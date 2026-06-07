// ============================================================================
// WSL SUPPORT (Windows only)
// ============================================================================
// Detects installed WSL distributions via the Windows registry and resolves
// AI-tool data directories inside them through UNC paths
// (`\\wsl.localhost\<distro>\...` with a `\\wsl$\<distro>\...` fallback).
//
// All Windows-specific code (registry + `wsl.exe` invocation) is gated behind
// `#[cfg(windows)]`. On other platforms every entry point is a no-op so the
// crate compiles unchanged.
//
// Path-construction and parsing helpers are platform-independent and unit
// tested without requiring a live WSL install.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

// ============================================================================
// TYPES
// ============================================================================

/// A detected WSL distribution with resolved AI-tool data directories.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WslDistro {
    /// Distribution name as registered with WSL (e.g. "Ubuntu", "Debian").
    pub name: String,
    /// Whether this is the default WSL distribution.
    pub is_default: bool,
    /// Resolved Linux home directory (e.g. "/home/user"), when discoverable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub home_path: Option<String>,
    /// UNC path to the distro's `~/.claude` directory, present only when it exists.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub claude_path: Option<String>,
    /// Every detected AI-tool data directory inside the distro (UNC paths).
    pub tools: Vec<WslToolDir>,
}

/// A single AI-tool data directory discovered inside a WSL distribution.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WslToolDir {
    /// Stable provider id matching the frontend adapters (e.g. "claude-code").
    pub provider_id: String,
    /// UNC path to the data directory inside the distro.
    pub path: String,
}

/// Linux-relative AI-tool data directories probed inside each distro.
/// `(provider_id, home-relative path)`.
const WSL_TOOL_DIRS: &[(&str, &str)] = &[
    ("claude-code", ".claude"),
    ("codex", ".codex"),
    ("gemini", ".gemini"),
    ("opencode", ".local/share/opencode"),
];

// ============================================================================
// PLATFORM-INDEPENDENT HELPERS (unit tested)
// ============================================================================

/// Convert a Linux path to `\\wsl.localhost\<distro>\<path>`.
pub fn build_unc_path(distro: &str, linux_path: &Path) -> PathBuf {
    let linux_str = linux_path.to_string_lossy().replace('/', "\\");
    let linux_str = linux_str.trim_start_matches('\\').to_string();
    PathBuf::from(format!(r"\\wsl.localhost\{distro}\{linux_str}"))
}

/// Fallback scheme: `\\wsl$\<distro>\<path>` (older Windows builds).
pub fn build_unc_path_fallback(distro: &str, linux_path: &Path) -> PathBuf {
    let linux_str = linux_path.to_string_lossy().replace('/', "\\");
    let linux_str = linux_str.trim_start_matches('\\').to_string();
    PathBuf::from(format!(r"\\wsl$\{distro}\{linux_str}"))
}

/// Reject distro names that could escape the UNC scheme or inject arguments.
pub fn is_valid_distro_name(distro: &str) -> bool {
    !distro.is_empty()
        && distro
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.' || c == ' ')
}

/// Sort distros: default first, then alphabetically by name. Pure helper so the
/// ordering can be tested without touching the registry.
pub fn sort_distros(distros: &mut [WslDistro]) {
    distros.sort_by(|a, b| {
        b.is_default
            .cmp(&a.is_default)
            .then_with(|| a.name.cmp(&b.name))
    });
}

// ============================================================================
// WINDOWS IMPLEMENTATION
// ============================================================================

#[cfg(windows)]
const LXSS_KEY: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Lxss";

/// Whether WSL appears to be installed (the Lxss registry key exists).
#[cfg(windows)]
pub fn is_wsl_available() -> bool {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    hkcu.open_subkey(LXSS_KEY).is_ok()
}

#[cfg(not(windows))]
pub fn is_wsl_available() -> bool {
    false
}

