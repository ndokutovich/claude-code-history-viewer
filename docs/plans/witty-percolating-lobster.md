# Plan: Close All Remaining Gaps vs Upstream

## Context

After the 13-commit implementation session, three structural gaps remain between our fork
and upstream `jhlee0409/claude-code-history-viewer`. Many items previously listed as "missing"
actually exist in our fork (ProviderMetadataDisplay, ProviderIcons, time utilities, all hooks,
etc.). The real gaps are narrower and well-defined:

1. **Empty sub-directories** — `MessageViewer/components/`, `MessageViewer/hooks/`,
   `ProjectTree/components/` were created as folders but never populated
2. **8 missing store slices** — state organization is incomplete (7 of 15 upstream slices)
3. **Missing tests** — no hook tests (`hooks/__tests__/`), no ProjectTree component tests
4. **2 missing utils** — `formatters.ts`, `toolUtils.ts`

---

## Confirmed Gap Inventory (after exploration)

### NOT missing (exist in our fork already)
- `ProviderMetadataDisplay.tsx` ✅ | `ProviderIcons.tsx` ✅
- `useAppTranslation` — not needed, standard `useTranslation` used throughout ✅
- `date.ts` — `time.ts` already covers all date formatting with i18n ✅
- `SyntaxHighlighterLazy.tsx` ✅ | All hooks ✅ | `services/analyticsApi.ts` ✅
- `shared/` directory ✅ | `modals/` (all 7) ✅ | Header SettingDropdown (all 7) ✅
- `lib/utils.ts` — we use `utils/cn.ts` (functionally identical) ✅

### Real gaps

#### Gap 1: MessageViewer/components/ and hooks/ — EMPTY
Upstream has `components/VirtualizedMessageRow.tsx` + 4 others, `hooks/useMessageVirtualization.ts`,
`useScrollNavigation.ts`, `useSearchState.ts`. Our dirs were created but never filled.

What to extract from `MessageViewer.tsx` (1,116 lines):
- **MessageNode** (lines ~50-267, ~220 lines): `UIMessageNode` inline component → `MessageViewer/components/MessageNode.tsx`
- **useMessageScrolling** (~185 lines of inline useEffect/ref logic): manages showScrollToBottom,
  scroll-to-bottom, load-more-scroll, throttled scroll handler → `MessageViewer/hooks/useMessageScrolling.ts`
- **useMessageTree** (~220 lines): parentUuid map building, root message detection, renderMessageTree
  function → `MessageViewer/hooks/useMessageTree.ts`

#### Gap 2: ProjectTree/components/ — EMPTY
Upstream has `GroupedProjectList.tsx`, `SessionList.tsx`, `ProjectRow.tsx`, `SessionRow.tsx`
plus `__tests__/`. Our `ProjectTree/components/` dir is empty.

What to extract from `ProjectTree.tsx` (1,072 lines):
- **ProjectRow** (~79 lines): single project row with expand/collapse, loading spinner
- **SessionRow** (~95 lines): single session row with metadata badges (message count, time, tool/error icons)
- **FlatSessionsList** (~77 lines): the flat all-sessions view mode
- **ProjectGroup** (~214 lines): group header + all projects in one group

#### Gap 3: 8 missing store slices
We have 7 slices; upstream has 15. Missing: `boardSlice`, `globalStatsSlice`, `messageSlice`,
`metadataSlice`, `navigatorSlice`, `projectSlice`, `providerSlice`, `watcherSlice`.

**Strategy**: Create all 8 as additive state-shape definitions following the existing pattern
(state interface + initialState export + actions interface). Integrate into `useAppStore.ts`
as type extensions + initialState spreads. Do NOT move existing store keys yet (too risky
without full coverage) — slices define new state additions.

State each slice should own:

| Slice | New state it adds |
|-------|-------------------|
| `boardSlice` | `boardLayout`, `expandedBoardNodes`, `selectedBoardNodes`, `boardViewMode` |
| `globalStatsSlice` | `globalStats`, `isLoadingGlobalStats`, `globalStatsError`, `globalStatsCacheTime` |
| `messageSlice` | `messageViewMode`, `messageFilters` (lift from inline) |
| `metadataSlice` | `sessionMetadata`, `isSavingMetadata` |
| `navigatorSlice` | `navigatorOpen`, `navigatorMode`, `bookmarkedMessages`, `navigatorWidth` |
| `projectSlice` | `isLoadingAllSessions` (global flag) |
| `providerSlice` | `defaultProvider`, `providerHealthStatus` |
| `watcherSlice` | `isWatchingEnabled`, `watchedPaths`, `fileWatcherError`, `lastSyncTime` |

#### Gap 4: Missing tests

| File | Location | What to test |
|------|----------|-------------|
| `useFileWatcher.test.ts` | `src/hooks/__tests__/` | Mock Tauri watch calls, callback triggers |
| `useUpdater.test.ts` | `src/hooks/__tests__/` | Mock @tauri-apps/plugin-updater, state transitions |
| `TreeSemantics.test.tsx` | `ProjectTree/components/__tests__/` | ARIA roles on extracted components |

#### Gap 5: Missing utils (2 files)

