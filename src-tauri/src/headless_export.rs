//! Headless session export (upstream #413).
//!
//! `--export <uuid|/abs/path.jsonl> [--format json|markdown] [--output <file>]`
//! renders one session without launching the GUI, writes to `--output` or
//! stdout, then exits. Session ids resolve under `~/.claude/projects`; an
//! ambiguous prefix is an error rather than a guess.

use std::fs;
use std::path::{Path, PathBuf};

use crate::cli::{extract_flag_value, is_uuid_like, looks_like_abs_path};

/// Output shape for the exported session.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFormat {
    Json,
    Markdown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportRequest {
    /// Session id (uuid prefix) or an absolute `.jsonl` path.
    pub session: String,
    pub format: ExportFormat,
    pub output: Option<PathBuf>,
}

/// Parse `--export`-family flags. `None` means "no export requested, start the
/// GUI". `Some(Err(..))` means the flags were given but are unusable — the
/// caller prints the message and exits non-zero instead of opening a window.
#[must_use]
pub fn parse_export_request(args: &[String]) -> Option<Result<ExportRequest, String>> {
    let session = extract_flag_value(args, "--export")?;

    if !is_uuid_like(&session) && !looks_like_abs_path(&session) {
        return Some(Err(format!(
            "EXPORT_BAD_SESSION: expected a session id or an absolute .jsonl path, got '{session}'"
        )));
    }

    let format = match extract_flag_value(args, "--format").as_deref() {
        None | Some("json") => ExportFormat::Json,
        Some("markdown") | Some("md") => ExportFormat::Markdown,
        Some(other) => {
            return Some(Err(format!(
                "EXPORT_BAD_FORMAT: expected json or markdown, got '{other}'"
            )))
        }
    };

    let output = match extract_flag_value(args, "--output") {
        None => None,
        Some(raw) => {
            let path = PathBuf::from(&raw);
            if !path.is_absolute() {
                return Some(Err(format!(
                    "EXPORT_BAD_OUTPUT: --output must be an absolute path, got '{raw}'"
                )));
            }
            Some(path)
        }
    };

    Some(Ok(ExportRequest {
        session,
        format,
        output,
    }))
}

/// Resolve a session argument to a `.jsonl` path.
///
/// Absolute paths are used as-is (must exist and end in `.jsonl`). Ids are
/// matched as an exact or prefix match on the file stem across every project
/// folder; zero or several matches are errors.
pub fn resolve_session_file(
    session: &str,
    projects_root: &Path,
) -> Result<PathBuf, String> {
    if session.ends_with(".jsonl") && looks_like_abs_path(session) {
        let path = PathBuf::from(session);
        return if path.is_file() {
            Ok(path)
        } else {
            Err(format!("EXPORT_NOT_FOUND: no such file: {}", path.display()))
        };
    }

    let mut matches: Vec<PathBuf> = Vec::new();
    let entries = fs::read_dir(projects_root)
        .map_err(|e| format!("EXPORT_READ_ERROR: cannot read {}: {e}", projects_root.display()))?;

    for project in entries.filter_map(Result::ok) {
        if !project.path().is_dir() {
            continue;
        }
        let Ok(files) = fs::read_dir(project.path()) else {
            continue;
        };
        for file in files.filter_map(Result::ok) {
            let path = file.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue;
            }
            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or_default();
            if stem == session || stem.starts_with(session) {
                matches.push(path);
            }
        }
    }

    match matches.len() {
        0 => Err(format!("EXPORT_NOT_FOUND: no session matches '{session}'")),
        1 => Ok(matches.remove(0)),
        count => Err(format!(
            "EXPORT_AMBIGUOUS: {count} sessions match '{session}' — use the full id or a path"
        )),
    }
}

/// Render one universal message as Markdown.
fn message_to_markdown(message: &crate::models::universal::UniversalMessage) -> String {
    let role = match message.role {
        crate::models::universal::MessageRole::User => "User",
        crate::models::universal::MessageRole::Assistant => "Assistant",
        crate::models::universal::MessageRole::System => "System",
        crate::models::universal::MessageRole::Function => "Tool",
    };

    let mut body = String::new();
    for block in &message.content {
        if let Some(text) = block.data.get("text").and_then(|v| v.as_str()) {
            body.push_str(text);
            body.push_str("\n\n");
        }
    }
    if let Some(calls) = &message.tool_calls {
        for call in calls {
            body.push_str(&format!("> tool: `{}`\n\n", call.name));
        }
    }
    if body.trim().is_empty() {
        return String::new();
    }

    format!("## {role} · {}\n\n{body}", message.timestamp)
}

