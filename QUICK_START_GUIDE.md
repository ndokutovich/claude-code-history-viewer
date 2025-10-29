# Quick Start Guide: Multi-Provider Implementation

Quick reference for implementing new providers following our architecture patterns.

---

## Architecture Principles

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                          │
│                  (React Components)                          │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND ADAPTERS                           │
│              (TypeScript - Orchestration)                    │
│  • ClaudeCodeAdapter.ts                                     │
│  • CursorAdapter.ts                                         │
│  • GeminiAdapter.ts (NEW)                                   │
│  • CodexAdapter.ts (NEW)                                    │
│                                                             │
│  Implements: IConversationAdapter                          │
│  - validate(), canHandle()                                  │
│  - scanProjects(), loadSessions(), loadMessages()          │
│  - healthCheck(), handleError()                            │
└─────────────────────────────────────────────────────────────┘
                            ↕
                    Tauri IPC (invoke)
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND ADAPTERS                            │
│              (Rust - Parsing & Conversion)                   │
│  • claude_code.rs                                           │
│  • cursor.rs                                                │
│  • gemini.rs (NEW)                                          │
│  • codex.rs (NEW)                                           │
│                                                             │
│  Converts: RawFormat → UniversalMessage                    │
│  - Preserves ALL data in provider_metadata                  │
│  - Zero data loss guarantee                                 │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                  DATA SOURCES                               │
│  • ~/.claude/projects/**/*.jsonl (Claude Code)             │
│  • AppData/Cursor/User/workspaceStorage (Cursor)           │
│  • ~/.gemini/tmp/**/session-*.json (Gemini)                │
│  • ~/.codex/sessions/rollout-*.jsonl (Codex)               │
└─────────────────────────────────────────────────────────────┘
```

---

## Adding a New Provider: Checklist

### Step 1: Backend (Rust)

**Files:**
- `src-tauri/src/commands/adapters/<provider>.rs`
- `src-tauri/src/commands/<provider>.rs` (Tauri commands)
- `src-tauri/src/commands/adapters/mod.rs` (add export)
- `src-tauri/src/main.rs` (register commands)

**Pattern:**
```rust
// 1. Define provider-specific types
struct ProviderMessage { ... }

// 2. Implement conversion function
pub fn provider_message_to_universal(
    msg: &ProviderMessage,
    ...
) -> UniversalMessage {
    UniversalMessage {
        id: msg.id,
        provider_id: "provider-name",
        content: convert_content(msg),
        provider_metadata: preserve_all_fields(msg), // IMPORTANT!
        ...
    }
}

// 3. Implement Tauri commands
#[tauri::command]
pub async fn scan_provider_projects(...) -> Result<Vec<UniversalProject>, String>

#[tauri::command]
pub async fn load_provider_sessions(...) -> Result<Vec<UniversalSession>, String>

#[tauri::command]
pub async fn load_provider_messages(...) -> Result<Vec<UniversalMessage>, String>
```

### Step 2: Frontend (TypeScript)

**Files:**
- `src/adapters/providers/<Provider>Adapter.ts`
- `src/adapters/registry/AdapterRegistry.ts` (register)
- `src/types/providers.ts` (add ProviderID)

**Pattern:**
```typescript
export class ProviderAdapter implements IConversationAdapter {
  public readonly providerId = ProviderID.PROVIDER;

  public readonly providerDefinition: ProviderDefinition = {
    id: ProviderID.PROVIDER,
    name: 'Provider Name',
    capabilities: { ... },
    detectionPatterns: [ ... ],
    ...
  };

  async initialize() { ... }
  async validate(path: string): Promise<ValidationResult> { ... }
  async scanProjects(...): Promise<ScanResult<UniversalProject>> {
    return invoke('scan_provider_projects', { ... });
  }
  // ... implement all interface methods
}
```

### Step 3: i18n

**Files:**
- `src/i18n/locales/en/common.json`
- `src/i18n/locales/ko/common.json`
- `src/i18n/locales/ja/common.json`
- `src/i18n/locales/zh-CN/common.json`
- `src/i18n/locales/zh-TW/common.json`
- `src/i18n/locales/ru/common.json`

**Pattern:**
```json
{
  "providers": {
    "provider-id": "Provider Name"
  }
}
```

### Step 4: Testing

```typescript
// tests/unit/adapters/provider.test.ts
describe('ProviderAdapter', () => {
  test('should initialize', async () => { ... });
  test('should validate path', async () => { ... });
  test('should scan projects', async () => { ... });
});

