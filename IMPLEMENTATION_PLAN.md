# Comprehensive Implementation Plan
## Adding Gemini CLI, Codex CLI, and Agent Sessions Features

**Architecture Principles:**
- ✅ Backend (Rust) handles parsing and format conversion
- ✅ Frontend (TypeScript) handles orchestration and UI
- ✅ Clear separation of concerns (no backend logic in frontend)
- ✅ Follow existing adapter patterns (Claude Code, Cursor)
- ✅ Fail-fast validation, graceful error handling
- ✅ Incremental implementation with testing at each step

---

## Phase 1: Foundation & Quick Wins (Week 1)

### 1.1 Gemini CLI Adapter - Backend (Days 1-2)

**Files to Create:**

#### `src-tauri/src/commands/adapters/gemini.rs`

```rust
// ============================================================================
// GEMINI CLI ADAPTER
// ============================================================================
// Converts Gemini CLI JSON format to UniversalMessage
//
// File Location: ~/.gemini/tmp/**/session-*.json
// Format: Single JSON file per session (not JSONL!)
//
// Structure:
// {
//   "sessionId": "...",
//   "projectHash": "sha256-of-cwd",  // IMPORTANT: Used to resolve working directory
//   "startTime": "2025-01-01T00:00:00Z",
//   "lastUpdated": "2025-01-01T01:00:00Z",
//   "model": "gemini-1.5-pro",
//   "messages": [...]
// }

use crate::models::universal::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;
use sha2::{Sha256, Digest};

// ============================================================================
// GEMINI-SPECIFIC TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiSession {
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,

    #[serde(rename = "projectHash")]
    pub project_hash: Option<String>,

    #[serde(rename = "startTime")]
    pub start_time: Option<String>,

    #[serde(rename = "lastUpdated")]
    pub last_updated: Option<String>,

    pub model: Option<String>,

    pub messages: Option<Vec<Value>>,

    // Fallback: root array or history field
    pub history: Option<Vec<Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiMessage {
    #[serde(rename = "type")]
    pub message_type: Option<String>,

    pub role: Option<String>,

    pub content: Option<Value>,

    pub timestamp: Option<String>,

    pub id: Option<String>,

    pub uuid: Option<String>,

    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,

    pub model: Option<String>,

    // Tool calls
    pub name: Option<String>,
    pub tool: Option<String>,
    pub input: Option<Value>,
    pub output: Option<Value>,
}

// ============================================================================
// GEMINI HASH RESOLVER
// ============================================================================
// Maps projectHash (SHA-256) → actual working directory path
// Seeded from Claude Code / Cursor sessions for smart CWD resolution

pub struct GeminiHashResolver {
    map: HashMap<String, String>, // hash → cwd
}

impl GeminiHashResolver {
    pub fn new() -> Self {
        Self {
            map: HashMap::new(),
        }
    }

    /// Resolve projectHash to working directory
    pub fn resolve(&self, hash: &str) -> Option<String> {
        self.map.get(hash).cloned()
    }

    /// Register known CWD (from Claude Code or Cursor sessions)
    pub fn register(&mut self, cwd: &str) {
        let normalized = normalize_path(cwd);
        let hash = compute_sha256(&normalized);
        self.map.insert(hash, cwd.to_string());
    }

    /// Seed resolver with CWDs from other sessions
    pub fn seed_from_sessions(&mut self, sessions: &[UniversalSession]) {
        for session in sessions {
            if let Some(cwd) = session.metadata.get("cwd") {
                if let Some(cwd_str) = cwd.as_str() {
                    self.register(cwd_str);
                }
            }
        }
    }
}

fn normalize_path(path: &str) -> String {
    // Normalize path for consistent hashing
    path.replace("\\", "/").to_lowercase()
}

fn compute_sha256(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/// Convert Gemini session file to UniversalProject
///
/// Groups Gemini sessions by parent directory (project hash)
pub fn gemini_sessions_to_projects(
    gemini_root: &Path,
    source_id: String,
) -> Result<Vec<UniversalProject>, String> {
    // Find all session-*.json files
    let session_files = find_gemini_sessions(gemini_root)?;

    // Group by parent directory (each directory is a "project")
    let mut projects: HashMap<String, Vec<PathBuf>> = HashMap::new();

    for file in session_files {
        if let Some(parent) = file.parent() {
            let parent_str = parent.to_string_lossy().to_string();
            projects.entry(parent_str.clone()).or_insert_with(Vec::new).push(file);
        }
    }

    // Convert to UniversalProject
    let mut result = Vec::new();

    for (project_path, files) in projects {
        let project_name = Path::new(&project_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        // Try to extract projectHash from first file
        let mut project_hash = None;
        if let Some(first_file) = files.first() {
            if let Ok(content) = fs::read_to_string(first_file) {
                if let Ok(session) = serde_json::from_str::<GeminiSession>(&content) {
                    project_hash = session.project_hash.clone();
                }
            }
        }

        let project = UniversalProject {
            id: compute_sha256(&project_path),
            source_id: source_id.clone(),
            provider_id: "gemini".to_string(),
            name: project_name,
            path: project_path.clone(),
            session_count: files.len() as i32,
            total_messages: 0, // Will be calculated when sessions are loaded
            first_activity_at: None,
            last_activity_at: None,
            metadata: {
                let mut meta = HashMap::new();
                if let Some(hash) = project_hash {
                    meta.insert("project_hash".to_string(), json!(hash));
                }
                meta
            },
        };

        result.push(project);
    }

    Ok(result)
}

/// Convert Gemini session file to UniversalSession
pub fn gemini_file_to_session(
    file_path: &Path,
    project_id: String,
    source_id: String,
    resolver: &GeminiHashResolver,
) -> Result<UniversalSession, String> {
    // Read JSON file
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read Gemini session: {}", e))?;

    let session: GeminiSession = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse Gemini session: {}", e))?;

    // Extract messages array (with fallbacks)
    let messages = session.messages
        .or(session.history)
        .unwrap_or_else(Vec::new);

    let message_count = messages.len() as i32;

    // Extract title from first user message
    let title = extract_first_user_text(&messages)
        .unwrap_or_else(|| "Untitled Session".to_string());

    // Resolve CWD from projectHash
    let cwd = session.project_hash.as_ref()
        .and_then(|hash| resolver.resolve(hash));

    // Session metadata
    let mut metadata = HashMap::new();
    metadata.insert("file_path".to_string(), json!(file_path.to_string_lossy()));
    if let Some(ref hash) = session.project_hash {
        metadata.insert("project_hash".to_string(), json!(hash));
    }
    if let Some(ref cwd_path) = cwd {
        metadata.insert("cwd".to_string(), json!(cwd_path));
    }
    if let Some(ref model) = session.model {
        metadata.insert("model".to_string(), json!(model));
    }

    // File size
    let file_size = fs::metadata(file_path)
        .ok()
        .and_then(|m| Some(m.len() as i32));

    if let Some(size) = file_size {
        metadata.insert("file_size_bytes".to_string(), json!(size));
    }

    Ok(UniversalSession {
        id: compute_sha256(&file_path.to_string_lossy()),
        project_id,
        source_id,
        provider_id: "gemini".to_string(),
        title,
        message_count,
        first_message_at: session.start_time.clone(),
        last_message_at: session.last_updated.or(session.start_time),
        duration: None,
        total_tokens: None,
        tool_call_count: 0,
        error_count: 0,
        metadata,
        checksum: compute_sha256(&content),
    })
}

/// Convert Gemini message to UniversalMessage
pub fn gemini_message_to_universal(
    msg_value: &Value,
    session_id: String,
    project_id: String,
    source_id: String,
    sequence_number: i32,
) -> Result<UniversalMessage, String> {
    let msg: GeminiMessage = serde_json::from_value(msg_value.clone())
        .map_err(|e| format!("Failed to parse Gemini message: {}", e))?;

    // Determine role
    let role = determine_gemini_role(&msg);

    // Determine message type
    let message_type = determine_gemini_type(&msg);

    // Convert content
    let content = convert_gemini_content(&msg);

    // Convert tool calls
    let tool_calls = convert_gemini_tool_calls(&msg);

    // Build provider_metadata
    let mut provider_metadata = HashMap::new();
    provider_metadata.insert("original_type".to_string(), json!(msg.message_type));
    provider_metadata.insert("raw_content".to_string(), msg_value.clone());

    Ok(UniversalMessage {
        id: msg.id.or(msg.uuid).unwrap_or_else(|| format!("gemini-{}", sequence_number)),
        session_id,
        project_id,
        source_id,
        provider_id: "gemini".to_string(),
        timestamp: msg.timestamp.unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
        sequence_number,
        role,
        message_type,
        content,
        parent_id: msg.parent_id,
        depth: None,
        branch_id: None,
        model: msg.model,
        tokens: None, // Gemini doesn't expose token counts in session files
        tool_calls,
        thinking: None, // Gemini doesn't have thinking blocks
        attachments: None,
        errors: None,
        original_format: "gemini_json".to_string(),
        provider_metadata,
    })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn find_gemini_sessions(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut sessions = Vec::new();

    fn visit_dirs(dir: &Path, sessions: &mut Vec<PathBuf>) -> std::io::Result<()> {
        if dir.is_dir() {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_dir() {
                    visit_dirs(&path, sessions)?;
                } else if let Some(name) = path.file_name() {
                    if let Some(name_str) = name.to_str() {
                        if name_str.starts_with("session-") && name_str.ends_with(".json") {
                            sessions.push(path);
                        }
                    }
                }
            }
        }
        Ok(())
    }

    visit_dirs(root, &mut sessions)
        .map_err(|e| format!("Failed to scan Gemini sessions: {}", e))?;

    Ok(sessions)
}

fn extract_first_user_text(messages: &[Value]) -> Option<String> {
    for msg_value in messages {
        if let Ok(msg) = serde_json::from_value::<GeminiMessage>(msg_value.clone()) {
            let role_str = msg.role.as_deref().or(msg.message_type.as_deref())?;
            if role_str == "user" || role_str == "human" {
                return extract_text_from_content(&msg.content?);
            }
        }
    }
    None
}

fn extract_text_from_content(content: &Value) -> Option<String> {
    match content {
        Value::String(s) => Some(s.clone()),
        Value::Object(obj) => {
            obj.get("text")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        }
        Value::Array(arr) => {
            // Try to extract text from array items
            for item in arr {
                if let Some(text) = extract_text_from_content(item) {
                    return Some(text);
                }
            }
            None
        }
        _ => None,
    }
}

fn determine_gemini_role(msg: &GeminiMessage) -> MessageRole {
    let role_str = msg.role.as_deref()
        .or(msg.message_type.as_deref())
        .unwrap_or("assistant");

    match role_str {
        "user" | "human" => MessageRole::User,
        "gemini" | "model" | "assistant" => MessageRole::Assistant,
        "system" => MessageRole::System,
        "tool" | "tool_result" => MessageRole::Function,
        _ => MessageRole::Assistant,
    }
}

fn determine_gemini_type(msg: &GeminiMessage) -> MessageType {
    let type_str = msg.message_type.as_deref().unwrap_or("message");

    match type_str {
        "tool_use" | "tool_call" => MessageType::ToolCall,
        "tool_result" => MessageType::ToolResult,
        "error" => MessageType::Error,
        _ => MessageType::Message,
    }
}

fn convert_gemini_content(msg: &GeminiMessage) -> Vec<ContentItem> {
    let mut items = Vec::new();

    if let Some(ref content) = msg.content {
        if let Some(text) = extract_text_from_content(content) {
            items.push(ContentItem::Text { text });
        }
    }

    items
}

fn convert_gemini_tool_calls(msg: &GeminiMessage) -> Option<Vec<ToolCall>> {
    if msg.message_type.as_deref() == Some("tool_use") || msg.message_type.as_deref() == Some("tool_call") {
        let name = msg.name.clone().or(msg.tool.clone())?;
        let input = msg.input.clone().unwrap_or(json!({}));

        Some(vec![ToolCall {
            id: format!("tool-{}", uuid::Uuid::new_v4()),
            name,
            input,
        }])
    } else {
        None
    }
}
```

