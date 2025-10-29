# Future Features: Command History Integration

Inspired by the `cchistory` CLI tool, these features would add bash command extraction and analysis to the GUI viewer.

## 1. Commands View/Panel

**Description**: New dedicated view for extracted bash commands

**Features**:
- New tab/panel showing bash commands in table/list format
- Columns:
  - Timestamp
  - Command text
  - Success/Failure status (from tool_result)
  - Description (from Bash tool's description field)
  - Project name
  - Session ID
- Sortable by any column
- Filter by:
  - Success/failure status
  - Date range
  - Project
  - Command type (git, npm, docker, etc.)
- Copy individual commands or selections
- Export commands to shell script file

**Implementation Notes**:
- Parse `tool_use` blocks with `name: "Bash"` from assistant messages
- Match with `tool_result` blocks to determine success/failure
- Also parse `<bash-input>` tags for user `! commands`
- Reuse existing message parsing logic in Rust backend

---

## 2. Command Search

**Description**: Dedicated search functionality specifically for bash commands

**Features**:
- Separate search interface from message search
- Search across:
  - Command text
  - Command descriptions
  - Working directory (cwd)
- Filter options:
  - Success/failure status
  - Date range
  - Project/session
  - Command source (Claude's Bash tool vs user `! commands`)
- Regex pattern support
- Search history (recent command searches)
- Quick filters: "git commands", "npm commands", "docker commands", etc.

**Implementation Notes**:
- Add `search_commands` Rust command (similar to `search_messages`)
- Create dedicated search index for commands
- UI component separate from message search

---

## 3. Command Statistics & Analytics

**Description**: Analytics dashboard focused on command usage patterns

**Features**:
- **Most Used Commands**:
  - Top 20 most frequent commands
  - Command frequency chart
  - Group similar commands (e.g., all `git status` variants)
- **Success/Failure Rates**:
  - Overall success rate percentage
  - Failure trends over time
  - Most commonly failed commands
- **Command Categories**:
  - Auto-detect command types (git, npm, docker, python, etc.)
  - Pie chart showing category distribution
  - Category usage over time
- **Command Complexity**:
  - Average command length
  - Multi-line command frequency
  - Commands with pipes/redirects
  - Most complex commands (by length, pipe count)
- **Time-based Analysis**:
  - Commands per session
  - Commands per hour/day/week
  - Busiest coding times

**Implementation Notes**:
- Add `get_command_stats` Rust command
- Categorization logic using regex patterns
- Integrate with existing analytics dashboard

---

## 4. Export Commands

**Description**: Export bash commands in various formats

**Export Formats**:
1. **Shell Script** (`.sh`):
   ```bash
   #!/bin/bash
   # Exported from Claude Code History Viewer
   # Project: my-project
   # Session: abc-123
   # Date: 2025-10-27

   git status
   npm install
   npm run build
   ```

2. **Bash History Format**:
   ```
   #1730000000
   git status
   #1730000123
   npm install
   ```

3. **CSV/Excel**:
   - Timestamp, Command, Success, Description, Project, Session

4. **JSON**:
   ```json
   [
     {
       "timestamp": "2025-10-27T10:30:00Z",
       "command": "git status",
       "success": true,
       "description": "Check git status",
       "project": "my-project",
       "session": "abc-123",
       "cwd": "/path/to/project"
     }
   ]
   ```

5. **Markdown**:
   ```markdown
   # Command History - my-project

   ## 2025-10-27

   - `git status` ✓
   - `npm install` ✓
   - `npm run build` ✗
   ```

**Features**:
- Export current session, project, or global
- Filter before export (date range, success/failure, etc.)
- Include/exclude metadata (timestamps, descriptions, etc.)
- Executable script option (add shebang, make executable)

**Implementation Notes**:
- Add `export_commands` Rust command
- Use existing export patterns from files panel
- Add to context menu and toolbar

---

## 5. User Command Detection & Tagging

**Description**: Distinguish between Claude's commands and user's commands

**Features**:
- **Parse User Commands**:
  - Detect `<bash-input>` tags in user messages (from `! command` syntax)
  - Mark as "user-initiated" vs "Claude-initiated"
- **Visual Distinction**:
  - Different icons/colors for user vs Claude commands
  - Badge showing source
- **Separate Views**:
  - Filter to show only user commands
  - Filter to show only Claude commands
  - Show both with clear distinction
- **Command Attribution**:
  - "You ran this command"
  - "Claude suggested and ran this command"
- **Analytics**:
  - Ratio of user vs Claude commands
  - User command patterns vs Claude patterns
  - Commands Claude runs most often

**Implementation Notes**:
- Parse `<bash-input>` tags from user messages
- Add `source` field to command data structure: `"user" | "assistant"`
- Update command extraction logic in Rust backend

---

## Implementation Priority

**Phase 1** (Quick Wins):
1. Commands View/Panel - Core functionality
2. Export Commands - Shell script format

**Phase 2** (Medium Complexity):
3. Command Search - Basic text search
4. User Command Detection - Source tagging

**Phase 3** (Advanced):
5. Command Statistics & Analytics - Full dashboard
6. Advanced export formats (CSV, JSON, Markdown)
7. Regex search support

---

## Technical Architecture

### Backend (Rust)

**New Commands**:
```rust
// src-tauri/src/commands/command_extraction.rs

#[tauri::command]
async fn get_session_commands(session_id: String) -> Result<Vec<CommandEntry>, String>

#[tauri::command]
async fn get_project_commands(project_path: String) -> Result<Vec<CommandEntry>, String>

#[tauri::command]
async fn search_commands(query: String, filters: CommandFilters) -> Result<Vec<CommandEntry>, String>

#[tauri::command]
async fn get_command_stats(project_path: Option<String>) -> Result<CommandStats, String>

#[tauri::command]
async fn export_commands(commands: Vec<CommandEntry>, format: ExportFormat) -> Result<String, String>
```

**Data Structures**:
```rust
#[derive(Serialize, Deserialize)]
struct CommandEntry {
    id: String,
    timestamp: String,
    command: String,
    description: Option<String>,
    success: Option<bool>,
    source: CommandSource, // "user" | "assistant"
    project_path: String,
    session_id: String,
    cwd: Option<String>,
    tool_use_id: Option<String>,
}

#[derive(Serialize, Deserialize)]
enum CommandSource {
    User,        // From <bash-input> tags
    Assistant,   // From Bash tool use
}

#[derive(Serialize, Deserialize)]
struct CommandFilters {
    success_only: bool,
    source: Option<CommandSource>,
    date_range: Option<DateRange>,
    project_path: Option<String>,
    command_pattern: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct CommandStats {
    total_commands: u32,
    success_count: u32,
    failure_count: u32,
    success_rate: f32,
    most_used: Vec<CommandFrequency>,
    categories: HashMap<String, u32>,
    commands_per_day: Vec<DailyCount>,
}
```

### Frontend (React + TypeScript)

**New Components**:
- `src/components/CommandsView.tsx` - Main commands panel
- `src/components/CommandsList.tsx` - Table/list of commands
- `src/components/CommandSearch.tsx` - Search interface
- `src/components/CommandStats.tsx` - Analytics dashboard
- `src/components/CommandExport.tsx` - Export dialog

**Store Updates**:
```typescript
// src/store/useCommandStore.ts
interface CommandStore {
  commands: CommandEntry[];
  commandStats: CommandStats | null;
  filters: CommandFilters;

  loadSessionCommands: (sessionId: string) => Promise<void>;
  loadProjectCommands: (projectPath: string) => Promise<void>;
  searchCommands: (query: string) => Promise<void>;
  exportCommands: (format: ExportFormat) => Promise<void>;
}
```

---

## References

- **Inspiration**: `cchistory` CLI tool (c:\_init\w\_proj\_own\_gemsbox\gembox-v1\cchistory)
- **Related Backend**: Command extraction logic similar to cchistory's `jsonl-stream-parser.ts`
- **Related Features**: Current analytics dashboard, token stats, search functionality
