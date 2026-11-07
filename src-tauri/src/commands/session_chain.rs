//! Cross-file session chain resolution (upstream #496).
//!
//! Claude Code sometimes auto-continues a conversation that ran out of
//! context by starting a brand-new session file rather than compacting in
//! place: the new file's `compact_boundary` system event carries a
//! `logicalParentUuid` that points at the last message of the OLD file, not
//! at anything in the new one. The rest of the app (session list, message
//! loading) only ever looks at one file at a time, so the earlier half of
//! the conversation was invisible even though it's still on disk.
//!
//! This module detects that dangling link and walks it backward to the
//! originating file(s), purely for display — nothing here writes anything.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::SystemTime;

/// Hard cap on chain hops; guards against a corrupted-uuid cycle. No real
/// Claude Code conversation chains this deep.
const MAX_CHAIN_HOPS: usize = 50;

/// Cheap fingerprint that changes when a session file is appended or
/// replaced. The directory snapshot also notices new/deleted candidates,
/// which matters when an orphaned boundary is completed later.
#[derive(Clone, Debug, PartialEq, Eq)]
struct FileSignature {
    len: u64,
    modified: Option<SystemTime>,
}

type ProjectSnapshot = Vec<(PathBuf, FileSignature)>;

#[derive(Clone)]
struct CachedChain {
    project_snapshot: ProjectSnapshot,
    chain: Vec<PathBuf>,
}

/// Resolved chains are cheap to recompute but not free (each hop scans every
/// `.jsonl` in the project dir once), and the same session is re-resolved on
/// every pagination page as the user scrolls. Cached for the process life,
/// keyed by the leaf file, invalidated when any candidate file changes.
static SESSION_CHAIN_CACHE: OnceLock<Mutex<HashMap<String, CachedChain>>> = OnceLock::new();

fn chain_cache() -> &'static Mutex<HashMap<String, CachedChain>> {
    SESSION_CHAIN_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Regular, non-symlink `.jsonl` file. Symlinks are never followed: neither
/// as chain predecessors nor as superseded candidates.
fn is_regular_jsonl(path: &Path) -> bool {
    if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
        return false;
    }
    fs::symlink_metadata(path)
        .map(|m| !m.file_type().is_symlink() && m.is_file())
        .unwrap_or(false)
}

fn file_signature(path: &Path) -> Option<FileSignature> {
    let metadata = fs::metadata(path).ok()?;
    Some(FileSignature {
        len: metadata.len(),
        modified: metadata.modified().ok(),
    })
}

fn project_snapshot(project_dir: &Path) -> Option<ProjectSnapshot> {
    let mut snapshot = Vec::new();
    for entry in fs::read_dir(project_dir).ok()? {
        let entry = entry.ok()?;
        let path = entry.path();
        if !is_regular_jsonl(&path) {
            continue;
        }
        snapshot.push((path.clone(), file_signature(&path)?));
    }
    snapshot.sort_unstable_by(|left, right| left.0.cmp(&right.0));
    Some(snapshot)
}

#[derive(serde::Deserialize)]
struct BoundaryClassifier {
    #[serde(rename = "type")]
    message_type: String,
    subtype: Option<String>,
    uuid: Option<String>,
    #[serde(rename = "logicalParentUuid")]
    logical_parent_uuid: Option<String>,
    #[serde(rename = "isSidechain")]
    is_sidechain: Option<bool>,
}

