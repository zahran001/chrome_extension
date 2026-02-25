# Phase 1 Plan Review — Rubber-Band AI

**Date:** 2026-02-24
**Status:** Pre-execution review. No code exists yet. This document covers plan quality, known issues, open questions, and deferred decisions before `/gsd:execute-phase 01` is run.

---

## 1. What Phase 1 Builds

A complete, working Chrome MV3 extension with seven sequential/parallel plans:

| Plan | Wave | What It Delivers |
|------|------|-----------------|
| 01-01 | 1 | Project scaffold: Vite + CRXJS + TypeScript + all test stubs |
| 01-02 | 2 | BYOK settings popup: API key input, toggle, test-key, save |
| 01-03 | 2 | Extraction layer (TDD): AABB collision, visibility filter, TreeWalker |
| 01-04 | 3 | Selection UI: Alt+S, marching ants SVG, confirm button, Escape cancel |
| 01-05 | 3 | Service worker: Gemini streaming, port lifecycle, error classification |
| 01-06 | 4 | Result panel: Top Layer dialog, Shadow DOM, copy, retry, error states |
| 01-07 | 5 | Full E2E test implementation + human verification checkpoint |

Plans 01-02 and 01-03 run in parallel. Plans 01-04 and 01-05 run in parallel.

---

## 2. Known Issues in the Plans

These are concrete bugs or friction points discovered during plan review. Each needs a decision before or during execution.

---

### Issue A — `_execute_action` may not fire `onCommand`

**Where:** Plan 01-01 (`src/manifest.json`), Plan 01-05 (`src/service-worker.ts`)

**Problem:**
The manifest uses `"_execute_action"` as the command name, which is a reserved MV3 name that opens the extension popup — not a custom command. `chrome.commands.onCommand` may not fire for it at all. The service worker's `chrome.commands.onCommand.addListener` will never receive `"_execute_action"`, so Alt+S will open the popup instead of activating selection mode.

**Evidence:** Chrome docs say `_execute_action` triggers `chrome.action.onClicked`, not `chrome.commands.onCommand`. Custom command handlers require a non-reserved name.

**Fix options:**
1. Rename the manifest command to `"activate-selection"` and update the service worker listener to match.
2. Handle activation in `chrome.action.onClicked` instead of `onCommand`, send `activate-selection` from there.

**Recommended:** Option 1 — rename to `"activate-selection"` in both manifest and service worker.

**Impact if ignored:** Alt+S does nothing. The entire selection flow never starts.

---

### Issue B — Dynamic import of `panel.ts` inside a content script

**Where:** Plan 01-04 (`src/content-script.ts`)

```typescript
const { showPanel } = await import('./ui/panel');
```

**Problem:**
CRXJS bundles content scripts as IIFE or ES module chunks. Dynamic imports inside content scripts are unreliable — Chrome's content script environment doesn't always support module-level dynamic `import()` the way a regular web page does, and CRXJS may not correctly split the panel bundle as a loadable chunk from the content script context.

**Fix options:**
1. Convert to a static import at the top of `content-script.ts`. Move the `showPanel` call inside the confirm handler without the dynamic import.
2. Keep it dynamic but configure CRXJS explicitly to treat `panel.ts` as a web-accessible resource.

**Recommended:** Option 1 — static import. There's no circular dependency issue since `panel.ts` doesn't import from `content-script.ts`. The dynamic import was noted as a workaround risk in the plan itself.

**Impact if ignored:** `showPanel` may fail at runtime with a module resolution error. The panel never appears.

---

### Issue C — `chrome.action.openPopup()` requires user gesture

**Where:** Plan 01-05 (`src/service-worker.ts`) and Plan 01-06 (`src/ui/panel.ts`)

```typescript
chrome.action.openPopup?.();
```

**Problem:**
`chrome.action.openPopup()` is only available in Chrome 127+ and requires a user gesture on the calling side. Calling it from a `chrome.runtime.onMessage` handler (which is not a user gesture) may silently fail or throw a permission error in most Chrome versions. The `?.` optional chaining hides the failure.