#### `src-tauri/src/commands/adapters/mod.rs` (UPDATE)

```rust
// ============================================================================
// UNIVERSAL PROVIDER ADAPTERS
// ============================================================================

pub mod claude_code;
pub mod gemini; // ADD THIS

// Re-export for convenience
pub use claude_code::*;
pub use gemini::*; // ADD THIS
```

#### `src-tauri/src/commands/gemini.rs` (NEW TAURI COMMANDS)

```rust
use crate::commands::adapters::gemini::*;
use crate::models::universal::*;
use std::path::Path;
use tauri::State;
use std::sync::Mutex;

// Global Gemini hash resolver (thread-safe)
pub struct GeminiResolverState(pub Mutex<GeminiHashResolver>);

#[tauri::command]
pub async fn scan_gemini_projects(
    gemini_path: String,
    source_id: String,
) -> Result<Vec<UniversalProject>, String> {
    let path = Path::new(&gemini_path).join("tmp");
    gemini_sessions_to_projects(&path, source_id)
}

#[tauri::command]
pub async fn load_gemini_sessions(
    gemini_path: String,
    project_path: String,
    project_id: String,
    source_id: String,
    resolver: State<'_, GeminiResolverState>,
) -> Result<Vec<UniversalSession>, String> {
    let resolver_guard = resolver.0.lock()
        .map_err(|e| format!("Failed to lock resolver: {}", e))?;

    // Find all session files in project directory
    let project_dir = Path::new(&project_path);
    let session_files = find_gemini_sessions(project_dir)?;

    let mut sessions = Vec::new();
    for file in session_files {
        match gemini_file_to_session(&file, project_id.clone(), source_id.clone(), &resolver_guard) {
            Ok(session) => sessions.push(session),
            Err(e) => {
                eprintln!("Failed to parse Gemini session {}: {}", file.display(), e);
                // Continue with other sessions (graceful degradation)
            }
        }
    }

    Ok(sessions)
}

#[tauri::command]
pub async fn load_gemini_messages(
    session_path: String,
    session_id: String,
    project_id: String,
    source_id: String,
) -> Result<Vec<UniversalMessage>, String> {
    let path = Path::new(&session_path);

    // Read JSON file
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read Gemini session: {}", e))?;

    let session: GeminiSession = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse Gemini session: {}", e))?;

    // Extract messages
    let messages = session.messages
        .or(session.history)
        .unwrap_or_else(Vec::new);

    // Convert to UniversalMessage
    let mut universal_messages = Vec::new();
    for (i, msg_value) in messages.iter().enumerate() {
        match gemini_message_to_universal(
            msg_value,
            session_id.clone(),
            project_id.clone(),
            source_id.clone(),
            i as i32,
        ) {
            Ok(msg) => universal_messages.push(msg),
            Err(e) => {
                eprintln!("Failed to parse Gemini message {}: {}", i, e);
                // Continue with other messages
            }
        }
    }

    Ok(universal_messages)
}

#[tauri::command]
pub async fn seed_gemini_resolver(
    sessions: Vec<UniversalSession>,
    resolver: State<'_, GeminiResolverState>,
) -> Result<(), String> {
    let mut resolver_guard = resolver.0.lock()
        .map_err(|e| format!("Failed to lock resolver: {}", e))?;

    resolver_guard.seed_from_sessions(&sessions);

    Ok(())
}
```

