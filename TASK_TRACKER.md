# Task Tracker: Multi-Provider Implementation

Track progress for implementing Gemini CLI, Codex CLI, and Agent Sessions features.

---

## Phase 1: Gemini CLI Support (Week 1)

### Backend - Day 1

- [ ] Create `src-tauri/src/commands/adapters/gemini.rs`
  - [ ] Define `GeminiSession` struct
  - [ ] Define `GeminiMessage` struct
  - [ ] Implement `GeminiHashResolver`
  - [ ] Implement `gemini_sessions_to_projects()`
  - [ ] Implement `gemini_file_to_session()`
  - [ ] Implement `gemini_message_to_universal()`
  - [ ] Add helper functions (`find_gemini_sessions`, `extract_first_user_text`, etc.)

- [ ] Update `src-tauri/src/commands/adapters/mod.rs`
  - [ ] Add `pub mod gemini;`
  - [ ] Add `pub use gemini::*;`

- [ ] Create `src-tauri/src/commands/gemini.rs`
  - [ ] Implement `scan_gemini_projects` command
  - [ ] Implement `load_gemini_sessions` command
  - [ ] Implement `load_gemini_messages` command
  - [ ] Implement `seed_gemini_resolver` command

- [ ] Update `src-tauri/src/main.rs`
  - [ ] Add `GeminiResolverState` to app state
  - [ ] Register Gemini commands in `invoke_handler`

- [ ] Test backend
  - [ ] Build succeeds: `cd src-tauri && cargo build`
  - [ ] No compiler warnings
  - [ ] Manual test commands in DevTools

### Backend - Day 2

- [ ] Add Rust dependencies to `src-tauri/Cargo.toml`
  - [ ] Verify `sha2` crate is available
  - [ ] Verify `uuid` crate is available
  - [ ] Verify `regex` crate is available

- [ ] Write unit tests
  - [ ] Test `parse_codex_filename()` (if implementing Codex)
  - [ ] Test `compute_sha256()`
  - [ ] Test `extract_first_user_text()`

- [ ] Fix any compilation errors
- [ ] Run `cargo clippy` and fix warnings
- [ ] Run `cargo fmt` to format code

### Frontend - Day 3 Morning

- [ ] Create `src/adapters/providers/GeminiAdapter.ts`
  - [ ] Implement `providerId` and `providerDefinition`
  - [ ] Implement `initialize()` and `dispose()`
  - [ ] Implement `validate()` and `canHandle()`
  - [ ] Implement `scanProjects()`
  - [ ] Implement `loadSessions()`
  - [ ] Implement `loadMessages()`
  - [ ] Implement `searchMessages()` (stub for v1.8.0)
  - [ ] Implement `healthCheck()`
  - [ ] Implement `handleError()`

- [ ] Update `src/types/providers.ts`
  - [ ] Add `GEMINI = 'gemini'` to `ProviderID` enum

- [ ] Update `src/adapters/registry/AdapterRegistry.ts`
  - [ ] Import `GeminiAdapter`
  - [ ] Add `new GeminiAdapter()` to `registerBuiltinAdapters()`

### Frontend - Day 3 Afternoon

- [ ] Add i18n translations
  - [ ] `src/i18n/locales/en/common.json`: Add "gemini": "Gemini CLI"
  - [ ] `src/i18n/locales/ko/common.json`: Add Korean translation
  - [ ] `src/i18n/locales/ja/common.json`: Add Japanese translation
  - [ ] `src/i18n/locales/zh-CN/common.json`: Add Simplified Chinese
  - [ ] `src/i18n/locales/zh-TW/common.json`: Add Traditional Chinese
  - [ ] `src/i18n/locales/ru/common.json`: Add Russian translation

- [ ] Test frontend
  - [ ] `pnpm build` succeeds
  - [ ] No TypeScript errors
  - [ ] No ESLint warnings
  - [ ] Test in DevTools console

### Testing - Day 3 Evening

- [ ] Write unit tests
  - [ ] `tests/unit/adapters/gemini.test.ts`
  - [ ] Test initialization
  - [ ] Test validation
  - [ ] Test canHandle()
  - [ ] Test scanProjects() (mocked)
  - [ ] Test loadSessions() (mocked)
  - [ ] Test loadMessages() (mocked)

