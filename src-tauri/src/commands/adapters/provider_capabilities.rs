// ============================================================================
// PROVIDER CAPABILITIES METADATA
// ============================================================================
// Defines which features each provider supports

/// Provider capability flags
#[derive(Debug, Clone)]
pub struct ProviderCapabilities {
    pub supports_resume: bool,
    pub resume_command_template: Option<String>, // e.g., "claude --resume {session_id}"
    pub cli_name: Option<String>,                // e.g., "claude", "codex"
    pub resume_type: ResumeType,                 // How this provider handles resume
}

#[derive(Debug, Clone, PartialEq)]
pub enum ResumeType {
    /// Direct CLI flag: claude --resume <id>
    DirectFlag,
    /// Open CLI in directory, user manually resumes
    OpenInDirectory,
    /// Interactive command to copy: /chat resume <tag>
    InteractiveCommand(String), // Template for the interactive command
}

impl ProviderCapabilities {
    /// Get capabilities for a specific provider
    pub fn for_provider(provider_id: &str) -> Self {
        match provider_id {
            "claude-code" => Self {
                supports_resume: true,
                resume_command_template: Some("claude --resume {session_id}".to_string()),
                cli_name: Some("claude".to_string()),
                resume_type: ResumeType::DirectFlag,
            },
            "codex" => Self {
                supports_resume: true,
                resume_command_template: Some("codex resume {session_id}".to_string()),
                cli_name: Some("codex".to_string()),
                resume_type: ResumeType::DirectFlag,
            },
            "gemini" => Self {
                supports_resume: true, // Open gemini in project dir, user can /chat resume
                // Shift+Click copies: /chat resume <session-id>
                resume_command_template: Some("gemini".to_string()), // Just open gemini CLI
                cli_name: Some("gemini".to_string()),
                resume_type: ResumeType::InteractiveCommand("/chat resume {session_id}".to_string()),
            },
            "cursor" => Self {
                supports_resume: true, // Cursor CLI supports session resumption
                // cursor . (opens Cursor in current directory)
                // Note: cursor-agent is not available on Windows
                resume_command_template: Some("cursor .".to_string()),
                cli_name: Some("cursor".to_string()),
                resume_type: ResumeType::OpenInDirectory,
            },
            _ => Self {
                supports_resume: false,
                resume_command_template: None,
                cli_name: None,
                resume_type: ResumeType::OpenInDirectory,
            },
        }
    }

    /// Build resume command for this provider
    pub fn build_resume_command(&self, session_id: &str) -> Option<String> {
        self.resume_command_template.as_ref().map(|template| {
            template.replace("{session_id}", session_id)
        })
    }

    /// Get the interactive command to copy (for Shift+Click)
    /// For providers like Gemini that need manual commands
    pub fn get_interactive_command(&self, session_id: &str) -> Option<String> {
        match &self.resume_type {
            ResumeType::InteractiveCommand(template) => {
                Some(template.replace("{session_id}", session_id))
            }
            _ => None,
        }
    }

    /// Check if this provider uses interactive commands (Shift+Click behavior differs)
    pub fn is_interactive(&self) -> bool {
        matches!(self.resume_type, ResumeType::InteractiveCommand(_))
    }
}