#### `src-tauri/src/main.rs` (UPDATE)

```rust
// Add Gemini resolver to app state
fn main() {
    tauri::Builder::default()
        .manage(GeminiResolverState(Mutex::new(GeminiHashResolver::new())))
        .invoke_handler(tauri::generate_handler![
            // ... existing commands ...
            scan_gemini_projects,
            load_gemini_sessions,
            load_gemini_messages,
            seed_gemini_resolver,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Testing Backend:**
```bash
# Build and test
pnpm tauri dev

# Manual test in DevTools console:
await window.__TAURI__.core.invoke('scan_gemini_projects', {
  geminiPath: '/Users/you/.gemini',
  sourceId: 'test-source'
});
```

---

### 1.2 Gemini CLI Adapter - Frontend (Day 3)

#### `src/adapters/providers/GeminiAdapter.ts` (NEW)

```typescript
// ============================================================================
// GEMINI CLI ADAPTER (v1.7.0)
// ============================================================================
// Adapter for Gemini CLI conversation history (JSON files)
// Implements IConversationAdapter to enable multi-provider support

import type {
  IConversationAdapter,
  ValidationResult,
  DetectionScore,
  ScanResult,
  LoadResult,
  SearchResult,
  LoadOptions,
  SearchFilters as AdapterSearchFilters,
  HealthStatus,
  ErrorRecovery,
  ErrorContext,
} from '../base/IAdapter';
import { classifyError } from '../base/IAdapter';
import type {
  UniversalProject,
  UniversalSession,
  UniversalMessage,
} from '../../types/universal';
import type {
  ProviderDefinition,
} from '../../types/providers';
import { ProviderID, ErrorCode } from '../../types/providers';
import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// ADAPTER IMPLEMENTATION
// ============================================================================

export class GeminiAdapter implements IConversationAdapter {
  // ------------------------------------------------------------------------
  // IDENTITY (REQUIRED)
  // ------------------------------------------------------------------------

  public readonly providerId: string = ProviderID.GEMINI;
  public readonly providerDefinition: ProviderDefinition = {
    id: ProviderID.GEMINI,
    name: 'Gemini CLI',
    version: '1.0.0',
    author: 'Google',
    description: 'Gemini CLI conversation history from JSON files',
    capabilities: {
      supportsThinking: false,
      supportsToolCalls: true,
      supportsBranching: false,
      supportsStreaming: false,
      supportsImages: false,
      supportsFiles: false,
      supportsFullTextSearch: false,
      supportsTokenCounting: false, // Gemini doesn't expose tokens in session files
      supportsModelInfo: true,
      requiresAuth: false,
      requiresNetwork: false,
      isReadOnly: true, // v1.7.0: Read-only for now
      supportsProjectCreation: false,
      supportsSessionCreation: false,
      supportsMessageAppending: false,
      maxMessagesPerRequest: 10000,
      preferredBatchSize: 100,
      supportsPagination: false,
    },
    detectionPatterns: [
      {
        type: 'directory',
        pattern: '.gemini',
        weight: 90,
        required: true,
      },
      {
        type: 'directory',
        pattern: 'tmp',
        weight: 80,
        required: true,
      },
      {
        type: 'file',
        pattern: 'session-*.json',
        weight: 70,
        required: false,
      },
    ],
    pathConfig: {
      projectsPath: 'tmp', // Gemini stores sessions in tmp/
    },
    icon: 'sparkles',
    color: '#4285F4', // Google blue
  };

