# Upstream Migration Plan v2 — tail v1.13.0 → v1.32.2

Boundary: `v1.13.0..upstream/main` = **433 commits** (2026-05-25 → 2026-10-20).
Previous tail (`7fa7e30..v1.13.0`, 271 commits) fully migrated as PR #15 (Phase 1) + PR #17 (Phases 2-5).
Raw list: `docs/plans/upstream-tail-v13-v32.txt`.

Method legend (unchanged from v1 plan): **PORT** re-implement final state in our architecture · **COMPARE** we have an equivalent, fold deltas only · **CONFIG** mechanical copy (i18n/CI/data) · **SKIP** not wanted.

## PROGRESS LOG (branch `fix/antigravity-stores`, started 2026-11-06)

- ✅ Antigravity P0 — `ed24f1c0`: brain transcripts + summaries.db + CLI store, workspace grouping, legacy fallback
- ✅ Windows #604/#548/#549 — `cee02502`: watcher `\\?\` strip; filesystem-verified project-folder decoder (project.rs/session.rs)
- ✅ Codex zstd (#74bdee28) — `05d89269`: .jsonl.zst discovery/parse/twin-skip (553/576 local rollouts were invisible)
- ✅ Codex identity (#7727193b+#38b9e583) — `9b0566e2`: first session_meta wins, filename-uuid fallback, cwd last-turn_context
- ✅ Codex reasoning (#610/#597) — next commit: reasoning items → Thinking content (summary → content[].reasoning_text)
- ✅ Gemini .jsonl (#393/#348) — commit: append-only jsonl sessions parse ($set/$rewindTo), .jsonl filter
- ✅ OpenCode global split (#432) — commit: global sessions split by raw directory into global-dir-<hash> virtual projects (75/124 local)
- ✅ percent_decode panic (#398) — commit: byte-wise decode in cli.rs + antigravity (both copies)
- 247→249 tests green after each batch. Frontend tsc clean, 354 vitest green.
- ✅ #eaaa8787 double-text render — commit: skipText for all roles in ClaudeContentArrayRenderer
- ✅ #623 metadata serialize — commit: write_lock across read→merge→persist (8 writers)
- ✅ #611 ai-titles — commit: aiTitle (last wins) > summary > first-user; noise exclusion was already ours
- ✅ #437+#396 in-session search — commit: tool_use.input args + array tool_result text indexed (4 new tests)
- ✅ UX batch part 1 — commits: KaTeX #499 (+shared markdownPlugins, 8 call sites), prompt jumps #629 (isTurnStart + usePromptJump, 9 tests), tool name aliases #00a9b362, repeated-header drop #051fa7a3 (continuation detection in rows memo). 367 vitest green.
- ✅ security sweep — VERIFIED CLOSED: no follow_links(true) anywhere, WalkDir defaults refuse symlink dirs, June adapter guards + antigravity port have per-entry symlink checks; no Server mode = no remote path surface. Residual (per-file symlink_metadata in local readers) accepted with rationale.
- ✅ #496 chain merge — commits: session_chain.rs (resolve + superseded, 7 tests), loader reads whole chain oldest-first, list hides covered predecessors (#572 included). 256 Rust tests green.
- ✅ #412 font scale — commits: text-pxN utilities (calc px * --font-scale), 233 hardcoded classes swept in 38 files; vite build green.
- ✅ #410 trash fallback — commit: remove_path (trash → permanent) for .jsonl + folder.
- ✅ #443/#412 both — the px sweep covers tool/thinking/markdown boxes (all 233 sites).

## FINAL DISPOSITIONS (2026-11-07, 19 commits on fix/antigravity-stores)

**Integrated (19 commits):** antigravity stores, win watcher+decode, codex zstd/identity/reasoning, gemini jsonl, opencode global split, percent_decode, double-render, metadata lock, ai-titles, search indexing, KaTeX, prompt jumps, tool aliases, header drop, chain merge (#496+#572), font scale, trash fallback. Suites: 256 Rust + 367 TS green, vite build green.

**QUEUED — next session, fresh context (P2 features, port-notes ready):**
- Recent Edits panel (#515+#514+follow-ups): backend edits reader + recentEditsPanelSlice + dock UI + i18n×6 + restore guard. Port WHOLE subsystem; the 20+ review-fix commits are integral.
- resume-in-terminal (#463+#595) + multi-select mass delete (#456): interdependent UI; needs getResumeCommand per-provider map first.
- minimap #634: opt-in session minimap beside message list.
- archive backup #411: one-click zip of all projects.
- workflow rendering #99b2ec7d; parallel-tasks filter #446; explorer columns (#23ea7fbe/#ccf7c19b/#4bc63da2); headless --export #413.
- perf COMPARE (#458/#381/#591/#528/#436/#468): diff against our June cache; port deltas only.
- #568 preserve branched conversations (chain merge covered the display half; verify fork-parent visibility).

**SKIP (rationale):** 20 new providers (user uses none; each = adapter+registration+i18n×6+maintenance); Server/WebUI cluster (no server mode in fork); pricing lifecycle (P3, drift-prone); Cline SDK store #589/#588/#586 (no local store; 2 legacy tasks); #612/#614/#621 (architecture absent); i18n plural v4 migration (verify our i18next version first — CONFIG); Linux ibus/DMABUF, CI/Homebrew/release chores (not applicable).

- ⏭ REMAINING BIG: Recent Edits panel; perf COMPARE (#458/#381/#591/#528); archive backup #411 + trash fallback #410; resume-in-terminal #463 + args #595; minimap #634; #572/#568 session intel; explorer columns; workflow rendering #99b2ec7d; parallel-tasks filter #446; multi-select delete #456; headless export #413.
- DISPOSITIONED no-op: #612/#614/#621 store reload races (their session-list pagination architecture — we have no sessionsOffset/loadMoreSessions machinery; our reload path differs, June tree-orphan fix covered the visible bug).
- DEFERRED: Cline SDK store #589/#588/#586 (no local ~/.cline store, 2 legacy tasks); OpenCode #428 cache bound + ab6bcb45 schema (our reader differs, verify later); providers wave 2 (SKIP unless user asks); Server/WebUI cluster (SKIP, no server mode); pricing lifecycle (P3).
- NOTE: Kaspersky blocks cargo build-script exes; user excluded target dirs. Build: `CARGO_TARGET_DIR=C:/Users/xxx/.cargo-target/ccv-merge cargo test --lib` from src-tauri.
- NOTE: big patches via scripts written to `.claude-scratch/` (bash heredocs choke on mixed quotes).

---

## P0 — diagnosed live bug: Antigravity shows nothing

**Root cause (confirmed on this machine 2026-11-06):**

| Store on disk | Contents | Our adapter (June port) |
|---|---|---|
| `~/.gemini/antigravity/conversations/` | 3× `.db` (SQLite), 2× `.pb` | reads only dirs + flat `.pb`; **`.db` unsupported**; `.pb` scan upstream deleted as unusable (5da74de9) |
| `~/.gemini/antigravity-cli/` | `history.jsonl`, `conversations/*.db`, `conversation_summaries.db` | **not read at all** (store added upstream in #470, July) |
| state DB / trajectory summaries | `agyhub_summaries_proto.pb`, `antigravity_state.pbtxt` | not read (upstream `antigravity_state_sync.rs` parses titles) |

**Fix = PORT upstream final state of all three modules** into our adapter layer:
- `providers/antigravity.rs` (1445 ln) — .db (SQLite) conversations, titles via rpc-cache/session-titled, `data_dir()/Antigravity/logs` ls-main.log
- `providers/antigravity_cli.rs` (867 ln) — `~/.gemini/antigravity-cli`: history.jsonl, brain/conv-cli transcripts, conversation_summaries
- `providers/antigravity_state_sync.rs` (646 ln) — trajectory protobuf summaries for session titles

Upstream commits to absorb: #470 (8546a439), 5da74de9, ae536bbe, #555 test-sandbox path expectations.
**Rule: write a failing test against real store fixtures first** (reproduces "sessions exist but not listed"), then port.

## P0 — Windows fixes (we are the Windows user)

| Commit(s) | Fix | Method |
|---|---|---|
| b8264157+43c55dbf+bb6e3e1b (#549) | project-folder decoding heuristic unreachable/mis-keyed on Windows | PORT |
| c1c7a59f (#604) | watcher: strip `\\?\` extended-length prefix from events | PORT |
| f4c7bee5 (#398) | cursor percent_decode panic on multibyte workspace names | PORT (when Cursor Agent ported) |
| 5a767673 (#588), 0820adba (#586) | Cline Windows paths + extension discovery | PORT (with Cline SDK) |
| 150efb18 (#624) | shared Windows path-prefix helper in settings | COMPARE |
| 62b37328 etc. | clippy Windows false positives | SKIP (noise) |

## P1 — Performance (COMPARE against our June cache work)

Our own cache landed June (#perf cache, "unbelievable! fast"). Upstream did an independent wave — diff approaches, port deltas:

| Commit | What | Method |
|---|---|---|
| f94c2b10 (#458) | chat-style message pagination across all providers | COMPARE→PORT (we paginate 20/load-more already) |
| 034fb54a (#381) | paginate project session loading | COMPARE |
| 41530711 (#591) | session list load speedup large histories | COMPARE |
| f22b6b3a (#528) | heavy reads on blocking pool | PORT |
| 76af742d (#436) | concurrent provider scanners at startup | COMPARE (we have 5s timeout per provider) |
| 22657329 (#468) | bounded-pool parallel workspace scans | PORT |
| 4c921fe5/be07e308 (#466/#467) | search result resolve + per-file cache signature | COMPARE (we have backend search) |
| d93907c9 (#464) | per-file daily stats aggregate cache | COMPARE |
| b8ba8e5e (#352) | FlexSearch → Web Worker | COMPARE (our FlexSearch in-session search) |
| 7f5f942c (#460), 016f0acd (#461) | offscreen row skip; size-guard syntax highlight | PORT |
| af5f1d9b | resolve image blobs only on session open | PORT (with Kimi-style images) |

## P1 — Session intelligence (Phase 2 follow-ups)

| Commit(s) | Feature | Method |
|---|---|---|
| e43bb358 (#611), 6ec51b09 (#616) | show Claude auto-generated session titles (viewer + stats) | PORT |
| 9fceba3b (#496) | merge cross-file Claude continuations | PORT |
| 1d16de59 (#572) | hide redundant Claude predecessors | PORT |
| 7f096a1d (#568) | preserve branched conversations | PORT |
| 6dee9c8c (#477), 29f7af21 (#368), 2c720731 (#395) | native rename: custom-title event (Claude 2.x), /branch source, JSONL newline | COMPARE (we have rename) |
| 5c0fc736 (#369) | resolve project cwd/name from JSONL metadata | COMPARE |
| fa96b51b (#419) | folder name over stale cwd for project identity | COMPARE |
| 8c9946f3 (#623) | serialize metadata saves | PORT |
| c1374fda/89e61026/581c5105 (#621/#614/#612) | store: stale pages on reload, keep selection past page 1, in-place reload | PORT (we hit reload blanking too) |

## P1 — Security sweep (port into OUR readers; June port already symlink-guarded adapters)

| Commit(s) | Area | Method |
|---|---|---|
| 8599a911/742e1e5f/aa0d355a/6b5f4b5f/e09c3c98 | stats/sessions/search/subagents: never follow symlinks, regular files only, refuse FIFO | COMPARE→close gaps |
| e8aa95f4/c3eb2459 | recent-edits/server refuse folder-or-FIFO named like session | PORT (with Recent Edits) |
| 1eed29d7 (#602), d864bdeb (#613) | links: block non-external nav, only downloads for blob/data | PORT |
| 3b551796 (#605) | refuse to overwrite unparseable config on MCP save | PORT if we have MCP settings |
| 8a9df561 + #640-642 | restore only recorded whole-file versions + restore guard | with Recent Edits |

## P2 — Recent Edits panel (full subsystem, mature by v1.32)

Series #515 (20+ feat commits Aug 21-26) + #514 cache + adversarial-review fix wave + #475 reveal-in-folder + #473 diff view + v1.31-32 restore hardening.
Files: `recentEditsPanelSlice`, dock/sidebar panel, backend edits reader, i18n 5 locales.
**PORT whole subsystem in one phase** — follow-ups (cache keying, cursor ownership, ABA guards) are integral, do not skip. Includes #526 refactor onto `useFileEditActions`.

## P2 — Search improvements

| Commit | What | Method |
|---|---|---|
| ce01bea1 (#437) | index `tool_use.input` → matches tool arguments | PORT |
| f28efa29 (#396) | global search matches tool_result content | PORT |
| ee6082b3 (#481) | reveal + highlight in-session matches inside tool cards | PORT |
| 8aa2c1bb (#426), c65ee5ea (#392) | conversation attribution + navigation from results | COMPARE (our GlobalSearchModal) |
| d7b33a9b, 54936818 (#506) | JSON-escaped matches preserved; Codex relevance | PORT |

## P2 — Viewer UX

Minimap (#634), Alt+↑↓ prompt jumps (#629+#630), collapsed tool-call summary rows (#00a9b362), drop repeated headers (#051fa7a3), **double text render for array-content providers (#eaaa8787 — likely affects OUR providers)**, expand-key scope (#81a27a6c), KaTeX (#499+6130cac2+86c8f8a8), narrow window (#500), font-size propagation (#412/#443/af2dcd7f/c81e9a82), i18n plural v4 (#82a05981), theme tokens (#1bd82f8b, e6f10e99), a11y skip links (#530), OverlayScrollbars init event (#351).

## P3 — Providers wave 2 (pick per need)

**Fixes to providers we already have — PORT regardless:**
- Antigravity: see P0
- Codex: zstd rollouts (74bdee28), meta-less rollouts via turn_context (38b9e583), forked session_meta (7727193b), reasoning in content not summary (#610), sqlite orphan cleanup (50d32412)
- OpenCode: split global sessions by dir (#432), bounded session cache (#428), schema align (ab6bcb45), subagents from DB (#560)
- Gemini: .jsonl sessions (#393), path normalize in stats (#3155c05c)
- Cline (have adapter): SDK-era store (#589), Windows (#588/#586), truncation char-safe (#425)
- Cursor (have): global stats (#495); Cursor Agent CLI is a NEW provider (#397/#482/#571)
- Claude: subagent usage rollup (#594), streamed final tokens (#585)

**New providers — DECISION REQUIRED (recommend SKIP unless user uses them):**
Kiro (#324), Kimi CLI (#349) + Kimi Code wire (#513, VS Code ext), Copilot ×3 (#415), Continue/PearAI/Kilo/Goose/Crush/llm (#416), Amazon Q (#417), OpenInterpreter/Qwen/Zed/OpenHands/Trae (#418), Pi+oh-my-pi (#445), Vibe (#438), Grok (#487), Z Code (#573), Kilo OpenCode-core (#580), CodeBuddy (#353).
Each = Rust adapter + TS adapter + registration + 6 locale files + maintenance.

## P3 — SKIP candidates (no server mode in our fork / not applicable)

Server/WebUI cluster: #384 auth, #493 deep links, #560/#617/#618/#620/#693 path+URI validation, #562/#520 restore gates, watcher wildcard events (1dbe4a84), global refresh (#439) — **all SKIP while we have no Server Mode** (revisit if we ever port it).
Also skip: Homebrew/release CI (#553/#554/#342b...), Linux ibus/WebKit DMABUF (#360, 4d2cf9d6), harness-kit (2f77115f), serena config (e3ed8f0e), README/changelog/docs, test-sandboxing campaign (#544-#558 — useful patterns, not features).

## Session management features (P2/P3 mix)

Multi-select + mass delete (#456, + a11y 03fea98e + scope 5568ff5c) — PORT (P2, we have delete?). Resume in terminal (#463) + extra args (#595) — PORT (P2, pairs with our resume). One-click full backup archive (#411) + trash fallback (#410) — PORT (P2). Parallel-tasks filter (#446) — PORT (P3). Workflow runs rendering (#99b2ec7d) — P3 decision. Explorer columns (one-row-per-folder #23ea7fbe, temp bucketing #ccf7c19b, sessions column #4bc63da2) — COMPARE with our ProjectTree (P3). Headless `--export` (#413) — P3. Skill/subagent stats (#414) — P3. Pricing lifecycle (eae3db1c + updates) — P3 (costs drift; optional).

---

## Suggested execution order

1. **Antigravity P0** (test-first against real fixtures: .db + CLI store)
2. **Windows P0 cluster** (#549 decode, #604 watcher prefix)
3. **Provider fixes for providers we have** (Codex/OpenCode/Gemini/Cline/Cursor fixes)
4. **Perf COMPARE** — measure our cache vs their approaches, port deltas
5. **Session intelligence + store reload fixes**
6. **Security sweep gaps**
7. **Recent Edits panel** (big, isolated)
8. **Viewer UX + search** (incremental)
9. Provider decisions for wave 2 (likely SKIP most)

Ship each batch as PR to `origin` (never upstream). Re-measure: `git rev-list --count v1.13.0..upstream/main` stays 433 until next fetch; new tail re-triaged then.
