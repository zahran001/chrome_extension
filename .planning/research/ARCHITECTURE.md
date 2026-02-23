# Architecture Research: Chrome MV3 AI Extension

## Component Boundaries

```
┌─────────────────────────────────────────────────────────┐
│ HOST PAGE                                               │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ CONTENT SCRIPT (unprivileged, per-tab)           │  │
│  │  - Global keydown listener (activation)          │  │
│  │  - Canvas overlay (rubber-band rendering)        │  │
│  │  - MouseEvent capture during selection           │  │
│  │  - TreeWalker DOM extraction (fast path)         │  │
│  │  - AABB collision math                           │  │
│  │  - Routing heuristic (DOM vs VLM)                │  │
│  │  - Top Layer dialog injection (result panel)     │  │
│  │  - chrome.runtime.connect() → port to SW         │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ EXTENSION PROCESS                                       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ BACKGROUND SERVICE WORKER (privileged)           │  │
│  │  - chrome.runtime.onConnect listener             │  │
│  │  - chrome.tabs.captureVisibleTab (screenshot)    │  │
│  │  - new OffscreenCanvas() (image crop)            │  │
│  │  - chrome.storage.local (BYOK key read)          │  │
│  │  - Gemini API streaming (fetch / SDK)            │  │
│  │  - Chunk forwarding via port.postMessage()       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ POPUP (popup.html + popup.ts)                    │  │
│  │  - API key input + chrome.storage.local write    │  │
│  │  - Key visibility toggle                         │  │
│  │  - Save confirmation                             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Note:** No Offscreen Document needed. `OffscreenCanvas` (the canvas 2D API) is directly available in service workers — it does not require `chrome.offscreen`. The chrome.offscreen API is only needed for DOM APIs (DOMParser, audio) not available in SW.

## Streaming Pattern: chrome.runtime.connect (Ports)

**Use long-lived ports, not sendMessage, for streaming.**

`chrome.runtime.sendMessage` is request/response only — it can return a single value but cannot stream. For token-by-token streaming, use `chrome.runtime.connect()`:

### Content Script side
```typescript
// On selection confirmed:
const port = chrome.runtime.connect({ name: 'llm-stream' });

port.onMessage.addListener((msg) => {
  if (msg.chunk) appendToPanel(msg.chunk);
  if (msg.done) finalizePanel();
  if (msg.error) showError(msg.error);
});

port.postMessage({
  type: 'start-stream',
  payload: { text: extractedText } // or { imageBase64, mimeType }
});
```

### Service Worker side
```typescript
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'llm-stream') return;

  port.onMessage.addListener(async (msg) => {
    if (msg.type !== 'start-stream') return;

    try {
      const key = await getStoredKey();
      const stream = await callGeminiStream(key, msg.payload);

      for await (const chunk of stream) {
        port.postMessage({ chunk: chunk.text() });
      }
      port.postMessage({ done: true });
    } catch (err) {
      port.postMessage({ error: err.message });
    }
  });
});
```

**Why not sendMessage with callbacks:** No native streaming support. Would require chunking manually with multiple sendMessage calls — more complex, more error-prone.

## Service Worker Lifecycle & Streaming

### The Problem
MV3 service workers are ephemeral. Chrome terminates them after ~30 seconds of inactivity. If the SW is killed mid-stream, the port closes and streaming stops.

### Why This Is Less Dangerous Than It Sounds
- The SW stays alive as long as there is an active port connection
- `chrome.runtime.connect()` keeps the SW alive for the duration of the connection
- The SW will NOT sleep while the port is open and messages are flowing
- Risk: if the user dismisses the panel early and the content script disconnects, the port closes → SW may sleep (acceptable — stream is cancelled)

### Mitigation
- Keep the port open until `{ done: true }` or `{ error: ... }` is sent
- Content script should only disconnect the port on explicit cancel or completion
- For streams longer than ~5 minutes (unlikely for this use case), a keepalive ping may be needed — not required for typical selections

### SW Wakeup
The SW will be woken by `chrome.runtime.onConnect` automatically when the content script calls `chrome.runtime.connect()`. No manual wakeup needed.

## OffscreenCanvas / Offscreen Document

### OffscreenCanvas (Available in SW ✓)
```typescript
// In service worker — this works:
const canvas = new OffscreenCanvas(width, height);
const ctx = canvas.getContext('2d');
const img = await createImageBitmap(blob);
ctx.drawImage(img, -cropX, -cropY);
const croppedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
```

**Flow for VLM path:**
1. SW receives `{ coords: { x, y, w, h } }` from content script
2. SW calls `chrome.tabs.captureVisibleTab()` → gets full viewport as dataURL
3. SW converts dataURL → Blob → `createImageBitmap(blob)`
4. SW creates `OffscreenCanvas(w, h)`, draws cropped region
5. SW calls `canvas.convertToBlob()` → Blob
6. SW converts Blob → base64 → sends to Gemini Vision

### Offscreen Document (NOT needed for this project)
`chrome.offscreen` is only needed when you require DOM APIs (like `DOMParser`, `AudioContext`) in the background. Since we only need canvas operations, plain `OffscreenCanvas` in the SW suffices.

## captureVisibleTab Requirements

### Permissions needed in manifest.json
```json
{
  "permissions": ["activeTab", "storage"],
  "commands": {
    "_execute_action": { ... }
  }
}
```

**`"activeTab"` is sufficient** — it grants `captureVisibleTab` access to the currently active tab when triggered by a user gesture (keyboard shortcut qualifies as a user gesture in MV3).

**You do NOT need `"tabs"` permission or host permissions** for `captureVisibleTab` with `activeTab`.

### Edge cases where captureVisibleTab fails
- `chrome://` URLs (Chrome internal pages)
- `chrome-extension://` pages
- PDF viewer (`chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/...`)
- New Tab page in some configurations
- `file://` URLs unless `"Allow access to file URLs"` is enabled in extension settings

