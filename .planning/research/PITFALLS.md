# Pitfalls Research: Chrome MV3 AI Extension

## Critical Pitfalls (Will Break Your Extension)

### 1. Service Worker Killed Mid-Stream
**What happens:** SW terminates after ~30s of inactivity. If the port is open and messages are flowing, Chrome keeps the SW alive. But if there's a lull (slow Gemini response, network pause), Chrome may kill it.

**Symptoms:** Stream stops mid-response. Content script receives `port.onDisconnect` event with no error. Panel freezes.

**Prevention:**
- Use `chrome.runtime.connect()` (long-lived port) — not `sendMessage`
- Keep port open until explicit done/error message
- In Phase 1, add a `port.onDisconnect` handler in the content script that shows "Connection interrupted — try again"
- For Phase 2+: implement a ping/keepalive if needed (`port.postMessage({ ping: true })` every 20s)

**Phase:** Phase 1 — handle in the initial port setup

---

### 2. OffscreenCanvas Confusion (SW vs Offscreen Document)
**What happens:** Developer sees `chrome.offscreen` in docs and adds it as a dependency, over-engineering the architecture. Or they try to use DOM APIs in SW and are confused when they fail.

**Symptoms:** Unnecessary complexity, or crashes when `document` is referenced in SW.

**Prevention:**
- `new OffscreenCanvas(w, h)` works directly in service workers — use it
- `chrome.offscreen` is ONLY for DOMParser, audio, screen capture via getUserMedia — none of which are needed here
- Never reference `document` or `window` in the service worker

**Phase:** Phase 2 — document this clearly in SW code comments

---

### 3. captureVisibleTab on Restricted Pages
**What happens:** `chrome.tabs.captureVisibleTab()` throws on `chrome://` URLs, PDF viewer, and New Tab page. Extension crashes or shows unhelpful error.

**Symptoms:** Unhandled promise rejection in SW. Content script gets no response.

**Prevention:**
```typescript
// In content script, check before sending VLM request:
const url = window.location.href;
if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
  showError('Cannot capture Chrome internal pages');
  return;
}
```
Also wrap `captureVisibleTab` in try/catch in SW and return structured error to content script.

**Phase:** Phase 2 (VLM path)

---

### 4. Content Script Not Injected on Existing Tabs
**What happens:** User installs extension while tabs are already open. Declarative content script injection only runs on new page loads — existing tabs don't have the content script.

**Symptoms:** Keyboard shortcut does nothing on tabs that were open before installation.

**Prevention:** Two options:
1. Use programmatic injection on extension install:
   ```typescript
   chrome.runtime.onInstalled.addListener(async () => {
     const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
     for (const tab of tabs) {
       await chrome.scripting.executeScript({
         target: { tabId: tab.id },
         files: ['content-script.js']
       });
     }
   });
   ```
2. Instruct users to reload tabs after installation (simpler for MVP)

**Phase:** Phase 1 — decide approach during manifest setup

---

### 5. Keyboard Shortcut Command API Limitations
**What happens:** Chrome command API has constraints developers miss:
- Maximum 4 extension commands total
- Default shortcut must use modifier key (Alt, Ctrl, Shift)
- Some shortcuts conflict with Chrome itself (Ctrl+T, Ctrl+W, etc.)
- Users can override via `chrome://extensions/shortcuts` — your shortcut may be unset

**Symptoms:** Shortcut silently does nothing if unset or conflicting.

**Prevention:**
- Use `Alt+S` as default (uncommon, unlikely to conflict)
- In popup, show current shortcut and link to `chrome://extensions/shortcuts`
- Add fallback: clicking toolbar icon also activates selection mode
- Listen for `chrome.commands.onCommand` in SW, not content script (relay via messaging if needed)

**Phase:** Phase 1 — manifest setup

---

## Moderate Pitfalls (Subtle Bugs)

### 6. AABB False Positives with Fixed/Transformed Elements
**What happens:** `Range.getBoundingClientRect()` returns viewport-relative coordinates. Fixed-position elements are in the viewport but not at their scroll-offset position. CSS transforms (`translate`, `scale`) can make `getBoundingClientRect()` return unexpected values.

**Symptoms:** Text from fixed headers/footers incorrectly included in selection. Text inside scaled containers has wrong bounds.

**Prevention:**
- For MVP, accept this as a known limitation — fixed headers are rare in the selection area
- In Phase 3: detect `position: fixed` elements in selection region and handle separately
- `Range.getBoundingClientRect()` already returns the transformed visual position — transforms are actually handled correctly by this API

**Phase:** Phase 1 awareness, Phase 3 fix if needed

---

### 7. TreeWalker Including Hidden/Off-Screen Text
**What happens:** `NodeFilter.SHOW_TEXT` includes text nodes that are `visibility: hidden`, `display: none`, or positioned off-screen (used for SEO/accessibility tricks). These contaminate the extracted text.

**Symptoms:** Garbled or irrelevant text in Gemini prompt.

**Prevention:**
```typescript
function isVisible(node: Node): boolean {
  const el = node.parentElement;
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && style.opacity !== '0';
}
// Use as filter in TreeWalker acceptNode callback
```