/// Scan a session file for the first `compact_boundary` event whose
/// `logicalParentUuid` is NOT among this file's own message uuids. That
/// absence marks "history starts abruptly here; the messages before it live
/// in a different file."
fn find_dangling_parent_uuid(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let reader = BufReader::new(file);

    let mut own_uuids: HashSet<String> = HashSet::new();
    let mut boundary_parents: Vec<String> = Vec::new();

    for line in reader.lines() {
        let Ok(line) = line else { continue };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(entry) = serde_json::from_str::<BoundaryClassifier>(trimmed) else {
            continue;
        };
        if let Some(uuid) = entry.uuid {
            own_uuids.insert(uuid);
        }
        if entry.message_type == "system" && entry.subtype.as_deref() == Some("compact_boundary") {
            if let Some(parent) = entry.logical_parent_uuid {
                boundary_parents.push(parent);
            }
        }
    }

    boundary_parents
        .into_iter()
        .find(|parent| !own_uuids.contains(parent))
}

/// Fast (non-JSON-parsing) containment check. A substring search is
/// sufficient: uuids are random v4 strings, so an accidental match elsewhere
/// in the file is not a realistic concern.
fn file_contains_uuid(path: &Path, target_uuid: &str) -> bool {
    let Ok(content) = fs::read(path) else {
        return false;
    };
    let needle = format!("\"uuid\":\"{target_uuid}\"");
    memchr_search(&content, needle.as_bytes())
}

/// `memchr::memmem` equivalent without the dependency: naive search is fine
/// for the file sizes involved (a few MB) and this is not a hot path.
fn memchr_search(haystack: &[u8], needle: &[u8]) -> bool {
    if needle.is_empty() || haystack.len() < needle.len() {
        return false;
    }
    haystack
        .windows(needle.len())
        .any(|window| window == needle)
}

/// Search the (flat) project directory for a session file containing a
/// message with `target_uuid`, skipping anything in `skip`. Only the project
/// root — a chain predecessor is always another top-level session file.
fn find_file_containing_uuid(
    project_dir: &Path,
    target_uuid: &str,
    skip: &HashSet<PathBuf>,
) -> Option<PathBuf> {
    let entries = fs::read_dir(project_dir).ok()?;
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if !is_regular_jsonl(&path) {
            continue;
        }
        if skip.contains(&path) {
            continue;
        }
        if file_contains_uuid(&path, target_uuid) {
            return Some(path);
        }
    }
    None
}

/// Whether the predecessor kept producing main-conversation turns after the
/// UUID referenced by a continuation boundary. True means the newer file is
/// a branch from the predecessor, not a replacement for it.
fn has_main_conversation_after_uuid(path: &Path, target_uuid: &str) -> bool {
    let Ok(file) = fs::File::open(path) else {
        return false;
    };
    let reader = BufReader::new(file);
    let mut found_target = false;

    for line in reader.lines() {
        let Ok(line) = line else { continue };
        let Ok(entry) = serde_json::from_str::<BoundaryClassifier>(line.trim()) else {
            continue;
        };

        if found_target
            && !entry.is_sidechain.unwrap_or(false)
            && matches!(entry.message_type.as_str(), "user" | "assistant")
        {
            return true;
        }

        if entry.uuid.as_deref() == Some(target_uuid) {
            found_target = true;
        }
    }

    false
}

/// Resolve the full chain of session files that make up one logical
/// conversation, oldest first, ending with `session_path` itself. For a
/// session with no cross-file continuation this is just `[session_path]`.
pub fn resolve_session_chain(session_path: &Path) -> Vec<PathBuf> {
    let key = session_path.to_string_lossy().to_string();
    let cached_snapshot = session_path.parent().and_then(project_snapshot);
    if let Some(snapshot) = cached_snapshot.as_ref() {
        if let Some(cached) = chain_cache()
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .get(&key)
        {
            if cached.project_snapshot == *snapshot {
                return cached.chain.clone();
            }
        }
    }

    let mut chain: Vec<PathBuf> = vec![session_path.to_path_buf()];
    let mut visited: HashSet<PathBuf> = HashSet::new();
    visited.insert(session_path.to_path_buf());

    let mut current = session_path.to_path_buf();
    for _ in 0..MAX_CHAIN_HOPS {
        let Some(parent_uuid) = find_dangling_parent_uuid(&current) else {
            break;
        };
        let Some(project_dir) = current.parent() else {
            break;
        };
        let Some(predecessor) = find_file_containing_uuid(project_dir, &parent_uuid, &visited)
        else {
            break;
        };
        chain.insert(0, predecessor.clone());
        visited.insert(predecessor.clone());
        current = predecessor;
    }

    if let Some(snapshot) = session_path.parent().and_then(project_snapshot) {
        chain_cache()
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .insert(
                key,
                CachedChain {
                    project_snapshot: snapshot,
                    chain: chain.clone(),
                },
            );
    }

    chain
}

