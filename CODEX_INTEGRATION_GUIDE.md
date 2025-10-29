# Codex Provider Integration Guide
## How to Add Codex to the Multi-Provider Architecture

**Focus:** This guide shows how to integrate Codex into the existing source provider system, following the same pattern as Claude Code, Cursor, and Gemini.

---

## Overview: Provider Integration Checklist

- [ ] 1. Add `CODEX` to provider enum
- [ ] 2. Create backend Rust adapter implementing provider trait
- [ ] 3. Register Tauri commands
- [ ] 4. Create frontend TypeScript adapter
- [ ] 5. Register in AdapterRegistry
- [ ] 6. Add auto-detection to SourceStore
- [ ] 7. Update i18n translations (6 languages)
- [ ] 8. Test integration end-to-end

---

## Step 1: Add CODEX to Provider Enum

### File: `src/types/providers.ts`

**Location:** Line ~90

**Change:**
```typescript
export enum ProviderID {
  CLAUDE_CODE = 'claude-code',
  CURSOR = 'cursor',
  GEMINI = 'gemini',      // v1.7.0 - Gemini CLI support
  CODEX = 'codex',        // v1.8.0 - Codex CLI support ← ADD THIS
  COPILOT = 'copilot',
  CLINE = 'cline',
  AIDER = 'aider',
}
```

**Commit:**
```bash
git add src/types/providers.ts
git commit -m "feat: add CODEX provider to ProviderID enum"
```

---

## Step 2: Create Backend Rust Adapter

### File: `src-tauri/src/commands/adapters/codex.rs` (NEW FILE)

**Create new file with full implementation:**