// tests/integration/provider.test.ts
test('should integrate with registry', async () => { ... });

// e2e/tests/provider.spec.ts
test('should load sessions in UI', async ({ page }) => { ... });
```

---

## Key Patterns to Follow

### 1. Backend: Zero Data Loss

**ALWAYS preserve original data:**
```rust
let mut provider_metadata = HashMap::new();
provider_metadata.insert("original_uuid".to_string(), json!(msg.uuid));
provider_metadata.insert("original_type".to_string(), json!(msg.message_type));
provider_metadata.insert("raw_content".to_string(), msg.content.clone());
// ... preserve ALL fields

UniversalMessage {
    // ... mapped fields
    original_format: "provider_format_name",
    provider_metadata, // Contains everything!
}
```

### 2. Frontend: Fail Fast Validation

```typescript
async validate(path: string): Promise<ValidationResult> {
  try {
    // Quick checks first
    if (!path || path.trim().length === 0) {
      return {
        isValid: false,
        confidence: 0,
        errors: [{ code: ErrorCode.INVALID_PATH, message: 'Path is empty' }],
      };
    }

    // Delegate to backend for thorough validation
    const isValid = await invoke<boolean>('validate_provider_folder', { path });

    return isValid
      ? { isValid: true, confidence: 100, errors: [], warnings: [] }
      : { isValid: false, confidence: 0, errors: [...], warnings: [] };
  } catch (error) {
    // FAIL FAST: Don't swallow errors
    return {
      isValid: false,
      confidence: 0,
      errors: [{ code: classifyError(error), message: error.message }],
    };
  }
}
```

### 3. Error Handling: Graceful Degradation

```typescript
async loadSessions(...): Promise<ScanResult<UniversalSession>> {
  try {
    const sessions = await invoke<UniversalSession[]>('load_provider_sessions', { ... });

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
    console.error('❌ ProviderAdapter.loadSessions error:', error);

    // Return error result (don't throw!)
    return {
      success: false,
      error: {
        code: classifyError(error),
        message: error.message,
        recoverable: true, // Can retry?
      },
    };
  }
}
```

### 4. Registry: Automatic Registration

```typescript
// src/adapters/registry/AdapterRegistry.ts

private async registerBuiltinAdapters(): Promise<void> {
  const adapters: IConversationAdapter[] = [
    new ClaudeCodeAdapter(),
    new CursorAdapter(),
    new GeminiAdapter(), // ADD NEW PROVIDERS HERE
    new CodexAdapter(),  // ADD NEW PROVIDERS HERE
  ];

  for (const adapter of adapters) {
    await this.register(adapter);
  }
}
```

---

## Common Pitfalls to Avoid

### ❌ DON'T: Put Parsing Logic in Frontend

```typescript
// ❌ BAD: Parsing in TypeScript
async loadMessages(sessionPath: string) {
  const content = await fs.readFile(sessionPath);
  const lines = content.split('\n');
  const messages = lines.map(line => JSON.parse(line)); // ❌ DON'T DO THIS
  return messages;
}
```

```rust
// ✅ GOOD: Parsing in Rust
#[tauri::command]
pub async fn load_provider_messages(session_path: String) -> Result<Vec<UniversalMessage>, String> {
    let content = fs::read_to_string(&session_path)?;
    let messages = parse_provider_format(&content)?;
    Ok(messages.into_iter().map(to_universal).collect())
}
```

### ❌ DON'T: Lose Original Data

```rust
// ❌ BAD: Data loss
UniversalMessage {
    content: convert_content(msg), // Lost original structure!
    provider_metadata: HashMap::new(), // Empty!
}

