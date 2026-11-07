//! One-click backup of every Claude project (upstream #411).
//!
//! Zips the whole `projects/` tree into a single archive the user chooses.
//! Read-only on the source side: nothing is moved, renamed or compacted.

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;

/// Outcome reported to the UI so the toast can say what actually happened.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSummary {
    pub archive_path: String,
    pub file_count: usize,
    pub total_bytes: u64,
}

/// Reject paths we must never write to or read from: relative paths and any
/// `..` traversal. The source is additionally canonicalised before use.
fn validate_absolute(raw: &str, what: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw);
    if !path.is_absolute() {
        return Err(format!("{what} must be an absolute path"));
    }
    if path
        .components()
        .any(|component| component == Component::ParentDir)
    {
        return Err(format!("{what} must not contain `..`"));
    }
    Ok(path)
}

/// Whether `candidate` lives inside `root` (both canonicalised by the caller).
fn is_inside(candidate: &Path, root: &Path) -> bool {
    candidate.starts_with(root)
}

/// Zip every file under `<claude_path>/projects` into `destination`.
///
/// Refuses to overwrite an existing archive, to write inside the source tree,
/// and skips symlinks so the backup cannot pull in files from outside the
/// history folder.
#[tauri::command]
pub async fn backup_claude_projects(
    claude_path: String,
    destination: String,
) -> Result<BackupSummary, String> {
    let claude_root = validate_absolute(&claude_path, "Claude folder")?;
    let destination = validate_absolute(&destination, "Backup destination")?;

    let projects = claude_root.join("projects");
    if !projects.is_dir() {
        return Err(format!(
            "BACKUP_NO_PROJECTS: no projects folder at {}",
            projects.display()
        ));
    }

    let canonical_source = fs::canonicalize(&projects)
        .map_err(|e| format!("BACKUP_SOURCE_ERROR: cannot resolve source: {e}"))?;

    let parent = destination
        .parent()
        .ok_or("BACKUP_DEST_ERROR: destination has no parent folder")?;
    if !parent.is_dir() {
        return Err(format!(
            "BACKUP_DEST_ERROR: destination folder does not exist: {}",
            parent.display()
        ));
    }

    // Canonicalise the destination's parent so the "inside the source" check
    // cannot be fooled by a symlinked path.
    let canonical_parent = fs::canonicalize(parent)
        .map_err(|e| format!("BACKUP_DEST_ERROR: cannot resolve destination: {e}"))?;
    let canonical_destination = canonical_parent.join(
        destination
            .file_name()
            .ok_or("BACKUP_DEST_ERROR: destination has no file name")?,
    );

    if is_inside(&canonical_destination, &canonical_source) {
        return Err(
            "BACKUP_DEST_ERROR: the archive must not be written inside the projects folder"
                .to_string(),
        );
    }
    if canonical_destination.exists() {
        return Err(format!(
            "BACKUP_EXISTS: {} already exists — choose another name",
            canonical_destination.display()
        ));
    }

    let file = fs::File::create(&canonical_destination)
        .map_err(|e| format!("BACKUP_WRITE_ERROR: cannot create archive: {e}"))?;
    let mut writer = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    let mut file_count = 0usize;
    let mut total_bytes = 0u64;

    for entry in WalkDir::new(&canonical_source)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let Ok(relative) = path.strip_prefix(&canonical_source) else {
            continue;
        };
        // Symlinked files are skipped: `follow_links(false)` covers directories,
        // this covers a symlink that is a direct child.
        if fs::symlink_metadata(path)
            .map(|meta| meta.file_type().is_symlink())
            .unwrap_or(true)
        {
            continue;
        }

        let name = relative.to_string_lossy().replace('\\', "/");
        writer
            .start_file(name.clone(), options)
            .map_err(|e| format!("BACKUP_WRITE_ERROR: cannot add {name}: {e}"))?;

        let content = fs::read(path)
            .map_err(|e| format!("BACKUP_READ_ERROR: cannot read {}: {e}", path.display()))?;
        writer
            .write_all(&content)
            .map_err(|e| format!("BACKUP_WRITE_ERROR: cannot write {name}: {e}"))?;

        file_count += 1;
        total_bytes += content.len() as u64;
    }

    writer
        .finish()
        .map_err(|e| format!("BACKUP_WRITE_ERROR: cannot finalise archive: {e}"))?;

    Ok(BackupSummary {
        archive_path: canonical_destination.to_string_lossy().to_string(),
        file_count,
        total_bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_claude_dir() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let project = dir.path().join("projects").join("proj-a");
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("s1.jsonl"), b"{\"uuid\":\"u1\"}\n").unwrap();
        fs::write(project.join("notes.txt"), b"hello").unwrap();
        dir
    }

    #[tokio::test]
    async fn backs_up_every_file_under_projects() {
        let claude = make_claude_dir();
        let out = tempfile::tempdir().unwrap();
        let dest = out.path().join("backup.zip");

        let summary = backup_claude_projects(
            claude.path().to_string_lossy().to_string(),
            dest.to_string_lossy().to_string(),
        )
        .await
        .expect("backup succeeds");

        assert_eq!(summary.file_count, 2);
        assert!(dest.is_file(), "archive written");

        let file = fs::File::open(&dest).unwrap();
        let mut zip = zip::ZipArchive::new(file).unwrap();
        let mut names: Vec<String> = (0..zip.len())
            .map(|i| zip.by_index(i).unwrap().name().to_string())
            .collect();
        names.sort();
        assert_eq!(names, vec!["proj-a/notes.txt", "proj-a/s1.jsonl"]);
    }

    #[tokio::test]
    async fn refuses_to_overwrite_an_existing_archive() {
        let claude = make_claude_dir();
        let out = tempfile::tempdir().unwrap();
        let dest = out.path().join("backup.zip");
        fs::write(&dest, b"already here").unwrap();

        let err = backup_claude_projects(
            claude.path().to_string_lossy().to_string(),
            dest.to_string_lossy().to_string(),
        )
        .await
        .expect_err("existing archive is not overwritten");
        assert!(err.contains("BACKUP_EXISTS"), "got: {err}");
        assert_eq!(fs::read(&dest).unwrap(), b"already here");
    }

    #[tokio::test]
    async fn refuses_a_destination_inside_the_projects_folder() {
        let claude = make_claude_dir();
        let dest = claude
            .path()
            .join("projects")
            .join("proj-a")
            .join("backup.zip");

        let err = backup_claude_projects(
            claude.path().to_string_lossy().to_string(),
            dest.to_string_lossy().to_string(),
        )
        .await
        .expect_err("writing into the source is refused");
        assert!(err.contains("must not be written inside"), "got: {err}");
        assert!(!dest.exists());
    }

    #[tokio::test]
    async fn refuses_a_relative_destination() {
        let claude = make_claude_dir();
        let err = backup_claude_projects(
            claude.path().to_string_lossy().to_string(),
            "backup.zip".to_string(),
        )
        .await
        .expect_err("relative destination is refused");
        assert!(err.contains("absolute"), "got: {err}");
    }

    #[tokio::test]
    async fn refuses_a_claude_folder_without_projects() {
        let empty = tempfile::tempdir().unwrap();
        let out = tempfile::tempdir().unwrap();
        let dest = out.path().join("backup.zip");

        let err = backup_claude_projects(
            empty.path().to_string_lossy().to_string(),
            dest.to_string_lossy().to_string(),
        )
        .await
        .expect_err("missing projects folder is reported");
        assert!(err.contains("BACKUP_NO_PROJECTS"), "got: {err}");
    }
}