```rust
// ============================================================================
// CODEX CLI ADAPTER
// ============================================================================
// Converts Codex CLI JSONL event format to UniversalMessage
//
// Pattern: Heavily reuses Claude Code's JSONL streaming approach from session.rs

use crate::models::universal::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

// ============================================================================
// RAW CODEX EVENT STRUCTURE (matches JSONL format)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexEvent {
    pub id: Option<String>,
    pub timestamp: Option<String>,
    #[serde(rename = "type")]
    pub event_type: String,
    pub payload: Option<Value>,

    // Codex-specific fields
    pub internal: Option<Value>,
    pub environment_context: Option<Value>,
    pub execution_context: Option<Value>,
}

// ============================================================================
// FILENAME PARSING
// ============================================================================

/// Parse Codex rollout filename: rollout-YYYY-MM-DDThh-mm-ss-UUID.jsonl
pub fn parse_rollout_filename(filename: &str) -> Option<(String, String)> {
    let re = regex::Regex::new(
        r"^rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-([a-f0-9-]+)\.jsonl$"
    ).ok()?;

    let caps = re.captures(filename)?;
    let timestamp = caps.get(1)?.as_str().to_string();
    let uuid = caps.get(2)?.as_str().to_string();

    Some((timestamp, uuid))
}

/// Extract session ID with priority: internal > filename UUID
pub fn extract_session_id(event: &CodexEvent, filename_uuid: &str) -> String {
    // Priority 1: internal.session.id
    if let Some(id) = event.internal
        .as_ref()
        .and_then(|i| i.get("session"))
        .and_then(|s| s.get("id"))
        .and_then(|v| v.as_str())
    {
        return id.to_string();
    }

    // Priority 2: Filename UUID
    filename_uuid.to_string()
}

// ============================================================================
// JSONL STREAMING PARSER (Claude Code pattern from session.rs:38-70)
// ============================================================================

/// Parse Codex JSONL file with BufReader streaming
pub fn parse_codex_jsonl(file_path: &Path) -> Result<Vec<CodexEvent>, String> {
    let file = File::open(file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let reader = BufReader::new(file);  // Memory-efficient streaming
    let mut events = Vec::new();

    for (line_num, line_result) in reader.lines().enumerate() {
        let line = line_result
            .map_err(|e| format!("Line {}: Read error: {}", line_num + 1, e))?;

        // Skip empty lines (Claude Code pattern)
        if line.trim().is_empty() {
            continue;
        }

        // Parse JSON - continue on error (graceful degradation)
        match serde_json::from_str::<CodexEvent>(&line) {
            Ok(event) => events.push(event),
            Err(e) => {
                eprintln!("⚠️ Line {}: Parse error: {}", line_num + 1, e);
                continue;  // Don't fail entire file for one bad line
            }
        }
    }

    Ok(events)
}

// ============================================================================
// CONVERSION TO UNIVERSAL FORMAT
// ============================================================================

/// Convert Codex event to UniversalMessage
/// Pattern: Similar to claude_code.rs:18-136
pub fn codex_event_to_universal(
    event: &CodexEvent,
    project_id: String,
    source_id: String,
    sequence_number: i32,
    file_path: &str,
) -> UniversalMessage {
    // Extract role (user vs assistant)
    let role = determine_role(event);

    // Determine message type
    let message_type = MessageType::Message; // Codex doesn't have summary/sidechain

    // Convert content
    let content = convert_content(event);

    // Extract CWD
    let cwd = extract_cwd(event);

    // Extract model
    let model = event.payload
        .as_ref()
        .and_then(|p| p.get("model"))
        .and_then(|m| m.as_str())
        .map(String::from);

    // ⭐ CRITICAL: Use camelCase for metadata (Gemini lesson learned!)
    let mut metadata = HashMap::new();
    metadata.insert("filePath".to_string(), json!(file_path));  // camelCase!
    metadata.insert("eventType".to_string(), json!(event.event_type)); // camelCase!
    if let Some(ref cwd_path) = cwd {
        metadata.insert("cwd".to_string(), json!(cwd_path));
    }

    // File size
    if let Ok(file_metadata) = fs::metadata(file_path) {
        metadata.insert("fileSizeBytes".to_string(), json!(file_metadata.len())); // camelCase!
    }

    UniversalMessage {
        // CORE IDENTITY
        id: event.id.clone().unwrap_or_else(|| format!("codex-{}", sequence_number)),
        session_id: "".to_string(), // Will be set by caller
        project_id,
        source_id,
        provider_id: "codex".to_string(),

        // TEMPORAL
        timestamp: event.timestamp.clone().unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
        sequence_number,

        // ROLE & TYPE
        role,
        message_type,

        // CONTENT
        content,

        // HIERARCHY
        parent_id: None, // Codex doesn't have parent relationships
        depth: None,
        branch_id: None,

        // METADATA
        model,
        tokens: None, // Codex doesn't expose token counts
        tool_calls: None, // TODO: Extract from payload
        thinking: None,
        attachments: None,
        errors: None,

        // RAW PRESERVATION
        original_format: "codex_jsonl".to_string(),
        provider_metadata: metadata,
    }
}

/// Determine role from event type
fn determine_role(event: &CodexEvent) -> MessageRole {
    match event.event_type.as_str() {
        "user_message" | "user_input" => MessageRole::User,
        "assistant_message" | "assistant_response" => MessageRole::Assistant,
        "system_message" => MessageRole::System,
        _ => MessageRole::Assistant, // Default
    }
}

/// Convert payload to content
fn convert_content(event: &CodexEvent) -> Vec<UniversalContent> {
    let mut content_items = Vec::new();

    if let Some(ref payload) = event.payload {
        // Extract text content
        if let Some(text) = payload.get("content").and_then(|c| c.as_str()) {
            content_items.push(UniversalContent {
                content_type: ContentType::Text,
                data: json!({"text": text}),
                encoding: None,
                mime_type: Some("text/plain".to_string()),
                size: Some(text.len()),
                hash: None,
            });
        }
    }

    content_items
}

/// Extract CWD with priority: environment_context > execution_context
fn extract_cwd(event: &CodexEvent) -> Option<String> {
    // Priority 1: environment_context.cwd
    if let Some(cwd) = event.environment_context
        .as_ref()
        .and_then(|ctx| ctx.get("cwd"))
        .and_then(|v| v.as_str())
    {
        return Some(cwd.to_string());
    }

    // Priority 2: execution_context.working_directory
    if let Some(wd) = event.execution_context
        .as_ref()
        .and_then(|ctx| ctx.get("working_directory"))
        .and_then(|v| v.as_str())
    {
        return Some(wd.to_string());
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_rollout_filename() {
        let filename = "rollout-2025-01-27T14-30-45-a1b2c3d4-e5f6-7890-abcd-ef1234567890.jsonl";
        let result = parse_rollout_filename(filename);
        assert!(result.is_some());

        let (timestamp, uuid) = result.unwrap();
        assert_eq!(timestamp, "2025-01-27T14-30-45");
        assert_eq!(uuid, "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    }

    #[test]
    fn test_invalid_filename() {
        assert!(parse_rollout_filename("invalid.jsonl").is_none());
        assert!(parse_rollout_filename("rollout-2025.jsonl").is_none());
    }
}
```