**Fix options:**
1. Open a new tab to `chrome-extension://[id]/popup.html` as a settings page fallback.
2. Use `chrome.runtime.openOptionsPage()` if popup is registered as an options page.
3. Accept the failure — the "Open Settings" button in the panel is a secondary flow; users can always click the toolbar icon manually.

**Recommended:** Replace with `chrome.tabs.create({ url: chrome.runtime.getURL('src/popup.html') })` as a reliable cross-version fallback. This opens the popup as a tab, which is universally supported.

**Impact if ignored:** "Open Settings" button in the panel silently does nothing on most Chrome versions. First-run flow is broken for users without an API key.

---

### Issue D — `@google/generative-ai` package name may be stale

**Where:** Plan 01-01 (`package.json`), Plan 01-05 (`src/llm/gemini.ts`)

**Problem:**
The research and plans reference `@google/generative-ai` at `^1.42.0`. Google has been migrating this SDK to a new package name (`@google/genai`) and new API surface. If the package name has changed, `npm install` will still work (the old package still exists), but it may be on a deprecated path with no new features or security patches.

**Research needed:**
- Verify current package name on npmjs.com
- Check if `GoogleGenerativeAI` constructor and `generateContentStream` API are still correct
- Check if `gemini-2.0-flash` model name is still valid

**Impact if ignored:** SDK may be deprecated. `generateContentStream` API shape may differ from what Plan 05 expects, causing runtime errors.

---

### Issue E — E2E test context isolation

**Where:** Plan 01-07 (all `tests/e2e/*.spec.ts`)

**Problem:**
All E2E test files use `test.beforeAll` to create a single `BrowserContext` shared across every test in the file. If one test corrupts the extension state (e.g., leaves a `dialog` open, leaves `cursor: crosshair` set, leaves `overflow: hidden` on body), subsequent tests in the same file fail for the wrong reason.

**Fix options:**
1. Add a `test.afterEach` that reloads the page: `await page.reload()`.
2. Use `test.beforeEach` to navigate fresh to the fixture file.
3. Accept the current approach — Plan 07 already uses `test.beforeEach` for navigation, which handles most cases.

**Recommended:** The existing `test.beforeEach` navigation in Plan 07 handles most cases. Add a targeted `afterEach` only for the cursor/overflow checks that are most likely to leak.

**Impact if ignored:** Flaky E2E tests that are hard to debug. Not a correctness problem in production.

---

### Issue F — Retry flow wire-up is split across plans

**Where:** Plan 01-04 (`src/content-script.ts`) and Plan 01-06 (`src/ui/panel.ts`)

**Problem:**
Plan 06 defines the `onRetry` callback signature and calls it when the user submits the retry input. But the actual wiring — passing `onRetry` to `showPanel()` from the content script — is described in a code comment at the bottom of Plan 06 as a modification to `content-script.ts`. This cross-plan edit can be missed by an executor that reads plans sequentially.

**Fix:**
Plan 06 should explicitly include the updated `content-script.ts` section as a task, not a comment. This is a task sequencing issue, not a logic error.

**Impact if ignored:** Retry button appears in the UI but submitting it does nothing — `onRetry` is null.

---

## 3. Known Limitations (Expected, Not Bugs)

These are architectural constraints that are intentional in Phase 1. They become bugs only if undocumented.

---

### Limitation 1 — Cross-Origin Iframes

**What happens:** The TreeWalker cannot cross the `<iframe>` security boundary. Selecting over an embedded YouTube player, Stripe checkout form, Twitter widget, or Google Maps embed will extract zero text from inside the iframe. The selection will succeed, but the extracted content will be whatever text surrounds the iframe — not what's inside it.

**Why it's acceptable in Phase 1:** Phase 2 introduces VLM fallback via `captureVisibleTab` screenshot, which captures the visual pixels of the iframe regardless of security boundaries. The Phase 1 DOM-only path is an explicit limitation documented in `ARCHITECTURE.md`.

