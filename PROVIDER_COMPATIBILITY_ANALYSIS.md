# Provider Compatibility Analysis: Agent Sessions vs Our Architecture

## Executive Summary

**Compatibility:** ✅ **HIGHLY COMPATIBLE** - Their architecture maps cleanly to ours!

**Effort to Port:**
- **Gemini CLI**: 🟢 **EASY** (2-3 days)
- **Codex CLI**: 🟡 **MEDIUM** (3-5 days)

---

## Their Architecture vs Ours

### 1. Data Models

| Agent Sessions | Our App | Compatibility |
|----------------|---------|---------------|
| `SessionSource` enum (codex/claude/gemini) | `ProviderID` enum | ✅ **100% Compatible** |
| `Session` struct | `UniversalSession` | ✅ **95% Compatible** |
| `SessionEvent` struct | `UniversalMessage` | ✅ **90% Compatible** |
| `SessionEventKind` enum | Message `role` + `type` | ✅ **85% Compatible** |

### 2. Parser Architecture

#### Agent Sessions (Swift):
```swift
protocol SessionDiscovery {
    func sessionsRoot() -> URL
    func discoverSessionFiles() -> [URL]
}

class ClaudeSessionParser {
    static func parseFile(at url: URL) -> Session?
    static func parseFileFull(at url: URL) -> Session?
    static func lightweightSession(from url: URL) -> Session?
}

class GeminiSessionParser {
    static func parseFile(at url: URL) -> Session?
    static func parseFileFull(at url: URL) -> Session?
}

// Codex uses ClaudeSessionParser (shared logic!)
```

#### Our App (Rust + TypeScript):
```rust
// src-tauri/src/commands/adapters/
trait ProviderAdapter {
    fn scan_projects(path: &str) -> Vec<UniversalProject>
    fn load_sessions(path: &str) -> Vec<UniversalSession>
    fn load_messages(path: &str) -> Vec<UniversalMessage>
}

struct ClaudeCodeAdapter implements ProviderAdapter
struct CursorAdapter implements ProviderAdapter
```

```typescript
// src/adapters/providers/
interface IConversationAdapter {
    scanProjects(path: string): Promise<UniversalProject[]>
    loadSessions(path: string): Promise<UniversalSession[]>
    loadMessages(path: string): Promise<UniversalMessage[]>
}

class ClaudeCodeAdapter implements IConversationAdapter
class CursorAdapter implements IConversationAdapter
```

**Compatibility:** ✅ **IDENTICAL PATTERNS!** Just different languages

---

## Field Mapping

### Session/UniversalSession

| Agent Sessions (`Session`) | Our App (`UniversalSession`) | Mapping Difficulty |
|----------------------------|------------------------------|-------------------|
| `id: String` | `id: string` | ✅ Direct |
| `source: SessionSource` | `providerId: string` | ✅ Direct (enum → string) |
| `startTime: Date?` | `firstMessageAt: string` | ✅ Convert Date → ISO string |
| `endTime: Date?` | `lastMessageAt: string` | ✅ Convert Date → ISO string |
| `model: String?` | N/A (in metadata) | ✅ Add to metadata |
| `filePath: String` | `metadata.filePath` | ✅ Direct |
| `fileSizeBytes: Int?` | N/A | ✅ Add to metadata |
| `eventCount: Int` | `messageCount: number` | ✅ Direct |
| `events: [SessionEvent]` | N/A (loaded separately) | ✅ Different pattern, but works |
| `cwd: String?` | N/A | ✅ Add to metadata |
| `lightweightCwd: String?` | N/A | ✅ Not needed |
| `lightweightTitle: String?` | `title: string` | ✅ Direct |

### SessionEvent/UniversalMessage

| Agent Sessions (`SessionEvent`) | Our App (`UniversalMessage`) | Mapping Difficulty |
|---------------------------------|------------------------------|-------------------|
| `id: String` | `id: string` | ✅ Direct |
| `timestamp: Date?` | `timestamp: string` | ✅ Convert Date → ISO |
| `kind: SessionEventKind` | N/A (derived from role/content) | ✅ Map to role |
| `role: String?` | `role: string` | ✅ Direct |
| `text: String?` | `content` (text item) | ✅ Direct |
| `toolName: String?` | `content` (tool_use.name) | ✅ Extract from content array |
| `toolInput: String?` | `content` (tool_use.input) | ✅ Extract from content array |
| `toolOutput: String?` | `content` (tool_result.content) | ✅ Extract from content array |
| `messageID: String?` | `id` | ✅ Same concept |
| `parentID: String?` | `parent_id` | ✅ Direct |
| `isDelta: Bool` | N/A | ✅ Not needed |
| `rawJSON: String` | N/A | ✅ Optional, can add |

