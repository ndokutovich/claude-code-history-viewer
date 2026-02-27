use super::ProviderInfo;

/// Detect Gemini CLI installation
pub fn detect() -> Option<ProviderInfo> {
    let base_path = get_base_path()?;

    Some(ProviderInfo {
        id: "gemini".to_string(),
        display_name: "Gemini CLI".to_string(),
        base_path: base_path.clone(),
        is_available: std::path::Path::new(&base_path).join("tmp").exists(),
    })
}

/// Get the Gemini base path (~/.gemini)
pub fn get_base_path() -> Option<String> {
    let home = dirs::home_dir()?;
    let gemini_path = home.join(".gemini");
    if gemini_path.exists() {
        Some(gemini_path.to_string_lossy().to_string())
    } else {
        None
    }
}
