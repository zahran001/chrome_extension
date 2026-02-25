# Phase 1 Plan Review — Rubber-Band AI

**Date:** 2026-02-24
**Updated:** 2026-02-25 — all issues resolved, plans updated, ready for execution.
**Status:** ✅ Plans patched. Ready for `/gsd:execute-phase 01`.

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

## 2. Issues — Resolved

All issues identified during pre-execution review have been fixed in the plan files.

---

### Issue A — `_execute_action` reserved command name ✅ FIXED

**Where:** Plan 01-01 (`src/manifest.json`), Plan 01-05 (`src/service-worker.ts`)

**Problem:** `"_execute_action"` is a reserved MV3 name that opens the extension popup, not a custom command. `chrome.commands.onCommand` never fires for it — Alt+S would open the BYOK popup instead of activating selection mode.

**Fix applied:** Renamed command to `"activate-selection"` in both `manifest.json` template (Plan 01) and the `onCommand` listener (Plan 05).

---

### Issue B — Dynamic import of `panel.ts` inside content script ✅ FIXED

**Where:** Plan 01-04 (`src/content-script.ts`)

**Problem:** `await import('./ui/panel')` is unreliable inside CRXJS-bundled content scripts. Chrome's content script environment doesn't always support module-level dynamic `import()`, and CRXJS may not correctly split the panel bundle as a loadable chunk.

**Fix applied:** Converted to static import at top of `content-script.ts`. Plan 04 now instructs the executor to create a minimal `src/ui/panel.ts` stub (`export function showPanel() {}`) during Plan 04 so the build succeeds; Plan 06 overwrites the stub with the full implementation.

---

### Issue C — `chrome.action.openPopup()` user-gesture requirement ✅ FIXED

**Where:** Plan 01-05 (`src/service-worker.ts`)

**Problem:** `chrome.action.openPopup()` requires a user gesture on the calling side. Calling it from `chrome.runtime.onMessage` (no gesture) silently fails. The `?.` optional chaining hides the failure. "Open Settings" button would do nothing.

**Fix applied:** Replaced with `chrome.tabs.create({ url: chrome.runtime.getURL('src/popup.html') })`. Opens the popup as a tab — 100% reliable across all Chrome versions.

---

### Issue D — SDK migration to `@google/genai` ✅ FIXED

**Where:** Plan 01-01 (`package.json`), Plan 01-05 (`src/llm/gemini.ts`, `src/llm/streaming.ts`), `01-RESEARCH.md`

**Problem:** Plans used `@google/generative-ai` at `^1.42.0`. Google has migrated to the new `@google/genai` SDK with a different API surface.

**Fix applied:** Migrated all references to `@google/genai`. Key API changes reflected in plans:
- Constructor: `new GoogleGenAI({ apiKey })` (was `new GoogleGenerativeAI(apiKey)`)
- Streaming: `ai.models.generateContentStream({ model, contents })` (was `model.generateContentStream(prompt)`)
- Chunk text: `chunk.text` property (was `chunk.text()` method)
- AbortSignal: passed via `config: { abortSignal: signal }` in the call options

---

### Issue E — E2E test context isolation / state bleed ✅ FIXED

**Where:** Plan 01-07 (all `tests/e2e/*.spec.ts`)

**Problem:** Shared `BrowserContext` + single `page` across tests. Failed tests leave cursor, overflow, and dialog state that corrupt subsequent tests.

**Fix applied:** Added explicit DOM state reset in `beforeEach` for both `selection.spec.ts` and `panel.spec.ts`. Removes any leftover `cursor`, `overflow`, `userSelect` styles and removes any orphaned extension DOM elements (`#rubber-band-ai-overlay`, `#rubber-band-ai-confirm`, `dialog[data-rba]`).

---

### Issue F — Retry flow wire-up split across plans ✅ FIXED

**Where:** Plan 01-06 (`src/ui/panel.ts` and `src/content-script.ts`)

**Problem:** The retry `onRetry` callback wiring — passing the callback from `content-script.ts` to `showPanel()`, and re-opening a port with `retryContext` — was described only as a code comment at the bottom of Plan 06. Easily missed by an executor.

**Fix applied:** Added explicit **Task 3** to Plan 06 that:
1. Refactors port setup into an `openStreamPort(extractedText, retryContext?)` helper in `content-script.ts`
2. Passes `onRetry: (ctx) => openStreamPort(extractedText, ctx)` to `showPanel()`
3. Wires the `rba-dismiss` CustomEvent listener to call `port.disconnect()`

---

## 3. Strategic Suggestions — Decisions

### Suggestion A — AbortSignal on dismiss (BYOK quota protection) ✅ IMPLEMENTED

**Decision:** Implement now.

**What was added:**
- `streaming.ts` (Plan 05): `AbortController` created; `port.onDisconnect` calls `abort.abort()` (wired before async loop); `AbortSignal` passed to `ai.models.generateContentStream()` via `config.abortSignal`; `AbortError` swallowed silently
- `panel.ts` (Plan 06): `dismiss()` dispatches `'rba-dismiss'` CustomEvent before closing dialog
- `content-script.ts` (Plan 06, Task 3): `rba-dismiss` listener calls `port.disconnect()` which triggers the abort chain in the SW