---

## Gemini CLI Support - How Easy?

### What They Have:

**File Location:**
- `~/.gemini/tmp/**/session-*.json`
- Single JSON file per session (not JSONL)

**Format:**
```json
{
  "sessionId": "...",
  "projectHash": "sha256-of-cwd",
  "startTime": "2025-01-01T00:00:00Z",
  "lastUpdated": "2025-01-01T01:00:00Z",
  "model": "gemini-1.5-pro",
  "messages": [
    {
      "type": "user" | "gemini" | "model",
      "role": "user" | "assistant",
      "content": "...",
      "timestamp": "..."
    }
  ]
}
```

**Parser Logic (GeminiSessionParser.swift:1-200):**
1. Read entire JSON file
2. Extract `messages` array (or fallback to root array, or `history` field)
3. Extract metadata: `sessionId`, `projectHash`, `startTime`, `lastUpdated`, `model`
4. **Resolve CWD**: Use `projectHash` with `GeminiHashResolver` (SHA-256 of path)
5. Parse messages:
   - Map `type` → `role` (user, gemini→assistant, model→assistant)
   - Extract `content` as text
   - Extract tool calls if present
6. Build `Session` with `source: .gemini`

**GeminiHashResolver:**
- Maps SHA-256 hash → actual file path
- Seeded from Codex/Claude sessions (learns CWD from other providers!)
- Smart heuristic fallback

### Port Difficulty: 🟢 **EASY (2-3 days)**

**Why Easy:**
1. ✅ Single JSON file (not streaming JSONL like Claude)
2. ✅ Simple message structure (no complex tool_use arrays)
3. ✅ CWD resolution is elegant (SHA-256 mapping)
4. ✅ No pagination needed (files are small)

**Implementation Steps:**

1. **Rust Backend (1 day)**
   ```rust
   // src-tauri/src/commands/adapters/gemini.rs

   pub struct GeminiAdapter;

   impl ProviderAdapter for GeminiAdapter {
       fn scan_projects(&self, path: &str) -> Result<Vec<UniversalProject>> {
           // Find ~/.gemini/tmp/**/session-*.json files
           // Group by parent directory (project hash)
       }

       fn load_sessions(&self, path: &str) -> Result<Vec<UniversalSession>> {
           // Read session-*.json files
           // Parse metadata (sessionId, model, timestamps)
       }

       fn load_messages(&self, session_path: &str) -> Result<Vec<UniversalMessage>> {
           // Read JSON file
           // Parse messages array
           // Convert to UniversalMessage
       }
   }
   ```

2. **Frontend Adapter (0.5 days)**
   ```typescript
   // src/adapters/providers/GeminiAdapter.ts

   export class GeminiAdapter extends BaseProviderAdapter {
       providerId = ProviderID.GEMINI

       async scanProjects(path: string) {
           return invoke<UniversalProject[]>('scan_gemini_projects', { path })
       }

       async loadSessions(projectPath: string) {
           return invoke<UniversalSession[]>('load_gemini_sessions', { projectPath })
       }

       async loadMessages(sessionPath: string) {
           return invoke<UniversalMessage[]>('load_gemini_messages', { sessionPath })
       }
   }
   ```

3. **CWD Resolution (0.5 days)**
   ```rust
   // src-tauri/src/commands/adapters/gemini_hash_resolver.rs

   struct GeminiHashResolver {
       map: HashMap<String, String>, // hash → cwd
   }

   impl GeminiHashResolver {
       fn resolve(&self, hash: &str) -> Option<String> {
           self.map.get(hash).cloned()
       }

       fn seed_from_other_sessions(&mut self, sessions: &[Session]) {
           for session in sessions {
               if let Some(cwd) = &session.cwd {
                   let hash = sha256(cwd);
                   self.map.insert(hash, cwd.clone());
               }
           }
       }
   }
   ```

