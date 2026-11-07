//! Sub-agent transcript discovery (prerequisite for upstream #99b2ec7d).
//!
//! Claude Code stores a sub-agent's transcript next to its parent session, in
//! `<session-uuid>/subagents/`. Dynamic Workflows add one level: their agents
//! live under `<session-uuid>/subagents/workflows/wf_*/agent-*.jsonl`.
//!
//! This module only *lists* those files — nothing is parsed for messages here,
//! and nothing outside the session's own folder is ever read.
//!
//! OpenCode has no sub-agent files: a Task run is a `session` row whose
//! `parent_id` points at its parent, addressed as `opencode://<project>/<id>`
//! (upstream #560).

use crate::commands::adapters::opencode::{
    get_opencode_base_path, is_safe_storage_id, load_child_sessions,
};
use crate::models::MessagePage;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

/// Where a sub-agent transcript came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SubagentKind {
    /// `<session>/subagents/<agent>.jsonl`
    Flat,
    /// `<session>/subagents/workflows/<wf>/agent-*.jsonl`
    Workflow,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubagentTranscript {
    /// File stem: the agent id, or `agent-<n>` for workflow agents.
    pub agent_id: String,
    /// Absolute path of the transcript file.
    pub path: String,
    pub kind: SubagentKind,
    /// Workflow directory name for [`SubagentKind::Workflow`] (`wf_…`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow: Option<String>,
}

/// Regular, non-symlink `.jsonl` file.
fn is_regular_jsonl(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str()) == Some("jsonl")
        && fs::symlink_metadata(path)
            .map(|meta| !meta.file_type().is_symlink() && meta.is_file())
            .unwrap_or(false)
}

fn collect_from_dir(dir: &Path, kind: SubagentKind, workflow: Option<&str>) -> Vec<SubagentTranscript> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };

    let mut found: Vec<SubagentTranscript> = entries
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .file_type()
                .map(|t| t.is_file() && !t.is_symlink())
                .unwrap_or(false)
        })
        .map(|entry| entry.path())
        .filter(|path| is_regular_jsonl(path))
        .map(|path| SubagentTranscript {
            agent_id: path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default(),
            path: path.to_string_lossy().to_string(),
            kind,
            workflow: workflow.map(str::to_string),
        })
        .collect();

    found.sort_by(|a, b| a.agent_id.cmp(&b.agent_id));
    found
}

/// List every sub-agent transcript belonging to `session_file`.
///
/// `session_file` is the session's `.jsonl`; its sibling folder (same stem)
/// holds the sub-agent data. Flat agents come first, then workflow agents
/// grouped by workflow directory.
pub fn list_transcripts(session_file: &Path) -> Vec<SubagentTranscript> {
    let Some(stem) = session_file.file_stem() else {
        return Vec::new();
    };
    let Some(parent) = session_file.parent() else {
        return Vec::new();
    };

    let subagents_root = parent.join(stem).join("subagents");
    if !subagents_root.is_dir() {
        return Vec::new();
    }

    let mut transcripts = collect_from_dir(&subagents_root, SubagentKind::Flat, None);

    let workflows_root = subagents_root.join("workflows");
    if let Ok(entries) = fs::read_dir(&workflows_root) {
        let mut workflow_dirs: Vec<PathBuf> = entries
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_type()
                    .map(|t| t.is_dir() && !t.is_symlink())
                    .unwrap_or(false)
            })
            .map(|entry| entry.path())
            .collect();
        workflow_dirs.sort();

        for dir in workflow_dirs {
            let workflow = dir
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_default();
            transcripts.extend(collect_from_dir(
                &dir,
                SubagentKind::Workflow,
                Some(&workflow),
            ));
        }
    }

    transcripts
}

/// `(project_id, session_id)` from an `opencode://` session id.
fn split_opencode_uri(uri: &str) -> Option<(String, String)> {
    let (project, session) = uri.strip_prefix("opencode://")?.split_once('/')?;
    if !is_safe_storage_id(project) || !is_safe_storage_id(session) {
        return None;
    }
    Some((project.to_string(), session.to_string()))
}

