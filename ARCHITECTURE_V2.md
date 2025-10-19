# Claude Code History Viewer - Architecture v2.0.0

## 🎯 Overview

Version 2.0.0 introduces a **Universal Multi-Provider Architecture** that transforms the app from a single-source Claude Code viewer into an extensible AI conversation history browser supporting multiple AI coding assistants.

## 📐 Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (React)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ SourceManager│  │  ProjectTree │  │ MessageViewer│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│           │                  │                 │         │
│           └──────────────────┼─────────────────┘         │
│                              │                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │             Store Layer (Zustand)                   │ │
│  │  ┌─────────────┐         ┌──────────────┐          │ │
│  │  │SourceStore  │────────▶│  AppStore    │          │ │
│  │  └─────────────┘         └──────────────┘          │ │
│  └─────────────────────────────────────────────────────┘ │
│                              │                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │         Adapter Layer (TypeScript)                   │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │        AdapterRegistry (Singleton)            │  │ │
│  │  │  ┌────────────────┐  ┌──────────────────┐    │  │ │
│  │  │  │ClaudeCodeAdapter│ │ CursorAdapter   │   │  │ │
│  │  │  └────────────────┘  └──────────────────┘    │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
                              │ Tauri IPC
                              ▼
┌─────────────────────────────────────────────────────────┐
│                 Backend (Rust + Tauri)                   │
│  ┌─────────────────────────────────────────────────────┐ │
│  │             Command Layer                           │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │ │
│  │  │ project  │  │ session  │  │ cursor (SQLite) │  │ │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │ │
│  └─────────────────────────────────────────────────────┘ │
│                              │                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │             Model Layer (Serde)                      │ │
│  │  ┌──────────────┐  ┌──────────────────────────┐    │ │
│  │  │Legacy Models │  │ Universal Models (v2.0)  │    │ │
│  │  └──────────────┘  └──────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────┘ │
│                              │                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Data Access                            │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │ │
│  │  │   JSONL  │  │  SQLite  │  │  Future: APIs    │  │ │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 🔑 Key Components

### 1. Universal Type System

**TypeScript** (`src/types/universal.ts`, `src/types/providers.ts`):
- `UniversalMessage` - Common message format across ALL providers
- `UniversalSession` - Unified session representation
- `UniversalProject` - Project-level data structure
- `UniversalSource` - Data source (folder/database)
- `ProviderDefinition` - Provider metadata & capabilities

**Rust** (`src-tauri/src/models/universal.rs`):
- Exact mirrors of TypeScript types
- `serde` serialization for Tauri IPC
- Type-safe bridge between frontend/backend

### 2. Adapter System

**Pattern**: Strategy + Registry pattern for provider extensibility

**Interface** (`src/adapters/base/IAdapter.ts`):
```typescript
interface IConversationAdapter {
  readonly providerId: string;
  readonly providerDefinition: ProviderDefinition;

  // Lifecycle
  initialize(): Promise<void>;
  dispose(): Promise<void>;

  // Validation (FAIL FAST)
  validate(path: string): Promise<ValidationResult>;
  canHandle(path: string): Promise<DetectionScore>;

  // Discovery
  scanProjects(sourcePath: string, sourceId: string): Promise<ScanResult<UniversalProject>>;
  loadSessions(projectPath: string, projectId: string, sourceId: string): Promise<ScanResult<UniversalSession>>;

  // Data Loading
  loadMessages(sessionPath: string, sessionId: string, options: LoadOptions): Promise<LoadResult<UniversalMessage>>;

  // Search
  searchMessages(sourcePaths: string[], query: string, filters: SearchFilters): Promise<SearchResult<UniversalMessage>>;

  // Health & Recovery
  healthCheck(sourcePath: string): Promise<HealthStatus>;
  handleError(error: Error, context: ErrorContext): ErrorRecovery;
}
```