/// Every file in `project_root` whose direct continuations already cover its
/// conversation history — safe to hide from the session list. A predecessor
/// stays visible when it kept receiving main-conversation turns after a
/// referenced branch point (it is a real fork parent, not a replaced stub).
pub fn superseded_chain_paths(project_root: &Path) -> HashSet<PathBuf> {
    let mut referenced_branch_points: HashMap<PathBuf, HashSet<String>> = HashMap::new();
    let Ok(entries) = fs::read_dir(project_root) else {
        return HashSet::new();
    };

    let paths: Vec<PathBuf> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| is_regular_jsonl(path))
        .collect();
    let dangling: Vec<(PathBuf, String)> = paths
        .iter()
        .filter_map(|path| find_dangling_parent_uuid(path).map(|uuid| (path.clone(), uuid)))
        .collect();

    for (path, parent_uuid) in dangling {
        let skip = HashSet::from([path]);
        let Some(predecessor) = find_file_containing_uuid(project_root, &parent_uuid, &skip) else {
            continue;
        };
        referenced_branch_points
            .entry(predecessor)
            .or_default()
            .insert(parent_uuid);
    }

    referenced_branch_points
        .into_iter()
        .filter_map(|(predecessor, parent_uuids)| {
            (!parent_uuids
                .iter()
                .any(|parent_uuid| has_main_conversation_after_uuid(&predecessor, parent_uuid)))
                .then_some(predecessor)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write_file(dir: &TempDir, name: &str, content: &str) -> PathBuf {
        let path = dir.path().join(name);
        fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn no_chain_for_a_normal_session() {
        let dir = TempDir::new().unwrap();
        let path = write_file(
            &dir,
            "a.jsonl",
            "{\"uuid\":\"u1\",\"type\":\"user\",\"sessionId\":\"s\",\"timestamp\":\"2026-01-01T00:00:00Z\",\"message\":{\"role\":\"user\",\"content\":\"hi\"}}\n",
        );
        let chain = resolve_session_chain(&path);
        assert_eq!(chain, vec![path]);
    }

    #[test]
    fn resolves_a_two_hop_chain() {
        let dir = TempDir::new().unwrap();
        let older = write_file(
            &dir,
            "older.jsonl",
            "{\"uuid\":\"tail-uuid\",\"type\":\"assistant\",\"message\":{\"role\":\"assistant\",\"content\":[]}}\n",
        );
        let newer = write_file(
            &dir,
            "newer.jsonl",
            concat!(
                "{\"type\":\"system\",\"subtype\":\"compact_boundary\",\"uuid\":\"boundary-1\",",
                "\"logicalParentUuid\":\"tail-uuid\"}\n",
                "{\"uuid\":\"u2\",\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":\"continuing\"}}\n",
            ),
        );

        let chain = resolve_session_chain(&newer);
        assert_eq!(chain, vec![older, newer]);
    }

    #[test]
    fn stops_when_the_parent_uuid_is_nowhere_to_be_found() {
        let dir = TempDir::new().unwrap();
        let newer = write_file(
            &dir,
            "orphan.jsonl",
            concat!(
                "{\"type\":\"system\",\"subtype\":\"compact_boundary\",\"uuid\":\"boundary-1\",",
                "\"logicalParentUuid\":\"missing-uuid\"}\n",
                "{\"uuid\":\"u2\",\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":\"hi\"}}\n",
            ),
        );

        let chain = resolve_session_chain(&newer);
        assert_eq!(chain, vec![newer]);
    }

    #[test]
    fn invalidates_cache_when_a_missing_predecessor_appears() {
        let dir = TempDir::new().unwrap();
        let newer = write_file(
            &dir,
            "newer.jsonl",
            concat!(
                "{\"type\":\"system\",\"subtype\":\"compact_boundary\",\"uuid\":\"boundary-1\",",
                "\"logicalParentUuid\":\"tail-uuid\"}\n",
                "{\"uuid\":\"u2\",\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":\"continuing\"}}\n",
            ),
        );

        assert_eq!(resolve_session_chain(&newer), vec![newer.clone()]);

        let older = write_file(
            &dir,
            "older.jsonl",
            "{\"uuid\":\"tail-uuid\",\"type\":\"assistant\",\"message\":{\"role\":\"assistant\",\"content\":[]}}\n",
        );

        assert_eq!(resolve_session_chain(&newer), vec![older, newer]);
    }

    #[test]
    fn stops_at_a_cycle_without_repeating_files() {
        let dir = TempDir::new().unwrap();
        let first = write_file(
            &dir,
            "first.jsonl",
            concat!(
                "{\"type\":\"system\",\"subtype\":\"compact_boundary\",\"uuid\":\"boundary-a\",",
                "\"logicalParentUuid\":\"uuid-b\"}\n",
                "{\"uuid\":\"uuid-a\",\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":\"a\"}}\n",
            ),
        );
        let second = write_file(
            &dir,
            "second.jsonl",
            concat!(
                "{\"type\":\"system\",\"subtype\":\"compact_boundary\",\"uuid\":\"boundary-b\",",
                "\"logicalParentUuid\":\"uuid-a\"}\n",
                "{\"uuid\":\"uuid-b\",\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":\"b\"}}\n",
            ),
        );

        assert_eq!(resolve_session_chain(&second), vec![first, second]);
    }

    #[test]
    fn respects_the_maximum_chain_hop_limit() {
        let dir = TempDir::new().unwrap();
        let mut paths = Vec::new();
        for index in 0..=MAX_CHAIN_HOPS {
            let boundary = if index == 0 {
                String::new()
            } else {
                format!(
                    "{{\"type\":\"system\",\"subtype\":\"compact_boundary\",\"uuid\":\"boundary-{index}\",\"logicalParentUuid\":\"uuid-{}\"}}\n",
                    index - 1
                )
            };
            let content = format!(
                "{boundary}{{\"uuid\":\"uuid-{index}\",\"type\":\"user\",\"message\":{{\"role\":\"user\",\"content\":\"{index}\"}}}}\n"
            );
            paths.push(write_file(&dir, &format!("chain-{index}.jsonl"), &content));
        }

        let chain = resolve_session_chain(paths.last().unwrap());
        assert_eq!(chain.len(), MAX_CHAIN_HOPS + 1);
    }

    #[test]
    fn superseded_paths_hides_only_non_leaf_files() {
        let dir = TempDir::new().unwrap();
        let older = write_file(
            &dir,
            "older.jsonl",
            "{\"uuid\":\"tail-uuid\",\"type\":\"assistant\",\"message\":{\"role\":\"assistant\",\"content\":[]}}\n",
        );
        let newer = write_file(
            &dir,
            "newer.jsonl",
            concat!(
                "{\"type\":\"system\",\"subtype\":\"compact_boundary\",\"uuid\":\"boundary-1\",",
                "\"logicalParentUuid\":\"tail-uuid\"}\n",
                "{\"uuid\":\"u2\",\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":\"continuing\"}}\n",
            ),
        );

        let superseded = superseded_chain_paths(dir.path());
        assert!(superseded.contains(&older), "got {superseded:?}");
        assert!(!superseded.contains(&newer));
    }
}