fn list_opencode_children(project_id: &str, parent_id: &str) -> Vec<SubagentTranscript> {
    let Some(base) = get_opencode_base_path() else {
        return Vec::new();
    };

    load_child_sessions(&base, parent_id)
        .into_iter()
        .map(|child| SubagentTranscript {
            agent_id: child.id.clone(),
            path: format!("opencode://{project_id}/{}", child.id),
            kind: SubagentKind::Flat,
            workflow: None,
        })
        .collect()
}

async fn load_opencode_child(
    project_id: &str,
    session_id: &str,
    offset: usize,
    limit: usize,
) -> Result<MessagePage, String> {
    let base = get_opencode_base_path()
        .ok_or_else(|| "OPENCODE_PATH_ERROR: OpenCode data directory not found".to_string())?;

    let messages = crate::commands::opencode::load_opencode_messages(
        base.to_string_lossy().to_string(),
        session_id.to_string(),
        Some(project_id.to_string()),
        None,
        offset,
        limit,
    )
    .await?;

    let fetched = messages.len();
    Ok(MessagePage {
        messages,
        total_count: offset + fetched,
        has_more: limit > 0 && fetched == limit,
        next_offset: offset + fetched,
    })
}

/// Tauri command: list a session's sub-agent transcripts.
#[tauri::command]
pub async fn list_subagent_transcripts(
    session_path: String,
) -> Result<Vec<SubagentTranscript>, String> {
    if session_path.contains('\0') {
        return Err("SUBAGENTS_BAD_PATH: path contains null bytes".to_string());
    }
    if session_path.starts_with("opencode://") {
        let (project_id, session_id) = split_opencode_uri(&session_path)
            .ok_or_else(|| "SUBAGENTS_BAD_PATH: malformed OpenCode session id".to_string())?;
        return Ok(list_opencode_children(&project_id, &session_id));
    }
    let path = PathBuf::from(&session_path);
    if !path.is_absolute() {
        return Err("SUBAGENTS_BAD_PATH: path must be absolute".to_string());
    }
    Ok(list_transcripts(&path))
}