- [ ] Write integration tests
  - [ ] `tests/integration/gemini-integration.test.ts`
  - [ ] Test adapter registration in registry
  - [ ] Test provider detection

- [ ] Run tests
  - [ ] `pnpm test` - all unit tests pass
  - [ ] `pnpm test:run` - verbose output shows all passing

- [ ] Manual testing
  - [ ] Open app in dev mode: `pnpm tauri:dev`
  - [ ] Add Gemini source via UI
  - [ ] Verify projects are detected
  - [ ] Verify sessions load
  - [ ] Verify messages display correctly

---

## Phase 2: Performance Optimizations (Week 2)

### Lightweight Session Loading - Day 4

- [ ] Update `src-tauri/src/commands/adapters/claude_code.rs`
  - [ ] Add constants: `LIGHTWEIGHT_THRESHOLD`, `HEAD_BYTES`, `TAIL_BYTES`
  - [ ] Implement `claude_file_to_session_optimized()`
  - [ ] Implement `claude_file_to_session_lightweight()`
  - [ ] Implement `extract_user_text()` helper
  - [ ] Update existing functions to use optimized version

- [ ] Test lightweight loading
  - [ ] Create test file ≥10MB
  - [ ] Verify lightweight parse is triggered
  - [ ] Verify metadata is extracted correctly
  - [ ] Verify estimated message count is reasonable

### Lightweight Session Loading - Day 5 Morning

- [ ] Update frontend for full-load trigger
  - [ ] Update `src/store/useAppStore.ts`
  - [ ] Add `loadSessionFull()` method
  - [ ] Update `selectSession()` to detect lightweight flag
  - [ ] Add loading state for full parse

- [ ] Add backend command for full load
  - [ ] `src-tauri/src/commands/session.rs`
  - [ ] Add `load_session_full` command
  - [ ] Call `claude_file_to_session_full()` directly

- [ ] Test full-load trigger
  - [ ] Click lightweight session
  - [ ] Verify full load is triggered
  - [ ] Verify all messages load
  - [ ] Verify loading indicator shows

### Smart Preamble Filtering - Day 5 Afternoon

- [ ] Create `src-tauri/src/commands/utils/preamble_filter.rs`
  - [ ] Implement `looks_like_preamble()` function
  - [ ] Add anchor patterns from Agent Sessions
  - [ ] Add markdown detection logic
  - [ ] Implement `extract_clean_title()` function

- [ ] Update `src-tauri/src/commands/adapters/mod.rs`
  - [ ] Add `pub mod utils;`

- [ ] Update session title extraction
  - [ ] Use `extract_clean_title()` in all adapters
  - [ ] Test with preamble-heavy sessions
  - [ ] Verify clean titles are extracted

### Git Branch Extraction - Day 6

- [ ] Create `src-tauri/src/commands/utils/git_extractor.rs`
  - [ ] Implement `extract_git_branch()` function
  - [ ] Try metadata field first
  - [ ] Parse from tool outputs
  - [ ] Implement `parse_branch_from_output()` with regex patterns

- [ ] Update session metadata
  - [ ] Add `git_branch` to session metadata
  - [ ] Extract during session parsing
  - [ ] Display in UI (session list)

- [ ] Test git branch extraction
  - [ ] Test with sessions containing git commands
  - [ ] Test with metadata containing git_branch field
  - [ ] Verify branch name is extracted correctly

---

## Phase 3: Codex CLI Support (Week 3)

### Backend - Day 7-8

- [ ] Create `src-tauri/src/commands/adapters/codex.rs`
  - [ ] Define `CodexFilename` struct
  - [ ] Define `CodexMessage` struct
  - [ ] Implement `parse_codex_filename()` with regex
  - [ ] Implement `codex_sessions_to_projects()`
  - [ ] Implement `codex_file_to_session()`
  - [ ] Implement `codex_message_to_universal()`

- [ ] Create `src-tauri/src/commands/codex.rs`
  - [ ] Implement `scan_codex_projects` command
  - [ ] Implement `load_codex_sessions` command
  - [ ] Implement `load_codex_messages` command

- [ ] Update `src-tauri/src/main.rs`
  - [ ] Register Codex commands

