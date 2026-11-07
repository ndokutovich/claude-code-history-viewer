//! Sub-agent transcript discovery (prerequisite for upstream #99b2ec7d).
//!
//! Claude Code stores a sub-agent's transcript next to its parent session, in
//! `<session-uuid>/subagents/`. Dynamic Workflows add one level: their agents
//! live under `<session-uuid>/subagents/workflows/wf_*/agent-*.jsonl`.
//!
//! This module only *lists* those files — nothing is parsed for messages here,
//! and nothing outside the session's own folder is ever read.

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

impl SubagentKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Flat => "flat",
            Self::Workflow => "workflow",
        }
    }
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

/// Tauri command: list a session's sub-agent transcripts.
#[tauri::command]
pub async fn list_subagent_transcripts(
    session_path: String,
) -> Result<Vec<SubagentTranscript>, String> {
    if session_path.contains('\0') {
        return Err("SUBAGENTS_BAD_PATH: path contains null bytes".to_string());
    }
    let path = PathBuf::from(&session_path);
    if !path.is_absolute() {
        return Err("SUBAGENTS_BAD_PATH: path must be absolute".to_string());
    }
    Ok(list_transcripts(&path))
}

/// Serialize helper used by tests and callers that need the wire shape.
pub fn to_json(transcripts: &[SubagentTranscript]) -> Result<String, String> {
    serde_json::to_string(transcripts).map_err(|e| format!("SUBAGENTS_SERIALIZE: {e}"))
}

/// Stable kind label (`flat` / `workflow`) for logs and tests.
pub fn kind_label(kind: SubagentKind) -> &'static str {
    kind.as_str()
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
        assert_eq!(kind_label(found[0].kind), "workflow");
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
        let json = to_json(&transcripts).unwrap();
        assert!(json.contains("\"kind\":\"workflow\""));
        assert!(json.contains("\"workflow\":\"wf_1\""));
    }
}