**Mitigation:** Wrap in try/catch, show graceful error: "Cannot capture this type of page."

## Top Layer Injection

### dialog.showModal() from content script
```typescript
const dialog = document.createElement('dialog');
dialog.innerHTML = `<div id="rb-panel">...</div>`;
document.body.appendChild(dialog);
dialog.showModal();
```

This works from content scripts. The dialog is part of the host page's DOM but renders in the Top Layer, above all other elements.

### Host page CSP and Top Layer
- The host page's CSP does NOT block `dialog.showModal()` — it's a DOM API call, not a resource load
- The host page's CSS does NOT affect Top Layer elements' stacking
- However, host page CSS **can** style elements within the dialog if they match selectors
- **Mitigation:** Use Shadow DOM inside the dialog for style isolation:
  ```typescript
  const dialog = document.createElement('dialog');
  const shadow = dialog.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>/* scoped styles */</style><div>...</div>`;
  ```

### popover API vs dialog
Both are Top Layer. Differences:
- `dialog.showModal()`: creates a backdrop, traps focus, blocks interaction with rest of page
- `popover="manual"`: no backdrop, no focus trap, rest of page remains interactive

**Recommendation:** Use `dialog.showModal()` for the result panel (focus trap is good UX while reading results). Use a simple `div` with `popover="manual"` for the rubber-band selection warning overlay (non-blocking).

## Recommended Build Order

Dependencies flow in this order:

```
1. Manifest + project scaffold (Vite + CRXJS + TypeScript)
   └── Required before anything else can load

2. Popup (API key entry + chrome.storage.local)
   └── Required before any LLM call can succeed

3. Content Script: keyboard activation + canvas overlay + mouse capture
   └── Required before selection data exists

4. AABB math + TreeWalker extraction (pure logic)
   └── Can be developed and tested in isolation

5. chrome.runtime.connect port setup (CS ↔ SW)
   └── Required before SW can receive data

6. Service Worker: key retrieval + Gemini text streaming
   └── Fast path end-to-end

7. Top Layer dialog + streaming render
   └── Fast path complete (Phase 1 done)

8. SW: captureVisibleTab + OffscreenCanvas crop
   └── VLM path infrastructure

9. Routing heuristic + VLM integration
   └── VLM path complete (Phase 2 done)

10. Optimistic UI, size warnings, polish
    └── Phase 3
```

## Summary

- **Streaming**: `chrome.runtime.connect()` ports — SW stays alive while port is open
- **OffscreenCanvas**: Available directly in SW — no `chrome.offscreen` API needed
- **captureVisibleTab**: `"activeTab"` permission sufficient — keyboard shortcut = user gesture
- **Top Layer**: `dialog.showModal()` from content script works — use Shadow DOM for style isolation
- **SW lifecycle**: Port connection prevents sleep — safe for typical streaming durations
- **Build order**: Popup → CS activation → AABB/TreeWalker → port setup → SW streaming → dialog render → VLM path