  private initialized = false;

  // ------------------------------------------------------------------------
  // LIFECYCLE (REQUIRED)
  // ------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('GeminiAdapter already initialized');
    }

    // Verify Tauri is available
    if (typeof invoke !== 'function') {
      throw new Error('Tauri API not available - cannot initialize GeminiAdapter');
    }

    this.initialized = true;
    console.log('✅ GeminiAdapter initialized');
  }

  async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.initialized = false;
    console.log('🗑️  GeminiAdapter disposed');
  }

  // ------------------------------------------------------------------------
  // VALIDATION (REQUIRED, FAIL FAST)
  // ------------------------------------------------------------------------

  async validate(path: string): Promise<ValidationResult> {
    try {
      // Check if ~/.gemini/tmp exists
      const tmpPath = path.endsWith('.gemini') ? `${path}/tmp` : path;

      // Simple validation: just check if path exists (Tauri will handle this)
      // More thorough validation happens in canHandle()

      return {
        isValid: true,
        confidence: 80,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : (typeof error === 'string' ? error : JSON.stringify(error));
      const errorCode = error instanceof Error ? classifyError(error) : ErrorCode.UNKNOWN;

      return {
        isValid: false,
        confidence: 0,
        errors: [{
          code: errorCode,
          message: `Validation failed: ${errorMessage}`,
        }],
        warnings: [],
      };
    }
  }

  async canHandle(path: string): Promise<DetectionScore> {
    try {
      const validation = await this.validate(path);

      if (!validation.isValid) {
        return {
          canHandle: false,
          confidence: 0,
          matchedPatterns: [],
          missingPatterns: ['.gemini directory', 'tmp directory'],
        };
      }

      // High confidence for valid Gemini folders
      return {
        canHandle: true,
        confidence: 85,
        matchedPatterns: ['.gemini/tmp directory structure'],
        missingPatterns: [],
      };
    } catch (error) {
      return {
        canHandle: false,
        confidence: 0,
        matchedPatterns: [],
        missingPatterns: [],
      };
    }
  }

  // ------------------------------------------------------------------------
  // DISCOVERY (REQUIRED)
  // ------------------------------------------------------------------------

  async scanProjects(sourcePath: string, sourceId: string): Promise<ScanResult<UniversalProject>> {
    this.ensureInitialized();

    try {
      const projects = await invoke<UniversalProject[]>('scan_gemini_projects', {
        geminiPath: sourcePath,
        sourceId,
      });

      return {
        success: true,
        data: projects,
        metadata: {
          scanDuration: 0,
          itemsFound: projects.length,
          itemsSkipped: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: error instanceof Error ? classifyError(error) : ErrorCode.UNKNOWN,
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
        },
      };
    }
  }

  async loadSessions(
    projectPath: string,
    projectId: string,
    sourceId: string
  ): Promise<ScanResult<UniversalSession>> {
    this.ensureInitialized();

    try {
      // Extract base Gemini path from project path
      const geminiPath = projectPath.includes('.gemini')
        ? projectPath.substring(0, projectPath.indexOf('.gemini') + 7)
        : projectPath;

      const sessions = await invoke<UniversalSession[]>('load_gemini_sessions', {
        geminiPath,
        projectPath,
        projectId,
        sourceId,
      });

      return {
        success: true,
        data: sessions,
        metadata: {
          scanDuration: 0,
          itemsFound: sessions.length,
          itemsSkipped: 0,
        },
      };
    } catch (error) {
      console.error('❌ GeminiAdapter.loadSessions error:', error);

      return {
        success: false,
        error: {
          code: error instanceof Error ? classifyError(error) : ErrorCode.UNKNOWN,
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
        },
      };
    }
  }

  // ------------------------------------------------------------------------
  // DATA LOADING (REQUIRED)
  // ------------------------------------------------------------------------

  async loadMessages(
    sessionPath: string,
    sessionId: string,
    options: LoadOptions
  ): Promise<LoadResult<UniversalMessage>> {
    this.ensureInitialized();

    try {
      const messages = await invoke<UniversalMessage[]>('load_gemini_messages', {
        sessionPath,
        sessionId,
        projectId: sessionId.split('-')[0] || 'unknown',
        sourceId: 'gemini',
      });

      // Apply offset/limit if specified
      const offset = options.offset || 0;
      const limit = options.limit || messages.length;
      const paginatedMessages = messages.slice(offset, offset + limit);

      return {
        success: true,
        data: paginatedMessages,
        pagination: {
          hasMore: offset + limit < messages.length,
          nextOffset: offset + limit,
          totalCount: messages.length,
        },
      };
    } catch (error) {
      console.error('❌ GeminiAdapter.loadMessages error:', error);

      return {
        success: false,
        error: {
          code: error instanceof Error ? classifyError(error) : ErrorCode.UNKNOWN,
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
        },
      };
    }
  }

  // ------------------------------------------------------------------------
  // SEARCH (REQUIRED)
  // ------------------------------------------------------------------------

  async searchMessages(
    sourcePaths: string[],
    query: string,
    filters: AdapterSearchFilters
  ): Promise<SearchResult<UniversalMessage>> {
    this.ensureInitialized();

    // TODO v1.8.0: Implement Gemini search
    return {
      success: false,
      error: {
        code: ErrorCode.UNSUPPORTED_VERSION,
        message: 'Gemini search not implemented yet',
        recoverable: false,
      },
    };
  }

  // ------------------------------------------------------------------------
  // HEALTH CHECK (REQUIRED)
  // ------------------------------------------------------------------------

  async healthCheck(sourcePath: string): Promise<HealthStatus> {
    try {
      const validation = await this.validate(sourcePath);

      if (!validation.isValid) {
        return 'offline';
      }

      // Try to scan projects as a health check
      const scanResult = await this.scanProjects(sourcePath, 'health-check');

      if (!scanResult.success) {
        return 'degraded';
      }

      return 'healthy';
    } catch {
      return 'offline';
    }
  }

  // ------------------------------------------------------------------------
  // ERROR RECOVERY (REQUIRED)
  // ------------------------------------------------------------------------

  handleError(error: Error, _context: ErrorContext): ErrorRecovery {
    const errorCode = classifyError(error);

    switch (errorCode) {
      case ErrorCode.PATH_NOT_FOUND:
        return {
          recoverable: false,
          retry: {
            shouldRetry: false,
            maxAttempts: 0,
            delayMs: 0,
          },
          message: 'Gemini folder or session file not found. Please check the path.',
        };

      case ErrorCode.PARSE_ERROR:
        return {
          recoverable: true,
          retry: {
            shouldRetry: false,
            maxAttempts: 0,
            delayMs: 0,
          },
          message: 'Some Gemini data has invalid format and will be skipped.',
        };

      default:
        return {
          recoverable: false,
          retry: {
            shouldRetry: false,
            maxAttempts: 0,
            delayMs: 0,
          },
          message: `Unexpected error: ${error.message}`,
          suggestion: 'Please report this issue if it persists.',
        };
    }
  }

  // ------------------------------------------------------------------------
  // HELPER METHODS
  // ------------------------------------------------------------------------

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('GeminiAdapter not initialized. Call initialize() first.');
    }
  }
}
```

#### `src/adapters/registry/AdapterRegistry.ts` (UPDATE)

```typescript
import { GeminiAdapter } from '../providers/GeminiAdapter'; // ADD THIS

