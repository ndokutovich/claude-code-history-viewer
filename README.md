# Claude Code History Viewer

<p style="center">
  <img src="https://img.shields.io/badge/Version-1.0.0--beta.2-orange.svg" alt="Version 1.0.0-beta.2" />
  <img src="https://img.shields.io/badge/Built%20with-Tauri%202.6%20+%20React%2019-blue.svg" alt="Built with Tauri 2.6 and React 19" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License" />
  <img src="https://img.shields.io/badge/Platform-macOS%20|%20Windows%20|%20Linux-lightgrey.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/Language-Korean%20UI-blueviolet.svg" alt="Korean UI" />
</p>

A desktop application to browse and analyze your Claude Code conversation history stored locally in the `~/.claude` directory.

> ⚠️ **Beta Notice**: This application is currently in beta. Features and APIs may change.

## Features

### Core Features
- 📁 **Browse Projects and Sessions** - Navigate through all your Claude Code projects and conversation sessions
- 🔍 **Search Across Messages** - Full-text search functionality across all conversations
- 🎨 **Syntax Highlighting** - Code blocks are beautifully highlighted for better readability with prism-react-renderer
- 🌲 **Tree View Navigation** - Intuitive project/session hierarchy with expandable tree structure
- ⚡ **Fast Performance** - Built with Rust backend for efficient file parsing and searching
- 🖥️ **Cross-Platform** - Works on macOS, Windows, and Linux thanks to Tauri

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
- 🎯 **Advanced Message Filtering** - Sidechain messages are filtered for cleaner view
- 🚀 **Optimized Rendering** - FileEditRenderer for efficient file edit displays
- 🔧 **Session Management** - Direct path usage and last modified time tracking

### Tool Result Renderers
- 🌐 **Web Search Results** - Beautiful rendering of web search results
- 🔧 **MCP (Model Context Protocol)** - Support for MCP tool results
- 📁 **Codebase Context** - Display codebase exploration results
- 🔀 **Git Workflows** - Visualize git operations and workflows
- 💻 **Terminal Streams** - Real-time terminal output display
- 📚 **Claude Session History** - View referenced session history

## Screenshots

<details>
<summary>View Screenshots</summary>

_[Add screenshots here once available]_

</details>

## Installation

### Download Pre-built Binaries

Visit the [Releases](https://github.com/jhlee0409/claude-code-history-viewer/releases) page to download the latest version for your platform.

### Build from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) package manager (v8+)
- [Rust](https://www.rust-lang.org/) toolchain (latest stable)
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libwebkit2gtk-4.0-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
  - **Windows**: Microsoft C++ Build Tools

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
5. Use the search feature to find specific conversations or code snippets
6. View analytics dashboard to understand your usage patterns
7. Check for updates via the auto-update system

### Update Management

The application includes an automatic update checking system:
- **Critical Updates**: Must be installed immediately
- **Recommended Updates**: Suggested for better experience
- **Optional Updates**: New features you can install at your convenience
- Updates can be postponed or skipped based on priority level

## Development

### Tech Stack

- **Frontend**: React 19.1.0, TypeScript, Tailwind CSS, Zustand
- **Backend**: Rust, Tauri 2.6.1
- **UI Components**: Radix UI, Lucide React
- **Code Highlighting**: prism-react-renderer, react-syntax-highlighter, prismjs
- **Markdown Rendering**: react-markdown, remark-gfm
- **Diff Viewing**: react-diff-viewer-continued, diff
- **Styling**: Tailwind CSS with @tailwindcss/typography, tailwind-merge, clsx
- **Update System**: reqwest (for version checking)

### Project Structure

```text
claude-code-history-viewer/
├── src/                    # React frontend source
│   ├── components/         # React components
│   │   ├── contentRenderer/    # Content rendering components
│   │   ├── messageRenderer/    # Message rendering components
│   │   ├── toolResultRenderer/ # Tool result rendering components
│   │   └── ui/                 # UI components
│   ├── constants/         # Constants (colors, etc)
│   ├── hooks/            # Custom React hooks
│   ├── shared/           # Shared components
│   ├── store/            # Zustand state management
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── src-tauri/            # Rust backend source
│   ├── src/              # Rust source files
│   ├── icons/            # App icons
│   └── capabilities/     # Tauri permissions
├── public/               # Static assets
├── scripts/              # Build/migration scripts
└── package.json          # Node dependencies
```

### Available Scripts

```bash
# Start frontend dev server
pnpm dev

# Run full Tauri app in dev mode
pnpm tauri:dev

# Build frontend
pnpm build

# Build production app
pnpm tauri:build

# Run linter
pnpm lint
```

### Backend Commands

The Tauri backend exposes these commands:

- `get_claude_folder_path` - Get the Claude data directory path
- `validate_claude_folder` - Validate Claude folder exists and is valid
- `scan_projects` - Scan for all Claude projects
- `load_project_sessions` - Load sessions for a specific project
- `load_session_messages` - Load messages from a JSONL file
- `load_session_messages_paginated` - Load messages with pagination support
- `get_session_message_count` - Get total message count for a session
- `search_messages` - Search across all messages
- `get_session_token_stats` - Get token usage statistics for a session
- `get_project_token_stats` - Get token usage statistics for a project
- `check_for_updates` - Check for available application updates
- `get_session_analytics` - Get detailed analytics for a session
- `get_project_analytics` - Get comprehensive analytics for a project

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Add comments for complex logic
- Update documentation as needed
- Test on multiple platforms if possible

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

**Build fails on Linux**

- Install all required system dependencies listed in Prerequisites
- Run `sudo apt update` before installing packages

**Performance issues with large histories**

- The app uses virtualization for long message lists
- Consider archiving old conversations if performance degrades

## Privacy

This application runs entirely locally and does not send any data to external servers. All conversation data remains on your machine.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Tauri](https://tauri.app/) - A framework for building tiny, blazing fast binaries
- UI components from [Radix UI](https://www.radix-ui.com/) and [Tailwind CSS](https://tailwindcss.com/)
- Icons by [Lucide React](https://lucide.dev/)
- Code highlighting powered by [prism-react-renderer](https://github.com/FormidableLabs/prism-react-renderer) and [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter)
- Markdown rendering with [react-markdown](https://github.com/remarkjs/react-markdown)
- Diff viewing with [react-diff-viewer-continued](https://github.com/praneshr/react-diff-viewer)

## Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/jhlee0409/claude-code-history-viewer/issues) page
2. Create a new issue with detailed information about your problem
3. Include your platform, app version, and steps to reproduce

## Author

**JaeHyeok Lee**
- GitHub: [@jhlee0409](https://github.com/jhlee0409)

---