/// Enumerate raw `(name, is_default)` pairs from the Lxss registry key.
#[cfg(windows)]
fn enumerate_distros_raw() -> Vec<(String, bool)> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let lxss = match hkcu.open_subkey(LXSS_KEY) {
        Ok(key) => key,
        Err(_) => return Vec::new(),
    };

    let default_guid: String = lxss.get_value("DefaultDistribution").unwrap_or_default();
    let mut out = Vec::new();

    for subkey_name in lxss.enum_keys().filter_map(Result::ok) {
        let subkey = match lxss.open_subkey(&subkey_name) {
            Ok(k) => k,
            Err(_) => continue,
        };
        let name: String = match subkey.get_value("DistributionName") {
            Ok(n) => n,
            Err(_) => continue,
        };
        out.push((name, subkey_name == default_guid));
    }
    out
}

/// Resolve a distro's Linux `$HOME` by invoking `wsl.exe`.
#[cfg(windows)]
pub fn resolve_home_path(distro: &str) -> Result<PathBuf, String> {
    use std::process::Command;

    if !is_valid_distro_name(distro) {
        return Err(format!("Invalid distro name: {distro}"));
    }

    let output = Command::new("wsl")
        .args(["-d", distro, "-e", "sh", "-c", "echo $HOME"])
        .output()
        .map_err(|e| format!("Failed to run wsl command: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "WSL command failed for distro '{distro}': {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let home_str = String::from_utf8(output.stdout.clone())
        .or_else(|_| decode_utf16le(&output.stdout))
        .map_err(|e| format!("Failed to decode WSL output: {e}"))?;

    let home_str = home_str.trim();
    if home_str.is_empty() {
        return Err(format!("Empty home path for distro '{distro}'"));
    }
    Ok(PathBuf::from(home_str))
}

#[cfg(not(windows))]
pub fn resolve_home_path(_distro: &str) -> Result<PathBuf, String> {
    Err("WSL is only available on Windows".to_string())
}

/// `wsl.exe` frequently emits UTF-16LE; decode it (stripping an optional BOM).
#[cfg(windows)]
fn decode_utf16le(bytes: &[u8]) -> Result<String, String> {
    let bytes = if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE {
        &bytes[2..]
    } else {
        bytes
    };
    if bytes.len() % 2 != 0 {
        return Err("Odd byte count for UTF-16LE".to_string());
    }
    let u16s: Vec<u16> = bytes
        .chunks_exact(2)
        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
        .collect();
    String::from_utf16(&u16s)
        .map(|s| s.replace('\0', ""))
        .map_err(|e| format!("UTF-16LE decode error: {e}"))
}

/// Resolve an existing UNC path for `linux_path` inside `distro`, trying the
/// modern `\\wsl.localhost\` scheme first and falling back to `\\wsl$\`.
pub fn resolve_wsl_provider_path(distro: &str, linux_path: &Path) -> Option<PathBuf> {
    let primary = build_unc_path(distro, linux_path);
    if primary.exists() {
        return Some(primary);
    }
    let fallback = build_unc_path_fallback(distro, linux_path);
    if fallback.exists() {
        return Some(fallback);
    }
    None
}

/// Detect installed distros and probe each for AI-tool data directories.
#[cfg(windows)]
pub fn detect_distros() -> Vec<WslDistro> {
    let mut distros = Vec::new();

    for (name, is_default) in enumerate_distros_raw() {
        let home = resolve_home_path(&name).ok();

        let mut tools = Vec::new();
        let mut claude_path = None;

        if let Some(ref home_path) = home {
            for (provider_id, rel) in WSL_TOOL_DIRS {
                let linux_dir = home_path.join(rel);
                if let Some(unc) = resolve_wsl_provider_path(&name, &linux_dir) {
                    let unc_str = unc.to_string_lossy().to_string();
                    if *provider_id == "claude-code" {
                        claude_path = Some(unc_str.clone());
                    }
                    tools.push(WslToolDir {
                        provider_id: provider_id.to_string(),
                        path: unc_str,
                    });
                }
            }
        }

        distros.push(WslDistro {
            name,
            is_default,
            home_path: home.map(|p| p.to_string_lossy().to_string()),
            claude_path,
            tools,
        });
    }

    sort_distros(&mut distros);
    distros
}

#[cfg(not(windows))]
pub fn detect_distros() -> Vec<WslDistro> {
    Vec::new()
}

/// Resolve active (non-excluded) distros to `(distro_name, claude_unc_path)`
/// pairs whose `~/.claude` directory currently exists. Used by the
/// multi-provider scan/search to union WSL Claude directories.
pub fn resolve_active_claude_dirs(excluded: &[String]) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for distro in detect_distros() {
        if excluded.iter().any(|e| e == &distro.name) {
            continue;
        }
        if let Some(claude_path) = distro.claude_path {
            out.push((distro.name, claude_path));
        }
    }
    out
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Detect installed WSL distributions and their AI-tool data directories.
/// Returns an empty list on non-Windows platforms or when WSL is absent.
#[tauri::command]
pub async fn detect_wsl_distros() -> Result<Vec<WslDistro>, String> {
    Ok(detect_distros())
}

/// Whether WSL is available on this machine.
#[tauri::command]
pub async fn is_wsl_available_cmd() -> Result<bool, String> {
    Ok(is_wsl_available())
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_unc_path_converts_linux_path() {
        let result = build_unc_path("Ubuntu", Path::new("/home/user/.claude"));
        assert_eq!(
            result,
            PathBuf::from(r"\\wsl.localhost\Ubuntu\home\user\.claude")
        );
    }

    #[test]
    fn build_unc_path_fallback_uses_wsl_dollar() {
        let result = build_unc_path_fallback("Debian", Path::new("/home/dev/.codex"));
        assert_eq!(result, PathBuf::from(r"\\wsl$\Debian\home\dev\.codex"));
    }

    #[test]
    fn build_unc_path_handles_root_path() {
        let result = build_unc_path("Ubuntu", Path::new("/"));
        assert_eq!(result, PathBuf::from(r"\\wsl.localhost\Ubuntu\"));
    }

    #[test]
    fn build_unc_path_handles_nested_path() {
        let result = build_unc_path("Ubuntu", Path::new("/home/user/.local/share/opencode"));
        assert_eq!(
            result,
            PathBuf::from(r"\\wsl.localhost\Ubuntu\home\user\.local\share\opencode")
        );
    }

    #[test]
    fn distro_name_validation_accepts_common_names() {
        assert!(is_valid_distro_name("Ubuntu"));
        assert!(is_valid_distro_name("Ubuntu-22.04"));
        assert!(is_valid_distro_name("kali_linux"));
        assert!(is_valid_distro_name("openSUSE Leap 15.5"));
    }

    #[test]
    fn distro_name_validation_rejects_injection() {
        assert!(!is_valid_distro_name(""));
        assert!(!is_valid_distro_name("Ubuntu; rm -rf /"));
        assert!(!is_valid_distro_name("../../etc"));
        assert!(!is_valid_distro_name("a\\b"));
        assert!(!is_valid_distro_name("a/b"));
        assert!(!is_valid_distro_name("name&cmd"));
    }

    #[test]
    fn sort_distros_puts_default_first_then_alphabetical() {
        let mut distros = vec![
            WslDistro {
                name: "Ubuntu".into(),
                is_default: false,
                home_path: None,
                claude_path: None,
                tools: vec![],
            },
            WslDistro {
                name: "Alpine".into(),
                is_default: false,
                home_path: None,
                claude_path: None,
                tools: vec![],
            },
            WslDistro {
                name: "Debian".into(),
                is_default: true,
                home_path: None,
                claude_path: None,
                tools: vec![],
            },
        ];
        sort_distros(&mut distros);
        let order: Vec<&str> = distros.iter().map(|d| d.name.as_str()).collect();
        assert_eq!(order, vec!["Debian", "Alpine", "Ubuntu"]);
    }

    #[test]
    fn resolve_active_claude_dirs_respects_exclusions() {
        // Pure exclusion-filter behaviour verified via detect_distros, which is
        // empty on non-Windows / no-WSL machines. Excluding everything must
        // always yield an empty set regardless of platform.
        let result = resolve_active_claude_dirs(&["Ubuntu".to_string()]);
        assert!(result.iter().all(|(name, _)| name != "Ubuntu"));
    }

    #[test]
    fn is_wsl_available_returns_false_on_non_windows() {
        if !cfg!(windows) {
            assert!(!is_wsl_available());
        }
    }

    #[test]
    fn detect_distros_returns_empty_on_non_windows() {
        if !cfg!(windows) {
            assert!(detect_distros().is_empty());
        }
    }
}