private async registerBuiltinAdapters(): Promise<void> {
  const adapters: IConversationAdapter[] = [
    new ClaudeCodeAdapter(),
    new CursorAdapter(),
    new GeminiAdapter(), // ADD THIS
  ];
  // ... rest of code
}
```

#### `src/types/providers.ts` (UPDATE)

```typescript
export enum ProviderID {
  CLAUDE_CODE = 'claude-code',
  CURSOR = 'cursor',
  GEMINI = 'gemini', // ADD THIS
}
```

**Testing Frontend:**
```typescript
// In DevTools console:
const registry = await import('./src/adapters/registry/AdapterRegistry');
await registry.adapterRegistry.initialize();

const gemini = registry.adapterRegistry.get('gemini');
const result = await gemini.scanProjects('/Users/you/.gemini', 'test');
console.log(result);
```

---

### 1.3 Add i18n Translations (Day 3 - 30 minutes)

Update all language files:

#### `src/i18n/locales/en/common.json`
```json
{
  "providers": {
    "claude-code": "Claude Code",
    "cursor": "Cursor IDE",
    "gemini": "Gemini CLI"
  }
}
```

Repeat for: `ko`, `ja`, `zh-CN`, `zh-TW`, `ru`

---

### 1.4 Testing & Validation (Day 3 afternoon)

**Test Plan:**
1. ✅ Backend builds without errors
2. ✅ Tauri commands are registered
3. ✅ Frontend adapter initializes
4. ✅ Can detect Gemini folder
5. ✅ Can scan projects
6. ✅ Can load sessions
7. ✅ Can load messages
8. ✅ Messages render in UI

**Test Script:**
```typescript
// tests/integration/gemini-adapter.test.ts

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;

  beforeEach(async () => {
    adapter = new GeminiAdapter();
    await adapter.initialize();
  });

  test('should detect Gemini folder', async () => {
    const result = await adapter.canHandle('/Users/test/.gemini');
    expect(result.canHandle).toBe(true);
    expect(result.confidence).toBeGreaterThan(80);
  });

  test('should scan projects', async () => {
    const result = await adapter.scanProjects('/Users/test/.gemini', 'test-source');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  // ... more tests
});
```

---

## Phase 2: Performance Optimizations (Week 2)

### 2.1 Lightweight Session Loading (Days 4-5)

**Goal:** Parse only first 256KB + last 256KB for large files (≥10MB)

#### `src-tauri/src/commands/adapters/claude_code.rs` (UPDATE)

```rust
// Add at top of file
const LIGHTWEIGHT_THRESHOLD: u64 = 10_000_000; // 10 MB
const HEAD_BYTES: usize = 256 * 1024; // 256 KB
const TAIL_BYTES: usize = 256 * 1024; // 256 KB

