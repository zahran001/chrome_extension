---
phase: 01-core-mvp
plan: "04"
subsystem: ui
tags: [svg, animation, content-script, selection, rubber-band, abort-controller, chrome-runtime, custom-events]

# Dependency graph
requires:
  - phase: 01-01
    provides: Vite + CRXJS build pipeline, TypeScript config, content-script stub
  - phase: 01-03
    provides: extractVisibleText() from tree-walker.ts for text extraction on confirm

provides:
  - src/ui/selection-renderer.ts — SelectionRenderer class with SVG overlay, marching ants, confirm button
  - src/content-script.ts — full activation listener, drag state machine, AbortController cleanup, port stub
  - src/ui/panel.ts — minimal showPanel stub (static import target; overwritten by Plan 06)
  - CustomEvents: rba-token, rba-done, rba-error, rba-interrupted dispatched to document
  - Messages: activate-selection (inbound), check-api-key (outbound sendMessage)

affects:
  - 01-05 (service worker streaming) — connects to 'llm-stream' port opened here
  - 01-06 (panel implementation) — overwrites panel.ts stub; listens for rba-* CustomEvents
  - 01-07 (integration tests) — content-script behavior under test

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AbortController for event listener cleanup: single abort.abort() call removes all listeners added with { signal }"
    - "Per-drag AbortController separate from mode AbortController: drag listeners isolated from mode listeners"
    - "port.onDisconnect wired BEFORE port.onMessage and postMessage (CLAUDE.md hard rule)"
    - "Static panel import pattern: import at file top, not dynamic — dynamic import unreliable in CRXJS content scripts"
    - "SVG overlay with pointer-events: none — page remains interactive while rubber-band is visible"

key-files:
  created:
    - src/ui/selection-renderer.ts
    - src/ui/panel.ts
  modified:
    - src/content-script.ts

key-decisions:
  - "panel.ts stub created with static export so content-script.ts import compiles; Plan 06 overwrites with full implementation"
  - "port.onDisconnect registered before port.onMessage per CLAUDE.md hard rule (listeners added after async loop start miss disconnect events)"
  - "overflow + userSelect restored in mouseup path, Escape during drag path, AND deactivateSelectionMode() — three distinct restore points covering all exit scenarios"
  - "MAX_CHARS = 20_000 applied before port.postMessage with explicit truncation suffix message"

patterns-established:
  - "Dual AbortController pattern: startAbort (mode lifetime) + perDragAbort (drag lifetime) for layered cleanup"
  - "deactivateSelectionMode() as single canonical cleanup function called from all exit paths"
  - "renderer.setOnConfirm() wired once at module init time, not per-drag"

requirements-completed:
  - SEL-01
  - SEL-02
  - SEL-03
  - SEL-04
  - SEL-06

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 1 Plan 04: Selection UI Summary

**SVG rubber-band selection overlay with marching ants animation, AbortController-based drag state machine in content-script, and CustomEvent streaming bridge to panel**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T06:29:35Z
- **Completed:** 2026-02-25T06:32:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- SelectionRenderer class provides complete visual selection feedback: SVG overlay, marching ants animation, confirm button at bottom-right + 6px, accidental-click guard (< 4x4px)
- content-script.ts implements full state machine: idle → selection mode → dragging → confirm/cancel with guaranteed cleanup in all paths
- AbortController dual-layer pattern ensures no lingering event listeners or frozen pages on any exit path
- CLAUDE.md hard rules enforced: port.onDisconnect wired before port.onMessage, textContent-only rendering, no innerHTML anywhere

## SelectionRenderer API

```typescript
class SelectionRenderer {
  setOnConfirm(cb: (rect: DOMRect) => void): void
  startDrag(startX: number, startY: number): void
  updateDrag(currentX: number, currentY: number): void
  endDrag(endX: number, endY: number): void
  cleanup(): void
}
```

## Content Script Message Types

| Direction | Type | Description |
|-----------|------|-------------|
| Inbound (from SW) | `activate-selection` | Activates selection mode, sets crosshair cursor |
| Outbound (to SW) | `check-api-key` | Checks if API key is stored before opening port |
| Outbound (port) | `generate` | Sends extracted text to service worker for streaming |

## CustomEvents Dispatched