**Add to module declarations:**

### File: `src-tauri/src/commands/adapters/mod.rs`

```rust
pub mod claude_code;
pub mod cursor;
pub mod gemini;
pub mod codex;  // ← ADD THIS
```

**Commit:**
```bash
git add src-tauri/src/commands/adapters/codex.rs
git add src-tauri/src/commands/adapters/mod.rs
git commit -m "feat(backend): implement Codex CLI adapter with JSONL streaming"
```

---

## Step 3: Create Tauri Commands

### File: `src-tauri/src/commands/codex.rs` (NEW FILE)

```rust
use std::path::PathBuf;
use crate::commands::adapters::codex::*;
use crate::models::universal::*;

/// Get default Codex CLI installation path
#[tauri::command]
pub async fn get_codex_path() -> Result<String, String> {
    let home_dir = dirs::home_dir()
        .ok_or("HOME_DIRECTORY_NOT_FOUND: Could not determine home directory")?;

    // Codex CLI stores sessions at ~/.codex/agent-sessions
    let codex_path = home_dir.join(".codex").join("agent-sessions");

    if !codex_path.exists() {
        return Err(format!(
            "CODEX_FOLDER_NOT_FOUND: Codex folder not found at {}",
            codex_path.display()
        ));
    }

    if std::fs::read_dir(&codex_path).is_err() {
        return Err(
            "PERMISSION_DENIED: Cannot access Codex folder. Please check permissions.".to_string(),
        );
    }

    Ok(codex_path.to_string_lossy().to_string())
}

/// Validate Codex folder structure
#[tauri::command]
pub async fn validate_codex_folder(path: String) -> Result<bool, String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Ok(false);
    }

    // Check for rollout-*.jsonl files
    if let Ok(entries) = std::fs::read_dir(&path_buf) {
        for entry in entries.flatten() {
            if let Some(filename) = entry.file_name().to_str() {
                if filename.starts_with("rollout-") && filename.ends_with(".jsonl") {
                    return Ok(true); // Found at least one rollout file
                }
            }
        }
    }

    Ok(false)
}

/// Scan for Codex projects (rollout files grouped by session)
#[tauri::command]
pub async fn scan_codex_projects(base_path: String) -> Result<Vec<UniversalProject>, String> {
    // Implementation similar to scan_gemini_projects
    // Group rollout files by session ID
    todo!("Implement scan_codex_projects")
}

/// Load sessions for a Codex project
#[tauri::command]
pub async fn load_codex_sessions(
    project_path: String,
) -> Result<Vec<UniversalSession>, String> {
    // Implementation similar to load_gemini_sessions
    todo!("Implement load_codex_sessions")
}

/// Load messages for a Codex session
#[tauri::command]
pub async fn load_codex_messages(
    session_path: String,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    let file_path = PathBuf::from(&session_path);

    // Parse JSONL file
    let events = parse_codex_jsonl(&file_path)?;

    // Extract session ID from filename
    let filename = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid filename")?;

    let (_, filename_uuid) = parse_rollout_filename(filename)
        .ok_or("Invalid rollout filename format")?;

    // Convert events to UniversalMessages
    let mut messages: Vec<UniversalMessage> = events
        .iter()
        .enumerate()
        .map(|(idx, event)| {
            let session_id = extract_session_id(event, &filename_uuid);
            let mut msg = codex_event_to_universal(
                event,
                "codex".to_string(), // project_id
                session_path.clone(), // source_id
                idx as i32,
                &session_path,
            );
            msg.session_id = session_id;
            msg
        })
        .collect();

    // Apply pagination
    let total = messages.len();
    let start = offset.min(total);
    let end = (offset + limit).min(total);

    Ok(messages[start..end].to_vec())
}
```

### Register commands in `src-tauri/src/lib.rs`

**Find the `invoke_handler!` macro and add:**

```rust
invoke_handler![
    // ... existing commands ...

    // Gemini CLI support (v1.7.0)
    get_gemini_path,
    validate_gemini_folder,
    scan_gemini_projects,
    load_gemini_sessions,
    load_gemini_messages,

    // Codex CLI support (v1.8.0) ← ADD THESE
    get_codex_path,
    validate_codex_folder,
    scan_codex_projects,
    load_codex_sessions,
    load_codex_messages,
]
```

**Add module declaration at top:**