/// Parse Claude Code session with lightweight optimization
pub fn claude_file_to_session_optimized(
    file_path: &Path,
    project_id: String,
    source_id: String,
) -> Result<UniversalSession, String> {
    // Check file size
    let metadata = fs::metadata(file_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let file_size = metadata.len();

    if file_size >= LIGHTWEIGHT_THRESHOLD {
        // Large file: lightweight parse (metadata only)
        return claude_file_to_session_lightweight(file_path, project_id, source_id, file_size);
    } else {
        // Small file: full parse
        return claude_file_to_session_full(file_path, project_id, source_id);
    }
}

/// Lightweight session parse: read head + tail only
fn claude_file_to_session_lightweight(
    file_path: &Path,
    project_id: String,
    source_id: String,
    file_size: u64,
) -> Result<UniversalSession, String> {
    use std::io::{BufReader, Read, Seek, SeekFrom};

    let file = fs::File::open(file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let mut reader = BufReader::new(file);

    // Read head
    let mut head_buffer = vec![0u8; HEAD_BYTES];
    let head_read = reader.read(&mut head_buffer)
        .map_err(|e| format!("Failed to read head: {}", e))?;
    head_buffer.truncate(head_read);

    // Read tail
    let tail_offset = file_size.saturating_sub(TAIL_BYTES as u64);
    reader.seek(SeekFrom::Start(tail_offset))
        .map_err(|e| format!("Failed to seek to tail: {}", e))?;

    let mut tail_buffer = vec![0u8; TAIL_BYTES];
    let tail_read = reader.read(&mut tail_buffer)
        .map_err(|e| format!("Failed to read tail: {}", e))?;
    tail_buffer.truncate(tail_read);

    // Parse head for metadata
    let head_str = String::from_utf8_lossy(&head_buffer);
    let lines: Vec<&str> = head_str.lines().take(10).collect();

    let mut session_id = None;
    let mut first_timestamp = None;
    let mut model = None;
    let mut cwd = None;

    for line in lines {
        if let Ok(value) = serde_json::from_str::<Value>(line) {
            if session_id.is_none() {
                session_id = value.get("sessionId").and_then(|v| v.as_str()).map(String::from);
            }
            if first_timestamp.is_none() {
                first_timestamp = value.get("timestamp").and_then(|v| v.as_str()).map(String::from);
            }
            if model.is_none() {
                model = value.get("model").and_then(|v| v.as_str()).map(String::from);
            }
            if cwd.is_none() {
                cwd = value.get("cwd").and_then(|v| v.as_str()).map(String::from);
            }
        }
    }

    // Parse tail for last timestamp
    let tail_str = String::from_utf8_lossy(&tail_buffer);
    let tail_lines: Vec<&str> = tail_str.lines().rev().take(10).collect();

    let mut last_timestamp = None;
    for line in tail_lines {
        if let Ok(value) = serde_json::from_str::<Value>(line) {
            if last_timestamp.is_none() {
                last_timestamp = value.get("timestamp").and_then(|v| v.as_str()).map(String::from);
                break;
            }
        }
    }

    // Estimate message count (rough: file_size / avg_message_size)
    let estimated_count = (file_size / 500) as i32; // Assume ~500 bytes per message

    // Extract title from first user message in head
    let mut title = "Loading...".to_string();
    for line in head_str.lines().take(50) {
        if let Ok(value) = serde_json::from_str::<Value>(line) {
            if value.get("type").and_then(|v| v.as_str()) == Some("user") {
                if let Some(text) = extract_user_text(&value) {
                    title = text.chars().take(100).collect();
                    break;
                }
            }
        }
    }

    let mut metadata = HashMap::new();
    metadata.insert("file_path".to_string(), json!(file_path.to_string_lossy()));
    metadata.insert("file_size_bytes".to_string(), json!(file_size));
    metadata.insert("is_lightweight".to_string(), json!(true)); // IMPORTANT FLAG!
    if let Some(ref cwd_path) = cwd {
        metadata.insert("cwd".to_string(), json!(cwd_path));
    }

    Ok(UniversalSession {
        id: session_id.unwrap_or_else(|| format!("session-{}", uuid::Uuid::new_v4())),
        project_id,
        source_id,
        provider_id: "claude-code".to_string(),
        title,
        message_count: estimated_count,
        first_message_at: first_timestamp,
        last_message_at: last_timestamp,
        duration: None,
        total_tokens: None,
        tool_call_count: 0,
        error_count: 0,
        metadata,
        checksum: "lightweight".to_string(),
    })
}

fn extract_user_text(value: &Value) -> Option<String> {
    // Try message.content
    if let Some(message) = value.get("message") {
        if let Some(content) = message.get("content") {
            if let Some(text) = content.as_str() {
                return Some(text.to_string());
            }
            if let Some(arr) = content.as_array() {
                for item in arr {
                    if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                        return Some(text.to_string());
                    }
                }
            }
        }
    }
    None
}
```

**Frontend Update:**

When user clicks on lightweight session, trigger full load:

```typescript
// src/store/useAppStore.ts

async selectSession(sessionId: string) {
  const session = this.sessions.find(s => s.id === sessionId);

  if (!session) return;

  // Check if lightweight
  const isLightweight = session.metadata?.is_lightweight === true;

  if (isLightweight) {
    // Trigger full load
    await this.loadSessionFull(session);
  }

  // Continue with normal loading...
}

async loadSessionFull(session: UniversalSession) {
  // Call backend to do full parse
  const fullSession = await invoke('load_session_full', {
    sessionPath: session.metadata.file_path,
    projectId: session.project_id,
    sourceId: session.source_id,
  });

  // Update in state
  this.sessions = this.sessions.map(s =>
    s.id === session.id ? fullSession : s
  );
}
```

---

### 2.2 Smart Preamble Filtering (Day 5 afternoon)

```rust
// src-tauri/src/commands/utils/preamble_filter.rs

pub fn looks_like_preamble(text: &str) -> bool {
    let lower = text.to_lowercase();

    // Strong anchors from Agent Sessions
    let anchors = [
        "<user_instructions>",
        "</user_instructions>",
        "you are an expert",
        "you are a helpful",
        "act as a",
        "your role is",
        "caveat: the messages below",
        "# agent sessions agents playbook",
        "## required workflow",
        "## plan mode",
    ];

    for anchor in &anchors {
        if lower.contains(anchor) {
            return true;
        }
    }

    // Check for long markdown blocks (likely instructions)
    let lines: Vec<&str> = text.lines().collect();
    if lines.len() >= 6 {
        let heading_or_bullet_count = lines.iter()
            .take(20)
            .filter(|line| {
                let trimmed = line.trim();
                trimmed.starts_with('#') || trimmed.starts_with('-') || trimmed.starts_with('*')
            })
            .count();

        if heading_or_bullet_count >= 4 {
            return true;
        }
    }

    false
}

// Use in title extraction:
pub fn extract_clean_title(messages: &[UniversalMessage]) -> String {
    for msg in messages {
        if msg.role != MessageRole::User {
            continue;
        }

        for item in &msg.content {
            if let ContentItem::Text { text } = item {
                let trimmed = text.trim();

                // Skip preambles
                if looks_like_preamble(trimmed) {
                    continue;
                }

                // Skip very long messages (likely dumps)
                if trimmed.len() > 400 {
                    continue;
                }

                // Good title!
                return trimmed.chars().take(100).collect();
            }
        }
    }

    "No prompt".to_string()
}
```

---

### 2.3 Git Branch Extraction (Day 6)

```rust
// src-tauri/src/commands/utils/git_extractor.rs

pub fn extract_git_branch(messages: &[UniversalMessage], metadata: &HashMap<String, Value>) -> Option<String> {
    // 1. Try metadata first
    if let Some(branch) = metadata.get("git_branch").and_then(|v| v.as_str()) {
        return Some(branch.to_string());
    }

    // 2. Parse from tool outputs
    for msg in messages {
        // Check tool results
        for item in &msg.content {
            if let ContentItem::ToolResult { content, .. } = item {
                if let Some(branch) = parse_branch_from_output(content) {
                    return Some(branch);
                }
            }
        }
    }

    None
}

fn parse_branch_from_output(output: &str) -> Option<String> {
    let patterns = [
        regex::Regex::new(r"(?m)^On\s+branch\s+([A-Za-z0-9._/-]+)").unwrap(),
        regex::Regex::new(r"(?m)^\*\s+([A-Za-z0-9._/-]+)$").unwrap(),
    ];

    for pattern in &patterns {
        if let Some(captures) = pattern.captures(output) {
            if let Some(branch) = captures.get(1) {
                return Some(branch.as_str().to_string());
            }
        }
    }

    None
}
```

---

## Phase 3: Codex CLI Support (Week 3)

### 3.1 Codex CLI Adapter - Backend (Days 7-9)

**Note:** Codex uses JSONL format (similar to Claude Code), so we can reuse ~80% of logic!

#### `src-tauri/src/commands/adapters/codex.rs`

```rust
// ============================================================================
// CODEX CLI ADAPTER
// ============================================================================
// File Location: ~/.codex/sessions/rollout-YYYY-MM-DDThh-mm-ss-<uuid>.jsonl
// Format: JSONL (similar to Claude Code)
// Filename contains timestamp and session ID

// Key Differences from Claude Code:
// 1. Filename format: rollout-YYYY-MM-DDThh-mm-ss-UUID.jsonl
// 2. No message nesting: Direct fields (no message.content)
// 3. Sessions all in one directory (no projects hierarchy)

use regex::Regex;
use chrono::{DateTime, NaiveDateTime, Utc};

lazy_static::lazy_static! {
    static ref ROLLOUT_REGEX: Regex = Regex::new(
        r"^rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-([0-9a-f-]+)\.jsonl$"
    ).unwrap();
}

pub struct CodexFilename {
    pub timestamp: DateTime<Utc>,
    pub session_id: String,
}

pub fn parse_codex_filename(filename: &str) -> Option<CodexFilename> {
    let captures = ROLLOUT_REGEX.captures(filename)?;

    let timestamp_str = captures.get(1)?.as_str();
    let session_id = captures.get(2)?.as_str().to_string();

    // Parse timestamp: YYYY-MM-DDThh-mm-ss
    let naive = NaiveDateTime::parse_from_str(timestamp_str, "%Y-%m-%dT%H-%M-%S").ok()?;
    let timestamp = DateTime::from_naive_utc_and_offset(naive, Utc);

    Some(CodexFilename {
        timestamp,
        session_id,
    })
}

// Convert Codex message to Universal (similar to Claude but simpler)
pub fn codex_message_to_universal(
    msg_value: &Value,
    session_id: String,
    project_id: String,
    source_id: String,
    sequence_number: i32,
) -> Result<UniversalMessage, String> {
    // Codex messages have direct fields (no message.content nesting)
    let role = msg_value.get("role")
        .and_then(|v| v.as_str())
        .unwrap_or("assistant");

    let message_type = msg_value.get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("message");

    // Extract content (simpler than Claude Code!)
    let content = if let Some(content_val) = msg_value.get("content") {
        if let Some(text) = content_val.as_str() {
            vec![ContentItem::Text { text: text.to_string() }]
        } else if let Some(arr) = content_val.as_array() {
            // Parse array content
            parse_content_array(arr)
        } else {
            vec![]
        }
    } else {
        vec![]
    };

    // ... rest similar to Claude Code adapter

    Ok(UniversalMessage {
        id: msg_value.get("uuid")
            .or(msg_value.get("id"))
            .and_then(|v| v.as_str())
            .unwrap_or(&format!("codex-{}", sequence_number))
            .to_string(),
        session_id,
        project_id,
        source_id,
        provider_id: "codex".to_string(),
        // ... rest of fields
        original_format: "codex_jsonl".to_string(),
        // ...
    })
}
```

**(Similar pattern to Gemini - full implementation in actual file)**

---

### 3.2 Codex CLI Adapter - Frontend (Day 10)

```typescript
// src/adapters/providers/CodexAdapter.ts

export class CodexAdapter implements IConversationAdapter {
  public readonly providerId = ProviderID.CODEX;

  // ... similar structure to GeminiAdapter

  providerDefinition: ProviderDefinition = {
    id: ProviderID.CODEX,
    name: 'Codex CLI',
    detectionPatterns: [
      { type: 'directory', pattern: '.codex', weight: 90 },
      { type: 'directory', pattern: 'sessions', weight: 80 },
      { type: 'file', pattern: 'rollout-*.jsonl', weight: 70 },
    ],
    // ...
  };

  // ... implement interface methods
}
```

---

## Phase 4: Advanced Features (Week 4-5)

### 4.1 Resume Functionality (Days 11-13)

```rust
// src-tauri/src/commands/resume.rs

#[tauri::command]
pub async fn resume_claude_session(
    session_id: String,
    cwd: Option<String>,
) -> Result<String, String> {
    // Find claude binary
    let binary = which::which("claude")
        .map_err(|_| "Claude CLI not found in PATH")?;

    // Build command
    let mut cmd = format!("{} --resume {}", binary.display(), session_id);
    if let Some(cwd_path) = cwd {
        cmd.push_str(&format!(" --cwd {}", cwd_path));
    }

    // Platform-specific terminal launch
    launch_terminal(&cmd)?;

    Ok(format!("Resumed session {}", session_id))
}

#[cfg(target_os = "macos")]
fn launch_terminal(cmd: &str) -> Result<(), String> {
    let script = format!(
        r#"tell application "Terminal" to do script "{}""#,
        cmd.replace("\"", "\\\"")
    );

    std::process::Command::new("osascript")
        .arg("-e")
        .arg(script)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn launch_terminal(cmd: &str) -> Result<(), String> {
    // Use Windows Terminal or fallback to cmd
    if which::which("wt").is_ok() {
        std::process::Command::new("wt")
            .arg("new-tab")
            .arg("cmd")
            .arg("/k")
            .arg(cmd)
            .spawn()
            .map_err(|e| e.to_string())?;
    } else {
        std::process::Command::new("cmd")
            .arg("/c")
            .arg("start")
            .arg("cmd")
            .arg("/k")
            .arg(cmd)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg(target_os = "linux")]
fn launch_terminal(cmd: &str) -> Result<(), String> {
    // Try common terminals
    let terminals = ["gnome-terminal", "konsole", "xterm", "x-terminal-emulator"];

    for terminal in &terminals {
        if which::which(terminal).is_ok() {
            std::process::Command::new(terminal)
                .arg("-e")
                .arg(cmd)
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    Err("No terminal emulator found".to_string())
}
```

**Frontend:**

```typescript
// src/components/ResumeButton.tsx

export function ResumeButton({ session }: { session: UISession }) {
  const handleResume = async () => {
    try {
      const cwd = session.metadata?.cwd;
      await invoke('resume_claude_session', {
        sessionId: session.id,
        cwd,
      });

      toast.success('Session resumed in terminal!');
    } catch (error) {
      toast.error(`Failed to resume: ${error}`);
    }
  };

  return (
    <button onClick={handleResume}>
      Resume in Terminal
    </button>
  );
}
```

---

### 4.2 Favorites System (Days 14-15)

```typescript
// src/store/useFavoritesStore.ts

interface FavoritesStore {
  favorites: Set<string>; // session IDs
  addFavorite: (sessionId: string) => void;
  removeFavorite: (sessionId: string) => void;
  toggleFavorite: (sessionId: string) => void;
  isFavorite: (sessionId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: new Set(),

      addFavorite: (sessionId) => {
        set((state) => ({
          favorites: new Set([...state.favorites, sessionId]),
        }));
      },

      removeFavorite: (sessionId) => {
        set((state) => {
          const newFavorites = new Set(state.favorites);
          newFavorites.delete(sessionId);
          return { favorites: newFavorites };
        });
      },

      toggleFavorite: (sessionId) => {
        const { isFavorite, addFavorite, removeFavorite } = get();
        if (isFavorite(sessionId)) {
          removeFavorite(sessionId);
        } else {
          addFavorite(sessionId);
        }
      },

      isFavorite: (sessionId) => {
        return get().favorites.has(sessionId);
      },
    }),
    {
      name: 'favorites-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        favorites: Array.from(state.favorites), // Serialize Set to Array
      }),
      onRehydrateStorage: () => (state) => {
        // Deserialize Array back to Set
        if (state && Array.isArray(state.favorites)) {
          state.favorites = new Set(state.favorites);
        }
      },
    }
  )
);
```

**UI Component:**

```typescript
// src/components/FavoriteButton.tsx

import { Star } from 'lucide-react';
import { useFavoritesStore } from '@/store/useFavoritesStore';

export function FavoriteButton({ sessionId }: { sessionId: string }) {
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const favorite = isFavorite(sessionId);

  return (
    <button
      onClick={() => toggleFavorite(sessionId)}
      className={cn(
        "p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
        favorite ? "text-yellow-500" : "text-gray-400"
      )}
      title={favorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Star className={cn("w-4 h-4", favorite && "fill-current")} />
    </button>
  );
}
```

---

## Testing Strategy

### Unit Tests (Per Feature)

```typescript
// tests/unit/adapters/gemini.test.ts

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;

  beforeEach(async () => {
    adapter = new GeminiAdapter();
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      expect(adapter.providerId).toBe(ProviderID.GEMINI);
      expect(adapter.providerDefinition.name).toBe('Gemini CLI');
    });

    test('should throw on double initialization', async () => {
      await expect(adapter.initialize()).rejects.toThrow('already initialized');
    });
  });

  describe('validation', () => {
    test('should validate Gemini folder', async () => {
      const result = await adapter.validate('/Users/test/.gemini');
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid path', async () => {
      const result = await adapter.validate('/invalid/path');
      expect(result.isValid).toBe(false);
    });
  });

  // ... more tests
});
```

### Integration Tests

```typescript
// tests/integration/multi-provider.test.ts

