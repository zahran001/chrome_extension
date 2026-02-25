# Rubber-Band AI — Chrome Extension

Chrome MV3 extension. Alt+S activates rubber-band selection → DOM text extracted → streamed to Gemini → result in floating Top Layer panel. BYOK (Gemini key). No backend. No persistence.

## Architecture

- **Content script** — selection UI, DOM extraction, panel injection (unprivileged, page context)
- **Service worker** — Gemini API calls, port-based streaming back to content script (privileged)
- **Top Layer panel** — `dialog.showModal()` + Shadow DOM; bypasses all host-page z-index

Content script cannot call Gemini directly (CSP). Must go through service worker via `chrome.runtime.connect`.

## Hard Rules (Bugs if Violated)

**XSS:** Use `textContent` only for Gemini output. Never `innerHTML`. LLM may reproduce user-selected malicious HTML.

**Port lifecycle:** Wire `port.onDisconnect` *before* starting the async streaming loop in the service worker. Listeners added after the loop starts miss disconnect events.

**Shadow DOM CSS:** Use Vite `?inline` import + `adoptedStyleSheets`. Standard CSS imports and inline `<style>` tags do not cross the Shadow Root boundary.

**Pointer-events cleanup:** Restore `pointer-events` and `overflow` in ALL exit paths — mouseup, Escape keydown, and error paths. Use `AbortController` for guaranteed cleanup.

**Visibility check order in TreeWalker:** Check zero dimensions (`rect.width === 0 || rect.height === 0`) *before* AABB collision — avoids unnecessary `getComputedStyle` calls.

**SW alive window:** The service worker stays alive only while a `chrome.runtime.connect` port is open. Port must stay open from `generate` message until `done`/`error` is sent. Do not close the port early.

## Key Decisions

| Decision | Consequence |
|----------|-------------|
| Gemini-only, BYOK | `chrome.storage.local` stores key **plaintext** — acceptable for BYOK, do not add encryption |
| Port-based streaming | `sendMessage` won't work — SW sleeps after 30s; ports keep it alive for 5 min |
| Top Layer dialog | Do not use `position: fixed` + z-index as fallback — Top Layer is the only reliable approach |
| Phase 1: DOM text only | Canvas/SVG/PDF pages will silently fail — expected, deferred to Phase 2 VLM fallback |
| Ephemeral panel | No storage of results — panel close = gone, by design |

## Test Commands

```bash
npm run test:unit   # Vitest + JSDOM
npm run test:e2e    # Playwright headful Chrome
npm run build       # Vite + CRXJS → dist/
npx tsc --noEmit    # Type-check only
```

Streaming E2E tests are marked `test.fixme` when no API key is present — expected, not broken.
