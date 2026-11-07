# Upstream Migration Plan — jhlee0409 → ndokutovich fork

## Reference point (true sync boundary)

- **Boundary commit:** `7fa7e30` — upstream "Merge PR #171 / fix #167 panel overlap" (~2026-03-10)
- **Position:** 493 commits ahead of merge-base `1f26025`; upstream `v1.6.0` = 481 (`a7ba0ea`)
- **Why this point, not git merge-base:** our fork absorbed upstream by *porting/adapting* (2026-03-01 big port + 2026-03-10 PR #9 picking #165/#167), not by real merges — so git's ancestry shows base `1f26025`, but our *content* tracks upstream up to ~#167.
- **Validation:** pre-boundary features present in our tree (archive); post-boundary absent (date-overlay #170, WYSIWYG expand registry #169). Boundary is clean.
- **Our marker:** tag `sync-base-v1.9.8` @ `71c6a15` (fork state with our v1.9.8 fixes).

## Scope

- **Upstream tail to triage:** `7fa7e30..upstream/main` = **272 commits** (48 feat, 2 perf, 138 fix, 26 refactor, 13 chore, 7 docs, 2 test).
- Upstream head: **v1.13.0**. Ours: **v1.9.8**.
- Full raw list: `docs/plans/upstream-tail-493-765.txt`.

## Method legend

Because our architecture diverges (flat `session.rs` vs their `session/` module; our adapter set; FlexSearch frontend), **cherry-pick rarely applies**. Methods:

- **CP** — clean cherry-pick possible (file-compatible, isolated). Verify before applying.
- **PORT** — reimplement the *approach* in our architecture (the common case).
- **CONFIG** — copy data/config/i18n/CI tweaks (low-risk mechanical).
- **COMPARE** — we already have an equivalent; diff theirs vs ours, fold in only deltas.
- **SKIP** — not wanted / our-impl preferred / internal churn.

**Key principle:** we port *final feature state*, so the 138 fix-commits that are review follow-ups inside a feature/PR are absorbed automatically — they are **not** migrated individually. The decision unit below is the feature/PR.

---

## Per-feature migration table (chronological)

| # | PR | Lead commit | Feature | Our status | Method | Prio |
|---|----|-------------|---------|-----------|--------|------|
| 1 | #170 | `c17453e` | Date display on message timestamps (+ Radix tooltip, floating date overlay) | missing | PORT | med |
| 2 | #169 | `991e683` | True WYSIWYG capture via Zustand expand registry | missing (we have own capture mode) | COMPARE→PORT delta | low |
| 3 | #184 | `8b016d2` | Conversation export (MD/JSON/HTML) | HAVE (own export) | COMPARE | low |
| 4 | #187 | `f16fd8b` `ef92616` `5fa2dcf` | OpenCode **SQLite** storage + badge + db watch | missing (we have OpenCode JSON only) | PORT | high |
| 5 | #195 | `4fc29f2` | Custom Claude config directories (initial) | missing | PORT | high |
| 6 | — | `8985572` `6ab94c0` | Session names via `/rename` + visual diff named/unnamed | missing | PORT | high |
| 7 | #193 | `2895d32` `b191a82` | Advanced message filter (role + content-type toggles) in MessageNavigator | PARTIAL (have navigator) **VERIFY** | COMPARE→PORT | med |
| 8 | #213 | `39e6752` | Gemini **CLI** provider | HAVE-ish (our GeminiAdapter refs gemini-cli) **VERIFY paths** | COMPARE | med |
| 9 | — | `1835906` | Missing content-type support across all providers | partial **VERIFY** | PORT delta | med |
| 10 | — | `2255444` | **Cline, Cursor, Aider** provider support | Cline DONE (PR #14); Aider missing; Cursor HAVE | PORT (Aider remains) | high |
| 11 | — | `c6c99c8` `d576356` | Global search: project filter + msg navigation + UI/UX | partial (we have global search) | COMPARE→PORT delta | med |
| 12 | — | `d06ab51` `3443bab` | Search perf: aho-corasick, partial sort, LRU cache, early-term | missing (we use FlexSearch+backend) | PORT (approach) | med |
| 13 | — | `acffc89` | `validate_dialog_path` helper (dialog file-op hardening) | missing **VERIFY** | PORT (security) | med |
| 14 | #?(wsl) | `9032309`→`7a78445` (9 commits) | **WSL support**: winreg dep, wsl.rs (UNC/detection), Tauri cmds, scan integration, isWindows util, settings UI + i18n | strings only, no backend | PORT (large, staged) | high |
| 15 | — | `7625945` | DatePickerHeader in GlobalStatsView | missing **VERIFY** | PORT | low |
| 16 | — | `0d28aa3` | "Show JSONL File" in session context menu | depends on ctx-menu | PORT | low |
| 17 | — | `a0d10ed` | Delete session (move to trash) | HAVE-ish **VERIFY** | COMPARE | med |
| 18 | #232 | `f3d4d33` | Portable Windows zip release artifact | missing | CONFIG (CI) | low |
| 19 | #224 | `91321da` | Copy-path on project context menu | partial | PORT delta | low |
| 20 | #231 | `1d4598b` | Activity heatmap → monthly calendar blocks | missing | PORT | med |
| 21 | #242 | `9d8bd01` | Auto-refresh sessions + auto-scroll on new messages | HAVE-ish (file watcher) **VERIFY** | COMPARE | med |
| 22 | #248 | `427fe0b` | Search + horizontal scrollbar in project panel | missing | PORT | med |
| 23 | #251 | `c90bece` | Right-click context menu on session items | HAVE-ish **VERIFY** | COMPARE→PORT delta | med |
| 24 | #252 | `c1a4a4c` | SubAgent conversation history viewing | PARTIAL **VERIFY** | COMPARE→PORT | high |
| 25 | #254 | `d338cd7` | Custom Claude config dirs (full, follow-up to #195) | missing | PORT (with #5) | high |
| 26 | #261 | `45fa166` | CLI `--session <uuid>` external launch | missing | PORT | med |
| 27 | #270/#272 | `0779511` | CLI Stage B resolvers + session picker modal | missing | PORT (with #26) | med |
| 28 | #270/#274 | `4367ec5` | CLI single-instance + Apple Events re-invocation | missing | PORT (with #26, macOS) | med |
| 29 | #277 | `03c4ad6` | Follow symlinks at depth 1 in scan_projects | HAVE-ish **VERIFY** | COMPARE | low |
| 30 | #291 | `e90b196` | **Antigravity** provider | missing | PORT (new adapter) | med |
| 31 | #295 | `6127ca4` | **ForgeCode** provider | missing | PORT (new adapter) | med |
| 32 | #299 | `7b25b7b` | "Show Sub-agent Messages" toggle in header dropdown | missing (with #24) | PORT | med |
| 33 | #302 | `3059183` | Codex resume + `cd` prefix for resume command | HAVE-ish (Resume btn) **VERIFY** | COMPARE→PORT delta | med |
| 34 | #330 | `c8dbe8a` | Distinguish session source by `entrypoint` (CLI/VS Code/Desktop) | missing — **relates to our v1.9.8 schema fix** | PORT | high |
| 35 | #337 | `2a3a601` | macOS custom overlay title bar + Tauri v2 patch bump | missing | PORT (Tauri bump = CONFIG) | low |

> `**VERIFY**` = our presence flagged by fuzzy probe; confirm exact parity before deciding COMPARE vs PORT.

---

## Buckets folded in (not migrated per-commit)

- **138 `fix:`** — overwhelmingly review/QA follow-ups *inside* the features above (e.g., #193 has several, WSL has several, #166/#170 tooltip fixes). Folded into each feature's final-state PORT. Standalone infra fixes worth a look: CI/release hardening (`b303c11`, `b7fd934`, `1a18d52`), Tauri/Rust version alignment (`v1.12.0` head).
- **26 `refactor:`** — mostly the `session.rs → session/` module split and type reshuffles. **Do NOT port the refactor itself** (our structure differs); absorb only behavior that rides along with a feature.
- **13 `chore:` / 7 `docs:` / 2 `test:`** — release bumps, README, funding config → SKIP or CONFIG as needed. Their tests target their structure → rewrite ours per feature.

---

## Progress — ALL 20 TASKS DONE (222 Rust tests pass, tsc clean, cargo build clean)

Branch stack (local unless noted): `main` (Phase 1 merged) → `feat/phase2-session-intel` (PR #16, pushed) → `feat/phase3-ux` → `feat/phase4-platform` → `feat/phase5-parity` (HEAD = everything).

- **Phase 1 — providers: DONE.** Cline (PR #14, merged). Aider, ForgeCode, Antigravity, OpenCode-SQLite, Gemini-parity (PR #15, merged).
- **Phase 2 — session intel: DONE** (PR #16 open). entrypoint #330, sub-agent viewing #252/#299, rename display #6, custom config dirs #195/#254.
- **Phase 3 — UX: DONE** (local). date display #170, advanced filter #193, monthly heatmap #231, project-panel search + ctx-menu #248/#251/#224.
- **Phase 4 — platform: DONE** (local). WSL #16x, CLI session launch #261/#270/#272/#274, macOS overlay title bar #337, search perf aho-corasick/LRU #12.
- **Phase 5 — parity sweep: DONE** (local). validate_dialog_path, JSON export, delete session (trash), auto-scroll, symlink depth-1, codex resume cd-prefix.

### Follow-ups (honest, not blocking)
- Antigravity `.pb` body decoding (needs protobuf schema) — metadata-only for now.
- OpenCode `opencode.db` live watch (needs generalized file-watcher).
- macOS-only bits (title-bar appearance, Apple Events re-invocation, deep-link scheme) compile but unverified on this Windows machine.
- WSL end-to-end project scan unverified without a live WSL Claude install (path/parse logic unit-tested).
- search: case-insensitivity now ASCII-only (aho-corasick tradeoff) — non-ASCII (e.g. Cyrillic) case-folding no longer matches in search.

## Recommended phasing (by value × independence)

1. **Phase 1 — providers (high value, isolated):** Cline (#10), Aider (#10), Antigravity (#291), ForgeCode (#295), OpenCode SQLite (#187), Gemini CLI parity (#213). Each is a self-contained adapter — lowest conflict risk.
2. **Phase 2 — session intelligence:** entrypoint source (#330, ties to our schema work), SubAgent viewing+toggle (#252/#299), session rename names (#6), custom config dirs (#195/#254).
3. **Phase 3 — UX:** date display (#170), advanced filter (#193), monthly heatmap (#231), project panel search/scroll (#248), context-menu deltas (#251/#224/#16).
4. **Phase 4 — platform/CLI (largest, most arch-specific):** WSL (#14), CLI session launch suite (#261/#270), macOS title bar (#337), search perf (#12).
5. **Phase 5 — parity sweep:** COMPARE items (export #184, delete #17, auto-refresh #21, symlink #29, codex resume #33) — fold deltas only.

Each migrated feature ships as its own PR to `origin` (never upstream), with our regression-test discipline.

## Open verifications before execution

Confirm exact parity for the `VERIFY`-flagged rows (#7, #8, #9, #13, #17, #21, #23, #24, #29, #33) by diffing the upstream feature files against ours. These flip between COMPARE (cheap) and PORT (real work).
