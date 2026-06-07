use std::fs;
use std::path::Path;
use tauri::command;

/// Moves a Claude session's JSONL file and its associated folder
/// (subagents, tool-results) to the system trash.
///
/// For a session at `<dir>/<uuid>.jsonl`, also trashes `<dir>/<uuid>/` if it
/// exists. Validates that the target is an absolute, plain `.jsonl` file (not a
/// symlink) with a well-formed session ID before moving anything.
#[command]
pub async fn delete_session(file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);

    if !path.is_absolute() {
        return Err("Session path must be absolute".to_string());
    }

    if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
        return Err("Only .jsonl session files can be deleted".to_string());
    }

    let session_id = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Invalid session filename".to_string())?;

    if !session_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err("Invalid session ID format".to_string());
    }

    let metadata =
        fs::symlink_metadata(path).map_err(|_| format!("Session file not found: {file_path}"))?;

    if metadata.file_type().is_symlink() {
        return Err("Session file cannot be a symlink".to_string());
    }

    if !metadata.file_type().is_file() {
        return Err("Session target must be a regular .jsonl file".to_string());
    }

    // Trash the .jsonl first (authoritative artifact), then the associated folder.
    trash::delete(path).map_err(|e| format!("Failed to move session file to trash: {e}"))?;

    // Best-effort trash of the associated folder — don't fail if it can't be
    // trashed since the primary .jsonl file is already gone.
    let associated_dir = path.with_extension("");
    if let Ok(dir_meta) = fs::symlink_metadata(&associated_dir) {
        if !dir_meta.file_type().is_symlink() && dir_meta.is_dir() {
            let _ = trash::delete(&associated_dir);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    use std::os::unix::fs::symlink;
    use tempfile::TempDir;

    #[tokio::test]
    async fn reject_relative_path() {
        let err = delete_session("relative/path.jsonl".into())
            .await
            .unwrap_err();
        assert_eq!(err, "Session path must be absolute");
    }

    #[tokio::test]
    async fn reject_non_jsonl_extension() {
        let abs = if cfg!(windows) {
            r"C:\tmp\session.txt"
        } else {
            "/tmp/session.txt"
        };
        let err = delete_session(abs.into()).await.unwrap_err();
        assert_eq!(err, "Only .jsonl session files can be deleted");
    }

    #[tokio::test]
    async fn reject_session_id_with_dots() {
        let abs = if cfg!(windows) {
            r"C:\tmp\a..b.jsonl"
        } else {
            "/tmp/a..b.jsonl"
        };
        let err = delete_session(abs.into()).await.unwrap_err();
        assert_eq!(err, "Invalid session ID format");
    }

    #[tokio::test]
    async fn reject_session_id_with_spaces() {
        let abs = if cfg!(windows) {
            r"C:\tmp\bad name.jsonl"
        } else {
            "/tmp/bad name.jsonl"
        };
        let err = delete_session(abs.into()).await.unwrap_err();
        assert_eq!(err, "Invalid session ID format");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn reject_symlink() {
        let dir = TempDir::new().unwrap();
        let real_file = dir.path().join("real.jsonl");
        fs::write(&real_file, "{}").unwrap();

        let link_path = dir.path().join("link.jsonl");
        symlink(&real_file, &link_path).unwrap();

        let err = delete_session(link_path.to_string_lossy().into())
            .await
            .unwrap_err();
        assert_eq!(err, "Session file cannot be a symlink");
    }

    #[tokio::test]
    async fn reject_directory_target() {
        let dir = TempDir::new().unwrap();
        let subdir = dir.path().join("session.jsonl");
        fs::create_dir(&subdir).unwrap();

        let err = delete_session(subdir.to_string_lossy().into())
            .await
            .unwrap_err();
        assert_eq!(err, "Session target must be a regular .jsonl file");
    }

    #[tokio::test]
    async fn reject_missing_file() {
        let dir = TempDir::new().unwrap();
        let missing = dir.path().join("does-not-exist.jsonl");
        let err = delete_session(missing.to_string_lossy().into())
            .await
            .unwrap_err();
        assert!(err.starts_with("Session file not found"));
    }
}