**Phase:** Phase 1 — include in initial TreeWalker implementation

---

### 8. Dialog Styling Conflict with Host Page
**What happens:** Host page CSS selects into the dialog's children (e.g., `* { box-sizing: border-box; font-family: Comic Sans }` applies to your panel). Results in broken UI on some pages.

**Symptoms:** Extension panel looks different on every website.

**Prevention:** Always use Shadow DOM inside the dialog:
```typescript
const dialog = document.createElement('dialog');
const shadow = dialog.attachShadow({ mode: 'closed' });
shadow.innerHTML = `<style>:host { all: initial; ... }</style><div>...</div>`;
document.body.appendChild(dialog);
dialog.showModal();
```
The `all: initial` reset in shadow CSS neutralizes inherited styles.

**Phase:** Phase 1 — foundational dialog setup

---

### 9. Gemini Streaming: Empty Chunks and Finish Reason
**What happens:** Gemini's streaming API sends chunks that may have empty `.text()` values, or may terminate with a `finishReason` of `"SAFETY"` or `"MAX_TOKENS"` without an explicit error.

**Symptoms:** Empty text appended to panel. Stream ends silently without complete response.

**Prevention:**
```typescript
for await (const chunk of stream) {
  const text = chunk.text();
  if (text) appendToPanel(text);

  const candidate = chunk.candidates?.[0];
  if (candidate?.finishReason === 'SAFETY') {
    showError('Response blocked by safety filters');
    break;
  }
  if (candidate?.finishReason === 'MAX_TOKENS') {
    appendToPanel('\n\n[Response truncated — selection too large]');
    break;
  }
}
```

**Phase:** Phase 1 — include in initial streaming implementation

---

### 10. Canvas Overlay Blocks Click Events After Selection
**What happens:** The full-viewport canvas overlay captures all pointer events during selection. If teardown is not clean (canvas removed, events detached), the host page becomes unresponsive.

**Symptoms:** Page freezes after using the extension. Users can't click anything.

**Prevention:**
- On Escape, selection complete, or any error: immediately remove the canvas and re-enable `pointer-events`
- Use `AbortController` for event listeners — `controller.abort()` removes all listeners at once
- Set `canvas.style.pointerEvents = 'none'` immediately after mouseup — before any async operations

**Phase:** Phase 1 — core selection lifecycle management

---

## Security Pitfalls

### 11. chrome.storage.local Is NOT Encrypted
**What happens:** `chrome.storage.local` stores data unencrypted on disk. Any extension with `"storage"` permission can read it. A compromised extension installed alongside yours can read the Gemini API key.

**What this means for the product:**
- This is the same security model as every BYOK browser extension (1Password, Bitwarden use keychain, but most BYOK AI tools use storage.local)
- The risk is from malicious extensions, not web pages (content scripts can't read storage directly)
- The architecture doc's CSP approach mitigates exfiltration via network — good

**Mitigation:**
- Document this limitation in the popup: "Your API key is stored locally in your browser."
- Never log the key to console
- Clear key from memory after use (don't keep it in a module-level variable in SW)

**Phase:** Phase 1 — part of BYOK implementation

---

### 12. XSS via AI Response Rendered as HTML
**What happens:** If Gemini's response is set via `innerHTML`, a malicious website could craft content that causes Gemini to return `<script>` tags or event handlers in its response.

**Symptoms:** Script execution in the Top Layer dialog. Potential content script compromise.

**Prevention:**
- NEVER use `innerHTML` to render streaming text
- Use `textContent` for plain text, or a sanitized markdown renderer
- If markdown rendering is added (Phase 3), use DOMPurify or equivalent

**Phase:** Phase 1 — use textContent in initial implementation, note the constraint

---

## Phase-by-Phase Risk Map

| Phase | Top Risk | Mitigation |
|-------|----------|------------|
| Phase 1 | Canvas teardown / page freeze | AbortController pattern, pointer-events cleanup |
| Phase 1 | SW sleep mid-stream | chrome.runtime.connect port, onDisconnect handler |
| Phase 1 | Hidden text in TreeWalker | getComputedStyle visibility check |
| Phase 1 | Dialog CSS bleed | Shadow DOM with `all: initial` |
| Phase 2 | captureVisibleTab on restricted pages | URL check + try/catch |
| Phase 2 | OffscreenCanvas confusion | Direct `new OffscreenCanvas()` in SW |
| Phase 2 | Gemini finish reason edge cases | Handle SAFETY + MAX_TOKENS explicitly |
| Phase 3 | XSS if markdown added | DOMPurify before innerHTML |

## Summary

**Must address in Phase 1:**
1. SW streaming via ports (not sendMessage) — prevents mid-stream kill
2. Canvas teardown with AbortController — prevents page freeze
3. Shadow DOM for dialog — prevents CSS bleed
4. TreeWalker visibility filter — prevents garbled text
5. textContent (not innerHTML) for response render — prevents XSS

**Must address in Phase 2:**
6. captureVisibleTab URL guard — prevents crash on restricted pages
7. Gemini finish reason handling — prevents silent truncation

**Nice to have:**
8. Tab injection on install (vs reload required)
9. Shortcut conflict documentation in popup
