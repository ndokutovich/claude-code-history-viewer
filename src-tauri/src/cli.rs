//! CLI argument parsing for the desktop binary.
//!
//! Supports launching the viewer pointed at a specific session:
//!
//! ```text
//! claude-code-history-viewer --session <uuid|uuid-prefix|abs-path>
//! ```
//!
//! The resolved [`SessionHint`] is exposed to the frontend two ways:
//! 1. On first launch, via the `get_startup_session_hint` Tauri command.
//! 2. On a single-instance re-invocation (a second launch while one is already
//!    running), via the `cli-session-hint` event emitted from `lib.rs`.
//!
//! The frontend then resolves the hint to a concrete session (using the
//! `resolve_session_by_id` command for UUID hints) and navigates to it, opening
//! a picker modal when a prefix matches more than one session.

use serde::Serialize;
use tauri::State;

/// Newtype wrapper so the optional hint can be passed through Tauri's
/// type-keyed managed-state API without colliding with another `Option<T>`.
#[derive(Default)]
pub struct StartupSessionHint(pub Option<SessionHint>);

/// Tauri command returning the CLI-supplied session hint, if any.
///
/// The frontend calls this on mount after projects have loaded; `None` means
/// "no preload requested, run the normal UI".
#[tauri::command]
pub fn get_startup_session_hint(state: State<'_, StartupSessionHint>) -> Option<SessionHint> {
    state.0.clone()
}

/// A CLI-supplied hint asking the frontend to preload a specific session.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionHint {
    /// How the frontend should interpret `value`.
    pub kind: SessionHintKind,
    /// The raw value supplied on the command line.
    pub value: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionHintKind {
    /// Full UUID or UUID prefix (hex + dash, 8..=36 chars).
    Uuid,
    /// Absolute filesystem path to a session file.
    Path,
}

/// Parse the `--session <value>` flag from a raw argv vector.
///
/// Returns `None` when the flag is absent or its value cannot be classified as
/// a UUID(-prefix) or an absolute path. A malformed value is rejected outright
/// rather than guessed — the launch then proceeds as if no flag was passed.
#[must_use]
pub fn parse_session_hint(args: &[String]) -> Option<SessionHint> {
    let raw = extract_flag_value(args, "--session")?;
    classify_session_value(raw)
}

/// Classify a `--session <value>` argument as a UUID hint or a Path hint.
fn classify_session_value(value: String) -> Option<SessionHint> {
    if is_uuid_like(&value) {
        return Some(SessionHint {
            kind: SessionHintKind::Uuid,
            value,
        });
    }
    if looks_like_abs_path(&value) {
        return Some(SessionHint {
            kind: SessionHintKind::Path,
            value,
        });
    }
    None
}

/// Extract the value following `flag`, supporting both `--flag value` and
/// `--flag=value` forms.
///
/// Returns `None` when: the flag is absent, the `=` form has an empty value,
/// the space form is at end-of-argv, or the following token is itself a flag
/// (begins with `--`).
#[must_use]
pub fn extract_flag_value(args: &[String], flag: &str) -> Option<String> {
    let eq_prefix = format!("{flag}=");
    let mut iter = args.iter();
    while let Some(arg) = iter.next() {
        if let Some(rest) = arg.strip_prefix(&eq_prefix) {
            if rest.is_empty() {
                return None;
            }
            return Some(rest.to_string());
        }
        if arg == flag {
            let next = iter.next()?;
            if next.starts_with("--") {
                return None;
            }
            return Some(next.clone());
        }
    }
    None
}