4. **Register in AdapterRegistry (0.5 days)**
   ```typescript
   // src/adapters/registry/AdapterRegistry.ts

   private async registerBuiltinAdapters(): Promise<void> {
       const adapters = [
           new ClaudeCodeAdapter(),
           new CursorAdapter(),
           new GeminiAdapter(), // ADD THIS
       ];
       // ... rest
   }
   ```

5. **Add i18n translations (0.5 days)**
   ```json
   // src/i18n/locales/en/common.json
   {
       "providers": {
           "gemini": "Gemini CLI"
       }
   }
   ```

**Total:** 2-3 days for Gemini CLI support

---

## Codex CLI Support - How Hard?

### What They Have:

**File Location:**
- `~/.codex/sessions/rollout-YYYY-MM-DDThh-mm-ss-<uuid>.jsonl`
- JSONL format (like Claude Code!)
- Filename contains timestamp and session ID

**Format:**
```jsonl
{"type": "environment_context", "timestamp": "...", "cwd": "/path/to/project", ...}
{"type": "user", "role": "user", "content": "...", "timestamp": "..."}
{"type": "assistant", "role": "assistant", "content": [...], "timestamp": "..."}
{"type": "tool_call", "name": "shell", "input": {...}, "timestamp": "..."}
{"type": "tool_result", "output": {...}, "timestamp": "..."}
```

**Key Differences from Claude Code:**
1. **Filename format**: `rollout-YYYY-MM-DDThh-mm-ss-<uuid>.jsonl` (vs random names)
2. **Session ID**: Extract from filename UUID
3. **Timestamps**: Use filename timestamp as primary source
4. **Content structure**: Similar to Claude but simpler
5. **No `message` nesting**: Direct fields (no `message.content`)

**Parser Logic:**
- They reuse `ClaudeSessionParser` with small tweaks!
- Filename parsing for timestamp/UUID
- CWD extraction from `environment_context` events
- Same event types as Claude

### Port Difficulty: 🟡 **MEDIUM (3-5 days)**

**Why Medium:**
1. ⚠️ JSONL streaming (more complex than single JSON)
2. ⚠️ Filename parsing for metadata
3. ⚠️ Content structure differences from Claude
4. ✅ Similar to Claude Code (can reuse logic)
5. ✅ No resume functionality needed (read-only)

**Implementation Steps:**

1. **Rust Backend (2 days)**
   ```rust
   // src-tauri/src/commands/adapters/codex.rs

   pub struct CodexAdapter;

   // Filename regex: rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-([a-f0-9-]+)\.jsonl

   impl ProviderAdapter for CodexAdapter {
       fn scan_projects(&self, path: &str) -> Result<Vec<UniversalProject>> {
           // Find ~/.codex/sessions/rollout-*.jsonl files
           // All sessions in same directory (no projects hierarchy)
           // Return single "Codex Sessions" project
       }

       fn load_sessions(&self, path: &str) -> Result<Vec<UniversalSession>> {
           // Find all rollout-*.jsonl files
           // Extract metadata from filename
           // Parse first few lines for additional metadata
       }

       fn load_messages(&self, session_path: &str) -> Result<Vec<UniversalMessage>> {
           // Stream JSONL file (like Claude Code)
           // Parse each line as JSON
           // Convert to UniversalMessage
       }
   }
   ```

2. **Filename Parsing (1 day)**
   ```rust
   struct CodexFilename {
       timestamp: DateTime<Utc>,
       session_id: String,
   }

   fn parse_codex_filename(path: &str) -> Option<CodexFilename> {
       // regex: rollout-YYYY-MM-DDThh-mm-ss-UUID.jsonl
       let re = Regex::new(r"rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-([a-f0-9-]+)\.jsonl").unwrap();
       // ...
   }
   ```

3. **Message Parsing (1 day)**
   ```rust
   fn parse_codex_line(line: &str) -> Result<UniversalMessage> {
       let obj: serde_json::Value = serde_json::from_str(line)?;

       // Extract type
       let msg_type = obj["type"].as_str().unwrap_or("unknown");

       // Map to UniversalMessage
       match msg_type {
           "user" => // ... convert user message
           "assistant" => // ... convert assistant message
           "tool_call" => // ... convert tool call
           "tool_result" => // ... convert tool result
           "environment_context" => // ... extract metadata, skip
           _ => // ... unknown, skip
       }
   }
   ```