**User impact:** Silent partial extraction. No error shown. AI response may be about unrelated text on the page instead of the selected iframe content.

**Options for Phase 1:**
- Accept silently (current plan)
- Detect iframe overlap and show a warning in the panel ("Some embedded content could not be read")
- Detect iframe overlap and block confirmation with an explanation

**Recommendation:** Add iframe detection as a Phase 1 quality-of-life improvement (see Section 4, Suggestion C). Low implementation cost; high clarity benefit.

---

### Limitation 2 — AABB and CSS Float / Text Wrap

**What happens:** `getBoundingClientRect()` on a parent element returns a rectangle that encompasses the full block including whitespace created by CSS floats. If a text block wraps around a floated image, the bounding box includes the space "behind" the float — the visually empty area. A user who carefully draws their selection to avoid the image may unknowingly capture text nodes whose parent bounding box includes that area.

**Why it's subtle:** The TreeWalker checks the *parent element's* bounding rect, not the individual text node's rect (which requires `Range.getBoundingClientRect()` and is more expensive). The RESEARCH.md and CLAUDE.md use `parent.getBoundingClientRect()`.

**User impact:** Occasional over-extraction on pages with floated images or multi-column layouts. AI gets slightly more text than the user intended. Low severity in practice.

**Options:**
- Accept (current plan)
- Use `Range.getBoundingClientRect()` per text node for precise geometry (more expensive — ~5-10x more `getBoundingClientRect()` calls)
- Apply in Phase 2 as a precision upgrade

**Recommendation:** Accept in Phase 1. The imprecision is minor and `Range.getBoundingClientRect()` adds measurable complexity and performance cost. Note it as a known limitation.

---

### Limitation 3 — BYOK Cost Runaway / Abort on Dismiss

**What happens:** When a user presses Escape or clicks X to dismiss the panel, the `StreamPanel.dismiss()` method closes the dialog and disconnects the port. However, the Gemini HTTP request may already be in-flight in the service worker. Disconnecting the port stops *sending tokens to the panel* but does not abort the HTTP request to Gemini.

**Consequence:** If the user selects a long document (e.g., a Wikipedia article introduction — ~2,000 words) and immediately dismisses, the service worker continues fetching the full Gemini response and consuming the user's API quota. The SW then tries to `port.postMessage()`, sees `portAlive = false`, and silently stops — but the network request already ran.

**Current plan behavior:**
- `streamToPort` sets `portAlive = false` on `port.onDisconnect`
- The `for await` loop checks `if (!portAlive) break` at each chunk
- But the HTTP request to Gemini was initiated before the loop and may buffer responses server-side

**Fix (Section 4, Suggestion A):** Pass an `AbortSignal` to `model.generateContentStream()`. Wire the signal to fire when the port disconnects. This kills the HTTP request mid-flight.

**User impact without fix:** Hidden API quota consumption after dismiss. On a rate-limited key, this could cause 429 errors on subsequent requests.

---

### Limitation 4 — Top Layer vs. Other Top Layer Elements

