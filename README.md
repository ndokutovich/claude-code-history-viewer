A cross-platform desktop app to browse and search your Claude Code, Cursor IDE, Codex CLI, and Gemini AI Studio conversation history stored in their respective data folders.

![Version](https://img.shields.io/github/v/release/ndokutovich/claude-code-history-viewer?label=Version&color=blue)
![Downloads](https://img.shields.io/github/downloads/ndokutovich/claude-code-history-viewer/total?label=Downloads&color=brightgreen)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/ndokutovich/claude-code-history-viewer?utm_source=oss&utm_medium=github&utm_campaign=ndokutovich%2Fclaude-code-history-viewer&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md) | [Русский](README.ru.md)

> ⚠️ **Beta software** - Things might break or change. Report issues on [GitHub](https://github.com/ndokutovich/claude-code-history-viewer/issues).

## Why this exists

Claude Code, Cursor IDE, Codex CLI, and Gemini AI Studio store conversation history in various formats (JSONL files, SQLite databases) scattered across their data folders. These are hard to read and search through. This app gives you a unified interface to browse conversations from all these AI coding assistants, see usage stats, resume sessions, and find old discussions.

## Screenshots & Demo

### Main Interface

Browse projects and view conversations with syntax-highlighted code blocks

<p align="center">
  <img width="49%" alt="Main Interface 1" src="https://github.com/user-attachments/assets/45719832-324c-40c3-8dfe-5c70ddffc0a9" />
  <img width="49%" alt="Main Interface 2" src="https://github.com/user-attachments/assets/bb9fbc9d-9d78-4a95-a2ab-a1b1b763f515" />
</p>

### Analytics Dashboard

Activity heatmap and tool usage statistics to understand your usage patterns

<img width="720" alt="Analytics Dashboard" src="https://github.com/user-attachments/assets/77dc026c-8901-47d1-a8ca-e5235b97e945" />

### Token Statistics

Per-project token usage breakdown and session-level analysis

<img width="720" alt="Token Statistics" src="https://github.com/user-attachments/assets/ec5b17d0-076c-435e-8cec-1c6fd74265db" />

### Demo

<img width="720" alt="Demo" src="https://github.com/user-attachments/assets/d3ea389e-a912-433e-b6e2-2e895eaa346d" />

## What's New in v1.7.0

**🤖 Multi-Provider Support**:
- **Codex CLI Integration**: Browse and search your Codex conversation history from `~/.codex/sessions/`
- **Gemini AI Studio Support**: View Gemini conversations from `~/.gemini/conversations/`
- Unified interface for 4 AI coding assistants: Claude Code, Cursor IDE, Codex CLI, and Gemini AI Studio
- Provider icons and badges for easy identification
- Auto-detection of all installed AI tools

**🔄 Resume Sessions**:
- Resume conversations directly in their native tools (Claude Code, Cursor, Codex, Gemini)
- Provider-aware resume commands that open the correct tool with proper context
- Automatic working directory detection and restoration
- Interactive command support for Gemini's `/chat resume` workflow
- Launch sessions with correct CWD from any project

**🔧 Session Management Tools**:
- **Fix Session Utility**: Repair problematic sessions that can't be resumed in Claude Code
- **Message Range Extraction**: Create new sessions from a specific range of messages
- Session health indicators showing which sessions can be resumed
- Backup creation before session repairs

**📊 Enhanced Session Information**:
- Git branch and commit display in session headers (when available)
- Repository context showing which branch Claude was working on
- Extract git info from session metadata and tool outputs
- Visual indicators with branch (📍) and commit (🔖) icons

**🔄 Improved Navigation**:
- Refresh button to reload session lists without restarting the app
- State preservation when refreshing (expanded projects, selected session)
- "Refresh All Sessions" for all providers at once
- Loading indicators and toast notifications for user feedback

---

## What's New in v1.6.0

**📁 File Activity Tracking**:
- Browse all files touched by Claude/Cursor AI sessions across all projects
- Filter by operation type (read, edit, create, delete), file extension, and date range
- View file content snapshots from any point in history
- Jump directly to the session and message where a file was accessed
- Download files from file viewer modal with "Open File" and "Open Folder" buttons
- Multi-source aggregation showing files from both Claude Code and Cursor IDE

**✍️ Session Creation & Project Management**:
- Create new Claude Code projects directly from the app
- Start new conversation sessions with custom messages and context
- Append messages to existing sessions programmatically
- Provider-aware architecture supporting multi-source session writing
- Session builder UI with message composer and context selectors

**📤 Advanced Export Features**:
- Export conversations to Markdown, HTML, and DOCX formats
- Formatted and raw export modes with syntax highlighting
- Light/dark theme support in HTML exports
- Include file attachments in exports
- "Load All Messages" button for complete conversation exports (respects pagination)
- Command-only export mode for extracting bash command history
- "Open File" and "Open Folder" buttons in export notifications

**🔍 Enhanced Message Filtering & Views**:
- Command-only filter to view just bash commands as a history log
- Raw message view showing underlying JSONL data structure
- Bash-only filter for tool use analysis
- Messages-only filter for text-focused reading
- Tool use filter for debugging AI operations
- Line-numbered command history view with unselectable line numbers

**🔌 Cursor IDE Support** (from v1.5.0):
- Multi-provider architecture supporting both Claude Code and Cursor IDE
- Auto-detection of Cursor's SQLite conversation database
- Universal message format for provider-agnostic data handling
- Seamless switching between Claude Code and Cursor conversations
- Backend Rust adapters for efficient file/database parsing

**🔍 Full Search Functionality** (from v1.5.0):
- Powerful full-text search with Cmd/Ctrl+F keyboard shortcut
- Quoted phrase support for exact matches
- Search result highlighting and jump-to-message
- Session-grouped results with expandable previews

**🌏 Complete Internationalization**:
- 6 languages: English, Korean, Japanese, Simplified Chinese, Traditional Chinese, Russian
- Automatic language detection from system locale
- Full UI translation coverage including all new features

**🌍 Cross-Platform Support**:
- Runs on macOS (universal binary), Windows, and Linux
- Platform-specific installers (.dmg, .exe, .msi, .deb, .AppImage, .rpm)
- Multi-package manager support (npm, pnpm, yarn, bun)

**⚡ Performance & Developer Experience**:
- React.memo() optimization for expensive components
- useCallback hooks to prevent unnecessary re-renders
- Comprehensive E2E test suite with Playwright
- Automated release workflow via GitHub Actions
- Multi-platform build scripts

## What it does

**Multi-provider support**: Unified interface for 4 AI coding assistants - Claude Code, Cursor IDE, Codex CLI, and Gemini AI Studio. Auto-detects all installed tools and aggregates conversations in one place.

**Resume sessions**: Continue conversations directly in their native tools with a single click. Provider-aware resume commands launch the correct AI assistant with proper working directory context.

**Browse conversations**: Navigate through projects and sessions with a tree view on the left, conversation view on the right. Clean, intuitive interface with support for light/dark themes.

**Track file changes**: New Files view shows all files accessed by Claude/Cursor across all your projects. Filter by operation type, extension, or date. View file content snapshots and jump to the exact session where each file was modified.

**Create and manage sessions**: Start new Claude Code projects and conversation sessions directly from the app. Compose custom messages, select context, and append to existing sessions.

**Export conversations**: Save conversations in Markdown, HTML, or DOCX format with syntax highlighting, attachments, and customizable themes. Export complete histories or filtered views (including command-only mode for bash history extraction).

**Powerful search**: Full-text search across all conversations with Cmd/Ctrl+F. Supports quoted phrases, highlights matches, and lets you jump directly to any message in context. Search results are grouped by session for easy navigation.

**Advanced filtering**: Multiple view modes for different use cases:
- Command-only: Extract bash command history as a log
- Raw message view: See the underlying JSONL data structure
- Bash/Tool use filters: Focus on specific AI operations
- Messages-only: Text-focused reading without tool output

**Usage analytics**: Comprehensive analytics dashboard with:
- Activity heatmaps showing your usage patterns over time
- Token usage statistics per project and session
- Tool usage breakdown and percentiles
- Session comparison metrics

**Better reading experience**:
- Syntax highlighted code blocks with multiple themes
- Properly formatted diffs and git operations
- Readable message threads with collapsible sections
- Virtual scrolling for smooth performance with large conversations
- Line-numbered command history view

**Tool output visualization**: Specialized renderers for:
- Web search results with structured display
- Git operations and workflows
- Terminal output with streaming support
- File edits with diff visualization
- Todo list changes and updates

**Cross-platform & internationalized**:
- Runs on macOS (universal binary), Windows, and Linux
- Full support for 6 languages: English, Korean, Japanese, Simplified Chinese, Traditional Chinese, and Russian
- Automatic language detection

The app handles large conversation histories efficiently with virtual scrolling and pagination, and features a secure auto-update system.

## Installation

### Download Pre-built Binaries

Get the latest version from [Releases](https://github.com/ndokutovich/claude-code-history-viewer/releases).

**macOS**:
- Download the `.dmg` file
- Drag the app to your Applications folder
- Universal binary supports both Intel and Apple Silicon

**Windows**:
- Download the `.exe` installer (NSIS) or `.msi` (WiX)
- Run the installer
- WebView2 will be automatically installed if needed

**Linux**:
- Download `.deb` (Debian/Ubuntu), `.AppImage` (universal), or `.rpm` (Fedora/RHEL)
- For `.deb`: `sudo dpkg -i claude-code-history-viewer*.deb`
- For `.AppImage`: `chmod +x *.AppImage && ./claude-code-history-viewer*.AppImage`
- For `.rpm`: `sudo rpm -i claude-code-history-viewer*.rpm`

### Build from Source

**All platforms**:
```bash
git clone https://github.com/ndokutovich/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install  # or npm install, yarn, bun
pnpm tauri:build  # builds for your current platform
```

**Platform-specific builds**:
```bash
pnpm tauri:build:mac      # macOS universal binary
pnpm tauri:build:windows  # Windows x86_64
pnpm tauri:build:linux    # Linux x86_64
```

**Requirements**:
- Node.js 18+
- Package manager: pnpm, npm, yarn, or bun
- Rust toolchain (install from https://rustup.rs)
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: WebKitGTK, build tools, and other dependencies (see CLAUDE.md for full list)
- **Windows**: WebView2 runtime (auto-installed)

## Usage

### Basic Navigation
1. Launch the app
2. It automatically scans for all installed AI tools:
   - Claude Code: `~/.claude/projects/`
   - Cursor IDE: AppData/Cursor database
   - Codex CLI: `~/.codex/sessions/`
   - Gemini AI Studio: `~/.gemini/conversations/`
3. Browse projects in the left sidebar tree (organized by provider)
4. Click any session to view messages
5. Use the tabs at the top to switch between:
   - **Messages**: Read full conversations
   - **Files**: Browse all files accessed by AI sessions
   - **Analytics**: View activity heatmaps and patterns
   - **Token Stats**: Analyze token usage

### Resume Sessions
- Click the **Resume** button (▶️ icon) on any session
- The app launches the native tool (Claude Code, Cursor, Codex, or Gemini)
- Working directory is automatically restored
- Continue your conversation where you left off
- **Fix Session** button available for problematic Claude Code sessions

### Message Range Extraction
- Select a session and click **Create from Range** in Session Builder
- Enter message IDs or leave blank to extract from start/end
- Creates a new artificial session with selected messages
- Useful for sharing specific conversation segments
- Preserves message structure and metadata

### File Activity Tracking
- Switch to the **Files** tab to see all files touched by AI sessions
- Filter by:
  - **Operation type**: Read, Edit, Create, Delete
  - **File extension**: .ts, .js, .py, .md, etc.
  - **Date range**: Find files from specific time periods
- Click **View** to see file content snapshots
- Click **Jump to Session** to see the exact conversation where the file was modified
- Use **Download** to save file content locally
- Click **All Projects** to aggregate files from all sources (Claude Code + Cursor)

### Export Conversations
- Click the **Export** button (top-right of message view)
- Choose format: **Markdown**, **HTML**, or **DOCX**
- Toggle **Formatted/Raw** mode for different detail levels
- Enable **Include Attachments** to embed file contents
- Select **Light/Dark** theme for HTML exports
- Use **Command Only** filter + export to extract bash command history
- Click **Load All** to export complete conversations (respects current filters)

### Session Creation
- Click the **Session Builder** button (⊕ icon in header)
- Select source (Claude Code or Cursor - if writable)
- Choose existing project or create new one
- Compose messages with optional context files
- Preview session structure before creation
- Session is immediately available in the app after creation

### Search Functionality
- Press **Cmd+F** (macOS) or **Ctrl+F** (Windows/Linux) to open search
- Type your query and press Enter
- Use quotes for exact phrases: `"error message"`
- Click on any result to jump directly to that message in context
- Results are grouped by session with expandable previews

### Message Filtering
- **Bash Only**: Show only messages with bash tool use
- **Tool Use Only**: Focus on AI tool operations
- **Messages Only**: Hide tool output, show just text
- **Command Only**: Extract bash commands as a history log (great for export)

### Keyboard Shortcuts
- **Cmd/Ctrl+F**: Open search
- **ESC**: Clear selection or close search
- **Click session**: Load conversation
- **X button**: Clear current selection

### Theme & Language
- Theme automatically matches your system preference (light/dark)
- Language auto-detected from system locale
- Change settings via the settings menu (top-right)

## Current limitations

- **Beta software** - expect some rough edges and occasional bugs
- Large conversation histories (10,000+ messages) may take a moment to load initially
- Session creation only supports Claude Code (Cursor support planned)
- Cannot delete conversations or projects from the app (read-only for existing sessions)

## Data privacy

Everything runs locally. No data is sent to any servers. The app reads files from your `~/.claude` directory and Cursor's data folder. When creating new sessions, data is written only to your local Claude Code projects folder.

## Claude directory structure

The app expects this structure:

```
~/.claude/
├── projects/          # Project conversations
│   └── [project-name]/
│       └── *.jsonl    # Conversation files
├── ide/              # IDE data
├── statsig/          # Analytics
└── todos/            # Todo lists
```

## Troubleshooting

**"No data found"**:
- Make sure you've used at least one AI coding assistant to create conversation history
- Check that the respective directories exist:
  - Claude Code: `~/.claude/projects/`
  - Codex CLI: `~/.codex/sessions/`
  - Gemini AI Studio: `~/.gemini/conversations/`
  - Cursor IDE: AppData/Cursor folder
- **macOS/Linux**: `ls ~/.claude ~/.codex ~/.gemini`
- **Windows**: Check `C:\Users\<YourUsername>\.claude`, `.codex`, `.gemini`

**Performance issues**:
- Large sessions (1,000+ messages) use virtual scrolling for smooth performance
- If loading feels slow, try selecting a smaller session first
- Close other apps to free up memory if needed

**Search not working**:
- Make sure you've typed a query and pressed Enter
- Try quoted phrases for exact matches: `"specific error"`
- Check that the sessions you're searching contain the text

**Platform-specific issues**:
- **Windows**: If the app won't start, ensure WebView2 is installed (usually auto-installs)
- **Linux**: Install WebKitGTK if you see webkit-related errors: `sudo apt install libwebkit2gtk-4.1-dev`
- **macOS**: If you get a security warning, right-click the app and choose "Open"

**Update problems**: If auto-update fails, download the latest version manually from [Releases](https://github.com/ndokutovich/claude-code-history-viewer/releases).

## Contributing

Contributions are welcome! Here's how you can help:

**Bug Reports**:
- Open an issue on [GitHub](https://github.com/ndokutovich/claude-code-history-viewer/issues)
- Include your OS, app version, and steps to reproduce
- Screenshots or error messages are helpful

**Feature Requests**:
- Check existing issues first to avoid duplicates
- Describe the use case and expected behavior
- Consider submitting a PR if you can implement it

**Pull Requests**:
- Fork the repo and create a feature branch
- Follow the existing code style (ESLint configured)
- Add tests for new functionality when possible
- Update CLAUDE.md if you add new features or change architecture
- Test on your platform before submitting

**Development Setup**:
```bash
git clone https://github.com/ndokutovich/claude-code-history-viewer.git
cd claude-code-history-viewer
pnpm install
pnpm tauri:dev  # starts dev server with hot reload
```

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation, development commands, and implementation notes.

**Contributors**:
Thanks to everyone who has contributed to this project! Special thanks to:
- Original concept and initial development
- Search UI implementation and improvements
- E2E testing infrastructure
- Multi-platform support and i18n
- And all the bug reporters and feature requesters

## Tech stack

**Core**:
- **Tauri v2** - Lightweight native shell with Rust backend (2-10MB footprint)
- **React 19** - Modern frontend with hooks and functional components
- **TypeScript** - Type-safe development

**UI & Styling**:
- **Tailwind CSS v4** - Utility-first styling with custom Claude brand colors
- **Radix UI** - Accessible, unstyled component primitives
- **Lucide React** - Beautiful icon library
- **Prism** - Syntax highlighting for code blocks

**State & Data**:
- **Zustand** - Lightweight state management
- **i18next** - Internationalization with 5 languages
- **@tanstack/react-virtual** - Virtual scrolling for performance

**Build & Tools**:
- **Vite** - Fast build tool and dev server
- **Vitest** - Unit testing framework
- **Playwright** - E2E testing for Tauri apps
- **ESLint** - Code linting and quality

**Platform Features**:
- **Tauri Plugins**: Store, Dialog, Updater, OS, Process, HTTP
- **GitHub Actions** - Automated multi-platform builds and releases

## License

MIT License - see [LICENSE](LICENSE) file.

---

**Questions or issues?** [Open an issue](https://github.com/ndokutovich/claude-code-history-viewer/issues) with details about your setup and what went wrong.
