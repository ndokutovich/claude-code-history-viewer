pub fn extract_project_name(raw_project_name: &str) -> String {
    if raw_project_name.starts_with('-') {
        let parts: Vec<&str> = raw_project_name.splitn(4, '-').collect();
        if parts.len() == 4 {
            parts[3].to_string()
        } else {
            raw_project_name.to_string()
        }
    } else {
        raw_project_name.to_string()
    }
}

/// Estimate message count from file size (more accurate calculation)
pub fn estimate_message_count_from_size(file_size: u64) -> usize {
    // Average JSON message is 800-1200 bytes
    // Small files are treated as having at least 1 message
    ((file_size as f64 / 1000.0).ceil() as usize).max(1)
}

/// Extract clean session title by filtering out system preambles
/// Detects and removes common system instruction patterns
pub fn filter_preamble_from_title(text: &str) -> String {
    // Preamble detection patterns (case-insensitive)
    let preamble_markers = [
        "<user_instructions>",
        "<environment_context>",
        "<system_context>",
        "you are an expert",
        "you are a helpful",
        "you are tasked with",
        "as an ai assistant",
        "your role is to",
    ];

    let lower_text = text.to_lowercase();

    // Check if text starts with preamble markers
    for marker in &preamble_markers {
        if lower_text.starts_with(marker) {
            // Find where the preamble ends
            if let Some(end_tag_pos) = text.find('>') {
                // Skip past the closing tag
                let after_tag = &text[end_tag_pos + 1..].trim();
                if !after_tag.is_empty() {
                    return after_tag.to_string();
                }
            }
        }
    }

    // Check for XML-style system instructions
    if text.contains("<user_instructions>") {
        if let Some(end_pos) = text.find("</user_instructions>") {
            let after_instructions = text[end_pos + "</user_instructions>".len()..].trim();
            if !after_instructions.is_empty() {
                return after_instructions.to_string();
            }
        }
    }

    if text.contains("<environment_context>") {
        if let Some(end_pos) = text.find("</environment_context>") {
            let after_context = text[end_pos + "</environment_context>".len()..].trim();
            if !after_context.is_empty() {
                return after_context.to_string();
            }
        }
    }

    // If no preamble detected, return original text
    text.to_string()
}

/// Extract git branch from session metadata or tool outputs
/// Returns: (branch_name, commit_hash)
pub fn extract_git_info(
    metadata: &Option<serde_json::Value>,
    tool_outputs: &[String],
) -> (Option<String>, Option<String>) {
    let mut branch: Option<String> = None;
    let mut commit: Option<String> = None;

    // Priority 1: Check session metadata for git info
    if let Some(meta) = metadata {
        if let Some(git_obj) = meta.get("git") {
            branch = git_obj
                .get("branch")
                .and_then(|v| v.as_str())
                .map(String::from);

            commit = git_obj
                .get("commit_hash")
                .or(git_obj.get("commitHash"))
                .and_then(|v| v.as_str())
                .map(|s| s.chars().take(8).collect()); // Short hash
        }
    }

    // Priority 2: Parse from tool outputs (git status, git branch, etc.)
    if branch.is_none() {
        for output in tool_outputs {
            // Look for "On branch <name>" pattern
            if output.contains("On branch ") {
                if let Some(start) = output.find("On branch ") {
                    let after_marker = &output[start + "On branch ".len()..];
                    if let Some(newline) = after_marker.find('\n') {
                        branch = Some(after_marker[..newline].trim().to_string());
                    } else {
                        branch = Some(after_marker.trim().to_string());
                    }
                }
            }

            // Look for "* <branch>" pattern (git branch output)
            if branch.is_none() {
                for line in output.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("* ") {
                        branch = Some(trimmed[2..].trim().to_string());
                        break;
                    }
                }
            }
        }
    }

    (branch, commit)
}