4. **Frontend Adapter (0.5 days)**
   ```typescript
   // src/adapters/providers/CodexAdapter.ts

   export class CodexAdapter extends BaseProviderAdapter {
       providerId = ProviderID.CODEX

       providerDefinition: ProviderDefinition = {
           id: ProviderID.CODEX,
           name: 'Codex CLI',
           capabilities: {
               // Similar to Claude Code
           },
           detectionPatterns: [
               { type: 'directory', pattern: '.codex', weight: 90 },
               { type: 'directory', pattern: 'sessions', weight: 80 },
               { type: 'file', pattern: 'rollout-*.jsonl', weight: 70 },
           ],
           // ...
       }
   }
   ```

5. **Register & i18n (0.5 days)**
   - Add to AdapterRegistry
   - Add translations
   - Add provider icon

**Total:** 3-5 days for Codex CLI support

---

## Resume Functionality - How Hard?

### What They Have:

**ClaudeResumeCoordinator.swift:**
- Probes for Claude CLI binary (`which claude`)
- Checks for `--resume` and `--continue` flags
- Builds terminal command: `claude --resume <session-id> --cwd <path>`
- Launches Terminal.app or iTerm2 with AppleScript

**CodexResumeCoordinator.swift:** (Similar pattern)
- Probes for Codex CLI binary
- Builds command: `codex-cli --resume <session-id>`
- Launches terminal

### Port Difficulty: 🟡 **MEDIUM (2-3 days per provider)**

**Why Medium:**
1. ⚠️ Platform-specific terminal launching (macOS/Windows/Linux)
2. ⚠️ CLI binary detection (PATH resolution)
3. ⚠️ Different command formats per provider
4. ✅ Simple command building
5. ✅ No need for complex state management

**Implementation:**

```rust
// src-tauri/src/commands/resume.rs

#[tauri::command]
pub async fn resume_claude_session(
    session_id: String,
    cwd: Option<String>,
) -> Result<String, String> {
    // 1. Find claude binary
    let binary = which::which("claude")
        .map_err(|_| "Claude CLI not found in PATH")?;

    // 2. Build command
    let mut cmd = std::process::Command::new(binary);
    cmd.arg("--resume").arg(&session_id);
    if let Some(cwd) = cwd {
        cmd.arg("--cwd").arg(cwd);
    }

    // 3. Launch terminal (platform-specific)
    #[cfg(target_os = "macos")]
    launch_terminal_macos(&cmd)?;

    #[cfg(target_os = "windows")]
    launch_terminal_windows(&cmd)?;

    #[cfg(target_os = "linux")]
    launch_terminal_linux(&cmd)?;

    Ok(format!("Resumed session {}", session_id))
}

#[cfg(target_os = "macos")]
fn launch_terminal_macos(cmd: &std::process::Command) -> Result<(), String> {
    // Use osascript to launch Terminal.app
    let script = format!(
        r#"tell application "Terminal" to do script "{}""#,
        cmd.as_std().to_string_lossy()
    );
    std::process::Command::new("osascript")
        .arg("-e")
        .arg(script)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn launch_terminal_windows(cmd: &std::process::Command) -> Result<(), String> {
    // Use Windows Terminal or cmd.exe
    std::process::Command::new("wt")
        .arg("new-tab")
        .arg(cmd.as_std().to_string_lossy().to_string())
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn launch_terminal_linux(cmd: &std::process::Command) -> Result<(), String> {
    // Try common terminals (gnome-terminal, xterm, konsole)
    for terminal in &["gnome-terminal", "xterm", "konsole"] {
        if which::which(terminal).is_ok() {
            std::process::Command::new(terminal)
                .arg("-e")
                .arg(cmd.as_std().to_string_lossy().to_string())
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
    }
    Err("No terminal emulator found".to_string())
}
```

---

## What Else They Have for Claude Code That We Don't

### 1. ✅ Lightweight Session Loading

**What they do:**
- For files ≥10MB: Only read first 256KB + last 256KB
- Extract metadata without parsing all messages
- Build "lightweight" Session with `events: []`
- Full parse deferred until user opens session

**What we do:**
- Parse full session upfront
- Pagination helps, but still reads entire file

**Benefit:** Faster initial load for large sessions

**Port Difficulty:** 🟢 **EASY** - Add `lightweight: bool` flag to our parsers

---

