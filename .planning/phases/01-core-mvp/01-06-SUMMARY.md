---
phase: 01-core-mvp
plan: "06"
subsystem: ui
tags: [shadow-dom, top-layer, dialog, streaming, custom-events, abort-controller, css-inline, chrome-mv3, typescript]

# Dependency graph
requires:
  - phase: 01-04
    provides: content-script.ts with port setup stub, rba-* CustomEvent dispatch pattern, SelectionRenderer confirm callback
  - phase: 01-05
    provides: service worker streaming protocol (generate -> token* -> done|error), streamToPort with AbortController

provides:
  - src/ui/panel.ts — showPanel() factory + StreamPanel class: Top Layer dialog with Shadow DOM, skeleton, streaming, copy, retry, errors
  - src/ui/panel.css — Shadow DOM stylesheet via Vite ?inline + adoptedStyleSheets
  - Custom events listened: rba-token, rba-done, rba-error, rba-interrupted (from content-script)
  - Custom events dispatched: rba-dismiss (to content-script to trigger abort chain)
  - src/content-script.ts — openStreamPort() helper + onRetry callback + rba-dismiss abort chain wired

affects:
  - 01-07 (integration tests) — panel and content-script behavior under E2E test; streaming + retry + error states all testable

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vite ?inline CSS import + adoptedStyleSheets: only reliable pattern for Shadow DOM stylesheet injection"
    - "dialog.showModal() Top Layer: bypasses all host-page z-index without position:fixed hacks"
    - "textContent-only rendering: all Gemini output via textContent, never innerHTML — XSS prevention"
    - "rba-dismiss abort chain: dismiss() -> rba-dismiss event -> port.disconnect() -> SW port.onDisconnect -> abort.abort()"
    - "openStreamPort helper: encapsulates port lifecycle, onDisconnect before onMessage, rba-dismiss { once: true }"
    - "StreamPanel event handler arrow functions as class properties: allows removeEventListener by reference"

key-files:
  created:
    - src/ui/panel.ts
    - src/ui/panel.css
  modified:
    - src/content-script.ts

key-decisions:
  - "innerHTML replaced with explicit DOM node removal (while body.firstChild) for clearing skeleton/error state — avoids any innerHTML even for static content"
  - "StreamPanel event handlers as class property arrow functions (handleToken, handleDone, handleError, handleInterrupted) — required for removeEventListener by reference in dismiss()"
  - "rba-dismiss listener uses { once: true } — auto-removed after first dismiss, preventing stale listeners from future port opens"
  - "openStreamPort refactors inline port code from Plan 04 stub — single function handles all port lifecycle including retry invocations"
  - "showPanel returns StreamPanel instance — callers can call appendToken/streamingDone/showError directly if needed (vs. event-only approach)"

patterns-established:
  - "Shadow DOM isolation: :host { all: initial } reset prevents all host page CSS bleed-in"
  - "Blinking cursor via ::after pseudo-element with blink-cursor keyframe, removed with .streaming-done class"
  - "Mid-stream failure preservation: if accumulatedText exists, append interrupted-notice; if not, show full error state"

requirements-completed:
  - PNL-01
  - PNL-02
  - PNL-03
  - PNL-04
  - PNL-05
  - PNL-06

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 1 Plan 06: Result Panel Summary

**Top Layer dialog panel with Shadow DOM CSS isolation, word-by-word streaming via textContent, copy + retry actions, and dismiss-triggered abort chain cancelling in-flight Gemini HTTP requests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T06:37:23Z
- **Completed:** 2026-02-25T06:40:41Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Full StreamPanel class: Top Layer dialog (dialog.showModal), Shadow DOM with adoptedStyleSheets + Vite ?inline CSS, all 6 PNL requirements implemented
- XSS compliance enforced throughout: textContent used exclusively for all Gemini output rendering; innerHTML never used in content rendering paths
- Abort chain complete: dismiss() -> rba-dismiss CustomEvent -> port.disconnect() -> SW port.onDisconnect -> abort.abort() in streaming.ts cancels in-flight Gemini HTTP request (stops BYOK charges)
- Retry flow wired end-to-end: panel retry input -> onRetry callback -> openStreamPort(text, retryContext) -> SW appends context to prompt
- 30/30 unit tests still passing after all changes

## showPanel API

```typescript
showPanel(options: PanelOptions): StreamPanel

interface PanelOptions {
  mode: 'loading' | 'setup' | 'streaming' | 'done' | 'error';
  onRetry?: (retryContext: string) => void;
}
```

## StreamPanel Public Methods

| Method | Description |
|--------|-------------|
| `appendToken(token: string)` | Appends streaming token via textContent; starts streaming mode on first call |
| `streamingDone()` | Removes blinking cursor (.streaming-done class), shows action bar + retry section |
| `showError(errorMessage: string, errorType: string)` | Shows full error state or appends interrupted notice if partial text exists |
| `showInterrupted()` | Marks cursor done, appends interrupted notice, shows actions |
| `dismiss()` | Removes event listeners, dispatches rba-dismiss, closes + removes dialog |

## Custom Events

| Event | Direction | Detail | When |
|-------|-----------|--------|------|
| `rba-token` | listened | `string` (token text) | Each streaming token from content-script |
| `rba-done` | listened | none | Stream completed successfully |
| `rba-error` | listened | `{ error: string; errorType: string }` | Stream error from SW |
| `rba-interrupted` | listened | none | SW port.onDisconnect (SW killed mid-stream) |
| `rba-dismiss` | dispatched | none | Panel dismiss() — triggers abort chain |

## CSS Classes in panel.css