```rust
mod commands;
use commands::{
    codex::*,  // ← ADD THIS
    gemini::*,
    // ... other imports
};
```

**Commit:**
```bash
git add src-tauri/src/commands/codex.rs
git add src-tauri/src/lib.rs
git commit -m "feat(backend): add Codex Tauri commands for path detection and validation"
```

---

## Step 4: Create Frontend TypeScript Adapter

### File: `src/adapters/providers/CodexAdapter.ts` (NEW FILE)

```typescript
import { invoke } from '@tauri-apps/api/core';
import type {
  IConversationAdapter,
  ValidationResult,
  DetectionPattern,
} from '../types';
import { BaseProviderAdapter } from '../base/BaseProviderAdapter';
import { ErrorCode, classifyError } from '../../utils/errorHandling';
import type { UniversalProject, UniversalSession, UniversalMessage } from '../../types/universal';

/**
 * Codex CLI Adapter
 * Handles Codex CLI conversation history stored in ~/.codex/agent-sessions/
 *
 * File Format: JSONL (rollout-YYYY-MM-DDThh-mm-ss-UUID.jsonl)
 * Reference: Claude Code adapter (JSONL streaming pattern)
 */
export class CodexAdapter extends BaseProviderAdapter implements IConversationAdapter {
  readonly id = 'codex';
  readonly name = 'Codex CLI';
  readonly version = '1.0.0';

  /**
   * Detection patterns for Codex CLI installations
   * Priority order: macOS > Windows > Linux
   */
  async getDetectionPatterns(): Promise<DetectionPattern[]> {
    return [
      {
        path: '~/.codex/agent-sessions',
        platform: 'darwin',
        confidence: 100,
      },
      {
        path: '~/.codex/agent-sessions',
        platform: 'linux',
        confidence: 100,
      },
      {
        path: '%USERPROFILE%\\.codex\\agent-sessions',
        platform: 'win32',
        confidence: 100,
      },
    ];
  }

  /**
   * Validate Codex folder structure
   * Checks for rollout-*.jsonl files
   */
  async validate(path: string): Promise<ValidationResult> {
    try {
      const isValid = await invoke<boolean>('validate_codex_folder', { path });

      if (!isValid) {
        return {
          isValid: false,
          confidence: 0,
          errors: [
            {
              code: ErrorCode.INVALID_FORMAT,
              message: 'Not a valid Codex CLI folder (no rollout-*.jsonl files found)',
            },
          ],
          warnings: [],
        };
      }

      return {
        isValid: true,
        confidence: 100,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      const errorCode = classifyError(error as Error);
      return {
        isValid: false,
        confidence: 0,
        errors: [
          {
            code: errorCode,
            message: `Validation failed: ${(error as Error).message}`,
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Scan for Codex projects
   */
  async scanProjects(basePath: string): Promise<UniversalProject[]> {
    try {
      const projects = await invoke<UniversalProject[]>('scan_codex_projects', {
        basePath,
      });
      return projects;
    } catch (error) {
      console.error('Failed to scan Codex projects:', error);
      throw new Error(`Failed to scan Codex projects: ${(error as Error).message}`);
    }
  }

  /**
   * Load sessions for a project
   */
  async loadSessions(projectPath: string): Promise<UniversalSession[]> {
    try {
      const sessions = await invoke<UniversalSession[]>('load_codex_sessions', {
        projectPath,
      });
      return sessions;
    } catch (error) {
      console error('Failed to load Codex sessions:', error);
      throw new Error(`Failed to load Codex sessions: ${(error as Error).message}`);
    }
  }

  /**
   * Load messages for a session (paginated)
   */
  async loadMessages(
    sessionPath: string,
    offset: number = 0,
    limit: number = 20
  ): Promise<UniversalMessage[]> {
    try {
      const messages = await invoke<UniversalMessage[]>('load_codex_messages', {
        sessionPath,
        offset,
        limit,
      });
      return messages;
    } catch (error) {
      console.error('Failed to load Codex messages:', error);
      throw new Error(`Failed to load Codex messages: ${(error as Error).message}`);
    }
  }
}
```

**Commit:**
```bash
git add src/adapters/providers/CodexAdapter.ts
git commit -m "feat(frontend): implement Codex TypeScript adapter"
```

---

## Step 5: Register in AdapterRegistry

### File: `src/adapters/registry/AdapterRegistry.ts`