### 2. ✅ Smart Preamble Filtering

**What they do:**
```swift
private static func looksLikeAgentsPreamble(_ text: String) -> Bool {
    let anchors = [
        "<user_instructions>",
        "# agent sessions agents playbook",
        "you are an expert",
        "caveat: the messages below..."
    ]
    // ... check if text contains any anchor
}
```

**What we do:**
- Show raw first message as title

**Benefit:** Better session titles

**Port Difficulty:** 🟢 **EASY** - Add to title extraction logic

---

### 3. ✅ CWD Extraction from Multiple Sources

**What they do:**
1. Try `<cwd>...</cwd>` XML tags in text
2. Try `cwd` field in JSON
3. Try `project` field in JSON
4. Validate path exists on filesystem

**What we do:**
- Parse `cwd` from message metadata

**Benefit:** More robust CWD detection

**Port Difficulty:** 🟢 **EASY** - Add fallback logic

---

### 4. ✅ Git Branch Extraction

**What they do:**
1. Extract from `git_branch` field in JSON
2. Parse from tool outputs (git status, git log)
3. Use regex patterns:
   - `On branch <branch>`
   - `* <branch>` (git branch output)

**What we do:**
- ❌ Don't extract git branch

**Benefit:** Better session organization

**Port Difficulty:** 🟢 **EASY** - Add to metadata extraction

---

### 5. ✅ Model Version Extraction

**What they do:**
- Extract from `version` field → "Claude Code v1.0.35"
- Extract from `model` field → "claude-opus-4-20250514"
- Store in `Session.model`

**What we do:**
- Extract model from message metadata
- Store in UniversalMessage

**Benefit:** Show model in session list

**Port Difficulty:** 🟢 **EASY** - Add to session metadata

---

### 6. ❌ Transcript Caching

**What they do:**
```swift
class TranscriptCache {
    private var cache: [String: String] = [:] // sessionID → plain text

    func getOrGenerate(session: Session) -> String {
        if let cached = cache[session.id] {
            return cached
        }
        let transcript = generateTranscript(session)
        cache[session.id] = transcript
        return transcript
    }
}
```

**What we do:**
- Generate message text on-demand
- No caching

**Benefit:** Faster search (search cached transcript, not raw JSON)

**Port Difficulty:** 🟡 **MEDIUM** - Add caching layer to store

---

### 7. ❌ Multiple Transcript Rendering Modes

**What they do:**
- **Plain text**: Simple conversation flow
- **ANSI terminal**: Preserve colors from tool outputs
- **Attributed**: Rich text with formatting

**What we do:**
- Single rich rendering mode

**Benefit:** Flexibility for different use cases

**Port Difficulty:** 🟢 **EASY** - Add view mode toggle

---

## Recommendation: Implementation Priority

### Phase 1: Quick Wins (1 week)
1. **Gemini CLI Support** (2-3 days) 🟢
2. **Lightweight Session Loading** (1 day) 🟢
3. **Smart Preamble Filtering** (1 day) 🟢
4. **Git Branch Extraction** (1 day) 🟢

### Phase 2: Medium Effort (2 weeks)
5. **Codex CLI Support** (3-5 days) 🟡
6. **Resume Functionality (Claude)** (2-3 days) 🟡
7. **Resume Functionality (Codex)** (2-3 days) 🟡
8. **Transcript Caching** (2-3 days) 🟡

### Phase 3: Polish (1 week)
9. **Multiple Transcript Modes** (2 days) 🟢
10. **Enhanced CWD Detection** (1 day) 🟢
11. **Model Version Display** (1 day) 🟢

**Total Time:** 4-5 weeks for complete feature parity

---

## Conclusion

✅ **Their multi-provider architecture is HIGHLY COMPATIBLE with ours!**

- Same patterns (discovery, parsing, conversion)
- Same data model concepts (Session → UniversalSession, Event → UniversalMessage)
- Easy to port Gemini (2-3 days)
- Medium effort for Codex (3-5 days)
- Many quick wins available (preamble filtering, git branch, etc.)

**Next Steps:**
1. Start with Gemini CLI (easiest, high value)
2. Add lightweight session loading (performance win)
3. Implement smart preamble filtering (UX improvement)
4. Consider Codex CLI if there's user demand

The hard work of multi-provider architecture is already done in our app. Adding new providers is just implementing the adapter interface!