/// A canonical UUID is 36 chars with dashes; a prefix is any 8..=36 char slice.
/// We accept anything that is hex-or-dash of length 8..=36.
#[must_use]
pub fn is_uuid_like(value: &str) -> bool {
    let len = value.len();
    if !(8..=36).contains(&len) {
        return false;
    }
    value.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

/// Core resolver predicate (pure, unit-tested): does `candidate` satisfy the
/// session `query`?
///
/// - Exact, case-insensitive match always wins.
/// - A prefix match is accepted only when the query is at least 8 chars long,
///   so a short fragment cannot accidentally match unrelated sessions.
#[must_use]
pub fn session_id_matches(candidate: &str, query: &str) -> bool {
    if candidate.is_empty() || query.is_empty() {
        return false;
    }
    let candidate = candidate.to_ascii_lowercase();
    let query = query.to_ascii_lowercase();
    if candidate == query {
        return true;
    }
    query.len() >= 8 && candidate.starts_with(&query)
}

/// Heuristic absolute-path detection for Unix and Windows.
/// Unix: starts with `/`. Windows: drive-letter (`C:\`/`C:/`) or UNC (`\\`).
fn looks_like_abs_path(value: &str) -> bool {
    if value.starts_with('/') || value.starts_with("\\\\") {
        return true;
    }
    let bytes = value.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
}

/// Build a [`SessionHint`] from a URL delivered via Apple Events on macOS
/// (Spotlight / Finder "Open With"). Supported shapes:
/// - `file:///abs/path/session.jsonl` → `Path` hint
/// - `claude-code-history-viewer://session/<uuid>` → `Uuid` hint
///
/// Returns `None` for any malformed or unsupported URL; the `RunEvent::Opened`
/// handler must never panic. Only compiled where it is actually used.
#[cfg(any(target_os = "macos", test))]
#[must_use]
pub fn parse_session_hint_from_url(url: &tauri::Url) -> Option<SessionHint> {
    match url.scheme() {
        "file" => {
            let path = url.to_file_path().ok()?;
            let s = path.to_string_lossy().into_owned();
            if s.is_empty() {
                return None;
            }
            Some(SessionHint {
                kind: SessionHintKind::Path,
                value: s,
            })
        }
        "claude-code-history-viewer" => {
            let host = url.host_str()?;
            let raw = url.path().trim_start_matches('/');
            if raw.is_empty() {
                return None;
            }
            let value = percent_decode(raw);
            match host {
                "session" if is_uuid_like(&value) => Some(SessionHint {
                    kind: SessionHintKind::Uuid,
                    value,
                }),
                _ => None,
            }
        }
        _ => None,
    }
}

/// Percent-decode a URL path segment (`%xx` escapes only).
///
/// Decodes into a `Vec<u8>` then `String::from_utf8` so multi-byte UTF-8
/// (Korean/Japanese/Chinese) survives. Does NOT convert `+` to space — that is
/// form-urlencoded, not path, semantics.
#[cfg(any(target_os = "macos", test))]
fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut buf = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(&input[i + 1..i + 3], 16) {
                buf.push(byte);
                i += 3;
                continue;
            }
        }
        buf.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(buf).unwrap_or_else(|_| input.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn argv(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| (*s).to_string()).collect()
    }

    // ----- parse_session_hint: UUID -----

    #[test]
    fn returns_none_when_no_flag_present() {
        assert!(parse_session_hint(&argv(&["app", "--serve"])).is_none());
    }

    #[test]
    fn parses_space_separated_uuid() {
        let hint =
            parse_session_hint(&argv(&["app", "--session", "1265cd74-caa9-472e-b343-c4f44b5cf12c"]))
                .expect("hint");
        assert_eq!(hint.kind, SessionHintKind::Uuid);
        assert_eq!(hint.value, "1265cd74-caa9-472e-b343-c4f44b5cf12c");
    }

    #[test]
    fn parses_equals_form() {
        let hint = parse_session_hint(&argv(&["app", "--session=1265cd74-caa9-472e-b343-c4f44b5cf12c"]))
            .expect("hint");
        assert_eq!(hint.value, "1265cd74-caa9-472e-b343-c4f44b5cf12c");
    }

    #[test]
    fn accepts_uuid_prefix() {
        let hint = parse_session_hint(&argv(&["app", "--session", "1265cd74"])).expect("hint");
        assert_eq!(hint.kind, SessionHintKind::Uuid);
        assert_eq!(hint.value, "1265cd74");
    }

    #[test]
    fn rejects_non_hex_non_path_value() {
        assert!(parse_session_hint(&argv(&["app", "--session", "hello-world-xyz"])).is_none());
    }

    #[test]
    fn rejects_too_short_value() {
        assert!(parse_session_hint(&argv(&["app", "--session", "1265cd7"])).is_none());
    }

    #[test]
    fn rejects_too_long_non_path_value() {
        assert!(parse_session_hint(&argv(&[
            "app",
            "--session",
            "1265cd74-caa9-472e-b343-c4f44b5cf12c-extra"
        ]))
        .is_none());
    }

    #[test]
    fn returns_none_when_value_is_another_flag() {
        assert!(parse_session_hint(&argv(&["app", "--session", "--serve"])).is_none());
    }

    #[test]
    fn returns_none_when_flag_has_no_following_arg() {
        assert!(parse_session_hint(&argv(&["app", "--session"])).is_none());
    }

    #[test]
    fn returns_none_when_equals_form_empty() {
        assert!(parse_session_hint(&argv(&["app", "--session="])).is_none());
    }

    // ----- parse_session_hint: Path -----

    #[test]
    fn parses_abs_unix_path() {
        let hint = parse_session_hint(&argv(&[
            "app",
            "--session",
            "/Users/jack/.claude/projects/demo/abc.jsonl",
        ]))
        .expect("hint");
        assert_eq!(hint.kind, SessionHintKind::Path);
    }

    #[test]
    fn parses_windows_backslash_path() {
        let hint = parse_session_hint(&argv(&[
            "app",
            "--session",
            "C:\\Users\\jack\\.claude\\projects\\demo\\abc.jsonl",
        ]))
        .expect("hint");
        assert_eq!(hint.kind, SessionHintKind::Path);
    }

    #[test]
    fn parses_windows_forwardslash_path() {
        let hint =
            parse_session_hint(&argv(&["app", "--session", "C:/Users/jack/session.jsonl"]))
                .expect("hint");
        assert_eq!(hint.kind, SessionHintKind::Path);
    }

    #[test]
    fn parses_unc_path() {
        let hint =
            parse_session_hint(&argv(&["app", "--session", "\\\\server\\share\\s.jsonl"]))
                .expect("hint");
        assert_eq!(hint.kind, SessionHintKind::Path);
    }

    #[test]
    fn rejects_relative_path() {
        assert!(parse_session_hint(&argv(&["app", "--session", "demo/session.jsonl"])).is_none());
    }

    // ----- session_id_matches (resolver core) -----

    #[test]
    fn matches_exact_case_insensitive() {
        assert!(session_id_matches(
            "1265CD74-CAA9-472E-B343-C4F44B5CF12C",
            "1265cd74-caa9-472e-b343-c4f44b5cf12c"
        ));
    }

    #[test]
    fn matches_long_prefix() {
        assert!(session_id_matches("1265cd74-caa9-472e", "1265cd74"));
    }

    #[test]
    fn rejects_short_prefix() {
        // 7-char prefix is below the 8-char threshold.
        assert!(!session_id_matches("1265cd74-caa9", "1265cd7"));
    }

    #[test]
    fn rejects_unrelated_candidate() {
        assert!(!session_id_matches("abcdef01-2345", "1265cd74"));
    }

    #[test]
    fn rejects_empty_inputs() {
        assert!(!session_id_matches("", "1265cd74"));
        assert!(!session_id_matches("1265cd74", ""));
    }

    // ----- parse_session_hint_from_url -----

    fn url(input: &str) -> tauri::Url {
        tauri::Url::parse(input).expect("valid test url")
    }

    #[test]
    fn parses_file_url_as_path_hint() {
        // `url::to_file_path()` is platform-specific: Windows requires a
        // drive-letter URL, Unix accepts a rooted path.
        #[cfg(windows)]
        {
            let hint =
                parse_session_hint_from_url(&url("file:///C:/Users/jack/abc.jsonl")).expect("hint");
            assert_eq!(hint.kind, SessionHintKind::Path);
            assert!(hint.value.ends_with("abc.jsonl"));
        }
        #[cfg(not(windows))]
        {
            let hint = parse_session_hint_from_url(&url(
                "file:///Users/jack/.claude/projects/demo/abc.jsonl",
            ))
            .expect("hint");
            assert_eq!(hint.kind, SessionHintKind::Path);
            assert_eq!(hint.value, "/Users/jack/.claude/projects/demo/abc.jsonl");
        }
    }

    #[test]
    fn parses_custom_scheme_uuid_url() {
        let hint = parse_session_hint_from_url(&url(
            "claude-code-history-viewer://session/1265cd74-caa9-472e-b343-c4f44b5cf12c",
        ))
        .expect("hint");
        assert_eq!(hint.kind, SessionHintKind::Uuid);
        assert_eq!(hint.value, "1265cd74-caa9-472e-b343-c4f44b5cf12c");
    }

    #[test]
    fn rejects_custom_scheme_bad_uuid() {
        assert!(parse_session_hint_from_url(&url(
            "claude-code-history-viewer://session/not-a-uuid"
        ))
        .is_none());
    }

    #[test]
    fn rejects_unknown_scheme() {
        assert!(parse_session_hint_from_url(&url("http://example.com/session/foo")).is_none());
    }

    #[test]
    fn percent_decode_preserves_utf8() {
        assert_eq!(percent_decode("%ED%95%9C%EA%B8%80"), "한글");
    }

    #[test]
    fn percent_decode_keeps_literal_plus() {
        assert_eq!(percent_decode("C%2B%2B"), "C++");
        assert_eq!(percent_decode("one+two"), "one+two");
    }
}
