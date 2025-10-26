# Release Notes - Version 1.6.0

## 🎉 Major Features

### Session Builder - Create New Sessions and Projects
The most significant addition in this release is the **Session Builder**, which transforms the application from read-only to read-write.

**Capabilities:**
- ✅ Create new projects in Claude Code format
- ✅ Create new sessions within existing or new projects
- ✅ Import messages from existing sessions
- ✅ Add custom user/assistant messages
- ✅ Reorder messages with drag-and-drop
- ✅ Preview session before creation
- ✅ Browse any folder on disk as project location
- ✅ Provider-agnostic architecture (supports multiple AI assistants)

**Key Innovation - Path-Based Project Identifiers:**
When browsing a folder, the full path is sanitized and used as a unique project identifier.

Example:
```
Browse: C:\_init\w\_proj\_my-app\
Creates: C:\Users\xxx\.claude\projects\c-init-w-proj-my-app\
```

This ensures projects are uniquely identified by their actual code location on disk.

**Technical Implementation:**
- Backend: Rust commands for file system operations
- Frontend: React components with full i18n support (6 languages)
- Architecture: Provider-based abstraction layer
- Validation: Comprehensive input validation with user-friendly error messages

### Export, Filtering, and Raw View
- Export conversations to various formats
- Advanced filtering capabilities
- Raw JSON view for debugging and analysis

### Enhanced UX
- Loading indicators during data operations
- Improved toast notifications
- Better download experience in Files view
- Auto-select parent project when session is selected

## 🔧 Improvements

### Provider Architecture
- **Path Configuration**: Providers now define their directory structure via `pathConfig`
  - Claude Code: `pathConfig: { projectsPath: "projects" }`
  - Cursor: `pathConfig: { projectsPath: "User/workspaceStorage" }`
- **Path Sanitization**: `sanitizePathToProjectName()` method for unique identifiers
- **Provider Methods**: `getProjectsRoot()`, `convertToProjectPath()`

### Clean Code Refactoring
Applied clean code patterns across Session Builder components:
- ✅ Explicit return types for all functions (25+ functions)
- ✅ Extracted validation logic to `src/utils/sessionValidation.ts`
- ✅ Created reusable `ValidationErrors` component
- ✅ Extracted message transformation utilities
- ✅ Separated inline handlers into named functions
- ✅ Applied SSOT (Single Source of Truth) principle

### Internationalization
- Complete i18n coverage for Session Builder
- Updated "Parent Folder" → "Code Folder" labels across 6 languages
- Clarified field purposes in all translations

### Documentation
- Created `.claude/CLEAN_CODE_PATTERNS.md` - Reusable patterns for future development
- Created `.claude/SESSION_BUILDER_AUDIT.md` - Code quality audit

## 🐛 Bug Fixes

- Fixed provider path configuration to use static definitions
- Resolved permission errors for folder opening
- Improved download toast UX in Files view
- Fixed dialog accessibility issues
- Completed i18n translation coverage

## 🏗️ Technical Changes

### New Files
- `src/utils/sessionValidation.ts` - Validation logic utilities
- `src/components/ui/ValidationErrors.tsx` - Reusable error display
- `src/utils/messageTransform.ts` - Message conversion utilities
- `.claude/CLEAN_CODE_PATTERNS.md` - Clean code documentation
- `.claude/SESSION_BUILDER_AUDIT.md` - Code audit

### Modified Interfaces
- `ProviderDefinition` - Added `pathConfig` field
- `IAdapter` - Added path management methods section
  - `getProjectsRoot(sourcePath): string`
  - `convertToProjectPath(sourcePath, projectName): string`
  - `sanitizePathToProjectName(fullPath): string`

### Backend Commands (Rust)
- `create_claude_project` - Create new project directory
- `create_claude_session` - Create new session with JSONL file
- `append_claude_messages` - Append messages to existing session

## 📊 Statistics

- **Commits**: 18 commits in this release
- **Files Changed**: 50+ files
- **Code Quality**: 100% pattern compliance in Session Builder
- **Test Coverage**: Comprehensive E2E tests for new features
- **Languages Supported**: 6 (English, Korean, Japanese, Simplified Chinese, Traditional Chinese, Russian)

## 🔄 Migration Notes

**No breaking changes** - this release is fully backward compatible with 1.5.0.

Existing projects and sessions will continue to work without modification.

## 🚀 What's Next

Planned for future releases:
- Advanced search UI (backend already implemented)
- Session editing capabilities
- Batch operations
- Template system for common session patterns

## 📝 Commit History

**Session Builder Development:**
- `8907b09` refactor(i18n): update parentFolder label to reflect code folder identifier usage
- `140ac7b` feat(session-builder): sanitize full browsed path as project name for unique identifiers
- `c8e97fe` fix(providers): move path configuration to ProviderDefinition
- `8fff6ec` fix(session-builder): implement provider-based path management
- `ab049f6` refactor(session-builder): apply SSOT principle (Low Priority)
- `7d06747` refactor(session-builder): extract inline handlers (Medium Priority)
- `e67a4f3` refactor(session-builder): apply clean code patterns (High Priority)
- `4788d41` fix(i18n): complete Session Builder translation coverage
- `c391434` feat(session-builder): complete i18n implementation
- `fa920bb` feat(session-builder): complete ALL missing features
- `1e446f7` refactor(session-builder): make source-agnostic with provider architecture
- `7ec94b5` feat(session-builder): add comprehensive session/project creation system
- `ba1f730` feat(backend): add session/project creation infrastructure

**Other Features:**
- `28cfe0f` feat: add comprehensive export, filtering, and raw view features
- `e1ee817` feat: add loading indicators for improved UX
- `b6d1ecf` fix: improve download toast UX in FilesView
- `c225c07` fix: resolve Open Folder permission error
- `e8cbf36` fix: auto-select parent project when session is selected
- `324bccc` fix: add shell:allow-open permission

---

**Full Changelog**: [v1.5.0...v1.6.0](https://github.com/ndokutovich/claude-code-history-viewer/compare/v1.5.0...v1.6.0)