// ✅ GOOD: Preserve everything
UniversalMessage {
    content: convert_content(msg),
    provider_metadata: {
        let mut meta = HashMap::new();
        meta.insert("raw_content", json!(msg.content)); // Original preserved!
        meta.insert("original_field_1", json!(msg.field1));
        meta.insert("original_field_2", json!(msg.field2));
        // ... ALL fields
        meta
    },
}
```

### ❌ DON'T: Throw Errors Without Context

```typescript
// ❌ BAD: Generic error
throw new Error('Failed');

// ✅ GOOD: Contextual error with classification
throw new Error(`Failed to load Gemini session at ${sessionPath}: ${originalError.message}`);
```

---

## Testing Commands

```bash
# Unit tests
pnpm test                    # Run all unit tests
pnpm test:run               # Run once with verbose output

# Integration tests
pnpm test -- adapters       # Test all adapters
pnpm test -- gemini         # Test specific adapter

# E2E tests
pnpm test:e2e               # Run E2E tests
pnpm test:e2e:ui            # Run with UI
pnpm test:e2e:headed        # Run with visible browser

# Build and run
pnpm tauri:dev              # Development mode
pnpm tauri:build            # Production build

# Manual testing in DevTools console
await window.__TAURI__.core.invoke('scan_gemini_projects', {
  geminiPath: '/path/to/.gemini',
  sourceId: 'test'
});
```

---

## Debugging Tips

### 1. Check Rust Logs

```rust
// Add debug prints in Rust
println!("🔍 DEBUG: Parsing file: {}", path);
eprintln!("❌ ERROR: Failed to parse: {}", error);
```

View in terminal:
```bash
pnpm tauri:dev
# Logs appear in terminal where you ran this command
```

### 2. Check Frontend Logs

```typescript
// Add debug logs in TypeScript
console.log('🔍 Loading sessions:', projectPath);
console.error('❌ Load failed:', error);
```

View in DevTools Console (F12)

### 3. Inspect Tauri IPC Calls

```typescript
// Wrap invoke with logging
const invokeWithLog = async (cmd: string, args: any) => {
  console.log(`📞 Calling: ${cmd}`, args);
  const result = await invoke(cmd, args);
  console.log(`✅ Result: ${cmd}`, result);
  return result;
};
```

### 4. Test Rust Commands Directly

```rust
// Add test in Rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_gemini_file() {
        let path = Path::new("test-data/session.json");
        let result = gemini_file_to_session(path, "proj".into(), "src".into());
        assert!(result.is_ok());
    }
}
```

Run:
```bash
cd src-tauri
cargo test
```

---

## Code Review Checklist

Before submitting PR:

- [ ] Backend: All fields preserved in `provider_metadata`
- [ ] Backend: Conversion functions tested
- [ ] Backend: Tauri commands registered in main.rs
- [ ] Frontend: Implements full `IConversationAdapter` interface
- [ ] Frontend: Error handling with graceful degradation
- [ ] Frontend: Adapter registered in AdapterRegistry
- [ ] i18n: All 6 languages updated
- [ ] Tests: Unit tests pass
- [ ] Tests: Integration tests pass
- [ ] Tests: E2E tests pass
- [ ] Docs: README.md updated
- [ ] Docs: CLAUDE.md updated
- [ ] Docs: CHANGELOG.md updated
- [ ] Build: `pnpm build` succeeds
- [ ] Build: No TypeScript errors
- [ ] Build: No Rust warnings

---

## Resources

- **Full Implementation Plan:** `IMPLEMENTATION_PLAN.md`
- **Architecture Comparison:** `PROVIDER_COMPATIBILITY_ANALYSIS.md`
- **Feature Comparison:** `COMPARISON_AGENT_SESSIONS_CORRECTED.md`
- **Existing Adapters:**
  - Backend: `src-tauri/src/commands/adapters/claude_code.rs`
  - Frontend: `src/adapters/providers/ClaudeCodeAdapter.ts`
- **Interface Definition:** `src/adapters/base/IAdapter.ts`
- **Universal Types:** `src/types/universal.ts`

---

## Questions?

Review the full implementation plan for detailed code examples and step-by-step instructions.

**Start with Phase 1.1 (Gemini Backend)** - it's the easiest and sets the pattern for all other providers!