| File | Content |
|------|---------|
| `src/utils/formatters.ts` | `formatFileSize(bytes)`, `formatNumber(n)`, `formatPercentage(n)`, `formatTokenCount(n)` |
| `src/utils/toolUtils.ts` | `getToolCategory(name)`, `getToolDisplayName(name)`, `isReadOnlyTool(name)`, `isWriteTool(name)` |

---

## Execution Strategy — 3 Parallel Agents (worktree isolation)

### Agent A: MessageViewer extraction
Modifies: `src/components/MessageViewer/`

**Creates:**
- `MessageViewer/components/MessageNode.tsx` — extracts `UIMessageNode` inline component
- `MessageViewer/components/index.ts` — barrel: `export { MessageNode } from './MessageNode'`
- `MessageViewer/hooks/useMessageScrolling.ts` — extracts scroll state + effects
- `MessageViewer/hooks/useMessageTree.ts` — extracts tree building + renderMessageTree
- `MessageViewer/hooks/index.ts` — barrel

**Modifies:**
- `MessageViewer/MessageViewer.tsx` — import from new files, remove inline code

**Constraint:** TypeScript must remain clean after edits. No behavior change.

### Agent B: ProjectTree extraction + tests
Modifies: `src/components/ProjectTree/`

**Creates:**
- `ProjectTree/components/ProjectRow.tsx`
- `ProjectTree/components/SessionRow.tsx`
- `ProjectTree/components/FlatSessionsList.tsx`
- `ProjectTree/components/ProjectGroup.tsx`
- `ProjectTree/components/index.ts` — barrel
- `ProjectTree/components/__tests__/TreeSemantics.test.tsx` — ARIA structure assertions

**Modifies:**
- `ProjectTree/ProjectTree.tsx` — import from components, remove inline JSX blocks

**Constraint:** All existing `ProjectTree.keyboard.test.tsx` tests must still pass.

### Agent C: Store slices + utils + hook tests
No risk of conflict with A or B.

**Creates:**
- `store/slices/boardSlice.ts`
- `store/slices/globalStatsSlice.ts`
- `store/slices/messageSlice.ts`
- `store/slices/metadataSlice.ts`
- `store/slices/navigatorSlice.ts`
- `store/slices/projectSlice.ts`
- `store/slices/providerSlice.ts`
- `store/slices/watcherSlice.ts`
- `utils/formatters.ts`
- `utils/toolUtils.ts`
- `hooks/__tests__/useFileWatcher.test.ts`
- `hooks/__tests__/useUpdater.test.ts`

**Modifies:**
- `store/useAppStore.ts` — extend AppStore interface + spread initialState for all 8 new slices

---

## Files to Create/Modify Summary

| # | File | Action | Agent |
|---|------|--------|-------|
| 1 | `MessageViewer/components/MessageNode.tsx` | CREATE | A |
| 2 | `MessageViewer/components/index.ts` | CREATE | A |
| 3 | `MessageViewer/hooks/useMessageScrolling.ts` | CREATE | A |
| 4 | `MessageViewer/hooks/useMessageTree.ts` | CREATE | A |
| 5 | `MessageViewer/hooks/index.ts` | CREATE | A |
| 6 | `MessageViewer/MessageViewer.tsx` | MODIFY | A |
| 7 | `ProjectTree/components/ProjectRow.tsx` | CREATE | B |
| 8 | `ProjectTree/components/SessionRow.tsx` | CREATE | B |
| 9 | `ProjectTree/components/FlatSessionsList.tsx` | CREATE | B |
| 10 | `ProjectTree/components/ProjectGroup.tsx` | CREATE | B |
| 11 | `ProjectTree/components/index.ts` | CREATE | B |
| 12 | `ProjectTree/components/__tests__/TreeSemantics.test.tsx` | CREATE | B |
| 13 | `ProjectTree/ProjectTree.tsx` | MODIFY | B |
| 14-21 | `store/slices/[8 new slices].ts` | CREATE | C |
| 22 | `store/useAppStore.ts` | MODIFY | C |
| 23 | `utils/formatters.ts` | CREATE | C |
| 24 | `utils/toolUtils.ts` | CREATE | C |
| 25 | `hooks/__tests__/useFileWatcher.test.ts` | CREATE | C |
| 26 | `hooks/__tests__/useUpdater.test.ts` | CREATE | C |

---

## Key Patterns to Follow

- **Slice pattern**: copy structure from `src/store/slices/analyticsSlice.ts`
  — `XxxSliceState`, `XxxSliceActions`, `XxxSlice` type, `initialXxxState`, `createXxxSlice`
- **Component extraction**: props fully typed; extracted sub-components receive all data via
  props (no extra store hooks inside extracted sub-components unless already there)
- **Test pattern**: copy structure from `src/test/treeKeyboard.test.ts`
- **No behavioral changes**: extraction is pure refactor — identical rendering and logic

---

## Verification

```bash
pnpm exec tsc --build . --noEmit   # TypeScript: 0 errors
pnpm lint                           # ESLint: no new errors
pnpm test:run                       # All tests pass (84 existing + ~8 new)
```

Manual check:
- MessageViewer renders sessions identically (scroll, search, extraction all work)
- ProjectTree renders projects/sessions identically (keyboard nav, context menu work)
- New store slices appear without breaking existing state
