# Research Summary: Rubber-Band AI Chrome Extension

## Stack

**Build:** Vite + CRXJS v2 + TypeScript 5.x — the de-facto 2025/2026 standard for MV3 extensions. CRXJS handles manifest processing, content script HMR, and correct SW module format automatically.

**Test:** Vitest + JSDOM (unit/integration) + Playwright headful (E2E MV3 lifecycle). Playwright requires headful mode for MV3 service worker tests.

**API:** `@google/generative-ai` SDK — handles SSE parsing, streaming, and vision in one package. Streaming back to content script via `chrome.runtime.connect()` long-lived ports.

**UI:** Native canvas API + native `dialog.showModal()` with Shadow DOM. Zero UI libraries needed.

## Architecture

**Streaming:** Use `chrome.runtime.connect()` ports, not `sendMessage`. The long-lived port keeps the service worker alive during streaming. Port open = SW stays awake.

**OffscreenCanvas:** Available directly in service workers (`new OffscreenCanvas(w, h)`). No `chrome.offscreen` API needed — that's only for DOM APIs.

**captureVisibleTab:** `"activeTab"` permission is sufficient. Keyboard shortcut counts as a user gesture. Fails on `chrome://` pages — guard with URL check.

**Top Layer:** `dialog.showModal()` from content script works. Use Shadow DOM inside dialog (`attachShadow`) with `all: initial` CSS reset to isolate from host page styles.

**Build order:** Popup BYOK → CS activation + canvas → AABB/TreeWalker → ports → SW streaming → dialog render → VLM path (Phase 2)

## Table Stakes Features

Users of AI extensions expect:
- Real-time streaming render (word-by-word)
- Copy to clipboard button
- Esc to cancel/close at any stage
- Distinct error messages (bad key / rate limit / network)
- Loading skeleton before first token
- Cursor change on activation

## Watch Out For

**Critical — must address in Phase 1:**
1. **Canvas teardown** — Use AbortController; restore pointer-events immediately on mouseup or cancel. Failure = page freeze.
2. **Shadow DOM for dialog** — Host page CSS bleeds into dialog children. `attachShadow` + `all: initial` required.
3. **TreeWalker visibility filter** — `NodeFilter.SHOW_TEXT` includes hidden text. Add `getComputedStyle` check.
4. **textContent not innerHTML** — Never render Gemini response as HTML. XSS risk.
5. **Port onDisconnect handler** — SW may be killed mid-stream. Show "interrupted" error, not silence.

**Critical — must address in Phase 2:**
6. **captureVisibleTab guard** — Try/catch + URL check for `chrome://` and PDF pages.
7. **Gemini finish reason** — Handle `SAFETY` and `MAX_TOKENS` finishReason explicitly.

**Anti-features to avoid:** Account systems, analytics, cloud sync, subscription prompts — all undermine the BYOK/privacy-first positioning.

## Files

- `STACK.md` — Build tooling, testing, API integration, what not to use
- `FEATURES.md` — Table stakes, differentiators, anti-features, onboarding patterns
- `ARCHITECTURE.md` — Component boundaries, streaming pattern, SW lifecycle, build order
- `PITFALLS.md` — 12 specific pitfalls with prevention strategies and phase mapping