**Add import:**
```typescript
import { ClaudeCodeAdapter } from '../providers/ClaudeCodeAdapter';
import { CursorAdapter } from '../providers/CursorAdapter';
import { GeminiAdapter } from '../providers/GeminiAdapter';
import { CodexAdapter } from '../providers/CodexAdapter';  // ← ADD THIS
```

**Register in `registerBuiltinAdapters()` method:**
```typescript
private async registerBuiltinAdapters(): Promise<void> {
  const adapters: IConversationAdapter[] = [
    new ClaudeCodeAdapter(),
    new CursorAdapter(),
    new GeminiAdapter(),
    new CodexAdapter(),  // ← ADD THIS
  ];

  for (const adapter of adapters) {
    await this.register(adapter);
  }
}
```

**Commit:**
```bash
git add src/adapters/registry/AdapterRegistry.ts
git commit -m "feat(frontend): register Codex adapter in AdapterRegistry"
```

---

## Step 6: Add Auto-Detection to SourceStore

### File: `src/store/useSourceStore.ts`

**Find the `detectSources()` method and add Codex detection:**

```typescript
// Around line 200, after Gemini detection block

// Try to detect Codex CLI folder (v1.8.0)
try {
  const codexPath = await invoke<string>('get_codex_path');
  const validation = await get().validatePath(codexPath);

  if (validation.isValid && validation.providerId === 'codex') {
    console.log(`  ✓ Found Codex CLI at: ${codexPath}`);
    detectedSources.push(codexPath);
  }
} catch (error) {
  console.log('  ✗ Codex CLI not found:', (error as Error).message);
}
```

**Commit:**
```bash
git add src/store/useSourceStore.ts
git commit -m "feat(frontend): add Codex auto-detection to source store"
```

---

## Step 7: Update i18n Translations

Update translations in **6 languages** for Codex support.

### Files to Update:

1. `src/i18n/locales/en/common.json`
2. `src/i18n/locales/ko/common.json`
3. `src/i18n/locales/ja/common.json`
4. `src/i18n/locales/zh-CN/common.json`
5. `src/i18n/locales/zh-TW/common.json`
6. `src/i18n/locales/ru/common.json`

**English (`en/common.json`):**
```json
{
  "appTitle": "Claude Code, Cursor IDE, Gemini CLI & Codex CLI History Viewer",
  "appDescription": "Explore and analyze your Claude Code, Cursor IDE, Gemini CLI, and Codex CLI conversation history",
  "providers": {
    "claudeCode": "Claude Code",
    "cursor": "Cursor IDE",
    "gemini": "Gemini CLI",
    "codex": "Codex CLI"
  }
}
```

**Korean (`ko/common.json`):**
```json
{
  "appTitle": "Claude Code, Cursor IDE, Gemini CLI 및 Codex CLI 히스토리 뷰어",
  "appDescription": "Claude Code, Cursor IDE, Gemini CLI 및 Codex CLI 대화 기록을 탐색하고 분석하세요",
  "providers": {
    "claudeCode": "Claude Code",
    "cursor": "Cursor IDE",
    "gemini": "Gemini CLI",
    "codex": "Codex CLI"
  }
}
```

**Japanese (`ja/common.json`):**
```json
{
  "appTitle": "Claude Code、Cursor IDE、Gemini CLI、Codex CLI 履歴ビューア",
  "appDescription": "Claude Code、Cursor IDE、Gemini CLI、Codex CLIの会話履歴を探索・分析",
  "providers": {
    "claudeCode": "Claude Code",
    "cursor": "Cursor IDE",
    "gemini": "Gemini CLI",
    "codex": "Codex CLI"
  }
}
```

**Simplified Chinese (`zh-CN/common.json`):**
```json
{
  "appTitle": "Claude Code、Cursor IDE、Gemini CLI 和 Codex CLI 历史查看器",
  "appDescription": "探索和分析您的 Claude Code、Cursor IDE、Gemini CLI 和 Codex CLI 对话历史",
  "providers": {
    "claudeCode": "Claude Code",
    "cursor": "Cursor IDE",
    "gemini": "Gemini CLI",
    "codex": "Codex CLI"
  }
}
```

**Traditional Chinese (`zh-TW/common.json`):**
```json
{
  "appTitle": "Claude Code、Cursor IDE、Gemini CLI 和 Codex CLI 歷史檢視器",
  "appDescription": "探索和分析您的 Claude Code、Cursor IDE、Gemini CLI 和 Codex CLI 對話歷史",
  "providers": {
    "claudeCode": "Claude Code",
    "cursor": "Cursor IDE",
    "gemini": "Gemini CLI",
    "codex": "Codex CLI"
  }
}
```

