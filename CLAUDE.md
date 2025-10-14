# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

If the user's prompt starts with “EP:”, then the user wants to enhance the prompt. Read the PROMPT_ENHANCER.md file and follow the guidelines to enhance the user's prompt. Show the user the enhancement and get their permission to run it before taking action on the enhanced prompt.

The enhanced prompts will follow the language of the original prompt (e.g., Korean prompt input will output Korean prompt enhancements, English prompt input will output English prompt enhancements, etc.)

## Principal

First, You must use command "gemini -p {prompt}" and then use the result that returned response
Use pnpm Package Manager

가독성이 높은 설계 추구
예측 가능성이 높은 설계 추구
높은 응집도 설계 추구
낮은 결합도 설계 추구

## Project Overview

Claude Code History Viewer is a Tauri-based desktop application that allows users to browse and analyze their Claude Code conversation history stored in the `~/.claude` directory.

## Development Commands

- `pnpm dev` - Start Vite dev server for frontend development
- `pnpm tauri:dev` - Run full Tauri application in development mode
- `pnpm build` - Build frontend with TypeScript checking
- `pnpm tauri:build` - Build production desktop application for current platform
- `pnpm tauri:build:mac` - Build production application for macOS (universal binary)
- `pnpm tauri:build:windows` - Build production application for Windows (x86_64)
- `pnpm tauri:build:linux` - Build production application for Linux (x86_64)
- `pnpm lint` - Run ESLint on the codebase

## Platform Support

This application is **fully cross-platform** and runs on:
- ✅ **Windows** (x86_64) - `.exe` installer via NSIS, `.msi` via WiX
- ✅ **macOS** (Universal binary for Intel + Apple Silicon) - `.dmg`, `.app`
- ✅ **Linux** (x86_64) - `.deb`, `.AppImage`, `.rpm`

### macOS-Specific Notes

On macOS, the application:
- Automatically detects the `.claude` folder in the user's home directory (`~/.claude`)
- Uses native WebKit for rendering (built into macOS)
- Supports both Intel and Apple Silicon (M1/M2/M3) via universal binary
- Bundled as `.dmg` (disk image) and `.app` (application bundle)
- Code signing and notarization supported (requires Apple Developer account)

### Building for macOS

**Prerequisites:**
- Xcode Command Line Tools: `xcode-select --install`
- Rust toolchain with both architectures (for universal binary)

**Build command:**
```bash
pnpm tauri:build:mac
```

This creates a **universal binary** that runs on both Intel and Apple Silicon Macs.

Build artifacts will be in `src-tauri/target/release/bundle/`:
- `dmg/` - Disk image installer (.dmg)
- `macos/` - Application bundle (.app)

**Installing:**
Simply drag the `.app` from the `.dmg` to your Applications folder.

### Windows-Specific Notes

On Windows, the application:
- Automatically detects the `.claude` folder in the user's home directory (`C:\Users\<username>\.claude`)
- Uses the Windows WebView2 runtime (automatically downloaded if not present)
- Supports Korean and English languages in the installer
- Creates an uninstaller for easy removal
- Bundled as both NSIS installer (`.exe`) and WiX installer (`.msi`)

### Building for Windows

To build on Windows:
```bash
pnpm tauri:build:windows
```

Build artifacts will be in `src-tauri/target/release/bundle/`:
- `nsis/` - NSIS installer (.exe)
- `msi/` - WiX installer (.msi)

### Linux-Specific Notes

On Linux, the application:
- Automatically detects the `.claude` folder in the user's home directory (`~/.claude`)
- Uses the system's WebKitGTK for rendering (ensure it's installed)
- Supports both GTK-based desktop environments (GNOME, XFCE, etc.)
- Bundled as `.deb` (Debian/Ubuntu), `.AppImage` (universal), and `.rpm` (Fedora/RHEL)

### Building for Linux

**Prerequisites:**
```bash
# Debian/Ubuntu
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel

# Arch Linux
sudo pacman -S webkit2gtk-4.1 \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  appmenu-gtk-module \
  gtk3 \
  libappindicator-gtk3 \
  librsvg \
  libvips
```

**Build command:**
```bash
pnpm tauri:build:linux
```

Build artifacts will be in `src-tauri/target/release/bundle/`:
- `deb/` - Debian package (.deb) for Ubuntu/Debian
- `appimage/` - Universal Linux binary (.AppImage)
- `rpm/` - RPM package for Fedora/RHEL (if rpmbuild is installed)

**Installing:**
```bash
# For .deb (Ubuntu/Debian)
sudo dpkg -i src-tauri/target/release/bundle/deb/*.deb

# For .AppImage (any distro)
chmod +x *.AppImage
./claude-code-history-viewer*.AppImage

# For .rpm (Fedora/RHEL)
sudo rpm -i src-tauri/target/release/bundle/rpm/*.rpm
```

## Architecture

### Frontend (React + TypeScript)

