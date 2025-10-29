# Codex CLI Implementation Plan
## Comprehensive Guide with Claude Code Patterns + Gemini Lessons

**Version:** 2.0
**Date:** January 2025
**Estimated Effort:** 5-7 days (based on Gemini experience: 3 days + Codex complexity)

> **🔑 Key Insight:** Codex uses **JSONL format** (like Claude Code), NOT regular JSON (like Gemini).
> **Primary Reference:** Claude Code's JSONL parsing patterns in `src-tauri/src/commands/session.rs` and `adapters/claude_code.rs`
> **Secondary Reference:** Gemini's integration workflow (auto-detection, validation, frontend adapter)

---

## Table of Contents
1. [Critical Reference: Claude Code JSONL Patterns](#critical-reference-claude-code-jsonl-patterns)
2. [Lessons Learned from Gemini](#lessons-learned-from-gemini)
3. [Codex CLI Analysis](#codex-cli-analysis)
4. [Architecture Overview](#architecture-overview)
5. [Implementation Plan](#implementation-plan)
6. [Testing Strategy](#testing-strategy)
7. [Rollout Plan](#rollout-plan)

---

## Critical Reference: Claude Code JSONL Patterns

**⚠️ IMPORTANT:** Before implementing Codex, review:
- **`CODEX_JSONL_PATTERNS.md`** - Detailed guide on reusing Claude Code's JSONL patterns
- **`src-tauri/src/commands/session.rs:38-70`** - BufReader streaming pattern
- **`src-tauri/src/commands/adapters/claude_code.rs`** - Conversion to UniversalMessage

### Why Claude Code is the Right Reference

| Aspect | Claude Code | Gemini CLI | Codex CLI |
|--------|-------------|-----------|-----------|
| **File Format** | JSONL ✅ | JSON ❌ | JSONL ✅ |
| **Streaming** | BufReader + `.lines()` | `fs::read_to_string` | Should use BufReader |
| **Line-by-Line** | Yes ✅ | No (full parse) | Yes ✅ |
| **Error Handling** | Continue on bad lines | Fail on parse error | Should continue |
| **File Size** | 100KB-5MB | 10-100KB | 10-50MB (larger!) |

**Conclusion:** Codex implementation should **heavily reuse Claude Code's proven JSONL patterns**, not Gemini's JSON approach.

---

## Lessons Learned from Gemini

### ✅ What Went Well

1. **Clear Separation of Concerns**
   - Backend (Rust) handles all parsing and conversion
   - Frontend (TypeScript) only does orchestration
   - Clean adapter pattern with IConversationAdapter

2. **Incremental Implementation**
   - Backend first (2 days)
   - Frontend second (1 day)
   - Build and test after each phase

3. **Zero Data Loss**
   - All original fields preserved in `provider_metadata`
   - Can reconstruct original format if needed

### ⚠️ Issues Encountered

1. **Metadata Field Naming Mismatch** ⭐⭐⭐ CRITICAL
   - **Problem**: Backend used `file_path` (snake_case), frontend expected `filePath` (camelCase)
   - **Error**: `No source found for session path: <hash>` when clicking sessions
   - **Fix**: Changed backend to use camelCase: `filePath`, `projectHash`, `fileSizeBytes`
   - **Lesson**: **ALWAYS use camelCase for metadata fields from day 1**

2. **Missing Validation Command**
   - **Problem**: Initially used `scan_gemini_projects` for validation
   - **Fix**: Added dedicated `validate_gemini_folder` command
   - **Lesson**: Create validation command in Phase 1, not as afterthought

3. **Auto-Detection Not Working**
   - **Problem**: App loaded saved sources, skipped auto-detection
   - **Fix**: Added `get_gemini_path` and auto-detection logic
   - **Lesson**: Implement detection commands AND frontend integration together

4. **Frontend Adapter Parameters**
   - **Problem**: `loadMessages()` interface doesn't support `projectId`/`sourceId`
   - **Current Workaround**: Pass empty strings, backend doesn't use them
   - **Lesson**: Check interface signatures before implementing

### 🎯 Codex-Specific Challenges

Based on analysis, Codex will be **MORE COMPLEX** than Gemini:

| Aspect | Gemini | Codex | Complexity |
|--------|--------|-------|------------|
| **File Format** | Single JSON | JSONL (streaming) | 🔴 Higher |
| **Filename Parsing** | Simple | Regex required (timestamp + UUID) | 🔴 Higher |
| **Session ID** | Direct from JSON | Priority logic (internal > filename) | 🔴 Higher |
| **CWD Resolution** | SHA-256 hash | Multi-strategy extraction | 🔴 Higher |
| **Event Structure** | Simple | Nested payloads | 🔴 Higher |
| **File Size** | Small (~100KB) | Large (1-50MB) | 🟡 Medium |

**Estimated Complexity**: **1.5x Gemini** → 5-7 days total

---

## Codex CLI Analysis

### File Location & Structure

```
~/.codex/sessions/
  └── YYYY/
      └── MM/
          └── DD/
              ├── rollout-2025-01-27T10-30-45-abc123def456.jsonl
              ├── rollout-2025-01-27T14-15-22-xyz789ghi012.jsonl
              └── ...
```

**Filename Pattern**: `rollout-YYYY-MM-DDThh-mm-ss-<UUID>.jsonl`

### JSONL Event Format

**User Message**:
```json
{
  "type": "event_msg",
  "timestamp": "2025-01-27T10:30:45.123Z",
  "payload": {
    "type": "user_message",
    "role": "user",
    "content": "Fix this bug",
    "message_id": "msg-001"
  }
}
```

**Assistant Message**:
```json
{
  "type": "event_msg",
  "timestamp": "2025-01-27T10:30:46.456Z",
  "session_id": "internal-session-xyz",
  "payload": {
    "type": "assistant_message",
    "role": "assistant",
    "model": "gpt-4o-mini",
    "content": [
      {
        "type": "text",
        "text": "I'll help you fix that..."
      }
    ]
  }
}
```

**Tool Call**:
```json
{
  "type": "event_msg",
  "timestamp": "2025-01-27T10:30:47.789Z",
  "payload": {
    "type": "tool_call",
    "tool_name": "bash",
    "input": {"command": "ls -la"}
  }
}
```

**Tool Result**:
```json
{
  "type": "event_msg",
  "timestamp": "2025-01-27T10:30:48.012Z",
  "payload": {
    "type": "tool_result",
    "tool_name": "bash",
    "stdout": "total 42\n-rw-r--r-- 1 user staff 1024 Jan 27 10:30 file.txt",
    "stderr": "",
    "exit_code": 0
  }
}
```

**Environment Context** (contains CWD):
```json
{
  "type": "event_msg",
  "timestamp": "2025-01-27T10:30:45.000Z",
  "payload": {
    "type": "environment_context",
    "cwd": "/Users/user/project",
    "shell": "bash",
    "os": "darwin"
  }
}
```

### Key Differences from Gemini

| Feature | Gemini | Codex |
|---------|--------|-------|
| **File Format** | Single JSON | JSONL (line-by-line) |
| **Messages Field** | `messages` array | N/A (events are lines) |
| **Event Wrapper** | Direct in array | `payload` nesting |
| **Session ID** | `sessionId` at root | `session_id` in events OR filename UUID |
| **Timestamp** | At session level | Per event |
| **CWD** | `projectHash` (SHA-256) | `cwd` field or XML tags |
| **Model** | At session level | Per assistant message |
| **File Size** | ~100KB | 1-50MB (needs streaming) |

---

## Architecture Overview

### Data Flow

```
Codex JSONL File (~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl)
         ↓
Backend Rust Adapter (src-tauri/src/commands/adapters/codex.rs)
  - Parse filename → extract timestamp + UUID
  - Stream JSONL → parse line-by-line
  - Extract session ID (internal > filename UUID)
  - Extract CWD (environment_context > XML tags > JSON field)
  - Convert to UniversalMessage
         ↓
UniversalSession / UniversalMessage (with metadata)
         ↓
Frontend Adapter (src/adapters/providers/CodexAdapter.ts)
  - Calls Tauri commands
  - Handles errors
  - Returns UniversalSession/UniversalMessage
         ↓
UI Components (React)
```

### Module Structure

```
src-tauri/src/
  └── commands/
      ├── adapters/
      │   ├── codex.rs          ← NEW: Codex conversion logic
      │   ├── gemini.rs         ← Existing
      │   ├── claude_code.rs    ← Existing
      │   └── mod.rs            ← UPDATE: export codex
      └── codex.rs              ← NEW: Tauri commands

src/adapters/
  └── providers/
      ├── CodexAdapter.ts       ← NEW: Frontend adapter
      ├── GeminiAdapter.ts      ← Existing
      └── ClaudeCodeAdapter.ts  ← Existing
```

---

## Implementation Plan

### Phase 1: Backend - Codex Adapter (Days 1-3)

#### Task 1.1: Filename Parser (Day 1 Morning)

**File**: `src-tauri/src/commands/adapters/codex.rs`

```rust
use chrono::{DateTime, NaiveDateTime, Utc};
use regex::Regex;

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

    // Parse timestamp: YYYY-MM-DDThh-mm-ss → DateTime
    let naive = NaiveDateTime::parse_from_str(timestamp_str, "%Y-%m-%dT%H-%M-%S").ok()?;
    let timestamp = DateTime::from_naive_utc_and_offset(naive, Utc);

    Some(CodexFilename {
        timestamp,
        session_id,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_codex_filename() {
        let result = parse_codex_filename("rollout-2025-01-27T10-30-45-abc123def456.jsonl");
        assert!(result.is_some());

        let parsed = result.unwrap();
        assert_eq!(parsed.session_id, "abc123def456");
        // Test timestamp...
    }
}
```

**Lesson Applied**: ✅ Test filename parsing FIRST before implementing full parser

---

#### Task 1.2: JSONL Streaming Parser (Day 1 Afternoon)

> **📋 Reference:** This pattern is **directly copied from Claude Code's `session.rs:38-70`**
> Use the proven BufReader streaming approach for efficient JSONL parsing.

```rust
use serde_json::Value;
use std::fs::File;
use std::io::{BufRead, BufReader};

pub struct CodexSession {
    pub session_id: Option<String>,
    pub events: Vec<Value>, // Raw JSON events
}

/// Parse Codex JSONL session file using BufReader streaming
/// Pattern copied from Claude Code's session.rs:38-70 for proven performance
pub fn parse_codex_session(file_path: &Path) -> Result<CodexSession, String> {
    let file = File::open(file_path)
        .map_err(|e| format!("Failed to open Codex session: {}", e))?;

    // BufReader for memory-efficient line-by-line reading (Claude Code pattern)
    let reader = BufReader::new(file);
    let mut events = Vec::new();
    let mut session_id = None;

    // Iterate through lines with enumeration for error reporting
    for (line_num, line_result) in reader.lines().enumerate() {
        let line = line_result
            .map_err(|e| format!("Failed to read line {}: {}", line_num + 1, e))?;

        // Skip empty lines (Claude Code pattern)
        if line.trim().is_empty() {
            continue;
        }

        // Parse JSON line - continue on error for graceful degradation
        let event: Value = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(e) => {
                eprintln!("⚠️ Line {}: Parse error: {}", line_num + 1, e);
                continue; // Don't fail entire file for one bad line
            }
        };

        // Extract session_id from internal field (Codex-specific logic)
        if session_id.is_none() {
            // Try internal.session.id first
            if let Some(id) = event
                .get("internal")
                .and_then(|i| i.get("session"))
                .and_then(|s| s.get("id"))
                .and_then(|v| v.as_str())
            {
                session_id = Some(id.to_string());
            }
        }

        events.push(event);
    }

    Ok(CodexSession {
        session_id,
        events,
    })
}
```

**Patterns Reused from Claude Code:**
- ✅ BufReader for streaming (no full file load)
- ✅ `.lines().enumerate()` for line-by-line + line numbers
- ✅ `continue` on parse errors (graceful degradation)
- ✅ Skip empty lines silently
- ✅ Memory efficient for 10-50MB files

---

#### Task 1.3: Event Conversion (Day 2 Morning)

```rust
use crate::models::universal::*;
use serde_json::{json, Value};
use std::collections::HashMap;

pub fn codex_event_to_universal(
    event: &Value,
    session_id: String,
    project_id: String,
    source_id: String,
    sequence_number: i32,
) -> Result<UniversalMessage, String> {
    // Extract timestamp
    let timestamp = event.get("timestamp")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    // Extract payload
    let payload = event.get("payload")
        .ok_or("Missing payload field")?;

    // Determine event type
    let event_type = payload.get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    // Determine role
    let role = determine_codex_role(payload);

    // Extract content
    let content = extract_codex_content(payload, event_type)?;

    // Extract tool calls
    let tool_calls = extract_codex_tool_calls(payload, event_type);

    // Build provider_metadata (CAMELCASE! - Lesson learned)
    let mut provider_metadata = HashMap::new();
    provider_metadata.insert("originalType".to_string(), json!(event_type)); // camelCase!
    provider_metadata.insert("rawEvent".to_string(), event.clone());

    Ok(UniversalMessage {
        id: format!("codex-{}-{}", session_id, sequence_number),
        session_id,
        project_id,
        source_id,
        provider_id: "codex".to_string(),
        timestamp,
        sequence_number,
        role,
        message_type: MessageType::Message,
        content,
        parent_id: payload.get("parent_id").and_then(|v| v.as_str()).map(String::from),
        depth: None,
        branch_id: None,
        model: payload.get("model").and_then(|v| v.as_str()).map(String::from),
        tokens: None, // Codex doesn't expose tokens
        tool_calls,
        thinking: None,
        attachments: None,
        errors: None,
        original_format: "codex_jsonl".to_string(),
        provider_metadata,
    })
}

fn determine_codex_role(payload: &Value) -> MessageRole {
    let role_str = payload.get("role")
        .or(payload.get("type"))
        .and_then(|v| v.as_str())
        .unwrap_or("assistant");

    match role_str {
        "user" | "user_message" => MessageRole::User,
        "assistant" | "assistant_message" | "model" => MessageRole::Assistant,
        "system" => MessageRole::System,
        "tool" | "tool_result" => MessageRole::Function,
        _ => MessageRole::Assistant,
    }
}

fn extract_codex_content(payload: &Value, event_type: &str) -> Result<Vec<UniversalContent>, String> {
    let mut items = Vec::new();

    // Handle different content structures
    if let Some(content) = payload.get("content") {
        if let Some(text) = content.as_str() {
            // Simple string content
            items.push(UniversalContent {
                content_type: ContentType::Text,
                data: json!({"text": text}),
                encoding: None,
                mime_type: None,
                size: Some(text.len()),
                hash: None,
            });
        } else if let Some(arr) = content.as_array() {
            // Array content (like Claude Code)
            for item in arr {
                if let Some(item_type) = item.get("type").and_then(|v| v.as_str()) {
                    match item_type {
                        "text" => {
                            if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                                items.push(UniversalContent {
                                    content_type: ContentType::Text,
                                    data: json!({"text": text}),
                                    encoding: None,
                                    mime_type: None,
                                    size: Some(text.len()),
                                    hash: None,
                                });
                            }
                        }
                        _ => {
                            // Preserve unknown types in metadata
                            items.push(UniversalContent {
                                content_type: ContentType::Text,
                                data: item.clone(),
                                encoding: None,
                                mime_type: None,
                                size: None,
                                hash: None,
                            });
                        }
                    }
                }
            }
        }
    }

    // Tool result content
    if event_type == "tool_result" {
        let mut result_text = String::new();

        if let Some(stdout) = payload.get("stdout").and_then(|v| v.as_str()) {
            if !stdout.is_empty() {
                result_text.push_str(stdout);
            }
        }

        if let Some(stderr) = payload.get("stderr").and_then(|v| v.as_str()) {
            if !stderr.is_empty() {
                if !result_text.is_empty() {
                    result_text.push_str("\n\n");
                }
                result_text.push_str("STDERR:\n");
                result_text.push_str(stderr);
            }
        }

        if !result_text.is_empty() {
            items.push(UniversalContent {
                content_type: ContentType::ToolResult,
                data: json!({
                    "content": result_text,
                    "exitCode": payload.get("exit_code"),
                }),
                encoding: None,
                mime_type: Some("text/plain".to_string()),
                size: Some(result_text.len()),
                hash: None,
            });
        }
    }

    Ok(items)
}

fn extract_codex_tool_calls(payload: &Value, event_type: &str) -> Option<Vec<ToolCall>> {
    if event_type != "tool_call" {
        return None;
    }

    let tool_name = payload.get("tool_name")
        .and_then(|v| v.as_str())?
        .to_string();

    let input_value = payload.get("input").cloned().unwrap_or(json!({}));

    // Convert Value to HashMap
    let input = if let Some(obj) = input_value.as_object() {
        obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    } else {
        HashMap::new()
    };

    Some(vec![ToolCall {
        id: format!("tool-{}", uuid::Uuid::new_v4()),
        name: tool_name,
        input,
        output: None,
        error: None,
        status: ToolCallStatus::Success,
    }])
}
```

**Lesson Applied**: ✅ Use camelCase for all metadata fields

---

#### Task 1.4: Session & Project Conversion (Day 2 Afternoon)

```rust
pub fn codex_file_to_session(
    file_path: &Path,
    project_id: String,
    source_id: String,
) -> Result<UniversalSession, String> {
    // Parse filename
    let filename = file_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid filename")?;

    let filename_data = parse_codex_filename(filename)
        .ok_or("Failed to parse Codex filename")?;

    // Parse JSONL file
    let session_data = parse_codex_session(file_path)?;

    // Resolve session ID (internal > filename UUID)
    let session_id = session_data.session_id
        .unwrap_or(filename_data.session_id);

    // Extract CWD from environment_context events
    let cwd = extract_cwd_from_events(&session_data.events);

    // Extract title from first user message
    let title = extract_first_user_message(&session_data.events)
        .unwrap_or_else(|| "Untitled Session".to_string());

    // Extract model from assistant messages
    let model = extract_model_from_events(&session_data.events);

    // Build metadata (CAMELCASE! - Lesson learned)
    let mut metadata = HashMap::new();
    metadata.insert("filePath".to_string(), json!(file_path.to_string_lossy())); // camelCase!
    metadata.insert("filenameTimestamp".to_string(), json!(filename_data.timestamp.to_rfc3339())); // camelCase!
    metadata.insert("filenameUuid".to_string(), json!(filename_data.session_id)); // camelCase!

    if let Some(ref cwd_path) = cwd {
        metadata.insert("cwd".to_string(), json!(cwd_path));
    }

    if let Some(ref model_name) = model {
        metadata.insert("model".to_string(), json!(model_name));
    }

    // File size
    if let Ok(file_metadata) = fs::metadata(file_path) {
        metadata.insert("fileSizeBytes".to_string(), json!(file_metadata.len())); // camelCase!
    }

    // Calculate timestamps
    let first_message_at = session_data.events.first()
        .and_then(|e| e.get("timestamp"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| filename_data.timestamp.to_rfc3339());

    let last_message_at = session_data.events.last()
        .and_then(|e| e.get("timestamp"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| first_message_at.clone());

    Ok(UniversalSession {
        id: session_id,
        project_id,
        source_id,
        provider_id: "codex".to_string(),
        title,
        description: None,
        message_count: session_data.events.len(),
        first_message_at,
        last_message_at,
        duration: 0,
        total_tokens: None,
        tool_call_count: count_tool_calls(&session_data.events),
        error_count: count_errors(&session_data.events),
        metadata,
        checksum: compute_sha256_file(file_path)?,
    })
}

fn extract_cwd_from_events(events: &[Value]) -> Option<String> {
    // Priority 1: environment_context event
    for event in events {
        if let Some(payload) = event.get("payload") {
            if payload.get("type").and_then(|v| v.as_str()) == Some("environment_context") {
                if let Some(cwd) = payload.get("cwd").and_then(|v| v.as_str()) {
                    return Some(cwd.to_string());
                }
            }
        }
    }

    // Priority 2: XML tags in content (Agent Sessions pattern)
    let cwd_regex = Regex::new(r"<cwd>(.*?)</cwd>").unwrap();
    for event in events {
        if let Some(payload) = event.get("payload") {
            if let Some(content) = payload.get("content").and_then(|v| v.as_str()) {
                if let Some(captures) = cwd_regex.captures(content) {
                    if let Some(cwd_match) = captures.get(1) {
                        return Some(cwd_match.as_str().to_string());
                    }
                }
            }
        }
    }

    None
}

fn extract_first_user_message(events: &[Value]) -> Option<String> {
    for event in events {
        if let Some(payload) = event.get("payload") {
            let event_type = payload.get("type").and_then(|v| v.as_str());
            let role = payload.get("role").and_then(|v| v.as_str());

            if event_type == Some("user_message") || role == Some("user") {
                // Try to extract text
                if let Some(content) = payload.get("content") {
                    if let Some(text) = content.as_str() {
                        // Truncate to 100 chars for title
                        return Some(text.chars().take(100).collect());
                    }
                }
            }
        }
    }

    None
}

fn extract_model_from_events(events: &[Value]) -> Option<String> {
    for event in events {
        if let Some(payload) = event.get("payload") {
            if let Some(model) = payload.get("model").and_then(|v| v.as_str()) {
                return Some(model.to_string());
            }
        }
    }

    None
}

fn count_tool_calls(events: &[Value]) -> i32 {
    events.iter()
        .filter(|e| {
            e.get("payload")
                .and_then(|p| p.get("type"))
                .and_then(|v| v.as_str()) == Some("tool_call")
        })
        .count() as i32
}

fn count_errors(events: &[Value]) -> i32 {
    events.iter()
        .filter(|e| {
            e.get("payload")
                .and_then(|p| p.get("type"))
                .and_then(|v| v.as_str()) == Some("error")
        })
        .count() as i32
}

fn compute_sha256_file(path: &Path) -> Result<String, String> {
    use sha2::{Sha256, Digest};

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file for checksum: {}", e))?;

    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}
```

**Lesson Applied**: ✅ All metadata fields use camelCase

---

#### Task 1.5: Project Scanning (Day 3 Morning)

```rust
pub fn codex_sessions_to_projects(
    codex_root: &Path,
    source_id: String,
) -> Result<Vec<UniversalProject>, String> {
    // Find all rollout-*.jsonl files
    let session_files = find_codex_sessions(codex_root)?;

    // Codex has no project hierarchy - create single "Codex Sessions" project
    let project_id = format!("codex-{}", source_id);
    let project_path = codex_root.to_string_lossy().to_string();

    let project = UniversalProject {
        id: project_id,
        source_id,
        provider_id: "codex".to_string(),
        name: "Codex Sessions".to_string(),
        path: project_path,
        session_count: session_files.len(),
        total_messages: 0, // Calculated when sessions are loaded
        first_activity_at: None,
        last_activity_at: None,
        metadata: HashMap::new(),
    };

    Ok(vec![project])
}

fn find_codex_sessions(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut sessions = Vec::new();

    fn visit_dirs(dir: &Path, sessions: &mut Vec<PathBuf>) -> std::io::Result<()> {
        if dir.is_dir() {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();

                if path.is_dir() {
                    visit_dirs(&path, sessions)?;
                } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("rollout-") && name.ends_with(".jsonl") {
                        sessions.push(path);
                    }
                }
            }
        }
        Ok(())
    }

    visit_dirs(root, &mut sessions)
        .map_err(|e| format!("Failed to scan Codex sessions: {}", e))?;

    // Sort by filename descending (newest first)
    sessions.sort_by(|a, b| {
        b.file_name().cmp(&a.file_name())
    });

    Ok(sessions)
}
```

---

#### Task 1.6: Tauri Commands (Day 3 Afternoon)

**File**: `src-tauri/src/commands/codex.rs`

```rust
use crate::commands::adapters::codex::*;
use crate::models::universal::*;
use std::path::Path;

#[tauri::command]
pub async fn get_codex_path() -> Result<String, String> {
    let home_dir =
        dirs::home_dir().ok_or("HOME_DIRECTORY_NOT_FOUND: Could not determine home directory")?;

    // Check CODEX_HOME environment variable first
    if let Ok(codex_home) = std::env::var("CODEX_HOME") {
        if !codex_home.is_empty() {
            let codex_path = PathBuf::from(&codex_home).join("sessions");
            if codex_path.exists() {
                return Ok(codex_path.to_string_lossy().to_string());
            }
        }
    }

    // Default: ~/.codex/sessions
    let codex_path = home_dir.join(".codex").join("sessions");

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

#[tauri::command]
pub async fn validate_codex_folder(path: String) -> Result<bool, String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Ok(false);
    }

    // Check for .codex/sessions directory structure
    if path_buf.ends_with("sessions") && path_buf.parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str()) == Some(".codex")
    {
        // Look for at least one rollout-*.jsonl file
        let has_sessions = find_codex_sessions(&path_buf)
            .map(|sessions| !sessions.is_empty())
            .unwrap_or(false);

        return Ok(has_sessions);
    }

    // Also accept if it's the .codex directory itself
    let sessions_dir = path_buf.join("sessions");
    if sessions_dir.exists() && sessions_dir.is_dir() {
        let has_sessions = find_codex_sessions(&sessions_dir)
            .map(|sessions| !sessions.is_empty())
            .unwrap_or(false);

        return Ok(has_sessions);
    }

    Ok(false)
}

#[tauri::command]
pub async fn scan_codex_projects(
    codex_path: String,
    source_id: String,
) -> Result<Vec<UniversalProject>, String> {
    let path = Path::new(&codex_path);
    codex_sessions_to_projects(path, source_id)
}

#[tauri::command]
pub async fn load_codex_sessions(
    codex_path: String,
    project_id: String,
    source_id: String,
) -> Result<Vec<UniversalSession>, String> {
    let path = Path::new(&codex_path);
    let session_files = find_codex_sessions(path)?;

    let mut sessions = Vec::new();
    for file in session_files {
        match codex_file_to_session(&file, project_id.clone(), source_id.clone()) {
            Ok(session) => sessions.push(session),
            Err(e) => {
                eprintln!("Failed to parse Codex session {}: {}", file.display(), e);
                // Continue with other sessions (graceful degradation)
            }
        }
    }

    Ok(sessions)
}

#[tauri::command]
pub async fn load_codex_messages(
    session_path: String,
    session_id: String,
    project_id: String,
    source_id: String,
) -> Result<Vec<UniversalMessage>, String> {
    let path = Path::new(&session_path);

    // Parse JSONL file
    let session_data = parse_codex_session(path)?;

    // Convert each event to UniversalMessage
    let mut universal_messages = Vec::new();
    for (i, event) in session_data.events.iter().enumerate() {
        match codex_event_to_universal(
            event,
            session_id.clone(),
            project_id.clone(),
            source_id.clone(),
            i as i32,
        ) {
            Ok(msg) => universal_messages.push(msg),
            Err(e) => {
                eprintln!("Failed to parse Codex event {}: {}", i, e);
                // Continue with other messages (graceful degradation)
            }
        }
    }

    Ok(universal_messages)
}
```

---

#### Task 1.7: Register Commands (Day 3)

**File**: `src-tauri/src/commands/mod.rs`

```rust
pub mod codex; // v1.8.0 - Codex CLI support
```

**File**: `src-tauri/src/commands/adapters/mod.rs`

```rust
pub mod codex; // v1.8.0 - Codex CLI support
```

**File**: `src-tauri/src/lib.rs`

```rust
use crate::commands::{..., codex::*};

.invoke_handler(tauri::generate_handler![
    // ... existing commands ...

    // Codex CLI support (v1.8.0)
    get_codex_path,
    validate_codex_folder,
    scan_codex_projects,
    load_codex_sessions,
    load_codex_messages,
])
```

**Lesson Applied**: ✅ Create validation and path detection commands from the start

---

### Phase 2: Frontend - Codex Adapter (Day 4)

#### Task 2.1: Create CodexAdapter

**File**: `src/adapters/providers/CodexAdapter.ts`

```typescript
// ============================================================================
// CODEX CLI ADAPTER (v1.8.0)
// ============================================================================
// Adapter for Codex CLI conversation history (JSONL files)

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

export class CodexAdapter implements IConversationAdapter {
  public readonly providerId: string = ProviderID.CODEX;

  public readonly providerDefinition: ProviderDefinition = {
    id: ProviderID.CODEX,
    name: 'Codex CLI',
    version: '1.0.0',
    author: 'Various',
    description: 'Codex CLI conversation history from JSONL files',
    capabilities: {
      supportsThinking: false,
      supportsToolCalls: true,
      supportsBranching: false,
      supportsStreaming: false,
      supportsImages: false,
      supportsFiles: true,
      supportsFullTextSearch: false,
      supportsTokenCounting: false,
      supportsModelInfo: true,
      requiresAuth: false,
      requiresNetwork: false,
      isReadOnly: true, // v1.8.0: Read-only for now
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
        pattern: '.codex',
        weight: 90,
        required: true,
      },
      {
        type: 'directory',
        pattern: 'sessions',
        weight: 90,
        required: true,
      },
      {
        type: 'file',
        pattern: 'rollout-*.jsonl',
        weight: 80,
        required: false,
      },
    ],
    pathConfig: {
      projectsPath: 'sessions',
    },
    icon: '🔧',
    color: '#FF6B6B',
  };

  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('CodexAdapter already initialized');
    }

    if (typeof invoke !== 'function') {
      throw new Error('Tauri API not available - cannot initialize CodexAdapter');
    }

    this.initialized = true;
    console.log('✅ CodexAdapter initialized');
  }

  async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.initialized = false;
    console.log('🗑️  CodexAdapter disposed');
  }

  async validate(path: string): Promise<ValidationResult> {
    try {
      const isValid = await invoke<boolean>('validate_codex_folder', { path });

      if (!isValid) {
        return {
          isValid: false,
          confidence: 0,
          errors: [{
            code: ErrorCode.INVALID_FORMAT,
            message: 'Not a valid Codex CLI folder (missing .codex/sessions structure or no session files)',
          }],
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
        errors: [{
          code: errorCode,
          message: `Validation failed: ${(error as Error).message}`,
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
          missingPatterns: ['.codex directory', 'sessions directory', 'rollout-*.jsonl files'],
        };
      }

      return {
        canHandle: true,
        confidence: 95,
        matchedPatterns: ['.codex/sessions directory structure', 'rollout-*.jsonl files'],
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

  async scanProjects(sourcePath: string, sourceId: string): Promise<ScanResult<UniversalProject>> {
    this.ensureInitialized();

    try {
      const projects = await invoke<UniversalProject[]>('scan_codex_projects', {
        codexPath: sourcePath,
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
          code: classifyError(error as Error),
          message: (error as Error).message,
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
      const sessions = await invoke<UniversalSession[]>('load_codex_sessions', {
        codexPath: projectPath,
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
      return {
        success: false,
        error: {
          code: classifyError(error as Error),
          message: (error as Error).message,
          recoverable: true,
        },
      };
    }
  }

  async loadMessages(
    sessionPath: string,
    sessionId: string,
    options: LoadOptions
  ): Promise<LoadResult<UniversalMessage>> {
    this.ensureInitialized();

    try {
      const messages = await invoke<UniversalMessage[]>('load_codex_messages', {
        sessionPath,
        sessionId,
        projectId: '', // Codex backend doesn't need this
        sourceId: '',  // Codex backend doesn't need this
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
      return {
        success: false,
        error: {
          code: classifyError(error as Error),
          message: (error as Error).message,
          recoverable: true,
        },
      };
    }
  }

  async searchMessages(
    sourcePaths: string[],
    query: string,
    filters: AdapterSearchFilters
  ): Promise<SearchResult<UniversalMessage>> {
    return {
      success: false,
      error: {
        code: ErrorCode.PROVIDER_UNAVAILABLE,
        message: 'Codex search not yet implemented',
        recoverable: false,
      },
    };
  }

  async healthCheck(sourcePath: string): Promise<HealthStatus> {
    try {
      const validation = await this.validate(sourcePath);

      if (!validation.isValid) {
        return 'offline';
      }

      const scanResult = await this.scanProjects(sourcePath, 'health-check');

      if (!scanResult.success) {
        return 'degraded';
      }

      return 'healthy';
    } catch {
      return 'offline';
    }
  }

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
          message: 'Codex folder or session file not found. Please check the path.',
        };

      case ErrorCode.PARSE_ERROR:
        return {
          recoverable: true,
          retry: {
            shouldRetry: false,
            maxAttempts: 0,
            delayMs: 0,
          },
          message: 'Some Codex data has invalid format and will be skipped.',
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

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CodexAdapter not initialized. Call initialize() first.');
    }
  }
}
```

**Lesson Applied**: ✅ Frontend adapter matches backend exactly

---

#### Task 2.2: Register Codex Adapter

**File**: `src/types/providers.ts`

```typescript
export enum ProviderID {
  CLAUDE_CODE = 'claude-code',
  CURSOR = 'cursor',
  GEMINI = 'gemini',
  CODEX = 'codex', // v1.8.0
}
```

**File**: `src/adapters/registry/AdapterRegistry.ts`

```typescript
import { CodexAdapter } from '../providers/CodexAdapter'; // v1.8.0

private async registerBuiltinAdapters(): Promise<void> {
  const adapters: IConversationAdapter[] = [
    new ClaudeCodeAdapter(),
    new CursorAdapter(),
    new GeminiAdapter(),
    new CodexAdapter(), // v1.8.0
  ];
  // ...
}
```

---

#### Task 2.3: Add Auto-Detection

**File**: `src/store/useSourceStore.ts`

```typescript
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

**Lesson Applied**: ✅ Auto-detection added immediately

---

#### Task 2.4: i18n Translations (Day 4)

Update all 6 languages:

```json
// en/common.json
{
  "providers": {
    "codex": "Codex CLI"
  }
}

// ko/common.json
{
  "providers": {
    "codex": "Codex CLI"
  }
}

// ... repeat for ja, zh-CN, zh-TW, ru
```

Update splash screen for all languages:

```json
// en/splash.json
{
  "appTitle": "Claude Code, Cursor IDE, Gemini CLI & Codex CLI History Viewer"
}

// ... repeat for all languages
```

---

### Phase 3: Testing & Polish (Days 5-7)

#### Task 3.1: Create Test Fixtures (Day 5)

**File**: `tests/fixtures/codex-session-001.jsonl`

```jsonl
{"type":"event_msg","timestamp":"2025-01-27T10:30:45.000Z","session_id":"test-session-001","payload":{"type":"environment_context","cwd":"/Users/test/project","shell":"bash","os":"darwin"}}
{"type":"event_msg","timestamp":"2025-01-27T10:30:46.123Z","payload":{"type":"user_message","role":"user","content":"Fix this bug","message_id":"msg-001"}}
{"type":"event_msg","timestamp":"2025-01-27T10:30:47.456Z","payload":{"type":"assistant_message","role":"assistant","model":"gpt-4o-mini","content":[{"type":"text","text":"I'll help you fix that bug."}]}}
{"type":"event_msg","timestamp":"2025-01-27T10:30:48.789Z","payload":{"type":"tool_call","tool_name":"bash","input":{"command":"ls -la"}}}
{"type":"event_msg","timestamp":"2025-01-27T10:30:49.012Z","payload":{"type":"tool_result","tool_name":"bash","stdout":"total 42\n-rw-r--r-- 1 user staff 1024 Jan 27 10:30 file.txt","stderr":"","exit_code":0}}
```

Create test file with proper filename:
```
tests/fixtures/rollout-2025-01-27T10-30-45-abc123def456.jsonl
```

#### Task 3.2: Unit Tests (Day 5-6)

```rust
// src-tauri/src/commands/adapters/codex.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_filename() {
        let result = parse_codex_filename("rollout-2025-01-27T10-30-45-abc123.jsonl");
        assert!(result.is_some());

        let parsed = result.unwrap();
        assert_eq!(parsed.session_id, "abc123");
        // Verify timestamp is correct
    }

    #[test]
    fn test_extract_cwd() {
        let event = json!({
            "type": "event_msg",
            "payload": {
                "type": "environment_context",
                "cwd": "/Users/test/project"
            }
        });

        let events = vec![event];
        let cwd = extract_cwd_from_events(&events);
        assert_eq!(cwd, Some("/Users/test/project".to_string()));
    }

    // ... more tests
}
```

#### Task 3.3: Integration Test (Day 6)

```typescript
// tests/integration/codex-adapter.test.ts

describe('CodexAdapter', () => {
  let adapter: CodexAdapter;

  beforeEach(async () => {
    adapter = new CodexAdapter();
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  test('should detect Codex folder', async () => {
    const result = await adapter.canHandle('/path/to/.codex/sessions');
    expect(result.canHandle).toBe(true);
    expect(result.confidence).toBeGreaterThan(90);
  });

  test('should scan projects', async () => {
    const result = await adapter.scanProjects('/path/to/.codex/sessions', 'test');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data![0].name).toBe('Codex Sessions');
  });

  test('should load sessions', async () => {
    const result = await adapter.loadSessions('/path/to/.codex/sessions', 'project-1', 'test');
    expect(result.success).toBe(true);
  });

  test('should load messages', async () => {
    const result = await adapter.loadMessages(
      '/path/to/rollout-2025-01-27T10-30-45-abc123.jsonl',
      'session-1',
      {}
    );
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
```

#### Task 3.4: E2E Test (Day 7)

```typescript
// e2e/tests/codex-provider.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Codex Provider', () => {
  test('should auto-detect Codex installation', async ({ page }) => {
    await page.goto('http://localhost:1420');

    // Wait for sources to load
    await page.waitForSelector('[data-provider="codex"]', { timeout: 10000 });

    // Should show Codex source
    const codexSource = await page.locator('[data-provider="codex"]');
    await expect(codexSource).toBeVisible();
    await expect(codexSource).toContainText('Codex CLI');
  });

  test('should load Codex sessions', async ({ page }) => {
    await page.goto('http://localhost:1420');

    // Click on Codex source
    await page.click('[data-provider="codex"]');

    // Should show "Codex Sessions" project
    await expect(page.locator('text=Codex Sessions')).toBeVisible();

    // Expand project
    await page.click('text=Codex Sessions');

    // Should show sessions
    await expect(page.locator('[data-session]')).toHaveCount({ min: 1 });
  });

  test('should display Codex messages', async ({ page }) => {
    await page.goto('http://localhost:1420');

    // Navigate to first Codex session
    await page.click('[data-provider="codex"]');
    await page.click('text=Codex Sessions');
    await page.click('[data-session]:first-child');

    // Should show messages
    await expect(page.locator('[data-message]')).toHaveCount({ min: 1 });

    // Should show tool calls
    await expect(page.locator('[data-tool-call]')).toHaveCount({ min: 0 });
  });
});
```

---

## Testing Strategy

### Test Coverage Goals

- **Unit Tests**: 80% coverage for adapters
- **Integration Tests**: All adapter methods
- **E2E Tests**: Full user flow (detect → load → view)

### Test Checklist

- [ ] Filename parsing (valid formats)
- [ ] Filename parsing (invalid formats)
- [ ] JSONL streaming (small files <1MB)
- [ ] JSONL streaming (large files >10MB)
- [ ] Session ID resolution (internal)
- [ ] Session ID resolution (filename UUID)
- [ ] CWD extraction (environment_context)
- [ ] CWD extraction (XML tags)
- [ ] Event type detection (all types)
- [ ] Content extraction (text)
- [ ] Content extraction (tool results)
- [ ] Tool call extraction
- [ ] Error handling (malformed JSON)
- [ ] Error handling (missing file)
- [ ] Auto-detection
- [ ] Manual source addition
- [ ] Session loading
- [ ] Message rendering

---

## Rollout Plan

### Day 1: Backend Foundation
- [ ] Filename parser with tests
- [ ] JSONL streaming parser
- [ ] Commit: `feat: add Codex filename parser and JSONL reader`

### Day 2: Backend Conversion
- [ ] Event to UniversalMessage conversion
- [ ] Session to UniversalSession conversion
- [ ] Commit: `feat: add Codex event and session conversion`

### Day 3: Backend Commands
- [ ] Path detection commands
- [ ] Validation commands
- [ ] Scan/load commands
- [ ] Commit: `feat: add Codex Tauri commands`
- [ ] Build and test backend
- [ ] Commit: `test: add Codex backend unit tests`

### Day 4: Frontend Adapter
- [ ] CodexAdapter implementation
- [ ] Register in AdapterRegistry
- [ ] Add auto-detection
- [ ] Add i18n translations
- [ ] Commit: `feat: add Codex frontend adapter`
- [ ] Build and test frontend
- [ ] Commit: `test: add Codex frontend integration tests`

### Day 5: Test Fixtures
- [ ] Create test JSONL files
- [ ] Unit tests for all functions
- [ ] Commit: `test: add Codex unit test fixtures`

### Day 6: Integration Tests
- [ ] Integration tests for adapter
- [ ] Commit: `test: add Codex integration tests`

### Day 7: E2E Tests & Polish
- [ ] E2E tests for full flow
- [ ] Fix any bugs found
- [ ] Update documentation
- [ ] Commit: `test: add Codex E2E tests`
- [ ] Commit: `docs: update README with Codex support`

---

## Success Criteria

✅ **Functional Requirements**
- [ ] Codex folders auto-detected on startup
- [ ] Can manually add Codex source
- [ ] Sessions load successfully
- [ ] Messages display correctly
- [ ] Tool calls render properly
- [ ] CWD extracted and displayed
- [ ] Model information shown

✅ **Technical Requirements**
- [ ] All tests passing (unit + integration + E2E)
- [ ] TypeScript compilation successful
- [ ] Rust compilation successful
- [ ] ESLint warnings acceptable
- [ ] No data loss (all fields preserved)
- [ ] Performance acceptable (<2s for 100 sessions)

✅ **Quality Requirements**
- [ ] Code follows existing patterns
- [ ] camelCase used for all metadata fields
- [ ] Error handling is graceful
- [ ] User experience is smooth
- [ ] Documentation is complete

---

## Risk Mitigation

### High Risk: JSONL Parsing Performance

**Risk**: Large Codex files (10-50MB) could slow down parsing

**Mitigation**:
1. Use buffered reader (already implemented)
2. Add lightweight session loading (future)
3. Stream events instead of loading all into memory
4. Add progress indicator for large files

### Medium Risk: Session ID Resolution

**Risk**: Internal session_id might not always be present

**Mitigation**:
1. Priority logic: internal > filename UUID (implemented)
2. Always fallback to filename UUID
3. Log warnings when internal ID missing

### Low Risk: CWD Extraction

**Risk**: CWD might not be in first event

**Mitigation**:
1. Multi-strategy extraction (implemented)
2. Scan up to first 100 events for environment_context
3. Fallback to XML tag extraction
4. Accept empty CWD gracefully

---

## Lessons Applied from Gemini

| Lesson | How Applied in Codex |
|--------|---------------------|
| ✅ camelCase for metadata | All fields use camelCase from start |
| ✅ Validation command upfront | `validate_codex_folder` in Phase 1 |
| ✅ Auto-detection integration | `get_codex_path` + frontend detection |
| ✅ Test filename parsing first | Unit tests in Day 1 |
| ✅ Graceful error handling | Continue on individual parse failures |
| ✅ Zero data loss | All fields preserved in `provider_metadata` |
| ✅ Clear backend/frontend separation | Rust parses, TypeScript orchestrates |

---

## Estimated Timeline

| Phase | Days | Deliverable |
|-------|------|-------------|
| Backend Foundation | 1 | Filename parser, JSONL reader |
| Backend Conversion | 1 | Event/session conversion logic |
| Backend Commands | 1 | Tauri commands, validation |
| Frontend Adapter | 1 | CodexAdapter, auto-detection |
| Test Fixtures | 1 | Test JSONL files, unit tests |
| Integration Tests | 1 | Adapter integration tests |
| E2E Tests & Polish | 1 | E2E tests, documentation |
| **TOTAL** | **7 days** | **Complete Codex support** |

**Complexity Factor**: 1.75x Gemini (Gemini was 3 days, Codex is 5-7 days)

---

## Next Steps

1. ✅ Review this plan
2. ⏭️ Start Day 1: Filename parser
3. ⏭️ Commit after each day
4. ⏭️ Test continuously
5. ⏭️ Update documentation

**Ready to implement?** 🚀