/// Serialize a session's messages in the requested format.
pub fn render_messages(
    messages: &[crate::models::universal::UniversalMessage],
    format: ExportFormat,
) -> Result<String, String> {
    match format {
        ExportFormat::Json => serde_json::to_string_pretty(messages)
            .map_err(|e| format!("EXPORT_WRITE_ERROR: cannot serialize messages: {e}")),
        ExportFormat::Markdown => Ok(messages
            .iter()
            .map(message_to_markdown)
            .filter(|section| !section.is_empty())
            .collect::<Vec<_>>()
            .join("\n")),
    }
}

/// Page size used while reading a session; large sessions are streamed in
/// chunks so the export never needs the whole transcript in memory at once.
const EXPORT_PAGE_SIZE: usize = 500;

/// Execute a parsed export request: resolve, load, render, write, exit.
pub async fn run_export(request: ExportRequest) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("EXPORT_HOME_ERROR: cannot determine home directory")?;
    let projects_root = home.join(".claude").join("projects");
    let session_file = resolve_session_file(&request.session, &projects_root)?;

    let mut all = Vec::new();
    let mut offset = 0usize;
    loop {
        let page = crate::commands::session::load_session_messages_paginated(
            session_file.to_string_lossy().to_string(),
            offset,
            EXPORT_PAGE_SIZE,
            Some(false),
            Some(false),
        )
        .await?;

        let received = page.messages.len();
        all.extend(page.messages);
        if !page.has_more || received == 0 {
            break;
        }
        offset += received;
    }

    let rendered = render_messages(&all, request.format)?;

    match request.output {
        Some(path) => {
            fs::write(&path, rendered)
                .map_err(|e| format!("EXPORT_WRITE_ERROR: cannot write {}: {e}", path.display()))?;
            eprintln!("exported {} message(s) to {}", all.len(), path.display());
        }
        None => println!("{rendered}"),
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| v.to_string()).collect()
    }

    #[test]
    fn no_export_flag_means_gui_mode() {
        assert!(parse_export_request(&args(&["app"])).is_none());
        assert!(parse_export_request(&args(&["app", "--session", "abc"])).is_none());
    }

    #[test]
    fn parses_a_minimal_request() {
        let request = parse_export_request(&args(&["app", "--export", "abc12345"]))
            .expect("some")
            .expect("ok");
        assert_eq!(request.session, "abc12345");
        assert_eq!(request.format, ExportFormat::Json);
        assert_eq!(request.output, None);
    }

    #[test]
    fn parses_format_and_output() {
        let request = parse_export_request(&args(&[
            "app",
            "--export=abc12345",
            "--format",
            "markdown",
            "--output",
            "C:/tmp/out.md",
        ]))
        .expect("some")
        .expect("ok");
        assert_eq!(request.format, ExportFormat::Markdown);
        assert_eq!(
            request.output,
            Some(PathBuf::from("C:/tmp/out.md"))
        );
    }

    #[test]
    fn rejects_a_relative_output_path() {
        let err = parse_export_request(&args(&[
            "app",
            "--export",
            "abc12345",
            "--output",
            "out.json",
        ]))
        .expect("some")
        .expect_err("relative output is refused");
        assert!(err.contains("EXPORT_BAD_OUTPUT"), "got: {err}");
    }

    #[test]
    fn rejects_an_unknown_format() {
        let err = parse_export_request(&args(&[
            "app", "--export", "abc12345", "--format", "pdf",
        ]))
        .expect("some")
        .expect_err("unknown format is refused");
        assert!(err.contains("EXPORT_BAD_FORMAT"), "got: {err}");
    }

    #[test]
    fn resolves_a_path_and_reports_a_missing_one() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("11111111-1111-1111-1111-111111111111.jsonl");
        fs::write(&file, "{}\n").unwrap();

        let resolved = resolve_session_file(&file.to_string_lossy(), dir.path()).unwrap();
        assert_eq!(resolved, file);

        let missing = dir.path().join("missing.jsonl");
        assert!(resolve_session_file(&missing.to_string_lossy(), dir.path()).is_err());
    }

    #[test]
    fn resolves_an_id_prefix_and_reports_ambiguity() {
        let dir = tempfile::tempdir().unwrap();
        let project = dir.path().join("proj");
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("abcdef01-0000.jsonl"), "{}\n").unwrap();

        let resolved = resolve_session_file("abcdef01", dir.path()).unwrap();
        assert!(resolved.ends_with("abcdef01-0000.jsonl"));

        fs::write(project.join("abcdef02-0000.jsonl"), "{}\n").unwrap();
        let err = resolve_session_file("abcdef", dir.path()).unwrap_err();
        assert!(err.contains("EXPORT_AMBIGUOUS"), "got: {err}");
    }
}
