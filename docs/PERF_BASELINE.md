# FlexHubs Desktop — Performance baseline

Captured during the optimization pass (Steps 0–5). Update this file after profiling on your machine.

## Environment

| Field | Value |
|-------|--------|
| Branch | `architecture-refactoring` (created from `test-yl` @ `9a3b67d`) |
| App version | 1.0.24 |
| Stack | Electron Forge + Vite, React 19 |

## Code-shaped baseline (pre-optimization signals)

These are **not** substitute for Profiler numbers; they describe structural cost before changes.

| Signal | Approximate value | Source |
|--------|-------------------|--------|
| `ChatPage.tsx` lines | ~7,440 | `wc -l` |
| `ChatPage` `useState` hooks | 71+ | static review |
| `ChatPage` `useEffect` hooks | 39 | static review |
| Message history page size | 50 (`MESSAGE_HISTORY_PAGE_SIZE`) | `ChatPage.tsx` |
| List virtualization | None (full DOM for loaded messages) | `MessageList.tsx` |
| `commitConversationList` pipeline | Full sidebar normalize on many paths | `ChatPage.tsx` |
| Presence refresh | Updates `presenceByUserId` + maps all DMs in `conversations` | `refreshPresence` (pre–Step 2) |

## Runtime metrics (fill in from React Profiler / DevTools)

| Scenario | Metric | Pre-opt | Post Steps 0–5 |
|----------|--------|---------|----------------|
| Cold login → chat visible | Wall time (ms) | | |
| Switch conversation (DM) | `ChatPage` commit (ms) | | |
| Switch conversation (DM) | `MessageList` render count | | |
| Receive 1 message (active thread) | `MessageRow` render count | | |
| Typing indicator (other DM) | `MessageList` render count | | |
| Load older × 5 (250 msgs) | Scroll / interaction | | |
| Realtime reconnect | `getConversations` / presence calls | | |
| 30 min session | Heap (MB) | | |

## After Steps 0–5 (code-complete, not runtime-profiled here)

| Change | Expected effect |
|--------|-----------------|
| Presence no longer rewrites every DM row in `conversations` | Fewer `ChatPage` renders on bulk presence refresh |
| `applyConversationSidebarPatch` | Skips full `commitConversationList` pipeline for single-row preview/hub/profile updates |
| `MessageRow` custom memo + precomputed `replyTarget` | Rows skip re-render when sibling messages change (same `message` reference) |
| `ConversationThread` memo + stable callback bridge | Thread subtree skips render when only unrelated `ChatPage` state changes |
| Dev `window.__FLEXHUBS_PERF__` | Measurable before/after in console for commits and refreshes |

## Dev instrumentation (Step 1+)

In development (`import.meta.env.DEV`):

1. Open DevTools → Console.
2. `window.__FLEXHUBS_PERF__.summary()` — counters and rolling durations.
3. `window.__FLEXHUBS_PERF__.reset()` — clear counters before a scenario.

Markers: `chat:commitConversationList`, `chat:refreshPresence`, `messageList:render`, `conversationThread:render`.

## How to profile

1. React DevTools → **Profiler** → Record → perform scenario → Stop.
2. Note **Commit duration** for `ChatPage`, `ConversationThread`, `MessageList`, `MessageRow`.
3. Optional: `FLEXHUBS_LOG_API=1 npm start` to count HTTP `/me` and API noise.

## TypeScript / build gate

```bash
npx tsc --noEmit
npm run package   # or npm start for smoke
```

Pre-existing `tsc` errors may remain; new changes should not add errors in touched files.