- [ ] Test backend
  - [ ] Build succeeds
  - [ ] Manual test commands

### Backend - Day 9

- [ ] Write unit tests
  - [ ] Test `parse_codex_filename()`
  - [ ] Test rollout regex pattern
  - [ ] Test timestamp parsing
  - [ ] Test UUID extraction

- [ ] Fix compilation errors
- [ ] Run `cargo clippy`
- [ ] Run `cargo fmt`

### Frontend - Day 10

- [ ] Create `src/adapters/providers/CodexAdapter.ts`
  - [ ] Implement full `IConversationAdapter` interface
  - [ ] Set `providerDefinition` with detection patterns
  - [ ] Implement all required methods

- [ ] Update `src/types/providers.ts`
  - [ ] Add `CODEX = 'codex'` to `ProviderID` enum

- [ ] Update `src/adapters/registry/AdapterRegistry.ts`
  - [ ] Add `new CodexAdapter()` to registry

- [ ] Add i18n translations (all 6 languages)

- [ ] Write unit tests
  - [ ] `tests/unit/adapters/codex.test.ts`

- [ ] Test in UI
  - [ ] Add Codex source
  - [ ] Verify detection works
  - [ ] Verify sessions load

---

## Phase 4: Advanced Features (Week 4-5)

### Resume Functionality - Day 11-12

