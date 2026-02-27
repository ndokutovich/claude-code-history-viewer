# Comprehensive Merge Plan: origin/main ← upstream/main

**Date**: 2026-02-27
**Our Fork**: ndokutovich v1.8.2 (183 unique commits, dormant since Nov 2025)
**Upstream**: jhlee0409 v1.5.3 (412 unique commits, actively developed)
**Common Ancestor**: `1f26025` (Jul 22, 2025)
**Total Conflicts**: 97 files

---

## Table of Contents

1. [Merge Strategy Overview](#1-merge-strategy-overview)
2. [Architectural Decisions](#2-architectural-decisions)
3. [Rust Backend — Per-File Decisions](#3-rust-backend--per-file-decisions)
4. [Frontend Components — Per-File Decisions](#4-frontend-components--per-file-decisions)
5. [Store, Types, Hooks — Per-File Decisions](#5-store-types-hooks--per-file-decisions)
6. [i18n, Config, Build — Per-File Decisions](#6-i18n-config-build--per-file-decisions)
7. [Files Unique to Our Fork (KEEP)](#7-files-unique-to-our-fork-keep)
8. [Files Unique to Upstream (ADOPT)](#8-files-unique-to-upstream-adopt)
9. [Modify/Delete Conflicts](#9-modifydelete-conflicts)
10. [Execution Plan — Phased Approach](#10-execution-plan--phased-approach)

---

## 1. Merge Strategy Overview

### Recommended Approach: **"Upstream as Base + Cherry-pick Our Unique Features"**

Given that:
- Upstream has **412 commits** of active development vs our **183** (dormant 15+ months)
- Upstream restructured nearly everything: store → slices, models → modules, session → submodules
- Upstream added performance optimizations (rayon, memmap2, simd-json)
- Upstream added comprehensive testing (proptest, insta, criterion)
- Our fork has unique features upstream never got (E2E tests, Cursor/Gemini adapters, export, resume, Russian i18n)

**The plan is to use upstream as the base and surgically integrate our unique value.**

### Why NOT a straight `git merge`:
- 97 conflicts, many architectural (not just content)
- 20 modify/delete conflicts where upstream restructured what we modified
- Upstream's modular patterns (store slices, model modules) cannot be auto-merged with our monolithic versions
- Manual resolution of each file would take as long as the surgical approach, with worse results

---

## 2. Architectural Decisions

These are the key decision points. For each, we pick the better approach:

### 2.1 Store Architecture
| | Our Fork | Upstream | **Winner** |
|---|---|---|---|
| Pattern | Monolithic (1,742 lines) | 14 slices (111 line wrapper) | **UPSTREAM** |
| Why | | Better maintainability, testability, scalability | |

### 2.2 Rust Models
| | Our Fork | Upstream | **Winner** |
|---|---|---|---|
| Pattern | Single models.rs (287 lines) | models/ module with 5 subfiles + snapshot tests | **UPSTREAM** |
| Why | | Better organization, tested | |

### 2.3 Session Commands
| | Our Fork | Upstream | **Winner** |
|---|---|---|---|
| Pattern | Single session.rs (~2000 lines) | session/ module (load, search, edits, rename) | **UPSTREAM** |
| Why | | Modular, adds edit restore + rename features | |

### 2.4 Provider Architecture
| | Our Fork | Upstream | **Winner** |
|---|---|---|---|
| Pattern | Individual command files + adapters | providers/ module + multi_provider.rs | **HYBRID** |
| Why | | Upstream's abstraction is cleaner; we add Cursor + Gemini providers to it | |

### 2.5 Update System
| | Our Fork | Upstream | **Winner** |
|---|---|---|---|
| Pattern | Custom (update.rs + secure_update.rs + 4 hooks) | Tauri plugin + single useUpdater.ts | **UPSTREAM** |
| Why | | Simpler, relies on framework, well-tested | |

### 2.6 Frontend Component Decomposition
| | Our Fork | Upstream | **Winner** |
|---|---|---|---|
| AnalyticsDashboard | Single file | Folder with 21 files (views, components, utils) | **UPSTREAM** |
| MessageViewer | Single file | Folder with 18 files (components, helpers, hooks) | **UPSTREAM** |
| ProjectTree | Single file | Folder with 9 files (components, hooks, tests) | **UPSTREAM** |

### 2.7 Type System
| | Our Fork | Upstream | **Winner** |
|---|---|---|---|
| Pattern | Flat types/ | core/ + derived/ + domain-specific | **UPSTREAM** |
| Why | | Scalable hierarchy, clear separation | |

### 2.8 i18n Architecture
| | Our Fork | Upstream | **Winner** |
|---|---|---|---|
| Config file | `i18n.config.ts` (avoids collision) | `i18n/index.ts` (standard) | **UPSTREAM** (but note the collision risk) |
| Namespaces | 6 (common, components, messages, search, sourceManager, splash) | 11 (common, analytics, error, feedback, message, recentEdits, renderers, session, settings, tools, update) | **UPSTREAM** |
| Type safety | None | Generated types (`types.generated.ts`) | **UPSTREAM** |
| Languages | EN, KO, JA, ZH-CN, ZH-TW, **RU** | EN, KO, JA, ZH-CN, ZH-TW | **HYBRID** (upstream + add Russian) |

### 2.9 Platform Support
| | Our Fork | Upstream | **Winner** |
|---|---|---|---|
| Platforms | macOS + Windows + Linux | macOS only | **OURS** |
| Why | More users, already working | | |

### 2.10 Testing Strategy
| | Our Fork | Upstream | **Winner** |
|---|---|---|---|
| Unit tests | Minimal | 30+ test files, snapshot tests, proptest | **UPSTREAM** |
| E2E tests | Playwright (3 test files) | None | **OURS** |
| Result | | | **HYBRID** (both) |

---

## 3. Rust Backend — Per-File Decisions

### Content Conflicts (both modified)

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 1 | `src-tauri/Cargo.toml` | **UPSTREAM** + add our unique deps | Upstream has newer Tauri (2.9.5), performance deps (rayon, memmap2, simd-json), better testing (proptest, insta). Add back `rusqlite` for Cursor, `reqwest` if needed, `sha2`/`hex` for secure updates if kept. |
| 2 | `src-tauri/build.rs` | **EITHER** (identical) | Both are trivial `tauri_build::build()` |
| 3 | `src-tauri/capabilities/default.json` | **UPSTREAM** + add clipboard/opener | Upstream's security-first approach is better. Add back clipboard-manager and opener:allow-open-path for our features. |
| 4 | `src-tauri/tauri.conf.json` | **HYBRID** | Upstream's security/CSP + our platform targets (Windows/Linux bundles) + our script runners (not `just`). Update endpoints to our repo. |
| 5 | `src-tauri/src/commands/feedback.rs` | **UPSTREAM** | Better GitHub issues integration with auto-populated data |
| 6 | `src-tauri/src/commands/mod.rs` | **UPSTREAM** + add our modules | Take upstream's modular structure. Add our modules: `resume`, `session_writer`, `files`, `cursor`, `codex`, `gemini`, `adapters` |
| 7 | `src-tauri/src/commands/project.rs` | **UPSTREAM** | Adds `get_git_log()` command, better path validation |
| 8 | `src-tauri/src/commands/stats.rs` | **UPSTREAM** | Performance-optimized with SIMD JSON, rayon parallel processing, billing/conversation filter modes |
| 9 | `src-tauri/src/lib.rs` | **UPSTREAM** + register our commands | Take upstream's provider-centric architecture. Register additional commands: resume, session_writer, files, cursor, codex, gemini adapters |
| 10 | `src-tauri/src/models.rs` | **UPSTREAM** | Modular re-export pattern with snapshot tests. Port our `universal.rs` and `FileActivity` types into the module structure |
| 11 | `src-tauri/src/utils.rs` | **UPSTREAM** | Superset of ours: adds SIMD line ranges, memchr, path traversal prevention, worktree detection |

### Modify/Delete Conflicts (we have, upstream deleted)

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 12 | `src-tauri/src/commands/secure_update.rs` | **DELETE** | Upstream relies on Tauri plugin for updates. Our custom SHA-256 verification is redundant. |
| 13 | `src-tauri/src/commands/session.rs` | **DELETE** (replaced by upstream's `session/` module) | Upstream's 4-file module is better organized. Port any unique functionality (e.g., `fix_session`) into upstream's structure. |
| 14 | `src-tauri/src/commands/update.rs` | **DELETE** | Same as secure_update.rs - Tauri plugin handles this. |

---

## 4. Frontend Components — Per-File Decisions

### App-Level

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 1 | `src/App.tsx` | **UPSTREAM** + add our views | Upstream has more views and better routing. Add our unique views (FilesView, CommandHistory, Export, DebugConsole) |
| 2 | `src/index.css` | **UPSTREAM** | More comprehensive Tailwind v4 styles |

### Main Components (upstream decomposed these into folders)

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 3 | `src/components/AnalyticsDashboard.tsx` | **UPSTREAM** | Upstream decomposed into 21-file folder with views (Global/Project/Session), 8 chart components, calculation utils. Far superior. |
| 4 | `src/components/FileContent.tsx` | **UPSTREAM** | Check for our additions, port if needed |
| 5 | `src/components/MessageViewer.tsx` | **UPSTREAM** | Upstream decomposed into 18-file folder with capture mode, agent task grouping, progress tracking, virtual scrolling hooks. Much richer. |
| 6 | `src/components/ProjectTree.tsx` | **UPSTREAM** | Upstream decomposed into 9-file folder with grouped lists, project items, session lists, tests. Better organized. |
| 7 | `src/components/TokenStatsViewer.tsx` | **UPSTREAM** | Likely more features |

### Update-Related Components

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 8 | `src/components/SimpleUpdateManager.tsx` | **UPSTREAM** | Better error handling, test coverage |
| 9 | `src/components/SimpleUpdateModal.tsx` | **UPSTREAM** | Better UX with manual restart fallback |
| 10 | `src/components/UpToDateNotification.tsx` | **UPSTREAM** | Enhanced with update checking/error notifications |

### Content Renderers

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 11 | `src/components/contentRenderer/ClaudeContentArrayRenderer.tsx` | **UPSTREAM** | Upstream has 30+ specialized renderers with registry. Far more comprehensive. |
| 12 | `src/components/contentRenderer/CommandRenderer.tsx` | **UPSTREAM** | Part of upstream's renderer ecosystem |
| 13 | `src/components/contentRenderer/ImageRenderer.tsx` | **UPSTREAM** | Enhanced rendering |
| 14 | `src/components/contentRenderer/ToolUseRenderer.tsx` | **UPSTREAM** | Upstream has per-tool sub-renderers (Bash, Glob, Grep, Read, etc.) |

### Message Renderers

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 15 | `src/components/messageRenderer/AssistantMessageDetails.tsx` | **UPSTREAM** | Part of richer message rendering system |
| 16 | `src/components/messageRenderer/ClaudeToolUseDisplay.tsx` | **UPSTREAM** | Enhanced with agent progress/task grouping |
| 17 | `src/components/messageRenderer/MessageContentDisplay.tsx` | **UPSTREAM** | Integrates with renderer registry |

### Tool Result Renderers

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 18 | `src/components/toolResultRenderer/FileEditRenderer.tsx` | **UPSTREAM** | Enhanced with StructuredPatch support |
| 19 | `src/components/toolResultRenderer/GitWorkflowRenderer.tsx` | **UPSTREAM** | |
| 20 | `src/components/toolResultRenderer/TerminalStreamRenderer.tsx` | **UPSTREAM** | |
| 21 | `src/components/toolResultRenderer/TodoUpdateRenderer.tsx` | **UPSTREAM** | |
| 22 | `src/components/toolResultRenderer/WebSearchRenderer.tsx` | **UPSTREAM** | |

### UI Components (add/add - both created independently)

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 23 | `src/components/ui/alert.tsx` | **UPSTREAM** | Part of more complete shadcn/ui set (20+ components vs our 5) |
| 24 | `src/components/ui/badge.tsx` | **UPSTREAM** | |
| 25 | `src/components/ui/button.tsx` | **UPSTREAM** | |
| 26 | `src/components/ui/input.tsx` | **UPSTREAM** | |
| 27 | `src/components/ui/label.tsx` | **UPSTREAM** | |

### Modify/Delete Components

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 28 | `src/components/SimpleUpdateSettings.tsx` | **DELETE** | Upstream has SettingsManager with comprehensive settings UI |
| 29 | `src/components/UpdateConsentModal.tsx` | **DELETE** | Upstream's update flow doesn't need consent modal |

---

## 5. Store, Types, Hooks — Per-File Decisions

### Store

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 1 | `src/store/useAppStore.ts` | **UPSTREAM** | 111-line wrapper composing 14 slices. Our 1,742-line monolith is unmaintainable. Port our unique state (export, fileActivity, providers) as new slices. |
| 2 | `src/store/useLanguageStore.ts` | **UPSTREAM** | Functionally identical, just different import path |

### Types

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 3 | `src/types/index.ts` | **UPSTREAM** | Clean re-exports from core/derived modules. Port our unique types (UniversalMessage, FileActivity, SessionWriter) into the structure. |
| 4 | `src/types/analytics.ts` | **UPSTREAM** | Extended with 6 views (vs our 3), statsMode, metricMode, recentEdits |
| 5 | `src/types/updateSettings.ts` | **UPSTREAM** | Same interface, but upstream's utilities have better validation |

### Hooks

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 6 | `src/hooks/useAnalytics.ts` | **UPSTREAM** | Likely enhanced for new analytics views |
| 7 | `src/hooks/useCopyButton.tsx` | **UPSTREAM** | More refined implementation |

### Modify/Delete Hooks (we have, upstream deleted)

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 8 | `src/hooks/useGitHubUpdater.ts` | **DELETE** | Replaced by upstream's unified `useUpdater.ts` |
| 9 | `src/hooks/useNativeUpdater.ts` | **DELETE** | Replaced by `useUpdater.ts` |
| 10 | `src/hooks/useSmartUpdater.ts` | **DELETE** | Replaced by `useUpdater.ts` |
| 11 | `src/hooks/useUpdateChecker.tsx` | **DELETE** | Replaced by `useUpdater.ts` |

### Utils

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 12 | `src/utils/messageUtils.ts` | **MERGE** | Different purposes - ours has content extraction, upstream has type guards. Combine both. |
| 13 | `src/utils/pathUtils.ts` | **MERGE** | Ours: getFileName/getPathParts. Upstream: isAbsolutePath/formatDisplayPath. Both useful. |
| 14 | `src/utils/time.ts` | **UPSTREAM** | Superset of ours - adds formatTimeShort, formatDateCompact |
| 15 | `src/utils/updateSettings.ts` | **UPSTREAM** | Better validation, logging integration, test hooks |

### Modify/Delete Utils & Constants

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 16 | `src/utils/updateCache.ts` | **DELETE** | Upstream doesn't cache update checks, keeps it simpler |
| 17 | `src/constants/colors.ts` | **KEEP OURS** | Centralized color management is better than inline Tailwind. Port into upstream's structure. |

### Contexts

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 18 | `src/contexts/modal/context.ts` | **OURS** | Straightforward modal management |
| 19 | `src/contexts/theme/utils.ts` | **UPSTREAM** | If exists; otherwise keep ours |

---

## 6. i18n, Config, Build — Per-File Decisions

### i18n Common Files

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 1 | `src/i18n/locales/en/common.json` | **UPSTREAM** | More translation keys for new features |
| 2 | `src/i18n/locales/ja/common.json` | **UPSTREAM** | |
| 3 | `src/i18n/locales/ko/common.json` | **UPSTREAM** | |
| 4 | `src/i18n/locales/zh-CN/common.json` | **UPSTREAM** | |
| 5 | `src/i18n/locales/zh-TW/common.json` | **UPSTREAM** | |

### i18n Structural Conflicts

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 6 | `src/i18n/index.ts` | **UPSTREAM** | We deleted this (renamed to i18n.config.ts). Upstream enhanced it with 11 namespaces + type-safe hook. Accept upstream's approach. |
| 7-11 | `src/i18n/locales/*/components.json` (5 files) | **DELETE** | Upstream replaced with finer-grained namespaces (analytics, session, settings, tools, etc.) |

### i18n — Add Russian
After merge, create Russian translations for ALL upstream namespaces based on our existing `src/i18n/locales/ru/` files. This is unique value only our fork has.

### Config & Build

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 12 | `package.json` | **UPSTREAM** + our scripts | Upstream has newer deps. Keep our `release`, `sync-version`, `run-with-pm` scripts. Keep our platform build scripts. |
| 13 | `index.html` | **UPSTREAM** | |
| 14 | `scripts/sync-version.cjs` | **OURS** | Upstream uses `just`; we use cross-platform node scripts |
| 15 | `.github/workflows/updater-release.yml` | **HYBRID** | Upstream's workflow + our multi-platform build targets |
| 16 | `.gitignore` | **MERGE** | Combine both |
| 17 | `.coderabbit.yaml` | **DELETE** | Upstream deleted it |

### Documentation

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 18 | `CLAUDE.md` | **HYBRID** | Upstream's updated architecture docs + our unique features docs |
| 19 | `README.md` | **UPSTREAM** + our platform info | |
| 20 | `README.ko.md` | **UPSTREAM** | |
| 21 | `README.ja.md` | **UPSTREAM** | |
| 22 | `README.zh-CN.md` | **UPSTREAM** | |
| 23 | `README.zh-TW.md` | **UPSTREAM** | |

### Layout

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 24 | `src/layouts/Header/Header.tsx` | **UPSTREAM** | Enhanced with global search, provider selector |
| 25 | `src/layouts/Header/SettingDropdown/index.tsx` | **UPSTREAM** | More settings options |

### Other

| # | File | Decision | Rationale |
|---|------|----------|-----------|
| 26 | `test-server/README.md` | **DELETE** | Upstream removed test-server |

---

## 7. Files Unique to Our Fork (KEEP)

These 123 files only exist in our fork. **All should be preserved** as they represent unique value:

### Must Keep — Core Unique Features

| Feature | Files | Priority |
|---------|-------|----------|
| **E2E Tests** | `e2e/fixtures/tauri.ts`, `e2e/fixtures/mockClaudeData.ts`, `e2e/tests/*.spec.ts`, `playwright.config.ts` | HIGH |
| **Frontend Adapters** | `src/adapters/base/IAdapter.ts`, `src/adapters/providers/*.ts`, `src/adapters/registry/AdapterRegistry.ts`, `src/adapters/utils/capabilityHelpers.ts` | HIGH |
| **Cursor Adapter** (backend) | `src-tauri/src/commands/cursor.rs` | HIGH |
| **Gemini Adapter** (backend) | `src-tauri/src/commands/gemini.rs`, `src-tauri/src/commands/adapters/gemini.rs` | MEDIUM |
| **Codex Adapter** (our version) | `src-tauri/src/commands/codex.rs`, `src-tauri/src/commands/adapters/codex.rs` | MEDIUM (merge with upstream's) |
| **Export** | `src/components/ExportControls.tsx`, `src/utils/exportUtils.ts` | HIGH |
| **Session Resume** | `src-tauri/src/commands/resume.rs` | HIGH |
| **Session Writer** | `src-tauri/src/commands/session_writer.rs`, `src/types/sessionWriter.ts` | HIGH |
| **File Activity** | `src/components/FilesView.tsx`, `src/components/FileActivityTable.tsx`, `src/components/FileActivityFilters.tsx`, `src-tauri/src/commands/files.rs` | MEDIUM |
| **Debug Console** | `src/components/DebugConsole.tsx` | LOW |
| **Command History** | `src/components/CommandHistoryView.tsx` | MEDIUM |
| **Russian i18n** | `src/i18n/locales/ru/*.json` (6 files) | HIGH |
| **Release Scripts** | `scripts/release.cjs`, `scripts/run-with-pm.cjs` | HIGH |
| **Universal Models** | `src-tauri/src/models/universal.rs` | MEDIUM (integrate into upstream's model module) |
| **Provider Capabilities** | `src-tauri/src/commands/adapters/provider_capabilities.rs` | MEDIUM |

### Can Evaluate — Lower Priority

| Feature | Files | Priority |
|---------|-------|----------|
| **VSCode Config** | `.vscode/launch.json`, `.vscode/tasks.json`, `.vscode/extensions.json` | LOW |
| **Raw Message View** | `src/components/RawMessageView.tsx` | LOW |
| **Source Manager** | `src/components/SourceManager.tsx` | LOW (upstream has provider slice) |
| **File Viewer Modal** | `src/components/FileViewerModal.tsx` | LOW |

---

## 8. Files Unique to Upstream (ADOPT)

These 370 files only exist in upstream. **All should be adopted** as the base:

### Critical New Architecture (must adopt)

| Feature | File Count | Key Files |
|---------|-----------|-----------|
| **Store Slices** | 15 | `src/store/slices/*.ts` |
| **Type System** | 10 | `src/types/core/*.ts`, `src/types/derived/*.ts` |
| **AnalyticsDashboard/** | 21 | Views, components, utils, types |
| **MessageViewer/** | 18 | Components, helpers, hooks, types |
| **ProjectTree/** | 9 | Components, hooks, tests |
| **SessionBoard/** | 8 | Board, lanes, cards, timeline |
| **SettingsManager/** | 25 | Sections, dialogs, editor, sidebar |
| **Renderer Registry** | 10 | `src/components/renderers/*` |
| **Content Renderers** | 30+ | Tool-specific renderers (Bash, Glob, Grep, Read, MCP, etc.) |
| **MessageNavigator/** | 5 | Navigation breadcrumbs |

### Important New Features

| Feature | Files | Description |
|---------|-------|-------------|
| **Global Search Modal** | 2 | `src/components/modals/globalSearch/*` |
| **File Watcher** | 3 | Backend watcher.rs + hook + slice |
| **MCP Support** | 6 | Presets, servers, hooks, types |
| **Session Rename** | 3 | Backend rename.rs + dialog + hook |
| **Recent Edits** | 4 | `src/components/RecentEditsViewer/*` |
| **Providers Module** | 4 | `src-tauri/src/providers/` (claude, codex, opencode) |
| **New UI Components** | 15 | card, chart-tooltip, collapsible, command, hover-card, loading, select, separator, skeleton, switch, tabs, textarea, DatePickerHeader, MetricModeToggle |
| **Unit Tests** | 26 | `src/test/*.test.ts(x)` |
| **i18n Toolchain** | 6 | `scripts/*-i18n*.mjs` |
| **Type-safe i18n** | 2 | `src/i18n/types.generated.ts`, `src/i18n/useAppTranslation.ts` |
| **New Utilities** | 26 | logger, contentTypeGuards, formatters, globUtils, searchIndex, toolUtils, etc. |
| **New Hooks** | 10 | useFileWatcher, useMCPPresets, useUpdater, useResizablePanel, etc. |

---

## 9. Modify/Delete Conflicts — Decision Summary

### Files We Have, Upstream Deleted → **DELETE (accept upstream's deletion)**

| File | Reason |
|------|--------|
| `src-tauri/src/commands/secure_update.rs` | Replaced by Tauri plugin |
| `src-tauri/src/commands/session.rs` | Restructured into `session/` module |
| `src-tauri/src/commands/update.rs` | Replaced by Tauri plugin |
| `src/components/SimpleUpdateSettings.tsx` | Replaced by SettingsManager |
| `src/components/UpdateConsentModal.tsx` | Not needed with new update flow |
| `src/hooks/useGitHubUpdater.ts` | Replaced by useUpdater.ts |
| `src/hooks/useNativeUpdater.ts` | Replaced by useUpdater.ts |
| `src/hooks/useSmartUpdater.ts` | Replaced by useUpdater.ts |
| `src/hooks/useUpdateChecker.tsx` | Replaced by useUpdater.ts |
| `src/i18n/locales/en/components.json` | Replaced by finer namespaces |
| `src/i18n/locales/ja/components.json` | Replaced by finer namespaces |
| `src/i18n/locales/ko/components.json` | Replaced by finer namespaces |
| `src/i18n/locales/zh-CN/components.json` | Replaced by finer namespaces |
| `src/i18n/locales/zh-TW/components.json` | Replaced by finer namespaces |
| `src/constants/colors.ts` | **EXCEPTION: KEEP THIS** — centralized colors is better |
| `src/utils/updateCache.ts` | Not needed with Tauri plugin |
| `.coderabbit.yaml` | Not needed |
| `test-server/README.md` | Test server removed |
| `test-server/latest.json` | Test server removed |
| `test-server/server.cjs` | Test server removed |

### Files We Deleted, Upstream Modified → **ACCEPT UPSTREAM**

| File | Reason |
|------|--------|
| `src/i18n/index.ts` | We renamed to i18n.config.ts. Accept upstream's enhanced version with 11 namespaces. Delete our i18n.config.ts. |

---

## 10. Execution Plan — Phased Approach

### Phase 0: Preparation
1. Create a fresh branch from `upstream/main`
2. Verify it builds and tests pass
3. Create a working branch for the merge

### Phase 1: Backend Integration (Rust)
**Estimated effort: HIGH**

1. **Start from upstream's Rust codebase** (all commands, models, providers, utils)
2. **Add our unique Rust modules:**
   - Copy `commands/resume.rs` → add session resume capability
   - Copy `commands/session_writer.rs` → add session creation
   - Copy `commands/files.rs` → add file activity tracking
   - Copy `commands/cursor.rs` → add Cursor IDE support
   - Copy `commands/codex.rs` → merge with upstream's codex provider (they overlap)
   - Copy `commands/gemini.rs` → add Gemini support
   - Copy `commands/adapters/` → add adapter framework
3. **Update `lib.rs`** to register all new commands
4. **Update `mod.rs`** to declare new modules
5. **Merge Cargo.toml:** Add `rusqlite` (for Cursor) to upstream's deps
6. **Update tauri.conf.json:** Add Windows/Linux bundle targets, keep our script runners
7. **Update capabilities:** Add clipboard and opener permissions
8. Build and verify Rust compiles

### Phase 2: Frontend Architecture (Store + Types)
**Estimated effort: HIGH**

1. **Start from upstream's store slices** (all 14 slices)
2. **Create new slices for our unique state:**
   - `exportSlice.ts` — export state management
   - `fileActivitySlice.ts` — file activity tracking state
   - Extend `providerSlice.ts` — add Cursor/Gemini providers
3. **Start from upstream's type system** (core/ + derived/)
4. **Add our unique types:**
   - Port `UniversalMessage` types into `types/core/`
   - Port `SessionWriter` types
   - Port `FileActivity` types
   - Port `ExportOptions` types
5. Build and verify TypeScript compiles

### Phase 3: Frontend Components
**Estimated effort: MEDIUM**

1. **Accept all upstream components** (they're the base)
2. **Add our unique components:**
   - `ExportControls.tsx` — conversation export
   - `FilesView.tsx`, `FileActivityTable.tsx`, `FileActivityFilters.tsx` — file tracking
   - `CommandHistoryView.tsx` — command history
   - `DebugConsole.tsx` — development debug tool
   - `SessionBuilderModal.tsx` — session creation
   - `RawMessageView.tsx` — raw JSON view
3. **Add our frontend adapters** (`src/adapters/`)
4. **Wire up App.tsx** to include our additional views
5. **Merge utils:** Combine messageUtils.ts and pathUtils.ts from both sides

### Phase 4: i18n Integration
**Estimated effort: MEDIUM**

1. **Accept all upstream i18n** (11 namespaces × 5 languages)
2. **Create Russian translations** for ALL upstream namespaces:
   - Translate: analytics, error, feedback, message, recentEdits, renderers, session, settings, tools, update
   - Use our existing `ru/common.json` as base
3. **Register Russian** in i18n/index.ts
4. **Add translations** for our unique features (export, file activity, command history, resume)

### Phase 5: Testing & Polish
**Estimated effort: MEDIUM**

1. **Keep all upstream unit tests** (30+ files)
2. **Add our E2E tests** (Playwright)
3. **Update CLAUDE.md** with merged architecture
4. **Update README** files with complete feature list
5. **Version:** Set to v2.0.0 (major merge milestone)
6. Full build + test cycle

---

## Appendix: Key Insights from Deep Analysis

### Frontend Component Architecture (from component research)

Upstream performed **massive component decomposition**:
- `AnalyticsDashboard.tsx` (1,321 lines) → `AnalyticsDashboard/` folder (21 files: views, components, utils)
- `MessageViewer.tsx` (894 lines) → `MessageViewer/` folder (18 files: components, helpers, hooks)
- `ProjectTree.tsx` (771 lines) → `ProjectTree/` folder (9 files with unit tests)
- New: `SessionBoard/` (8 files), `SettingsManager/` (25 files), `MessageNavigator/` (5 files)

Upstream also created a **renderer registry system** (`src/components/renderers/`) that centrally manages all content renderers. Their content renderer count went from ~5 to **30+** specialized renderers (Bash, Glob, Grep, Read, MCP, WebFetch, CodeExecution, etc.).

**Design system upgrade**: Upstream moved to OKLCH color space, IBM Plex Sans + JetBrains Mono typography, custom easing curves, and an "industrial luxury" Command Center aesthetic.

### i18n Architecture (from i18n research)

**Critical structural difference** in JSON key format:
- **Ours**: Nested objects — `{ "settings": { "title": "Settings" } }`
- **Upstream**: Flat dot-notation — `{ "common.settings.title": "Settings" }`

This means i18n keys are **incompatible** between forks. All translation references in code would need to match the chosen format.

**Upstream's i18n toolchain** includes:
- `scripts/generate-i18n-types.mjs` — generates TypeScript types for all translation keys
- `scripts/validate-i18n.mjs` — validates completeness across languages
- `scripts/sync-i18n-keys.mjs` — synchronizes keys across languages
- `src/i18n/types.generated.ts` — auto-generated type-safe translations
- `src/i18n/useAppTranslation.ts` — type-safe translation hook

### Build System (from config research)

**Upstream uses `just` taskrunner** (`brew install just`) instead of npm scripts:
- `just dev`, `just build`, `just test` instead of `pnpm dev`, `pnpm build`
- `just frontend-build`, `just vite-dev` for Tauri integration
- Phase-based release with quality gates

**Recommendation**: Keep our npm/pnpm scripts approach (more standard, cross-platform) but adopt upstream's version sync script (syncs 3 files vs our 2).

### Rust Performance (from backend research)

Upstream added significant performance dependencies:
- `rayon` — parallel processing for multi-file operations
- `memmap2` — memory-mapped file access for large JSONL files
- `simd-json` — SIMD-accelerated JSON parsing
- `memchr` — fast byte searching for line boundaries
- `notify` + `notify-debouncer-mini` — file system watching

These are used in `stats.rs` (parallel stats calculation), `session/load.rs` (memory-mapped file reading), and `utils.rs` (SIMD line boundary detection).

### Provider Architecture Overlap

| Provider | Our Backend | Upstream Backend | Frontend Adapter |
|----------|-------------|-----------------|------------------|
| **Claude Code** | `adapters/claude_code.rs` | `providers/claude.rs` | `ClaudeCodeAdapter.ts` |
| **Codex** | `commands/codex.rs` + `adapters/codex.rs` | `providers/codex.rs` | `CodexAdapter.ts` |
| **OpenCode** | — | `providers/opencode.rs` | — |
| **Cursor IDE** | `commands/cursor.rs` | — | `CursorAdapter.ts` |
| **Gemini** | `commands/gemini.rs` + `adapters/gemini.rs` | — | `GeminiAdapter.ts` |

**Merge strategy for providers**: Use upstream's `providers/` module structure. Add Cursor and Gemini as new provider modules. Merge Codex implementations (upstream's is more optimized with memmap2).

---

## Appendix A: File Count Summary

| Category | UPSTREAM | OURS | DELETE | MERGE | Total |
|----------|----------|------|--------|-------|-------|
| Rust backend conflicts | 9 | 0 | 3 | 0 | 12 |
| Frontend component conflicts | 25 | 0 | 2 | 0 | 27 |
| Store/types/hooks conflicts | 7 | 1 | 6 | 2 | 16 |
| i18n/config/build conflicts | 17 | 1 | 8 | 1 | 27 |
| Constants (colors.ts) | 0 | 1 | 0 | 0 | 1 |
| **Conflict totals** | **58** | **3** | **19** | **3** | **83** |
| Unique to our fork (keep) | — | ~50 | ~15 | — | ~65 |
| Unique to upstream (adopt) | ~370 | — | — | — | ~370 |

**Decision breakdown for 97 conflicts:**
- **Take UPSTREAM**: ~72 files (74%)
- **Take OURS**: ~4 files (4%)
- **MERGE both**: ~3 files (3%)
- **DELETE**: ~18 files (19%)

## Appendix B: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Rust compilation failures after adding our modules | HIGH | MEDIUM | Incremental integration, compile after each module |
| TypeScript type mismatches between our adapters and upstream types | HIGH | MEDIUM | Create bridge types, use `any` temporarily |
| Our E2E tests fail against new UI | HIGH | LOW | Update test selectors and assertions |
| Russian translations incomplete for new namespaces | MEDIUM | LOW | Use English fallback, translate incrementally |
| Provider adapter interface mismatch | MEDIUM | HIGH | Design unified adapter interface early |
| Performance regression from adding our features | LOW | MEDIUM | Benchmark critical paths |

## Appendix C: What We Gain from the Merge

### From Upstream
- 14 modular store slices (vs 1,742-line monolith)
- 30+ specialized content renderers
- AnalyticsDashboard with 8 chart types
- SessionBoard visual timeline
- SettingsManager with MCP support
- Global search modal
- File watcher with auto-refresh
- Session rename capability
- Performance optimizations (SIMD JSON, memmap2, rayon)
- 30+ unit tests with snapshot testing
- Type-safe i18n with generated types
- 26 new utility functions
- Newer Tauri (2.9.5) and dependencies

### From Our Fork (preserved)
- E2E testing with Playwright
- Cursor IDE support
- Gemini support
- Conversation export (Markdown/HTML/DOCX)
- Session resume capability
- Session creation/writing
- File activity tracking
- Command history view
- Debug console
- Russian language support
- Cross-platform (Windows/Linux) build targets
- Release automation scripts