describe('Multi-Provider Integration', () => {
  let registry: AdapterRegistry;

  beforeEach(async () => {
    registry = AdapterRegistry.getInstance();
    await registry.initialize();
  });

  test('should register all providers', () => {
    const stats = registry.getStats();
    expect(stats.totalAdapters).toBe(3); // Claude, Cursor, Gemini
    expect(stats.providers).toContain('claude-code');
    expect(stats.providers).toContain('cursor');
    expect(stats.providers).toContain('gemini');
  });

  test('should detect provider from path', async () => {
    const claudeResult = await registry.detectProvider('/Users/test/.claude');
    expect(claudeResult.providerId).toBe('claude-code');

    const geminiResult = await registry.detectProvider('/Users/test/.gemini');
    expect(geminiResult.providerId).toBe('gemini');
  });
});
```

### E2E Tests

```typescript
// e2e/tests/gemini-provider.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Gemini Provider', () => {
  test('should load Gemini sessions', async ({ page }) => {
    await page.goto('http://localhost:1420');

    // Add Gemini source
    await page.click('[data-testid="add-source-button"]');
    await page.fill('[data-testid="source-path-input"]', '/Users/test/.gemini');
    await page.click('[data-testid="detect-provider-button"]');

    // Should detect Gemini
    await expect(page.locator('[data-testid="detected-provider"]')).toHaveText('Gemini CLI');

    // Add source
    await page.click('[data-testid="add-source-confirm"]');

    // Should show Gemini projects
    await expect(page.locator('[data-provider="gemini"]')).toBeVisible();
  });
});
```

---

## Rollback Strategy

Each phase is independently deployable. If issues arise:

### Rollback Phase 1 (Gemini):
```bash
git revert <gemini-commits>
pnpm build
```

### Feature Flags (Optional):
```typescript
// src/config/features.ts