| Class | Purpose |
|-------|---------|
| `.panel-container` | Root flex column with box-shadow, 480px wide, 60vh max-height |
| `.panel-header` | Title + close button row |
| `.panel-title` | "Rubber-Band AI" label (uppercase, 12px) |
| `.close-btn` | X button triggering dismiss() |
| `.panel-body` | Scrollable flex-grow content area |
| `.response-text` | Streaming text container; ::after cursor removed by .streaming-done |
| `.skeleton-container` | Flex column of shimmer skeleton lines |
| `.skeleton-line` | Individual shimmer line with gradient animation |
| `.error-container` | Error message + optional action button column |
| `.error-message` | Red (#c62828) error text |
| `.error-action-btn` | "Open Settings" red-border button |
| `.interrupted-notice` | Yellow-background notice for mid-stream failures |
| `.panel-actions` | Copy button row at panel bottom |
| `.copy-btn` | Copy button with .copied feedback state |
| `.setup-container` | First-run API key setup prompt |
| `.setup-btn` | Green "Open Settings" button |
| `.retry-section` | Text input + Send button row |
| `.retry-input` | Follow-up prompt input field |
| `.retry-send-btn` | Send button (disabled during retry) |

## XSS Compliance

All Gemini output is rendered exclusively via `textContent`:
- `appendToken()`: `this.responseEl.textContent = this.accumulatedText` (accumulates tokens)
- `showError()`: `msg.textContent = errorMessage` (humanized error strings from streaming.ts)
- `showInterrupted()`: `notice.textContent = 'Stream interrupted...'` (static string)
- Static skeleton/error clearing: uses `while (body.firstChild) body.removeChild(body.firstChild)` instead of `body.innerHTML = ''`

## Retry Flow

```
User types in retry-input + presses Enter/Send
  -> panel.ts submitRetry() calls this.onRetry(ctx)
  -> content-script.ts onRetry callback: openStreamPort(extractedText, retryContext)
  -> port.postMessage({ type: 'generate', text: extractedText, retryContext })
  -> service worker streaming.ts: buildPrompt(text, retryContext) appends context
  -> new streaming response renders in panel (panel is replaced via showPanel())
```

## Abort Chain

```
User clicks X or presses Escape
  -> panel.ts dismiss() dispatches CustomEvent('rba-dismiss')
  -> content-script.ts rba-dismiss listener { once: true } calls port.disconnect()
  -> SW port.onDisconnect fires
  -> streaming.ts abort.abort() cancels in-flight Gemini HTTP fetch
  -> AbortError caught silently in streaming.ts
  -> No user-visible error (panel already closed)
```

## Task Commits

Each task was committed atomically:

1. **Task 1: Panel stylesheet** - `c167544` (feat)
2. **Task 2: StreamPanel Top Layer dialog** - `a3653ec` (feat)
3. **Task 3: Content-script retry + abort wiring** - `f3ead68` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/ui/panel.css` — Shadow DOM stylesheet: :host reset, skeleton shimmer, blinking cursor, error states, retry section (258 lines)
- `src/ui/panel.ts` — Full StreamPanel implementation replacing Plan 04 stub (354 lines)
- `src/content-script.ts` — openStreamPort() helper + onRetry callback + rba-dismiss abort chain wired

## Decisions Made

- **innerHTML replaced with explicit DOM removal:** `while (body.firstChild) body.removeChild(body.firstChild)` used instead of `body.innerHTML = ''` for clearing skeleton/error states — eliminates any innerHTML usage from the file entirely
- **Arrow function class properties for event handlers:** `handleToken`, `handleDone`, `handleError`, `handleInterrupted` declared as class properties so `removeEventListener` can reference the same function objects
- **rba-dismiss { once: true }:** Prevents stale listeners accumulating across multiple openStreamPort() calls when retry is used
- **openStreamPort() refactor:** Consolidates all port setup into one reusable function covering initial call and all retry invocations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced innerHTML with explicit DOM removal**
- **Found during:** Task 2 (panel.ts implementation)
- **Issue:** Plan used `body.innerHTML = ''` to clear skeleton/error states. While this is safe (clearing static structure, no user content), it is still innerHTML usage. The success criteria requires zero innerHTML in the file.
- **Fix:** Replaced with `while (body.firstChild) body.removeChild(body.firstChild)` throughout panel.ts to achieve true zero-innerHTML compliance
- **Files modified:** src/ui/panel.ts
- **Verification:** `grep "innerHTML" src/ui/panel.ts` returns only comment lines, no actual assignments
- **Committed in:** a3653ec (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Tightened XSS compliance beyond plan specification. No scope change.

## Issues Encountered

None — TypeScript compiled cleanly, build succeeded on first attempt, ?inline import resolved correctly.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- Panel is fully operational — ready to receive rba-token/rba-done/rba-error/rba-interrupted events
- Abort chain complete — dismiss cancels in-flight Gemini requests preventing BYOK charges
- Retry flow wired end-to-end — same selection can be re-run with additional context
- All 6 PNL requirements implemented (PNL-01 through PNL-06)
- 30/30 unit tests passing — no regressions
- Plan 07 (Integration Tests) can now write E2E tests against the full panel + streaming pipeline

---
*Phase: 01-core-mvp*
*Completed: 2026-02-25*

## Self-Check: PASSED

- src/ui/panel.css exists on disk (verified)
- src/ui/panel.ts exists on disk (verified)
- src/content-script.ts exists on disk (verified)
- .planning/phases/01-core-mvp/01-06-SUMMARY.md exists on disk (this file)
- Task 1 commit exists: c167544 (feat: panel stylesheet)
- Task 2 commit exists: a3653ec (feat: StreamPanel implementation)
- Task 3 commit exists: f3ead68 (feat: content-script retry + abort wiring)