| Event | Detail | When |
|-------|--------|------|
| `rba-token` | `{ text: string }` | Each streaming token from SW |
| `rba-done` | none | Stream completed successfully |
| `rba-error` | error object from SW | Stream error |
| `rba-interrupted` | none | port.onDisconnect fired (SW killed mid-stream) |

## AbortController Pattern

Two layered controllers used:
- `startAbort` (mode lifetime): covers mousedown listener + pre-drag Escape listener. Aborted in `deactivateSelectionMode()`.
- `perDragAbort` (drag lifetime): covers mousemove, mouseup, Escape-during-drag. Aborted on mouseup or Escape keydown inside drag.

```typescript
// Mode activation
const startAbort = new AbortController();
document.addEventListener('mousedown', onMouseDown, { signal: startAbort.signal, capture: true });

// Per-drag
const perDragAbort = new AbortController();
document.addEventListener('mousemove', ..., { signal: perDragAbort.signal });
document.addEventListener('mouseup', ..., { signal: perDragAbort.signal, once: true });
```

## Static Panel Import Pattern

`showPanel` is statically imported at the top of content-script.ts:
```typescript
import { showPanel } from './ui/panel';
```

A minimal stub `src/ui/panel.ts` was created in this plan to satisfy the import at build time:
```typescript
export interface PanelOptions { mode: 'loading' | 'setup' | 'result'; }
export function showPanel(_options: PanelOptions): void { /* stub */ }
```
Plan 06 overwrites this stub with the full Top Layer dialog implementation.

## MAX_CHARS Guard

Location: `renderer.setOnConfirm()` callback, applied immediately after `extractVisibleText()` returns.

```typescript
const MAX_CHARS = 20_000;
if (extractedText.length > MAX_CHARS) {
  extractedText = extractedText.slice(0, MAX_CHARS) + '\n\n[Selection truncated — too large to send]';
}
```

Truncation message is appended as plain text so the model knows the input was cut.

## Task Commits

Each task committed atomically:

1. **Task 1: SVG selection renderer** - `9e3650f` (feat)
2. **Task 2: Content script + panel stub** - `3079e4a` (feat)

## Files Created/Modified
- `src/ui/selection-renderer.ts` — SelectionRenderer class: SVG overlay, marching ants animation, confirm button
- `src/content-script.ts` — Full content script: Alt+S activation, drag state machine, AbortController cleanup, streaming port
- `src/ui/panel.ts` — Minimal stub for showPanel (Plan 06 overwrites)

## Decisions Made
- **Dual AbortController pattern:** Separate startAbort (mode) from perDragAbort (drag) keeps cleanup scopes isolated. Single abort.abort() per scope removes all listeners without iterating.
- **port.onDisconnect before port.onMessage:** Strict ordering per CLAUDE.md hard rule — avoids race condition where SW dies between connect and listener registration.
- **Three restore points for overflow/userSelect:** mouseup path, Escape-during-drag path, and deactivateSelectionMode() cover all possible exit scenarios including error paths that call deactivate directly.
- **panel.ts stub with static import:** Dynamic import is unreliable inside CRXJS-bundled content scripts (Issue B from research). Static import at top of file is required; stub created to allow build to succeed before Plan 06 implements the full panel.

## Deviations from Plan

None — plan executed exactly as written. The panel.ts stub creation was explicitly called out in the plan as a required step.

## Issues Encountered
None — build succeeded first attempt, TypeScript compiles without errors.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `chrome.runtime.connect({ name: 'llm-stream' })` port is opened in content-script.ts — service worker (Plan 05) must handle this port name
- `rba-token`, `rba-done`, `rba-error`, `rba-interrupted` CustomEvents dispatched — panel (Plan 06) must listen for these
- `check-api-key` message sent — service worker must handle this message type (already implemented in Plan 02 via `hasApiKey`)
- TypeScript compiles cleanly, build exits 0 — no blockers for Plan 05

---
*Phase: 01-core-mvp*
*Completed: 2026-02-25*

## Self-Check: PASSED

- src/ui/selection-renderer.ts exists on disk (verified)
- src/content-script.ts exists on disk (verified)
- src/ui/panel.ts exists on disk (verified)
- .planning/phases/01-core-mvp/01-04-SUMMARY.md exists on disk (verified)
- Task 1 commit exists: 9e3650f (verified)
- Task 2 commit exists: 3079e4a (verified)