**Registry** (`src/adapters/registry/AdapterRegistry.ts`):
- Singleton pattern for centralized adapter management
- Auto-registration of built-in adapters
- Provider auto-detection using pattern matching
- Validates all adapters on registration (FAIL FAST)

### 3. Implemented Adapters

#### Claude Code Adapter (`src/adapters/providers/ClaudeCodeAdapter.ts`)
- **Format**: JSONL files in `~/.claude/projects/`
- **Capabilities**: Thinking blocks, tool calls, branching, token counting
- **Status**: ✅ COMPLETE
- **Features**:
  - Reads `.jsonl` conversation files
  - Converts to UniversalMessage format
  - Preserves all Claude-specific metadata
  - Full-text search support
  - Paginated message loading

#### Cursor IDE Adapter (Backend: `src-tauri/src/commands/cursor.rs`)
- **Format**: SQLite databases in `%APPDATA%/Cursor/`
- **Databases**:
  - `state.vscdb` - Workspace metadata (project paths)
  - `*.sqlite` - Session messages (`cursorDiskKV` table)
- **Status**: ✅ BACKEND COMPLETE, Frontend adapter TODO
- **Features**:
  - Reads bubble messages from SQLite
  - Extracts project info from workspace DB
  - Message type detection (user/assistant)
  - Converts to UniversalMessage format

### 4. Source Management

**Store** (`src/store/useSourceStore.ts`):
- CRUD operations for data sources
- Source validation and health checking
- Auto-detection of default Claude Code folder
- Persistent storage using Tauri Store
- Multi-source support with default selection

**UI** (`src/components/SourceManager.tsx`):
- List all configured sources
- Add new sources with path browser
- Remove sources (with safety checks)
- Set default source
- Refresh source stats
- Visual health indicators
- Provider badges

**Integration**:
- Modal accessible from Header (Database icon)
- Initialized on app startup
- Auto-detects Claude folder if no sources configured

## 🔄 Data Flow

### Current Flow (Legacy - v1.x):
```
User Action → AppStore → invoke(tauri_command) → Rust → JSONL → ClaudeMessage
```

### New Flow (v2.0 - Implemented):
```
User Action → SourceStore → AdapterRegistry → Provider Adapter → Tauri/Direct Access → UniversalMessage
```

### Target Flow (v2.0 - Complete Integration):
```
User Action → AppStore → SourceStore → AdapterRegistry → Provider Adapter → Universal Types
                                                               ↓
                                                    UI Renders (Provider-Aware)
```

## 📁 File Structure

```
src/
├── adapters/
│   ├── base/
│   │   └── IAdapter.ts              # Adapter interface
│   ├── providers/
│   │   ├── ClaudeCodeAdapter.ts     # ✅ Claude Code implementation
│   │   └── CursorAdapter.ts         # ⏳ TODO: Frontend wrapper
│   ├── registry/
│   │   └── AdapterRegistry.ts       # Singleton registry
│   └── index.ts                     # Adapter exports
│
├── store/
│   ├── useAppStore.ts               # ⚠️  Legacy (needs adapter integration)
│   └── useSourceStore.ts            # ✅ Multi-source management
│
├── components/
│   ├── SourceManager.tsx            # ✅ Source CRUD UI
│   └── modals/
│       └── SourcesModal.tsx         # ✅ Source management dialog
│
├── types/
│   ├── universal.ts                 # ✅ Universal type definitions
│   ├── providers.ts                 # ✅ Provider enums & capabilities
│   └── index.ts                     # Legacy types (backwards compat)
│
└── App.tsx                          # ✅ Initializes SourceStore

src-tauri/
├── src/
│   ├── models/
│   │   ├── universal.rs             # ✅ Rust universal types
│   │   └── mod.rs                   # Model exports
│   │
│   └── commands/
│       ├── project.rs               # Legacy Claude Code
│       ├── session.rs               # Legacy Claude Code
│       ├── cursor.rs                # ✅ Cursor IDE support
│       └── mod.rs                   # Command exports
│
└── Cargo.toml                       # ✅ rusqlite dependency added
```

