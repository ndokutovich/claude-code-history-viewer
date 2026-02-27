use super::ProviderInfo;
use std::path::PathBuf;

/// Detect Cursor IDE installation
pub fn detect() -> Option<ProviderInfo> {
    let base_path = get_base_path()?;

    Some(ProviderInfo {
        id: "cursor".to_string(),
        display_name: "Cursor IDE".to_string(),
        base_path: base_path.clone(),
        is_available: std::path::Path::new(&base_path).exists(),
    })
}

/// Get the Cursor base path (platform-specific)
pub fn get_base_path() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let cursor_path = PathBuf::from(appdata).join("Cursor");
            if cursor_path.exists() {
                return Some(cursor_path.to_string_lossy().to_string());
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir()?;
        let cursor_path = home
            .join("Library")
            .join("Application Support")
            .join("Cursor");
        if cursor_path.exists() {
            return Some(cursor_path.to_string_lossy().to_string());
        }
    }

    #[cfg(target_os = "linux")]
    {
        let home = dirs::home_dir()?;
        let cursor_path = home.join(".config").join("Cursor");
        if cursor_path.exists() {
            return Some(cursor_path.to_string_lossy().to_string());
        }
    }

    None
}