Abort chain: `dismiss()` → `rba-dismiss` event → `port.disconnect()` → SW `port.onDisconnect` → `abort.abort()` → HTTP request cancelled

---

### Suggestion B — Character limit on extraction ✅ IMPLEMENTED

**Decision:** Implement now (truncation, not error).

**What was added to Plan 04:**
- `MAX_CHARS = 20_000` constant at top of `content-script.ts`
- After `extractVisibleText()`: if `extractedText.length > MAX_CHARS`, slice to 20,000 and append `'\n\n[Selection truncated — too large to send]'`
- Graceful truncation chosen over error panel — avoids a new error UI state while fully protecting quota

---

### Suggestion C — Iframe overlap warning ✅ DEFERRED (Phase 2)

**Decision:** Defer. Phase 2's VLM fallback (screenshot) inherently solves the iframe content problem. Adding a Phase 1 warning is throwaway UI work. Silent partial extraction is acceptable for Phase 1.

---

## 4. Dependency / Version Verification Checklist

Resolved items are checked. Verify remaining items on first `npm install`:

| Item | Status | Notes |
|------|--------|-------|
| `@crxjs/vite-plugin` `^2.3.0` | Verify | Check if v2 is still current or superseded by v3 |
| ~~`@google/generative-ai`~~ → `@google/genai` `^1.0.0` | ✅ Fixed | Migrated to new SDK package |
| `gemini-2.0-flash` model name | Verify | Confirm model ID valid in current Gemini API |
| `vite` `^5.0.0` | Verify | Check CRXJS v2 compatibility with Vite 5 vs. Vite 6 |
| `@playwright/test` `^1.40.0` | Verify | Current is ~1.50; check for Chrome extension API changes |
| `"activate-selection"` command name | ✅ Fixed | Was `_execute_action` (reserved name) |
| `chrome.tabs.create` for popup | ✅ Fixed | Replaced `chrome.action.openPopup()` |

---

## 5. Final Decision Table

| # | Issue | Decision | Status |
|---|-------|----------|--------|
| A | `_execute_action` command name | Renamed to `"activate-selection"` | ✅ Fixed in Plans 01, 05 |
| B | Dynamic import of `panel.ts` | Static import + stub pattern | ✅ Fixed in Plan 04 |
| C | `chrome.action.openPopup()` | `chrome.tabs.create` fallback | ✅ Fixed in Plan 05 |
| D | SDK `@google/generative-ai` | Migrated to `@google/genai` | ✅ Fixed in Plans 01, 05, RESEARCH.md |
| E | E2E test context bleed | DOM state reset in `beforeEach` | ✅ Fixed in Plan 07 |
| F | Retry wiring split across plans | Explicit Task 3 in Plan 06 | ✅ Fixed in Plan 06 |
| SugA | AbortSignal on dismiss | Implemented via `rba-dismiss` event chain | ✅ Added to Plans 05, 06 |
| SugB | `MAX_CHARS = 20_000` truncation | Implemented in `content-script.ts` | ✅ Added to Plan 04 |
| SugC | Iframe overlap warning | Deferred to Phase 2 | ✅ Deferred |

---

## 6. What Is Intentionally Not Addressed in Phase 1

The following items are out of scope for Phase 1 by design:

- **VLM/screenshot fallback** — Phase 2. Phase 1 is DOM text only; canvas/SVG/iframe pages silently return partial or empty extraction.
- **Markdown rendering in panel** — Phase 2 or later. Phase 1 renders plain text only. Phase 2 must gate HTML injection on DOMPurify before any `innerHTML` is used.
- **Iframe overlap warning** — Phase 2 (VLM fallback inherently handles iframe content).
- **Multi-provider support** — explicitly out of scope (PROJECT.md).
- **Result history / persistence** — explicitly out of scope. Ephemeral by design.
- **Mobile / Firefox** — Chrome MV3 only.
- **Pixel-precise text node geometry** (`Range.getBoundingClientRect()`) — accepted imprecision in Phase 1.
- **Large selection UI warning overlay** — Phase 3 (roadmap item SEL-05).

---

## 7. Plan Quality Assessment

Plans are now ready for execution. All blockers resolved.

**What was fixed:**
- Issues A–F resolved directly in plan files
- Suggestions A and B implemented
- RESEARCH.md updated with `@google/genai` API surface and migration notes

**Remaining known limitation (not a bug):**
- AABB uses `parent.getBoundingClientRect()` which can over-extract on float-wrapped layouts. `Range.getBoundingClientRect()` would be more precise but is 5-10x more expensive. Accepted in Phase 1.

**Security hardening applied:**
- `host_permissions` narrowed from `<all_urls>` to `https://generativelanguage.googleapis.com/*` — the service worker can only `fetch()` the Gemini API endpoint (enforced by Chrome at the network layer).
- `content_security_policy.extension_pages` added: `connect-src https://generativelanguage.googleapis.com` — restricts any fetch from the popup/options pages to the same endpoint.
- Note: MV3 manifest CSP applies only to extension pages, not to service worker `fetch()`. Service worker network access is governed by `host_permissions` only. Both layers are now set correctly.

---

*Review complete. All blockers resolved. Run `/clear`, then `/gsd:execute-phase 01`.*