export const FEATURES = {
  GEMINI_PROVIDER: process.env.VITE_ENABLE_GEMINI === 'true',
  CODEX_PROVIDER: process.env.VITE_ENABLE_CODEX === 'true',
  RESUME_FUNCTIONALITY: process.env.VITE_ENABLE_RESUME === 'true',
};

// In AdapterRegistry:
if (FEATURES.GEMINI_PROVIDER) {
  adapters.push(new GeminiAdapter());
}
```

---

## Documentation Updates

After each phase:

1. Update `README.md` with new providers
2. Update `CLAUDE.md` with implementation details
3. Add to CHANGELOG.md
4. Update i18n files
5. Add to release notes

---

## Timeline Summary

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Foundation | Gemini adapter (backend + frontend), i18n, tests |
| 2 | Performance | Lightweight loading, preamble filtering, git extraction |
| 3 | Codex | Codex adapter (backend + frontend), tests |
| 4-5 | Advanced | Resume functionality, favorites, polish |

**Total:** 4-5 weeks for complete implementation

---

## Success Criteria

✅ All providers pass unit tests
✅ Integration tests pass
✅ E2E tests pass
✅ Zero data loss (all fields preserved in `provider_metadata`)
✅ Backward compatible (existing adapters unaffected)
✅ Performance improvement (lightweight loading)
✅ User-facing features work (resume, favorites)
✅ Documentation complete
✅ CI/CD green

---

## Next Steps

1. Review this plan with team
2. Set up feature branch: `feat/multi-provider-expansion`
3. Start with Phase 1.1 (Gemini backend)
4. Daily standup to track progress
5. PR review after each sub-phase

Ready to begin implementation? 🚀