**Russian (`ru/common.json`):**
```json
{
  "appTitle": "Просмотр истории Claude Code, Cursor IDE, Gemini CLI и Codex CLI",
  "appDescription": "Исследуйте и анализируйте историю разговоров Claude Code, Cursor IDE, Gemini CLI и Codex CLI",
  "providers": {
    "claudeCode": "Claude Code",
    "cursor": "Cursor IDE",
    "gemini": "Gemini CLI",
    "codex": "Codex CLI"
  }
}
```

**Also update splash.json files** (same 6 languages) with `splashTitle` field.

**Commit:**
```bash
git add src/i18n/locales/*/common.json
git add src/i18n/locales/*/splash.json
git commit -m "feat(i18n): add Codex CLI to app title and provider names (6 languages)"
```

---

## Step 8: Test Integration End-to-End

### Testing Checklist:

- [ ] **Build succeeds**: `pnpm build`
- [ ] **TypeScript compiles**: No type errors
- [ ] **App starts**: `pnpm tauri:dev`
- [ ] **Auto-detection works**: Codex shows in source list if `~/.codex/agent-sessions/` exists
- [ ] **Manual add works**: Can add Codex path via "Add Source" button
- [ ] **Validation works**: Invalid paths rejected with error message
- [ ] **Projects load**: Codex projects appear in ProjectTree
- [ ] **Sessions load**: Clicking project shows sessions
- [ ] **Messages load**: Clicking session shows messages
- [ ] **Pagination works**: Can scroll to load more messages
- [ ] **i18n works**: All 6 languages show "Codex CLI" correctly

### Test Commands:

```bash
# Build
pnpm build

# Run in dev mode
pnpm tauri:dev

# Check for Codex folder
ls ~/.codex/agent-sessions/

# If doesn't exist, create test data
mkdir -p ~/.codex/agent-sessions/
# (Add test rollout-*.jsonl files)
```

---

## Summary: Integration Steps

| Step | File(s) Modified | Purpose |
|------|------------------|---------|
| 1 | `src/types/providers.ts` | Add `CODEX` enum value |
| 2 | `src-tauri/src/commands/adapters/codex.rs` | Create Rust adapter with JSONL parsing |
| 3 | `src-tauri/src/commands/codex.rs` + `lib.rs` | Add Tauri commands |
| 4 | `src/adapters/providers/CodexAdapter.ts` | Create TypeScript adapter |
| 5 | `src/adapters/registry/AdapterRegistry.ts` | Register adapter |
| 6 | `src/store/useSourceStore.ts` | Add auto-detection |
| 7 | `src/i18n/locales/*/common.json` (x6) | Update translations |
| 8 | - | Test end-to-end |

**Total Files Created:** 2 (codex.rs backend, CodexAdapter.ts frontend)
**Total Files Modified:** 8-10 files
**Estimated Time:** 1-2 days for full integration

---

## Next Steps After Integration

Once integration is complete:

1. **Implement TODO functions** in `codex.rs`:
   - `scan_codex_projects()` - Group rollout files by session
   - `load_codex_sessions()` - Extract session metadata from JSONL

2. **Add advanced features**:
   - Tool call extraction from Codex events
   - Error extraction from execution_context
   - Token usage if available in payload

3. **Create test fixtures**:
   - Sample rollout-*.jsonl files
   - Unit tests for filename parsing
   - Integration tests for full flow

---

## Troubleshooting

### Codex doesn't appear in UI
- Check `~/.codex/agent-sessions/` exists
- Check console logs for auto-detection errors
- Try manual "Add Source" with full path
- Verify `validate_codex_folder` returns true

### "No source found for session path" error
- **Check metadata naming!** Must use camelCase: `filePath`, `fileSizeBytes`
- This was the critical Gemini bug - don't repeat it!

### TypeScript build errors
- Run `pnpm build` to see full errors
- Check all imports are correct
- Verify `ProviderID.CODEX` exists in enum

### Rust build errors
- Run `cargo build` in `src-tauri/`
- Check all modules registered in `mod.rs` and `lib.rs`
- Verify serde derives on CodexEvent struct

---

**Ready to integrate Codex?** Follow these 8 steps in order! 🚀
