# Scoop

Select any text on screen → get an instant AI answer. No copy-pasting, no tab-switching, no screenshots.

## What it does

Hold **Alt+S**, drag to rubber-band select text on any webpage (MCQ options, a paragraph you don't understand, a question from a problem set), release — and a floating panel appears with the answer. Works on anything visible: lecture slides in a browser, PDFs, practice quiz pages, whatever.

The panel floats above the page (Top Layer), so it doesn't disrupt what you're reading. Close it when done.

## Setup

1. Load the extension unpacked from `dist/` in `chrome://extensions`
2. Click the extension icon → paste your OpenAI API key → Save
3. Optionally add a [Supermemory](https://supermemory.ai) key to bookmark answers

That's it. No account, no backend, no data leaving your machine except the OpenAI API call.

## Usage

| Action | What happens |
|--------|-------------|
| Hold **Alt+S** + drag | Rubber-band selects text on the page |
| Release | Sends selected text to OpenAI, streams response into panel |
| Click **✎ Edit text** | Edit extracted text in scratchpad before sending |
| Click **Bookmark ★** | Saves answer to Supermemory (requires SM key) |
| Enter text in Retry box | Sends a follow-up question with original context |
| Press **Esc** or click X | Closes panel |

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User  ──Alt+S──▶  Content Script  ──port──▶  Service Worker           |
│                         │                          │                    │
│                         │                          ▼                    │
│                         │                    OpenAI API                 │
│                         │                   (gpt-4o-mini)               │
│                         │                          │                    │
│                         │          token stream (port.postMessage)      │
│                         │                          │                    │
│                         ▼                          │                    │
│                   Top Layer Panel  ◀───────────────┘                   ||
│              (dialog.showModal + Shadow DOM)                            │
└─────────────────────────────────────────────────────────────────────────┘
```

The extension has three isolated components that communicate via Chrome messaging APIs:

---

### Component Map

```
src/
├── manifest.json              MV3 manifest — permissions, CSP, commands
├── content-script.ts          Selection UI, extraction, port relay
├── service-worker.ts          OpenAI streaming, message routing
├── popup.html / popup.ts      Settings UI for API keys
│
├── extraction/
│   ├── tree-walker.ts         DOM traversal + shadow-root piercing + AABB
│   ├── visibility.ts          display/visibility/opacity checks
│   └── aabb.ts                Rectangle intersection math
│
├── llm/
│   ├── openai.ts              OpenAI client init (gpt-4o-mini)
│   ├── streaming.ts           Port-based stream → per-token dispatch
│   └── prompts.ts             Auto-intent system prompt
│
├── ui/
│   ├── selection-renderer.ts  SVG marching-ants overlay + confirm buttons
│   ├── panel.ts               Top Layer dialog with Shadow DOM
│   └── panel.css              Shadow-isolated styles (?inline import)
│
└── storage/
    ├── keys.ts                OpenAI key (chrome.storage.local, plaintext)
    ├── supermemory-keys.ts    Supermemory key storage
    └── supermemory.ts         POST to supermemory.ai/v3/documents
```

---

### Component Details

#### Content Script (`content-script.ts`)
Runs in every page context. Unprivileged — cannot call OpenAI directly due to CSP.

```
Alt+S keydown
    │
    ▼
activateSelectionMode()
    ├─ Custom crosshair cursor
    ├─ mousedown → startDrag() → create SVG overlay
    ├─ mousemove → updateDrag() → animate marching-ants rect
    └─ mouseup → endDrag() → show [Analyze] [✎ Edit text] buttons
                                      │              │
                          ┌───────────┘              └─────────────┐
                          ▼                                        ▼
              extractVisibleText()                     showPanel({ mode: 'scratchpad' })
              (TreeWalker + AABB)                      user edits text, then Analyze
                          │
                          ▼
              analyzeText(text, url, title, tag)
                          │
                          ├─ sendMessage('check-api-key') ──▶ SW
                          ├─ showPanel({ mode: 'loading' })
                          └─ connect({ name: 'llm-stream' }) ──▶ SW
                             port.postMessage({ type: 'generate', text })
```

Streams are received from the service worker as port messages and forwarded to the panel via DOM `CustomEvent` (`rba-token`, `rba-done`, `rba-error`).

Cleanup uses `AbortController` on three levels: mode activation, per-drag, and per-port — ensuring `pointer-events` and `overflow` are restored in every exit path.

---

#### Service Worker (`service-worker.ts`)
Privileged background process. Handles all OpenAI calls (CSP allows `api.openai.com`).

```
chrome.commands.onCommand ('activate-selection')
    └─ sendMessage to active tab → content script activates

chrome.runtime.onConnect ('llm-stream')
    └─ streamToPort(port, message)
           │
           ├─ 1. Wire port.onDisconnect FIRST (before async loop)
           ├─ 2. Create OpenAI client from stored key
           ├─ 3. buildPrompt(text, retryContext)
           ├─ 4. client.chat.completions.create({ stream: true })
           └─ 5. For each chunk:
                  port.postMessage({ type: 'token', text })
                  ──▶ content script dispatches rba-token CustomEvent
                  ──▶ panel.appendToken(token)
              On finish: port.postMessage({ type: 'done' })
              On error:  classifyError → humanize → port.postMessage({ type: 'error' })

chrome.runtime.onMessage
    ├─ 'check-api-key'     → returns boolean
    ├─ 'open-popup'        → opens settings tab
    ├─ 'check-supermemory-key' → returns boolean
    └─ 'remember'          → POST to supermemory.ai
```

The service worker stays alive only while a port is open. The port must remain open from `generate` until `done` or `error` — closing it early causes the SW to sleep and aborts the stream.

---

#### Top Layer Panel (`ui/panel.ts`)
A `<dialog>` with `showModal()` injected into the page's Top Layer — sits above all page content, immune to z-index and `overflow: hidden` clipping.

```
showPanel({ mode, ... })
    │
    └─ Create <dialog> → dialog.showModal() → Top Layer
       └─ Shadow Root (all styles isolated)
              │
              ├─ [loading]     skeleton shimmer placeholders
              ├─ [setup]       "Add your OpenAI API key" first-run
              ├─ [scratchpad]  textarea + char count (warn 15k, error 20k)
              ├─ [streaming]   responseEl.textContent += token (XSS-safe)
              │                blinking cursor animation
              └─ [done]        [Copy] [Bookmark ★] [Retry input]
                 [error]       error message + optional [Open Settings]

Draggable header: resolves CSS transform → absolute position → clamps to viewport
Dismiss: Escape (capture phase) or X button → dispatch rba-dismiss → port.disconnect()
```

Shadow DOM CSS is loaded via Vite `?inline` import + `adoptedStyleSheets`. Standard `<style>` tags and CSS imports do not cross the Shadow Root boundary.

---

### Full End-to-End Data Flow

```
User drags selection rectangle on page
         │
         ▼
extractVisibleText(documentElement, selectionRect)
  ┌──────────────────────────────────────────┐
  │  TreeWalker traverses all DOM nodes      │
  │  + pierces shadow roots recursively      │
  │  For each TEXT_NODE:                     │
  │    1. isVisible(parent)        fast      │
  │    2. rect.width/height > 0    fast      │
  │    3. rectsIntersect(AABB)     medium    │
  │  Block-level tags → "\n" separator       │
  │  Inline elements  → " " separator        │
  └──────────────────────────────────────────┘
         │  plain text string (max 20k chars)
         ▼
chrome.runtime.connect({ name: 'llm-stream' })
         │
         ▼  Service Worker
buildPrompt(text, retryContext?)
  system: auto-intent detection (explain / summarize / solve / describe)
  user:   extracted text [+ "Additional context: {retryContext}"]
         │
         ▼
OpenAI API  POST /v1/chat/completions  stream=true  model=gpt-4o-mini
         │
         │  Server-sent event chunks
         ▼
port.postMessage({ type: 'token', text: chunk })
         │
         ▼  Content Script
document.dispatchEvent(new CustomEvent('rba-token', { detail: chunk }))
         │
         ▼  Panel (Shadow DOM)
responseEl.textContent += chunk      ← textContent only, never innerHTML
         │
         ▼  (on done)
Show [Copy] [Bookmark ★] [Retry] buttons
```

---

### Key Design Decisions

| Decision | Reason | Consequence |
|----------|--------|-------------|
| BYOK, OpenAI-only | Zero infrastructure, instant setup | Key stored plaintext in `chrome.storage.local` — acceptable |
| Port-based streaming | `sendMessage` won't work — SW sleeps after 30s; ports keep it alive 5 min | Must wire `port.onDisconnect` before async loop |
| `dialog.showModal()` Top Layer | Beats all page z-index, unaffected by `overflow: hidden` | Cannot use `position: fixed` fallback |
| `adoptedStyleSheets` for Shadow DOM | Only reliable way to inject CSS into Shadow Root | Vite `?inline` import required |
| `textContent` only for LLM output | LLM can reproduce user-selected malicious HTML | `innerHTML` is forbidden for response rendering |
| DOM text only (Phase 1) | Fast TreeWalker path, MVP speed | Canvas/SVG/PDF pages silently fail (Phase 2: VLM fallback) |
| Ephemeral results | Privacy-first, no storage risk | Panel close = result gone, by design |
| Auto-intent system prompt | Removes UX friction | AI infers explain/summarize/solve/describe from content |

---

### Security Invariants

- **XSS**: `textContent` only for all LLM output. `innerHTML` is never used on streamed content.
- **CSP**: OpenAI calls routed through service worker — content scripts cannot call `api.openai.com` directly.
- **API key**: Stored in `chrome.storage.local` (local device only, no sync). Never sent anywhere except OpenAI and Supermemory.
- **No telemetry**: Zero analytics, no external calls beyond the two optional APIs.

---

## Dev

```bash
npm install
npm run build       # Vite + CRXJS → dist/
npm run test:unit   # Vitest + JSDOM
npm run test:e2e    # Playwright headful Chrome
npx tsc --noEmit    # Type-check only
```

Load `dist/` as an unpacked extension in `chrome://extensions`.

Streaming E2E tests are marked `test.fixme` when no API key is present — expected, not broken.
