# Claude Code History Viewer

<p style="center">
  <img src="https://img.shields.io/badge/Version-1.0.0--beta.3-orange.svg" alt="Version 1.0.0-beta.3" />
  <img src="https://img.shields.io/badge/Built%20with-Tauri%202.6.1%20+%20React%2019.1.0-blue.svg" alt="Built with Tauri 2.6.1 and React 19.1.0" />
  <img src="https://img.shields.io/badge/Platform-macOS-lightgrey.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/Languages-Multi--lingual-blueviolet.svg" alt="Multi-lingual UI" />
</p>

**Languages**: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文 (简体)](README.zh-CN.md) | [中文 (繁體)](README.zh-TW.md)

A desktop application to browse and analyze your Claude Code conversation history stored locally in the `~/.claude` directory.

> ⚠️ **Beta Notice**: This application is currently in beta. Features and APIs may change.

## Features

### Core Features

- 📁 **Browse Projects and Sessions** - Navigate through all your Claude Code projects and conversation sessions
- 🎨 **Syntax Highlighting** - Code blocks are beautifully highlighted for better readability with react-syntax-highlighter
- 🌲 **Tree View Navigation** - Intuitive project/session hierarchy with expandable tree structure
- ⚡ **Fast Performance** - Built with Rust backend for efficient file parsing and searching
- 🖥️ **macOS Native** - Optimized desktop application built with Tauri for macOS

### Analytics & Statistics

- 📊 **Comprehensive Analytics Dashboard** - View detailed usage analytics with interactive charts
- 📈 **Token Usage Statistics** - Track token usage per project and session with growth rates
- 🔥 **Activity Heatmaps** - Visualize your interaction patterns over time
- 📊 **Session Comparisons** - Compare metrics across different sessions
- 📉 **Tool Usage Analytics** - See which tools are used most frequently

### Advanced Features

- 🔄 **Auto-Update System** - Automatic update checking with priority levels (critical, recommended, optional)
- 💭 **Thinking Content Display** - View Claude's reasoning process in formatted blocks
- 📃 **Efficient Message Loading** - Handle large conversation histories with pagination
- 🔄 **Session Refresh** - Refresh sessions to see new messages without restarting
- 📝 **Session Summaries** - AI-generated summaries for quick session overview

### Content Rendering

- 🖼️ **Image Support** - View images embedded in conversations
- 📝 **Enhanced Diff Viewer** - Improved line-by-line file change comparison
- 🚀 **Rich Tool Results** - Beautiful rendering of various tool outputs (web search, git workflows, terminal streams, etc.)

## Installation

### Download Pre-built Binaries

Visit the [Releases](https://github.com/jhlee0409/claude-code-history-viewer/releases) page to download the latest version for your platform.

### Build from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) package manager (v8+)
- [Rust](https://www.rust-lang.org/) toolchain (latest stable)
- **macOS**: Xcode Command Line Tools

#### Building

```bash
# Clone the repository
git clone https://github.com/jhlee0409/claude-code-history-viewer.git
cd claude-code-history-viewer

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri:dev

# Build for production
pnpm tauri:build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Usage

1. Launch the application
2. The app will automatically scan your `~/.claude` directory for conversation history
3. Browse through projects and sessions using the left sidebar
4. Click on any session to view its messages
5. View analytics dashboard to understand your usage patterns
6. Check for updates via the auto-update system

## Contributing

Contributions are welcome! Please submit a Pull Request.

## Claude Directory Structure

The app reads conversation data from:

```text
~/.claude/
├── projects/          # Project-specific conversation data
│   └── [project-name]/
│       └── *.jsonl    # JSONL files with conversation messages
├── ide/              # IDE-related data
├── statsig/          # Statistics/analytics data
└── todos/            # Todo list data
```

## Troubleshooting

### Common Issues

**App can't find Claude data**

- Ensure you have Claude Code installed and have some conversation history
- Check that `~/.claude` directory exists and contains project data

**Performance issues with large histories**

- The app uses virtualization for long message lists
- Consider archiving old conversations if performance degrades

## Privacy

This application runs entirely locally and does not send any data to external servers. All conversation data remains on your machine.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Tech Stack

- Built with [Tauri](https://tauri.app/) + React + TypeScript
- UI: [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)

## Support

If you encounter issues, please [create an issue](https://github.com/jhlee0409/claude-code-history-viewer/issues) with detailed information.

---