/// Load a sub-agent transcript's messages for display.
///
/// The path must be an absolute `.jsonl` inside a `subagents` directory —
/// that keeps this command from becoming a general file reader — and the
/// file itself must not be a symlink.
#[tauri::command]
pub async fn load_subagent_messages(
    transcript_path: String,
    offset: usize,
    limit: usize,
) -> Result<crate::models::MessagePage, String> {
    if transcript_path.contains(char::from(0)) {
        return Err("SUBAGENTS_BAD_PATH: path contains null bytes".to_string());
    }
    if transcript_path.starts_with("opencode://") {
        let (project_id, session_id) = split_opencode_uri(&transcript_path)
            .ok_or_else(|| "SUBAGENTS_BAD_PATH: malformed OpenCode session id".to_string())?;
        return load_opencode_child(&project_id, &session_id, offset, limit).await;
    }
    let path = PathBuf::from(&transcript_path);
    if !path.is_absolute() {
        return Err("SUBAGENTS_BAD_PATH: path must be absolute".to_string());
    }
    if !path
        .components()
        .any(|component| component.as_os_str() == "subagents")
    {
        return Err(
            "SUBAGENTS_BAD_PATH: transcript must live inside a subagents directory".to_string(),
        );
    }
    if !is_regular_jsonl(&path) {
        return Err(
            "SUBAGENTS_BAD_PATH: transcript must be a regular .jsonl file".to_string(),
        );
    }

    crate::commands::session::load_session_messages_paginated(
        transcript_path,
        offset,
        limit,
        Some(false),
        Some(false),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_session(root: &Path) -> PathBuf {
        let session = root.join("11111111-1111-1111-1111-111111111111.jsonl");
        fs::write(&session, "{}\n").unwrap();
        session
    }

    #[test]
    fn returns_nothing_without_a_subagents_folder() {
        let dir = tempfile::tempdir().unwrap();
        let session = make_session(dir.path());
        assert!(list_transcripts(&session).is_empty());
    }

    #[test]
    fn lists_flat_agents() {
        let dir = tempfile::tempdir().unwrap();
        let session = make_session(dir.path());
        let subagents = dir
            .path()
            .join("11111111-1111-1111-1111-111111111111")
            .join("subagents");
        fs::create_dir_all(&subagents).unwrap();
        fs::write(subagents.join("agent-a.jsonl"), "{}\n").unwrap();
        fs::write(subagents.join("agent-b.jsonl"), "{}\n").unwrap();
        fs::write(subagents.join("meta.json"), "{}").unwrap();

        let found = list_transcripts(&session);
        let ids: Vec<&str> = found.iter().map(|t| t.agent_id.as_str()).collect();
        assert_eq!(ids, vec!["agent-a", "agent-b"]);
        assert!(found.iter().all(|t| t.kind == SubagentKind::Flat));
    }

    #[test]
    fn lists_workflow_agents_with_their_workflow_name() {
        let dir = tempfile::tempdir().unwrap();
        let session = make_session(dir.path());
        let workflow_dir = dir
            .path()
            .join("11111111-1111-1111-1111-111111111111")
            .join("subagents")
            .join("workflows")
            .join("wf_abc123");
        fs::create_dir_all(&workflow_dir).unwrap();
        fs::write(workflow_dir.join("agent-1.jsonl"), "{}\n").unwrap();
        fs::write(workflow_dir.join("agent-2.jsonl"), "{}\n").unwrap();

        let found = list_transcripts(&session);
        assert_eq!(found.len(), 2);
        assert!(found.iter().all(|t| t.kind == SubagentKind::Workflow));
        assert!(found.iter().all(|t| t.workflow.as_deref() == Some("wf_abc123")));
        assert_eq!(found[0].kind, SubagentKind::Workflow);
    }

    #[cfg(unix)]
    #[test]
    fn ignores_symlinked_transcripts() {
        let outside = tempfile::tempdir().unwrap();
        let real = outside.path().join("real.jsonl");
        fs::write(&real, "{}\n").unwrap();

        let dir = tempfile::tempdir().unwrap();
        let session = make_session(dir.path());
        let subagents = dir
            .path()
            .join("11111111-1111-1111-1111-111111111111")
            .join("subagents");
        fs::create_dir_all(&subagents).unwrap();
        std::os::unix::fs::symlink(&real, subagents.join("linked.jsonl")).unwrap();

        assert!(list_transcripts(&session).is_empty());
    }

    #[tokio::test]
    async fn command_rejects_a_relative_path() {
        let err = list_subagent_transcripts("relative/session.jsonl".to_string())
            .await
            .expect_err("relative path is refused");
        assert!(err.contains("must be absolute"), "got: {err}");
    }

    #[test]
    fn serializes_the_wire_shape() {
        let transcripts = vec![SubagentTranscript {
            agent_id: "agent-1".to_string(),
            path: "C:/x/agent-1.jsonl".to_string(),
            kind: SubagentKind::Workflow,
            workflow: Some("wf_1".to_string()),
        }];
        let json = serde_json::to_string(&transcripts).unwrap();
        assert!(json.contains("\"kind\":\"workflow\""));
        assert!(json.contains("\"workflow\":\"wf_1\""));
    }
    #[tokio::test]
    async fn load_rejects_a_path_outside_subagents() {
        let dir = tempfile::tempdir().unwrap();
        let plain = dir.path().join("session.jsonl");
        fs::write(&plain, "{}
").unwrap();

        let err = load_subagent_messages(plain.to_string_lossy().to_string(), 0, 10)
            .await
            .expect_err("a file outside subagents is refused");
        assert!(err.contains("inside a subagents directory"), "got: {err}");
    }

    #[tokio::test]
    async fn load_rejects_a_relative_path() {
        let err = load_subagent_messages("subagents/agent-1.jsonl".to_string(), 0, 10)
            .await
            .expect_err("relative path is refused");
        assert!(err.contains("must be absolute"), "got: {err}");
    }

    #[tokio::test]
    async fn load_rejects_a_symlink_inside_subagents() {
        let outside = tempfile::tempdir().unwrap();
        let real = outside.path().join("real.jsonl");
        fs::write(&real, "{}
").unwrap();

        let dir = tempfile::tempdir().unwrap();
        let subagents = dir.path().join("subagents");
        fs::create_dir_all(&subagents).unwrap();
        let link = subagents.join("agent-link.jsonl");

        // Symlinks need elevation on Windows; skip there rather than fail.
        if std::os::windows::fs::symlink_file(&real, &link).is_err() {
            return;
        }

        let err = load_subagent_messages(link.to_string_lossy().to_string(), 0, 10)
            .await
            .expect_err("symlinked transcript is refused");
        assert!(err.contains("regular .jsonl"), "got: {err}");
    }

}