- **State Management**: Uses Zustand store in `src/store/useAppStore.ts`
- **Components**: Located in `src/components/`
  - `MessageViewer.tsx` - Displays messages with virtual scrolling for performance
  - `ProjectTree.tsx` - Shows project/session hierarchy
  - `contentRenderer.tsx` - Handles rendering of different content types
  - `messageRenderer.tsx` - Renders tool use, tool results, and message content
- **API Integration**: Frontend communicates with Rust backend via Tauri's IPC commands
- **Virtual Scrolling**: Uses react-window for efficient rendering of large message lists

### Backend (Rust + Tauri)

- **Main Commands** (in `src-tauri/src/lib.rs`):
  - `get_claude_folder_path` - Locates user's `.claude` directory
  - `scan_projects` - Scans for all Claude projects
  - `load_project_sessions` - Loads sessions for a specific project
  - `load_session_messages` - Loads messages from a JSONL file
  - `search_messages` - Searches across all messages
- **Data Structure**: Reads JSONL files containing conversation history from `~/.claude/projects/`

## Raw Message Structure

The application reads `.jsonl` files where each line is a JSON object representing a single message. The core structure is as follows:

```json
{
  "uuid": "...",
  "parentUuid": "...",
  "sessionId": "...",
  "timestamp": "...",
  "type": "user" | "assistant" | "system" | "summary",
  "message": { ... },
  "toolUse": { ... },
  "toolUseResult": { ... },
  "isSidechain": false
}
```

### The `message` Field

The `message` field is a nested JSON object. Its structure varies depending on the message `type`.

**For `user` messages:**

```json
{
  "message": {
    "role": "user",
    "content": "..." // or ContentItem[]
  }
}
```

**For `assistant` messages:**

Assistant messages contain additional metadata within the `message` object:

```json
{
  "message": {
    "id": "msg_...",
    "role": "assistant",
    "model": "claude-opus-4-20250514",
    "content": [...],
    "stop_reason": "tool_use" | "end_turn" | null,
    "usage": {
      "input_tokens": 123,
      "output_tokens": 456,
      "cache_creation_input_tokens": 20238,
      "cache_read_input_tokens": 0,
      "service_tier": "standard"
    }
  }
}
```

- **`id`, `model`, `stop_reason`, `usage`**: These fields are typically present only in assistant messages.
- **`usage` object**: Contains detailed token counts, including cache-related metrics.

## Key Implementation Details

- The app expects Claude conversation data in `~/.claude/projects/[project-name]/*.jsonl`
- Each JSONL file represents a session with one JSON message per line
- Messages can contain tool use results and error information
- The UI is primarily in Korean.션, etc.)
- Virtual scrolling is implemented for performance with large message lists
- Pagination is used to load messages in batches (100 messages per page)
- Message tree structure is flattened for virtual scrolling while preserving parent-child relationships
- No test suite currently exists

## Important Patterns

- Tauri commands are async and return `Result<T, String>`
- Frontend uses `@tauri-apps/api/core` for invoking backend commands
- All file paths must be absolute when passed to Rust commands
- The app uses Tailwind CSS with custom Claude brand colors defined in `tailwind.config.js`
- Message components are memoized for performance
- AutoSizer is used for responsive virtual scrolling
- Message height is dynamically calculated and cached for variable height scrolling

## Claude Directory Structure Analysis

### Directory Structure

```text
~/.claude/
├── projects/          # Contains project-specific conversation data
│   └── [project-name]/
│       └── *.jsonl    # JSONL files with conversation messages
├── ide/              # IDE-related data
├── statsig/          # Statistics/analytics data
└── todos/            # Todo list data
```

### JSONL Message Format

Each JSONL file contains one JSON object per line. The actual structure differs from what the frontend expects:

#### Raw Message Structure (in JSONL files)

This is the corrected structure based on analysis of the `.jsonl` files.

```json
{
  "uuid": "unique-message-id",
  "parentUuid": "uuid-of-parent-message",
  "sessionId": "session-uuid",
  "timestamp": "2025-06-26T11:45:51.979Z",
  "type": "user | assistant | system | summary",
  "isSidechain": false,
  "cwd": "/path/to/working/directory",
  "version": "1.0.35",
  "requestId": "request-id-from-assistant",
  "userType": "external",
  "message": {
    "role": "user | assistant",
    "content": "..." | [],
    "id": "msg_...",
    "model": "claude-opus-4-20250514",
    "stop_reason": "tool_use",
    "usage": { "input_tokens": 123, "output_tokens": 456 }
  },
  "toolUse": {},
  "toolUseResult": "..." | {}
}
```

**Note:** The fields `parentUuid`, `isSidechain`, `cwd`, `version`, `requestId`, `userType`, `toolUse`, `toolUseResult` are optional. The fields `id`, `model`, `stop_reason`, `usage` are specific to assistant messages and are also optional.

### Content Types

#### 1. User Message Content Types

**Simple String Content**

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "더 고도화할 부분은 없을까?"
  }
}
```

**Array Content with tool_result**

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "tool_use_id": "toolu_01VDVUHPae8mbcpER7tbbHvd",
        "type": "tool_result",
        "content": "file content here..."
      }
    ]
  }
}
```