**What happens:** The `<dialog>.showModal()` Top Layer guarantee applies against normal DOM z-index stacking. It does not guarantee priority over *other* Top Layer elements — elements that are also in the Top Layer (native video fullscreen, other extensions' dialogs, browser-native permission prompts). The specification says Top Layer elements are ordered by their insertion order in the Top Layer stack.

**User impact:** If triggered while a native `<video>` is fullscreen, the panel may be obscured. Rare in practice and not fixable from extension code — it's a browser-level stacking decision.

**Recommendation:** Document as a known limitation. Not actionable from extension code.

---

### Limitation 5 — No Character Limit on Extraction

**What happens:** `extractVisibleText` has no upper bound on output length. If a user selects the entire body of a Wikipedia article or a long terms-of-service page, the extracted text could be 50,000+ characters. This results in:
- A very large prompt sent to Gemini (slow, expensive)
- Potential 400 errors if the prompt exceeds Gemini Flash's input token limit (~1M tokens, so practically fine)
- A long wait before the first token arrives

**Fix (Section 4, Suggestion B):** Add a `MAX_CHARS` guard before opening the port.

---

## 4. Strategic Suggestions (Prioritized)

These are improvements to evaluate before execution. Each has a recommended decision.

---

### Suggestion A — AbortSignal for the Gemini HTTP request (HIGH PRIORITY)

**What:** When the user dismisses the panel, send an `{ type: 'abort' }` message through the port before disconnecting. The service worker wires an `AbortController` to `generateContentStream()`.

**Why important:** Without this, every dismissed stream continues consuming the user's BYOK quota. This is a user-hostile bug in a BYOK product — the user pays for requests they cancelled.

**Implementation sketch:**

In `src/llm/streaming.ts`:
```typescript
export async function streamToPort(port, message): Promise<void> {
  const abortController = new AbortController();

  port.onDisconnect.addListener(() => {
    abortController.abort();  // Kill the HTTP request
  });

  // Wire a message listener for explicit abort signal
  port.onMessage.addListener((msg) => {
    if (msg.type === 'abort') abortController.abort();
  });

  const result = await model.generateContentStream(prompt, {
    signal: abortController.signal   // <-- pass to SDK
  });
  // ...
}
```

In `src/ui/panel.ts`, `dismiss()`:
```typescript
// Before disconnecting
if (this.port) {
  this.port.postMessage({ type: 'abort' });
  this.port.disconnect();
}
```

**Verify:** Check if `@google/generative-ai` SDK's `generateContentStream` accepts a `signal` option — API shape depends on SDK version.

**Decision needed:** Add to Plan 05/06 now, or defer to Phase 3 (Polish)?

---

### Suggestion B — Character limit on extraction (MEDIUM PRIORITY)

**What:** Add a `MAX_CHARS` constant to `extractVisibleText` (or in the content script before opening the port). If the extracted text exceeds the limit, either truncate with a notice or show an error in the panel.

**Suggested limit:** 20,000 characters (~4,000–5,000 tokens). Covers most articles, code blocks, and documentation sections. Well within Gemini Flash's limits.

**Implementation sketch:**

In `src/content-script.ts`, after extraction:
```typescript
const MAX_CHARS = 20_000;
if (extractedText.length > MAX_CHARS) {
  showPanel({ mode: 'error', errorMessage: 'Selection is too large. Try selecting a smaller region.', errorType: 'too-large' });
  return;
}
```

Or truncate gracefully:
```typescript
const truncated = extractedText.length > MAX_CHARS
  ? extractedText.slice(0, MAX_CHARS) + '\n\n[Selection truncated — too large to send]'
  : extractedText;
```

**Decision needed:** Add to Plan 04/05 now, or defer to Phase 3 (Polish)? The roadmap already notes Phase 3 as "large selection warnings."

---

### Suggestion C — Iframe overlap warning (LOW PRIORITY)

**What:** Before confirming extraction, check if any `<iframe>` elements have bounding rects that intersect the selection rect. If so, append a warning to the panel: *"Note: Content inside embedded frames could not be read."*

**Implementation sketch:**

In `src/content-script.ts`, after extraction and before sending to SW:
```typescript
function selectionOverlapsIframe(selectionRect: DOMRect): boolean {
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    const rect = iframe.getBoundingClientRect();
    if (rectsIntersect(selectionRect, rect)) return true;
  }
  return false;
}
```

Pass `hasIframeOverlap: boolean` to `showPanel()` so the panel can append a small notice after the response.

**Decision needed:** Add to Plan 04/06 now, or defer to Phase 2 (Multimodal Upgrade, which already addresses iframe content via VLM fallback)?

---

## 5. Dependency / Version Verification Checklist

Before running Plan 01-01's `npm install`, verify these:

| Item | Planned Version | Verify |
|------|----------------|--------|
| `@crxjs/vite-plugin` | `^2.3.0` | Check if v2 is still current or superseded |
| `@google/generative-ai` | `^1.42.0` | Confirm package name hasn't changed to `@google/genai`; verify `generateContentStream` API shape |
| `gemini-2.0-flash` | model name | Confirm this model ID is still valid in the Gemini API |
| `vite` | `^5.0.0` | Check CRXJS v2 compatibility with Vite 5 vs. Vite 6 |
| `@playwright/test` | `^1.40.0` | Playwright 1.40 is from late 2023; current is ~1.50 — check for Chrome extension API changes |
| `chrome.commands.onCommand` | MV3 spec | Confirm `_execute_action` reserved name behavior (Issue A above) |
| `chrome.action.openPopup` | Chrome 127+ | Confirm availability and user-gesture requirement (Issue C above) |

---

## 6. Decisions Required Before Execution

| # | Issue | Options | Recommended | Urgency |
|---|-------|---------|-------------|---------|
| 1 | `_execute_action` command name | Rename to `activate-selection` / use `onClicked` | Rename | **Blocker** |
| 2 | Dynamic import of `panel.ts` | Static import / web-accessible resource | Static import | **Blocker** |
| 3 | `chrome.action.openPopup()` | `chrome.tabs.create` fallback / accept failure | `chrome.tabs.create` | High |
| 4 | SDK package name `@google/generative-ai` | Verify before `npm install` | Verify first | High |
| 5 | AbortSignal for Gemini on dismiss | Add to Plan 05/06 / defer to Phase 3 | Add now | Medium |
| 6 | Character limit on extraction | Add to Plan 04 / defer to Phase 3 | Defer (Phase 3 already planned) | Low |
| 7 | Iframe overlap warning | Add to Plan 04/06 / defer to Phase 2 | Defer (Phase 2 adds VLM for iframes) | Low |
| 8 | Retry flow cross-plan wiring | Explicit task in Plan 06 / trust executor | Explicit task | Medium |

---

## 7. What Is Intentionally Not Addressed in Phase 1

The following items are out of scope for Phase 1 by design. They are recorded here to avoid scope creep during execution:

- **VLM/screenshot fallback** — Phase 2. Phase 1 is DOM text only; canvas/SVG/iframe pages silently return partial or empty extraction.
- **Markdown rendering in panel** — Phase 2 or later. Phase 1 renders plain text only. Phase 2 must gate HTML injection on DOMPurify before any `innerHTML` is used.
- **Multi-provider support** (OpenAI, Anthropic) — explicitly out of scope (PROJECT.md).
- **Result history / persistence** — explicitly out of scope. Ephemeral by design.
- **Mobile / Firefox** — Chrome MV3 only.
- **Pixel-precise text node geometry** (`Range.getBoundingClientRect()`) — accepted imprecision in Phase 1. Cost/benefit doesn't favor it until float-wrap cases become user complaints.
- **Large selection UI warning overlay** — Phase 3 (roadmap item SEL-05).

---

## 8. Plan Quality Assessment

Overall quality is high. The seven plans are specific, ordered correctly, have clear success gates, and encode the CONTEXT.md locked decisions precisely.

**Strengths:**
- Every plan has `must_haves.truths` with testable boolean assertions, not vague goals
- TDD plan (01-03) correctly separates RED/GREEN/REFACTOR with commit points
- XSS constraint (`textContent` only) is repeated in every plan that touches Gemini output
- Port lifecycle invariant (wire `onDisconnect` before async loop) is called out explicitly in Plan 05
- Wave parallelization is correct — no circular dependencies

**Weaknesses / gaps:**
- Issues A and B above are blockers that will cause runtime failures
- Retry flow wire-up is split across plans (Issue F)
- No mention of `connect-src` CSP in manifest — ARCHITECTURE.md calls this out but Plan 01 manifest doesn't include it
- Plan 07 streaming tests are correctly marked `test.fixme`, but there's no guidance for running them manually once a key is configured

---

*Review complete. Pending decisions above before `/gsd:execute-phase 01`.*
