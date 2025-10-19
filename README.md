A cross-platform desktop app to browse and search your Claude Code and Cursor IDE conversation history stored in `~/.claude` and Cursor's data folders.

![Version](https://img.shields.io/github/v/release/ndokutovich/claude-code-history-viewer?label=Version&color=blue)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/ndokutovich/claude-code-history-viewer?utm_source=oss&utm_medium=github&utm_campaign=ndokutovich%2Fclaude-code-history-viewer&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md) | [Русский](README.ru.md)

> ⚠️ **Beta software** - Things might break or change. Report issues on [GitHub](https://github.com/ndokutovich/claude-code-history-viewer/issues).

## Why this exists

Claude Code and Cursor IDE store conversation history in JSONL files scattered across their data folders (`~/.claude/projects/` for Claude Code, and Cursor's AppData folder). These are hard to read and search through. This app gives you a proper interface to browse your conversations from both tools, see usage stats, and find old discussions.

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

## What's New in v1.5.0

**🔌 Cursor IDE Support** (New!):
- Multi-provider architecture supporting both Claude Code and Cursor IDE
- Auto-detection of Cursor's SQLite conversation database
- Universal message format for provider-agnostic data handling
- Seamless switching between Claude Code and Cursor conversations
- Backend Rust adapters for efficient file/database parsing

**🛡️ Security & Stability Improvements**:
- Content Security Policy (CSP) hardening against XSS attacks
- Cross-platform path handling fixes for Windows compatibility
- Division-by-zero protection in analytics calculations
- Fixed download progress tracking in auto-updater
- CodeRabbit AI code review integration

**🔍 Full Search Functionality**:
- Powerful full-text search with Cmd/Ctrl+F keyboard shortcut
- Quoted phrase support for exact matches
- Search result highlighting and jump-to-message
- Session-grouped results with expandable previews

**🌍 Cross-Platform Support**:
- Runs on macOS (universal binary), Windows, and Linux
- Platform-specific installers (.dmg, .exe, .msi, .deb, .AppImage, .rpm)
- Multi-package manager support (npm, pnpm, yarn, bun)

**🌏 Complete Internationalization**:
- 6 languages: English, Korean, Japanese, Simplified Chinese, Traditional Chinese, Russian
- Automatic language detection from system locale
- Full UI translation coverage

**🎨 Enhanced UI/UX**:
- Improved light/dark mode with better message bubble styling
- Clear selection with X button and ESC key
- Better session title display
- Unified view state architecture

**🔧 Developer Experience**:
- Comprehensive E2E test suite with Playwright
- Automated release workflow via GitHub Actions
- Better documentation (see CLAUDE.md)
- Multi-platform build scripts

## What it does

**Browse conversations**: Navigate through projects and sessions with a tree view on the left, conversation view on the right. Clean, intuitive interface with support for light/dark themes.

**Powerful search**: Full-text search across all conversations with Cmd/Ctrl+F. Supports quoted phrases, highlights matches, and lets you jump directly to any message in context. Search results are grouped by session for easy navigation.

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

**Tool output visualization**: Specialized renderers for:
- Web search results with structured display
- Git operations and workflows
- Terminal output with streaming support
- File edits with diff visualization
- Todo list changes and updates

**Cross-platform & internationalized**:
- Runs on macOS (universal binary), Windows, and Linux
- Full support for 5 languages: English, Korean, Japanese, Simplified Chinese, Traditional Chinese, and Russian
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
2. It automatically scans `~/.claude` for conversation data
3. Browse projects in the left sidebar tree
4. Click any session to view messages
5. Use the tabs at the top to switch between:
   - **Messages**: Read full conversations
   - **Analytics**: View activity heatmaps and patterns
   - **Token Stats**: Analyze token usage

### Search Functionality
- Press **Cmd+F** (macOS) or **Ctrl+F** (Windows/Linux) to open search
- Type your query and press Enter
- Use quotes for exact phrases: `"error message"`
- Click on any result to jump directly to that message in context
- Results are grouped by session with expandable previews

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
- Read-only access - cannot edit or delete conversations from the app
- No export functionality yet (planned for future release)

## Data privacy

Everything runs locally. No data is sent to any servers. The app only reads files from your `~/.claude` directory.

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

**"No Claude data found"**:
- Make sure you've used Claude Code at least once to create conversation history
- Check that `~/.claude` directory exists in your home folder
- **macOS/Linux**: `ls ~/.claude`
- **Windows**: Check `C:\Users\<YourUsername>\.claude`

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
