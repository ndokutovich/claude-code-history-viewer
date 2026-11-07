# Provider source/format spec (extracted from upstream, for re-implementation in OUR architecture)

Upstream backend lives in `src-tauri/src/providers/*.rs` and returns `ClaudeProject/ClaudeSession/ClaudeMessage`.
Their frontend has NO per-provider classes (uses `utils/providers.ts` + `providerSlice`). **We port by approach** into:
- Backend: `src-tauri/src/commands/adapters/<p>.rs` emitting our Universal types + 5-point wiring in `multi_provider.rs`.
- Frontend: `src/adapters/providers/<P>Adapter.ts` implementing `IConversationAdapter` + `AdapterRegistry` + `ProviderID` + icon + i18n (6 locales).

## Cline (+ Roo Code)
- **Extensions:** `saoudrizwan.claude-dev` (Cline), `rooveterinaryinc.roo-cline` (Roo Code)
- **Editors:** `Code` (VS Code), `Cursor`, `Code - Insiders`, `Codium`
- **Base paths (VS Code globalStorage):**
  - macOS: `~/Library/Application Support/<editor>/User/globalStorage/<ext_id>`
  - Linux: `~/.config/<editor>/User/globalStorage/<ext_id>`
  - **Windows (upstream MISSING — we add):** `%APPDATA%/<editor>/User/globalStorage/<ext_id>`
- **Projects:** `state/taskHistory.json` (Cline) or `tasks/_index.json`→`entries` (Roo). Items have `id`, `ts`(ms), `cwdOnTaskInitialization`, `task`, `tokensIn/Out`, `modelId`. Group by cwd. Path scheme `cline://<base>:<cwd>`.
- **Sessions:** one per task item; file = `tasks/<id>/ui_messages.json`; session path `cline://<base>:<id>`. summary = `task` (trunc 100) or modelId.
- **Messages:** `tasks/<id>/ui_messages.json` = `Value[]` of `{type:"say"|"ask", say/ask:subtype, ts, text, reasoning}`.
  - say `text`/`completion_result` → assistant text block
  - say `reasoning` → thinking block
  - ask → user/assistant prompt (read full upstream `convert_ask_message`)
- **Security:** reject `..`/slashes in task_id; skip symlinked ext dirs.

## Aider
- **File:** `.aider.chat.history.md` (Markdown) located in project dirs under `~/<subdir>` search roots.
- **Format:** markdown chat history, line-parsed into turns. Session path `aider://<file>#<index>`.
- Lowest infra but custom markdown parser required.

## ForgeCode
- **Base:** `$FORGE_CONFIG` or `~/.forge`. **DB:** `.forge.db` (SQLite, authoritative). Also `logs/`, `.forge_history`.
- Reuse our SQLite precedent (Cursor adapter). Workspace/conversation keyed; path scheme `forgecode://workspace/conversation`.

## Antigravity (hardest — defer)
- **Root markers:** `brain/`, `conversations/`, `monitor-state.json`. **Logs:** `<data_dir>/Antigravity/logs`.
- **Conversations:** `conversations/<session_id>.pb` (protobuf), `manifest.json` (step count), `usage.jsonl`, `ls-main.log` (tool names).
- Needs protobuf decoding — most complex; schedule last in Phase 1.

## Gemini CLI (parity check)
- We already have GeminiAdapter (reads `~/.gemini`, `session-*.json`). Compare upstream `providers/gemini.rs` paths/format; fold deltas only.

## OpenCode SQLite (#187)
- Extend existing OpenCode adapter to also read `opencode.db` (SQLite) alongside JSON; add storage-type badge + db watch.