**Array Content with text type**

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "text",
        "text": "Please analyze this codebase..."
      }
    ]
  }
}
```

**Command Messages**

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "<command-message>init is analyzing your codebase…</command-message>\n<command-name>/init</command-name>"
  }
}
```

#### 2. Assistant Message Content Types

**Text Content**

```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I'll help you fix these Rust compilation errors..."
      }
    ]
  }
}
```

**Tool Use Content**

```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_01QUa384MpVwU4F8tuF8hg9T",
        "name": "TodoWrite",
        "input": {
          "todos": [...]
        }
      }
    ]
  }
}
```

**Thinking Content**

```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": [
      {
        "type": "thinking",
        "thinking": "사용자가 메시지 객체의 내용이 null이고...",
        "signature": "EpUICkYIBRgCKkCB6bsN5FuO+M1gLbr..."
      }
    ]
  }
}
```

#### 3. Tool Use Result Structures

**File Read Results**

```json
{
  "toolUseResult": {
    "type": "text",
    "file": {
      "filePath": "/Users/jack/client/ai-code-tracker/package.json",
      "content": "{\n  \"name\": \"ai-code-tracker\"...",
      "numLines": 59,
      "startLine": 1,
      "totalLines": 59
    }
  }
}
```

**Command Execution Results**

```json
{
  "toolUseResult": {
    "stdout": "> ai-code-tracker@0.6.0 lint\n> eslint src --fix",
    "stderr": "",
    "interrupted": false,
    "isImage": false
  }
}
```

**Error Results**

```json
{
  "message": {
    "content": [
      {
        "type": "tool_result",
        "content": "Error: The service was stopped\n    at ...",
        "is_error": true,
        "tool_use_id": "toolu_01PKwT3i8u1ryjWZpMBWmDjX"
      }
    ]
  }
}
```

**Todo List Results**

```json
{
  "toolUseResult": {
    "oldTodos": [...],
    "newTodos": [...]
  }
}
```

**Multi-Edit Results**

```json
{
  "toolUseResult": {
    "filePath": "/Users/jack/client/ai-code-tracker/src/extension.ts",
    "edits": [
      {
        "old_string": "...",
        "new_string": "...",
        "replace_all": false
      }
    ],
    "originalFileContents": "..."
  }
}
```

#### 4. Special Message Types

**Summary Messages**

```json
{
  "type": "summary",
  "summary": "AI Code Tracker: Comprehensive VS Code Extension Analysis",
  "leafUuid": "28f1d1f6-3485-48a6-9408-723624bc1e42"
}
```

### Message Metadata Fields

- `parentUuid`: Links to parent message in conversation tree
- `isSidechain`: Boolean indicating if this is a sidechain conversation
- `userType`: Usually "external" for user messages
- `cwd`: Current working directory when message was sent
- `sessionId`: Unique session identifier
- `version`: Claude client version
- `timestamp`: ISO 8601 timestamp
- `uuid`: Unique message identifier
- `requestId`: Present in assistant messages

### Content Rendering Status

Currently Supported:

- ✅ Text content (`type: "text"`)
- ✅ Tool use (`type: "tool_use"`)
- ✅ Tool results (`type: "tool_result`)
- ✅ Command messages (within text content)

Not Yet Supported:

- ❌ Thinking type (`type: "thinking`) - currently only supported as text tags
- ❌ Image content - structure supports it via `isImage` flag but no rendering logic

### Recent Updates

- **Data Structure & Type Correction (June 2025)**:
  - Performed a deep analysis of `.jsonl` log files in the `~/.claude` directory to verify the exact data structure.
  - Added a `Raw Message Structure` section to this document to accurately model the nested `message` object and include assistant-specific metadata (`id`, `model`, `stop_reason`, `usage`).
  - Updated the corresponding Rust structs in `src-tauri/src/commands.rs` and TypeScript interfaces in `src/types/index.ts` to align with the true data format, enhancing type safety and preventing data loss during parsing.
- **Virtual Scrolling Implementation**: Added react-window with VariableSizeList for efficient rendering of large message lists
- **Performance Optimizations**:
  - Messages are memoized to prevent unnecessary re-renders
  - Dynamic height calculation for variable content sizes
  - AutoSizer for responsive viewport handling
  - Infinite scroll with react-window-infinite-loader
- **Type System Updates**:
  - Fixed ContentItem[] type support in ClaudeMessage interface
  - Added proper TypeScript types for virtual scrolling components
  - Updated messageAdapter to use type-only imports

### Dependencies Added

- `react-window` - Virtual scrolling for performance
- `react-window-infinite-loader` - Infinite scroll support
- `react-virtualized-auto-sizer` - Responsive height calculation
- `@types/react-window` - TypeScript definitions
- `@types/react-window-infinite-loader` - TypeScript definitions

### Known Issues

- The frontend expects content at the root level, but it's actually nested under `message.content`
- Thinking content appears both as a separate type and as tags within text
- Image support is defined in the data structure but not implemented in the UI
- ESLint configuration uses deprecated .eslintignore (migrated to ignores in config)