## 🎨 Design Principles

### 1. FAIL FAST Philosophy
- Strict validation at adapter registration
- All required methods must be implemented
- Invalid data throws errors immediately
- No silent failures or fallbacks

### 2. Provider Capabilities
- Each provider declares its capabilities
- UI adapts based on `ProviderCapabilities`
- No assumptions about provider features
- Graceful degradation for missing features

### 3. Type Safety
- Complete TypeScript/Rust type mirroring
- Serde serialization for all IPC
- No `any` types in adapter interface
- Exhaustive pattern matching

### 4. Extensibility
- Plugin-like adapter system
- Register new providers easily
- No core code changes required
- Standard interface for all providers

### 5. Backwards Compatibility
- Legacy types remain (`ClaudeProject`, `ClaudeSession`, `ClaudeMessage`)
- Old Tauri commands still work
- Gradual migration path
- No breaking changes for v1.x data

## 🔧 Provider Integration Guide

### Adding a New Provider

**1. Create Adapter Class** (`src/adapters/providers/YourAdapter.ts`):
```typescript
export class YourAdapter implements IConversationAdapter {
  public readonly providerId = ProviderID.YOUR_PROVIDER;
  public readonly providerDefinition: ProviderDefinition = {
    id: ProviderID.YOUR_PROVIDER,
    name: 'Your Provider',
    capabilities: { /* declare capabilities */ },
    detectionPatterns: [ /* detection rules */ ],
    // ...
  };

  async initialize() { /* setup */ }
  async validate(path: string) { /* check validity */ }
  async scanProjects(sourcePath: string, sourceId: string) { /* find projects */ }
  async loadSessions(projectPath: string, projectId: string, sourceId: string) { /* load sessions */ }
  async loadMessages(sessionPath: string, sessionId: string, options: LoadOptions) { /* read messages */ }
  // ... implement all required methods
}
```

**2. Register in Registry** (`src/adapters/registry/AdapterRegistry.ts`):
```typescript
private async registerBuiltinAdapters(): Promise<void> {
  const adapters: IConversationAdapter[] = [
    new ClaudeCodeAdapter(),
    new CursorAdapter(),
    new YourAdapter(), // Add here
  ];
  // ...
}
```

**3. Add Backend Commands** (if needed):
Create `src-tauri/src/commands/your_provider.rs` with Tauri commands.

**4. Update Provider ID Enum** (`src/types/providers.ts`):
```typescript
export enum ProviderID {
  CLAUDE_CODE = 'claude-code',
  CURSOR = 'cursor',
  YOUR_PROVIDER = 'your-provider', // Add here
}
```

## 🚀 Deployment Status

### ✅ Completed (Phases 1-7)
1. **Core Type System** - Universal message/session/project/source types
2. **Adapter Interface** - Complete IConversationAdapter with FAIL FAST
3. **Rust Backend** - Universal types mirrored in Rust
4. **Claude Code Adapter** - Full adapter implementation
5. **Multi-Source Management** - Source store + UI
6. **Cursor IDE Support** - SQLite backend + commands
7. **UI Integration** - SourceManager modal, App initialization

### ⏳ Remaining Work (Phases 8-12)

#### Phase 8: Universal Search & Analytics
**What**: Make search and analytics work across all sources

**Tasks**:
- [ ] Refactor `AppStore` to use adapters instead of direct `invoke()`
- [ ] Update search to work with `UniversalMessage`
- [ ] Make analytics aggregate across multiple sources
- [ ] Add source selector to search UI

**Files to Update**:
- `src/store/useAppStore.ts` - Use `adapterRegistry` for data loading
- `src/components/SearchView.tsx` - Add source filtering
- `src/components/AnalyticsDashboard.tsx` - Multi-source aggregation

