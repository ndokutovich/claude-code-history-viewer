# Codex Implementation: Reusing Claude Code JSONL Patterns

## Critical Insight

**Codex CLI uses JSONL format (just like Claude Code!)**

This means we should **heavily reference Claude Code's implementation** (`src-tauri/src/commands/adapters/claude_code.rs` and `session.rs`), not Gemini's JSON parser.

## Key Patterns to Reuse from Claude Code

### 1. JSONL Streaming with BufReader

**Pattern from Claude Code** (`session.rs:38-43`):
```rust
use std::io::{BufRead, BufReader};
use std::fs::File;

let file = File::open(path)?;
let reader = BufReader::new(file);

for (line_num, line_result) in reader.lines().enumerate() {
    let line = line_result.map_err(|e| format!("Failed to read line: {}", e))?;

    // Skip empty lines
    if line.trim().is_empty() {
        continue;
    }

    // Parse JSON from line
    let entry: RawLogEntry = serde_json::from_str(&line)
        .map_err(|e| format!("Line {}: Invalid JSON: {}", line_num + 1, e))?;

    // Process entry...
}
```

**Why This Pattern:**
- ✅ Memory efficient for large files (10-50MB)
- ✅ Line-by-line processing (doesn't load entire file)
- ✅ Graceful error handling per line
- ✅ Easy to add line number tracking for debugging

**Apply to Codex:**
Replace `RawLogEntry` with `CodexEvent`, use identical streaming approach.

---

### 2. Two-Stage Parsing Model

**Claude Code Pattern:**
```rust
// Stage 1: Raw JSONL structure (matches file format exactly)
#[derive(Debug, Deserialize)]
struct RawLogEntry {
    pub uuid: Option<String>,
    #[serde(rename = "parentUuid")]
    pub parent_uuid: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub timestamp: Option<String>,
    #[serde(rename = "type")]
    pub message_type: String,
    pub message: Option<MessageContent>,
    // ... other fields
}

// Stage 2: Validated/normalized structure
pub struct ClaudeMessage {
    pub uuid: String,          // Required (no Option)
    pub session_id: String,    // Required
    pub timestamp: String,     // Required
    pub message_type: String,
    pub content: Option<serde_json::Value>,
    // ... other fields
}
```

**Apply to Codex:**
```rust
// Stage 1: Raw Codex event (exactly as in JSONL)
#[derive(Debug, Deserialize)]
struct CodexEvent {
    pub id: Option<String>,
    pub timestamp: Option<String>,
    #[serde(rename = "type")]
    pub event_type: String,
    pub payload: Option<serde_json::Value>,
    // ... Codex-specific fields
}

// Stage 2: Validated Codex message
struct CodexMessage {
    pub id: String,           // Required
    pub timestamp: String,    // Required
    pub event_type: String,
    pub content: Option<serde_json::Value>,
    // ... normalized fields
}
```

---

### 3. Graceful Error Handling

**Claude Code Pattern** (`session.rs:43-70`):
```rust
for (line_num, line_result) in reader.lines().enumerate() {
    if let Ok(line) = line_result {
        if line.trim().is_empty() {
            continue;  // Skip empty lines silently
        }

        match serde_json::from_str::<RawLogEntry>(&line) {
            Ok(log_entry) => {
                // Process successfully parsed entry
                if let Some(msg) = convert_log_entry_to_message(log_entry) {
                    messages.push(msg);
                }
            }
            Err(e) => {
                // Log error but continue processing
                eprintln!("Line {}: Parse error: {}", line_num + 1, e);
                continue;  // Don't fail entire file for one bad line
            }
        }
    }
}
```

**Why This Pattern:**
- ✅ One corrupted line doesn't break entire session
- ✅ Handles malformed JSON gracefully
- ✅ Continues processing remaining messages
- ✅ Line numbers help debugging

**Apply to Codex:** Identical pattern - continue on errors.

---

### 4. Session Metadata Extraction

**Claude Code Pattern** (`session.rs:80-140`):
```rust
// Scan JSONL file to extract session metadata WITHOUT loading all messages
fn scan_session_file(file_path: PathBuf) -> Option<SessionMetadata> {
    let file = File::open(&file_path).ok()?;
    let reader = BufReader::new(file);

    let mut message_count = 0;
    let mut first_timestamp: Option<String> = None;
    let mut last_timestamp: Option<String> = None;
    let mut session_id: Option<String> = None;
    let mut has_tool_use = false;
    let mut has_errors = false;
    let mut summary: Option<String> = None;

    for line_result in reader.lines() {
        if let Ok(line) = line_result {
            if let Ok(entry) = serde_json::from_str::<RawLogEntry>(&line) {
                // Extract session ID from first message
                if session_id.is_none() {
                    session_id = entry.session_id.clone();
                }

                // Track timestamps
                if let Some(ts) = &entry.timestamp {
                    if first_timestamp.is_none() {
                        first_timestamp = Some(ts.clone());
                    }
                    last_timestamp = Some(ts.clone());
                }

                // Count messages
                if entry.message_type == "user" || entry.message_type == "assistant" {
                    message_count += 1;
                }

                // Check for tool use
                if entry.tool_use.is_some() {
                    has_tool_use = true;
                }

                // Extract summary
                if entry.message_type == "summary" {
                    summary = entry.summary.clone();
                }
            }
        }
    }

    Some(SessionMetadata {
        session_id: session_id?,
        message_count,
        first_timestamp,
        last_timestamp,
        has_tool_use,
        has_errors,
        summary,
    })
}
```

**Apply to Codex:**
- Scan `rollout-*.jsonl` files
- Extract session ID from internal field OR filename UUID
- Count events
- Extract start/end timestamps
- Detect CWD from environment_context
- Derive summary from first user event

---

### 5. Conversion to Universal Format

**Claude Code Pattern** (`adapters/claude_code.rs:18-136`):
```rust
pub fn claude_message_to_universal(
    msg: &ClaudeMessage,
    project_id: String,
    source_id: String,
    sequence_number: i32,
) -> UniversalMessage {
    // Extract role
    let role = determine_role(msg);

    // Determine message type
    let message_type = determine_message_type(msg);

    // Convert content
    let content = convert_content(msg);

    // Convert tool use
    let tool_calls = convert_tool_use(msg);

    // Extract thinking
    let thinking = extract_thinking(msg);

    // Convert tokens
    let tokens = msg.usage.as_ref().map(|u| TokenUsage { ... });

    // ⭐ CRITICAL: Use camelCase for metadata
    let mut metadata = HashMap::new();
    metadata.insert("filePath".to_string(), json!(file_path));  // camelCase!
    metadata.insert("projectHash".to_string(), json!(hash));   // camelCase!

    UniversalMessage {
        id: msg.uuid.clone(),
        session_id: msg.session_id.clone(),
        project_id,
        source_id,
        provider_id: "claude-code".to_string(),
        timestamp: msg.timestamp.clone(),
        sequence_number,
        role,
        message_type,
        content,
        parent_id: msg.parent_uuid.clone(),
        model: msg.model.clone(),
        tokens,
        tool_calls,
        thinking,
        errors: extract_errors(msg),
        original_format: "claude_jsonl".to_string(),
        provider_metadata: metadata,
        // ... other fields
    }
}
```

**Apply to Codex:**
```rust
pub fn codex_event_to_universal(
    event: &CodexEvent,
    project_id: String,
    source_id: String,
    sequence_number: i32,
) -> UniversalMessage {
    // Similar conversion logic

    // ⭐ CRITICAL: Use camelCase metadata from day 1
    let mut metadata = HashMap::new();
    metadata.insert("filePath".to_string(), json!(file_path));     // camelCase!
    metadata.insert("rolloutFile".to_string(), json!(filename));   // camelCase!
    metadata.insert("eventType".to_string(), json!(event_type));   // camelCase!

    UniversalMessage {
        id: event.id.clone(),
        provider_id: "codex".to_string(),
        original_format: "codex_jsonl".to_string(),
        // ... rest of conversion
    }
}
```

---

## Differences Between Claude Code and Codex

| Aspect | Claude Code | Codex CLI |
|--------|-------------|-----------|
| **File Format** | JSONL (✅ same) | JSONL (✅ same) |
| **File Naming** | `session-[uuid].jsonl` | `rollout-YYYY-MM-DDThh-mm-ss-[UUID].jsonl` |
| **Session ID** | Inside `sessionId` field | Inside `internal.session.id` OR filename UUID |
| **Message Structure** | Nested `message` object | Flat `payload` object |
| **Tool Use** | `toolUse` + `toolUseResult` | `tool_calls` array |
| **Thinking** | `content[].type: "thinking"` | Unknown (TBD from analysis) |
| **CWD** | Top-level field | `environment_context.cwd` |
| **File Size** | Typically 100KB-5MB | Can be 10-50MB |

---

## Implementation Checklist

Using Claude Code patterns, Codex implementation needs:

- [ ] **JSONL Streaming Parser** (BufReader + `.lines()`)
  - Reuse exact pattern from `session.rs:38-70`
  - Error handling: continue on bad lines

- [ ] **Two-Stage Model** (CodexEvent → CodexMessage)
  - Raw deserialization with `Option<T>` fields
  - Validated struct with required fields

- [ ] **Session Scanning** (metadata without loading all events)
  - Reuse pattern from `session.rs:80-140`
  - Fast scanning for session list display

- [ ] **Filename Parser** (regex for `rollout-*.jsonl`)
  - Extract timestamp and UUID from filename
  - Fall back to UUID if session ID not in events

- [ ] **Universal Conversion** (CodexMessage → UniversalMessage)
  - Reuse pattern from `claude_code.rs:18-136`
  - **⭐ camelCase metadata from start!**

- [ ] **CWD Extraction** (priority: environment_context > XML > JSON)
  - Multi-strategy extraction (like Claude Code's content parsing)

- [ ] **Tool Call Conversion** (Codex tool_calls → UniversalMessage)
  - Similar to Claude Code's `convert_tool_use()`

- [ ] **Error Extraction** (tool errors, event errors)
  - Similar to Claude Code's `extract_errors()`

---

## Code Reuse Opportunities

### 1. Direct Copy (with minimal changes):

```rust
// From session.rs - JSONL streaming pattern
fn read_jsonl_streaming<T: DeserializeOwned>(
    file_path: &Path
) -> Result<Vec<T>, String> {
    use std::io::{BufRead, BufReader};

    let file = File::open(file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);

    let mut items = Vec::new();

    for (line_num, line_result) in reader.lines().enumerate() {
        let line = line_result
            .map_err(|e| format!("Failed to read line: {}", e))?;

        if line.trim().is_empty() {
            continue;
        }

        match serde_json::from_str::<T>(&line) {
            Ok(item) => items.push(item),
            Err(e) => {
                eprintln!("Line {}: Parse error: {}", line_num + 1, e);
                continue;  // Graceful degradation
            }
        }
    }

    Ok(items)
}
```

Use this for both:
- `src-tauri/src/commands/adapters/codex.rs`
- Any other JSONL-based provider in the future

### 2. Adapt (Claude Code → Codex):

```rust
// Claude Code version
fn extract_session_id(entry: &RawLogEntry) -> Option<String> {
    entry.session_id.clone()
}

// Codex version (multi-source priority)
fn extract_session_id(
    event: &CodexEvent,
    filename: &str
) -> Option<String> {
    // Priority 1: Internal session ID
    if let Some(id) = event.payload
        .as_ref()
        .and_then(|p| p.get("internal"))
        .and_then(|i| i.get("session"))
        .and_then(|s| s.get("id"))
        .and_then(|v| v.as_str())
    {
        return Some(id.to_string());
    }

    // Priority 2: Extract UUID from filename
    extract_uuid_from_filename(filename)
}
```

---

## Lessons from Gemini (Still Valuable)

While Codex should primarily reference Claude Code, these Gemini lessons still apply:

1. **Metadata camelCase** - Critical for frontend compatibility
2. **Auto-detection** - Add to source store
3. **Validation commands** - `get_codex_path`, `validate_codex_folder`
4. **Frontend adapter** - TypeScript layer for UniversalMessage → UIMessage
5. **i18n updates** - All 6 languages

---

## Summary

**Codex Implementation Strategy:**
1. ✅ **Primary Reference**: Claude Code JSONL patterns
2. ✅ **Secondary Reference**: Gemini integration workflow
3. ✅ **Key Difference**: Filename parsing + multi-source session ID

**Next Step:** Update `CODEX_IMPLEMENTATION_PLAN.md` to explicitly reference Claude Code patterns and include code snippets above.