- [ ] Create `src-tauri/src/commands/resume.rs`
  - [ ] Implement `resume_claude_session` command
  - [ ] Implement `launch_terminal` for macOS (#[cfg(target_os = "macos")])
  - [ ] Implement `launch_terminal` for Windows (#[cfg(target_os = "windows")])
  - [ ] Implement `launch_terminal` for Linux (#[cfg(target_os = "linux")])

- [ ] Update `src-tauri/src/main.rs`
  - [ ] Register resume commands

- [ ] Add `which` crate to `Cargo.toml`

### Resume Functionality - Day 13

- [ ] Create `src/components/ResumeButton.tsx`
  - [ ] Add button UI component
  - [ ] Call `resume_claude_session` on click
  - [ ] Show toast notifications
  - [ ] Handle errors gracefully

- [ ] Add to session actions
  - [ ] Add to context menu (if exists)
  - [ ] Add to session details view
  - [ ] Add keyboard shortcut

- [ ] Test resume
  - [ ] Test on macOS (if available)
  - [ ] Test on Windows (if available)
  - [ ] Test on Linux (if available)
  - [ ] Verify terminal opens with correct command

### Favorites System - Day 14

- [ ] Create `src/store/useFavoritesStore.ts`
  - [ ] Define `FavoritesStore` interface
  - [ ] Implement with Zustand + persist
  - [ ] Add `addFavorite()`, `removeFavorite()`, `toggleFavorite()`
  - [ ] Add `isFavorite()` helper

- [ ] Create `src/components/FavoriteButton.tsx`
  - [ ] Add star icon button
  - [ ] Toggle favorite on click
  - [ ] Show filled star for favorites

- [ ] Add to session list
  - [ ] Add FavoriteButton to each session row
  - [ ] Add filter toggle for "Show Favorites Only"

### Favorites System - Day 15

- [ ] Test favorites
  - [ ] Click star, verify favorite is saved
  - [ ] Refresh page, verify favorite persists
  - [ ] Toggle filter, verify only favorites show
  - [ ] Remove favorite, verify it's removed

- [ ] Write unit tests
  - [ ] Test useFavoritesStore
  - [ ] Test favorite toggle
  - [ ] Test persistence

---

## Documentation & Polish

### Documentation - Day 16

- [ ] Update `README.md`
  - [ ] Add Gemini CLI to "What's New"
  - [ ] Add Codex CLI to "What's New"
  - [ ] Update screenshots if needed
  - [ ] Update provider list

- [ ] Update `CLAUDE.md`
  - [ ] Document Gemini adapter architecture
  - [ ] Document Codex adapter architecture
  - [ ] Document resume functionality
  - [ ] Document favorites system
  - [ ] Update implementation notes

- [ ] Update `CHANGELOG.md`
  - [ ] Add v1.7.0 section
  - [ ] List all new features
  - [ ] List performance improvements

### E2E Tests - Day 17

- [ ] Write E2E tests for Gemini
  - [ ] `e2e/tests/gemini-provider.spec.ts`
  - [ ] Test source detection
  - [ ] Test project loading
  - [ ] Test session loading
  - [ ] Test message display

- [ ] Write E2E tests for Codex
  - [ ] `e2e/tests/codex-provider.spec.ts`
  - [ ] Test source detection
  - [ ] Test session loading

- [ ] Write E2E tests for resume
  - [ ] `e2e/tests/resume-functionality.spec.ts`
  - [ ] Test resume button appears
  - [ ] Test resume button click

- [ ] Write E2E tests for favorites
  - [ ] `e2e/tests/favorites.spec.ts`
  - [ ] Test favorite toggle
  - [ ] Test favorites filter

### Final Testing - Day 18

- [ ] Run full test suite
  - [ ] `pnpm test` - all unit tests pass
  - [ ] `pnpm test:e2e` - all E2E tests pass
  - [ ] No flaky tests

- [ ] Manual testing
  - [ ] Test all 3 providers (Claude, Cursor, Gemini)
  - [ ] Test Codex if available
  - [ ] Test lightweight loading
  - [ ] Test preamble filtering
  - [ ] Test git branch extraction
  - [ ] Test resume functionality
  - [ ] Test favorites

- [ ] Cross-platform testing
  - [ ] Test on macOS
  - [ ] Test on Windows
  - [ ] Test on Linux

### Build & Release - Day 19

- [ ] Build production
  - [ ] `pnpm build` succeeds
  - [ ] No TypeScript errors
  - [ ] No build warnings

- [ ] Build desktop apps
  - [ ] `pnpm tauri:build:mac` succeeds
  - [ ] `pnpm tauri:build:windows` succeeds
  - [ ] `pnpm tauri:build:linux` succeeds

- [ ] Test installers
  - [ ] Test .dmg on macOS
  - [ ] Test .exe on Windows
  - [ ] Test .AppImage on Linux

- [ ] Create release
  - [ ] `pnpm release 1.7.0`
  - [ ] Push to GitHub
  - [ ] Verify CI/CD runs
  - [ ] Verify artifacts are uploaded

---

## Checklist Before Release

### Code Quality

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No TypeScript errors (`pnpm build`)
- [ ] No ESLint warnings (`pnpm lint`)
- [ ] No Rust warnings (`cargo clippy`)
- [ ] Code formatted (`cargo fmt`, `prettier`)

### Documentation

- [ ] README.md updated
- [ ] CLAUDE.md updated
- [ ] CHANGELOG.md updated
- [ ] All 6 i18n languages updated
- [ ] Code comments added where complex

### Testing

- [ ] Tested on macOS
- [ ] Tested on Windows
- [ ] Tested on Linux
- [ ] Manual smoke test passed
- [ ] No regression in existing features

### Architecture

- [ ] Backend: Zero data loss (all fields preserved)
- [ ] Backend: All Tauri commands registered
- [ ] Frontend: All adapters implement IConversationAdapter
- [ ] Frontend: All adapters registered in AdapterRegistry
- [ ] Separation of concerns maintained
- [ ] No backend logic in frontend

### Performance

- [ ] Lightweight loading works for large files
- [ ] No memory leaks
- [ ] No performance regressions
- [ ] Virtual scrolling still smooth

### User Experience

- [ ] All new features accessible via UI
- [ ] Error messages are user-friendly
- [ ] Loading states are clear
- [ ] Success messages are shown
- [ ] Keyboard shortcuts work

---

## Progress Tracking

**Status Symbols:**
- ⏳ Not started
- 🚧 In progress
- ✅ Complete
- ❌ Blocked

**Current Phase:** Phase 1 - Gemini CLI Support ⏳

**Estimated Completion:** 4-5 weeks from start date

**Actual Start Date:** _____________

**Actual Completion Date:** _____________

---

## Notes & Issues

Use this section to track blockers, decisions, and important notes:

### Blockers

- None yet

### Decisions Made

- None yet

### Important Notes

- None yet

---

## Daily Standup Template

**Date:** __________

**Completed Yesterday:**
-

**Working on Today:**
-

**Blockers:**
-

**Questions:**
-

---

**Last Updated:** [Date]
**Next Review:** [Date]