#### Phase 9: Provider Detection & Validation
**What**: Auto-detect providers and guide users

**Tasks**:
- [ ] Add "Detect Provider" button to SourceManager
- [ ] Show detection confidence in UI
- [ ] Validation error details in modal
- [ ] Provider selection wizard for ambiguous cases

**Files to Create**:
- `src/components/ProviderDetectionDialog.tsx`
- `src/components/ProviderValidationResults.tsx`

#### Phase 10: Feature-Aware Rendering
**What**: Adapt UI based on provider capabilities

**Tasks**:
- [ ] Check `provider.capabilities` before showing features
- [ ] Hide "Thinking" view for providers without `supportsThinking`
- [ ] Disable token stats for non-supporting providers
- [ ] Show provider badge in message headers

**Files to Update**:
- `src/components/MessageViewer.tsx` - Capability checks
- `src/components/ThinkingRenderer.tsx` - Conditional rendering
- `src/components/TokenStatsViewer.tsx` - Provider filtering

#### Phase 11: Migration & Backwards Compatibility
**What**: Seamless upgrade for v1.x users

**Tasks**:
- [ ] Auto-migrate v1.x settings to v2.0 format
- [ ] Convert legacy `claudePath` to `UniversalSource`
- [ ] Migration dialog on first v2.0 launch
- [ ] Preserve user preferences

**Files to Create**:
- `src/utils/migration.ts` - Migration logic
- `src/components/MigrationDialog.tsx` - User communication

#### Phase 12: i18n & Polish
**What**: Translations and final UX improvements

**Tasks**:
- [ ] Add translations for all new v2.0 UI strings
- [ ] Provider names in all 6 languages (en, ko, ja, zh-CN, zh-TW, ru)
- [ ] Error messages internationalization
- [ ] Documentation updates

**Files to Update**:
- `src/i18n/locales/*/common.json` - Add v2.0 strings
- `src/i18n/locales/*/components.json` - Source management strings

## 📊 Provider Support Matrix

| Provider       | Status | Format  | Search | Analytics | Thinking | Tools | Notes                    |
|----------------|--------|---------|--------|-----------|----------|-------|--------------------------|
| Claude Code    | ✅ Done | JSONL   | ✅     | ✅        | ✅       | ✅    | Full support             |
| Cursor IDE     | 🚧 Partial | SQLite | ⏳     | ⏳        | ❌       | ❌    | Backend ready            |
| GitHub Copilot | ⏳ Planned | ?      | ⏳     | ⏳        | ⏳       | ⏳    | TBD                      |
| Cline          | ⏳ Planned | JSONL? | ⏳     | ⏳        | ⏳       | ⏳    | Similar to Claude?       |
| Aider          | ⏳ Planned | Git?   | ⏳     | ⏳        | ❌       | ⏳    | Git commit based?        |

## 🔒 Security Considerations

- **Local-First**: All data processing happens locally
- **No External Calls**: Adapters don't send data externally
- **File Permissions**: Respects OS file permissions
- **Read-Only**: Adapters never modify source data
- **Validation**: All paths validated before access

## 📚 References

- **Adapter Pattern**: [refactoring.guru/design-patterns/adapter](https://refactoring.guru/design-patterns/adapter)
- **Registry Pattern**: Centralized service location
- **Strategy Pattern**: Interchangeable algorithms (providers)
- **Tauri IPC**: Type-safe Rust ↔ JavaScript communication

## 🎯 Success Metrics

- **Extensibility**: Add new provider in < 500 lines
- **Type Safety**: 100% TypeScript coverage, no `any`
- **Performance**: No regression vs. v1.x
- **Compatibility**: v1.x data works without migration
- **User Experience**: Seamless multi-source switching

---

**Version**: 2.0.0-alpha
**Last Updated**: 2025-10-17
**Authors**: Development Team + Claude
**License**: MIT
