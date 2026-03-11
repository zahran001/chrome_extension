# Supermemory "Remember" Button — Feature Plan

## Overview

Add an opt-in **"Remember"** button to the result panel. When clicked, the current
selection text and AI response are persisted to [Supermemory](https://supermemory.ai)
via their REST API. This is the only persistent action the user takes — everything else
stays ephemeral, matching the extension's existing design philosophy.

No memory is written automatically. No data leaves to Supermemory unless the user
explicitly clicks Remember.

---

## User Flow

```
User selects text on page
  → Alt+S → rubber-band → Analyze
    → Panel shows loading skeleton
    → AI response streams in
    → Panel reaches "done" state

  Panel footer (done state):
  ┌──────────────────────────────────────────────┐
  │  [Copy]          [Bookmark ☆]                │
  └──────────────────────────────────────────────┘

  User clicks "Bookmark ☆"
    → Button shows spinner: "Saving…"
    → POST /v3/documents to api.supermemory.ai
    → On success: button → "Bookmarked ✓" (green, disabled)
    → On failure: button → "Failed — retry?" (red, re-enabled)
```

The button only appears in `done` state, not during loading, error, or scratchpad modes.
A stream that is interrupted mid-way (panel closed early) also has no Remember button —
partial responses aren't worth persisting.

---

## What Gets Stored

Each Supermemory document contains:

```json
{
  "content": "<selected text>\n\n---\n\n<full AI response>",
  "metadata": {
    "source": "rubber-band-ai",
    "url": "<tab URL at time of selection>",
    "title": "<tab title at time of selection>",
    "savedAt": "<ISO 8601 timestamp>",
    "model": "gpt-4o-mini"
  }
}
```

**Why merge selected text + response into one document:**
Supermemory's embedding pipeline treats one document as one semantic unit. Keeping them
together means a future search for "eminent domain" returns both the original question
context and the AI's explanation, rather than two disconnected fragments.

**containerTag:** Set to `window.location.hostname` (e.g. `en.wikipedia.org`). Enables
future site-scoped search (Idea 3 / Phase 2) without re-tagging existing memories.
Passed from content script alongside `pageUrl` and `pageTitle`.

---

## Architecture

### New files

```
src/
  storage/
    supermemory.ts        ← Supermemory API client (POST /v3/documents)
  storage/
    supermemory-keys.ts   ← get/save/clear/has for Supermemory API key
                            (mirrors existing keys.ts for OpenAI)
```

### Modified files

```
src/
  service-worker.ts       ← Add 'check-supermemory-key' and 'remember' message handlers
  ui/panel.ts             ← Add Remember button in showDone(); new 'remember' panel mode
  ui/panel.css            ← .remember-btn styles
  src/popup.html          ← Second API key input field for Supermemory key
  src/popup.ts            ← Save/load/clear Supermemory key
manifest.json             ← Add api.supermemory.ai to connect-src CSP
```

---

## Implementation Details

### 1. `src/storage/supermemory-keys.ts`

Mirrors the existing [keys.ts](../src/storage/keys.ts) pattern exactly:

```ts
const SM_KEY = 'supermemoryApiKey';

export async function getSupermemoryKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(SM_KEY);
  return result[SM_KEY] ?? null;
}

export async function saveSupermemoryKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [SM_KEY]: key });
}

export async function clearSupermemoryKey(): Promise<void> {
  await chrome.storage.local.remove(SM_KEY);
}

export async function hasSupermemoryKey(): Promise<boolean> {
  const key = await getSupermemoryKey();
  return key !== null && key.trim().length > 0;
}
```

### 2. `src/storage/supermemory.ts`

Single function. Called from the service worker only (content script has CSP restrictions
on arbitrary `fetch` to external hosts — must go through SW, same as OpenAI).

```ts
export interface RememberPayload {
  selectedText: string;
  aiResponse: string;
  url: string;
  title: string;
  containerTag: string;  // window.location.hostname — for future site-scoped search
}

export async function rememberDocument(
  apiKey: string,
  payload: RememberPayload
): Promise<void> {
  const content = `${payload.selectedText}\n\n---\n\n${payload.aiResponse}`;

  const response = await fetch('https://api.supermemory.ai/v3/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      content,
      containerTag: payload.containerTag,
      metadata: {
        source: 'rubber-band-ai',
        url: payload.url,
        title: payload.title,
        savedAt: new Date().toISOString(),
        model: 'gpt-4o-mini',
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supermemory ${response.status}: ${body}`);
  }
}
```

**Why service worker, not content script:**
The extension's manifest `connect-src` currently allows only `api.openai.com`. Adding
`api.supermemory.ai` to the CSP is necessary regardless, but all privileged external
`fetch` calls should stay in the service worker to maintain the established security
boundary. Content scripts run in the page context and are exposed to more attack surface.

### 3. `src/service-worker.ts` — new message handlers

Two new message types handled in the existing `onMessage` listener:

```ts
// Check if Supermemory key is configured (for panel to decide whether to show button)
if (message.type === 'check-supermemory-key') {
  hasSupermemoryKey().then(result => sendResponse(result));
  return true;
}

// Store a selection+response pair in Supermemory
if (message.type === 'remember') {
  const key = await getSupermemoryKey();
  if (!key) { sendResponse({ ok: false, error: 'no-key' }); return; }

  rememberDocument(key, {
    selectedText: message.selectedText,
    aiResponse: message.aiResponse,
    url: message.url,
    title: message.title,
    containerTag: message.containerTag,
  })
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true; // async
}
```

### 4. `src/ui/panel.ts` — Remember button in `showDone()`

The panel's `showDone()` method currently renders the Copy button and the retry input
section. After the Copy button, append the Remember button:

```ts
private showDone(): void {
  // ... existing Copy button code ...

  const rememberBtn = document.createElement('button');
  rememberBtn.className = 'remember-btn';
  rememberBtn.textContent = 'Bookmark ☆';
  rememberBtn.setAttribute('aria-label', 'Save this result to Supermemory');

  rememberBtn.addEventListener('click', async () => {
    rememberBtn.disabled = true;
    rememberBtn.textContent = 'Saving…';

    const response = await chrome.runtime.sendMessage({
      type: 'remember',
      selectedText: this.selectedText,   // set from PanelOptions.selectedText
      aiResponse: this.accumulatedText,
      url: this.pageUrl,                 // set from PanelOptions.pageUrl
      title: this.pageTitle,             // set from PanelOptions.pageTitle
      containerTag: this.containerTag,   // set from PanelOptions.containerTag (hostname)
    }).catch(() => ({ ok: false, error: 'Message failed' }));

    if (response?.ok) {
      rememberBtn.textContent = 'Bookmarked ✓';
      rememberBtn.classList.add('remembered');
    } else {
      rememberBtn.textContent = 'Failed — retry?';
      rememberBtn.classList.add('remember-error');
      rememberBtn.disabled = false;
    }
  });

  actions.appendChild(rememberBtn);
}
```

**New fields on `StreamPanel`:**

```ts
private selectedText = '';   // from PanelOptions.selectedText (the extracted DOM text)
private pageUrl = '';        // from PanelOptions.pageUrl (window.location.href in content script)
private pageTitle = '';      // from PanelOptions.pageTitle (document.title in content script)
private containerTag = '';   // from PanelOptions.containerTag (new URL(pageUrl).hostname)
```

All four are passed from `content-script.ts` as part of `PanelOptions` — same pattern
as `initialText` for scratchpad mode. The content script captures them synchronously
at selection time, so SPA navigations after selection don't affect accuracy.

```ts
// content-script.ts — in analyzeText() / setOnConfirm callback
const panel = showPanel({
  mode: 'loading',
  selectedText: extractedText,
  pageUrl: window.location.href,
  pageTitle: document.title,
  containerTag: window.location.hostname,
  onRetry: ...
});
```

**Conditional rendering:** Before adding the Bookmark button, check whether the
Supermemory key is configured:

```ts
const hasKey = await chrome.runtime.sendMessage({ type: 'check-supermemory-key' });
if (hasKey) { /* append button */ }
```

If no key is set, the button is simply absent. No error, no noise.

If no-key state is hit despite the button being shown (race condition: key deleted
between panel open and button click), the SW returns `{ ok: false, error: 'no-key' }`
and the button transitions to "Failed — retry?". Clicking retry opens the popup via
`chrome.runtime.sendMessage({ type: 'open-popup' })` — same pattern as the OpenAI
key setup flow.

### 5. `src/ui/panel.css` — button styles

```css
/* Remember button */
.remember-btn {
  background: #f5f5f5;
  border: 1px solid #d0d0d0;
  color: #333;
  padding: 7px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.remember-btn:hover:not(:disabled) { background: #ebebeb; }
.remember-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.remember-btn.remembered {
  color: #2e7d32;
  border-color: #4CAF50;
}

.remember-btn.remember-error {
  color: #c62828;
  border-color: #c62828;
}
```

### 6. `manifest.json` — CSP update

Add `https://api.supermemory.ai` to `connect-src`:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src https://api.openai.com https://api.supermemory.ai"
}
```

### 7. Popup — second API key field

The popup needs a second input for the Supermemory key. It should be visually separated
and clearly labelled as optional (the extension works without it):

```
┌─────────────────────────────────────────┐
│ Rubber-Band AI                          │
│                                         │
│ OpenAI API Key                          │
│ ┌─────────────────────────────────────┐ │
│ │ sk-...                         [✕] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Supermemory API Key  (optional)         │
│ ┌─────────────────────────────────────┐ │
│ │ sm-...                         [✕] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ No Supermemory key? Get one free at     │
│ supermemory.ai — enables "Bookmark ☆"  │
└─────────────────────────────────────────┘
```

---

## Data Flow (complete)

```
Content Script                        Service Worker          Supermemory API
──────────────────────────────────    ──────────────────────  ───────────────
Alt+S → rubber-band → Analyze
Capture at selection time:
  selectedText = extractedText
  pageUrl      = window.location.href
  pageTitle    = document.title
  containerTag = window.location.hostname

showPanel({ mode:'loading',
  selectedText, pageUrl,
  pageTitle, containerTag })

port.postMessage(             →
  { type:'generate', text })

                              ← token / done / error (existing streaming)

Panel reaches done state
check-supermemory-key         →  hasSupermemoryKey()
                              ← true → show Bookmark ☆ button

user clicks "Bookmark ☆"
sendMessage('remember',       →  getSupermemoryKey()
  { selectedText,                rememberDocument(    → POST /v3/documents
    aiResponse,                    { ...payload,         (with containerTag)
    url, title,                      containerTag })  ← 200 OK / error
    containerTag })
                              ← { ok: true }

button → "Bookmarked ✓"
```

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| No Supermemory key set | Button absent from panel — no error shown |
| Supermemory key invalid (401) | Button shows "Failed — retry?" with key in red; user can fix key in popup and retry |
| Network offline | Same failed state |
| User dismisses panel before remembering | Nothing written — ephemeral default preserved |
| User clicks Remember twice quickly | Button is disabled on first click — second click impossible |
| Supermemory API rate limit (429) | Same failed state — message includes status code so user understands the cause |
| AI response still streaming | Button not shown during streaming — only added in `showDone()` |
| Mid-stream panel close (interrupted state) | `showInterrupted()` does not add Remember button — partial response not worth storing |

---

## What This Feature Does NOT Do

- Does not search Supermemory before sending to OpenAI (that is Idea 1 / Phase 2)
- Does not show a history list anywhere (that is Idea 2 / Phase 2)
- Does not write anything automatically (always opt-in)
- Does not add Supermemory key as a hard requirement — extension is fully functional without it

---

## Files Changed Summary

| File | Change Type | Description |
|---|---|---|
| `src/storage/supermemory-keys.ts` | New | CRUD for Supermemory API key in `chrome.storage.local` |
| `src/storage/supermemory.ts` | New | `rememberDocument()` — POST to Supermemory REST API |
| `src/service-worker.ts` | Edit | Add `check-supermemory-key` and `remember` message handlers |
| `src/ui/panel.ts` | Edit | Add `selectedText`, `pageUrl`, `pageTitle` fields; Remember button in `showDone()` |
| `src/ui/panel.css` | Edit | `.remember-btn`, `.remembered`, `.remember-error` styles |
| `src/popup.html` | Edit | Second key input field for Supermemory key |
| `src/popup.ts` | Edit | Save/load/clear Supermemory key via `supermemory-keys.ts` |
| `manifest.json` | Edit | Add `https://api.supermemory.ai` to `connect-src` CSP |

---

## Locked Decisions

| Decision | Rationale |
|---|---|
| Button label: "Bookmark ☆" / "Bookmarked ✓" | Universally understood; distinct from Copy |
| No-key fallback: open popup | Consistent with existing OpenAI key setup pattern (`open-popup` message) |
| containerTag: `window.location.hostname` | One line, zero extra complexity now; enables site-scoped search in Phase 2 without re-tagging existing memories |
| Page metadata threading: Option A (content script → PanelOptions) | Captures URL/title at selection time — accurate on SPAs where `location.href` changes between select and save |
| Opt-in only, no passive writes | Preserves ephemeral default; no GDPR/privacy surprises |
| SW-only fetch to Supermemory | Host-page CSP can block content-script `fetch` to external origins on strict sites; SW context is only subject to extension's own manifest CSP |
| Merge selected text + AI response into one document | Keeps context cohesive for future semantic search; one document = one semantic unit in Supermemory's embedding pipeline |
| No Bookmark button during streaming, error, or interrupted states | Partial/failed responses aren't worth persisting |
| Two separate API key fields in popup | OpenAI key is required; Supermemory key is optional — must be visually distinct |

---
*Plan written: 2026-03-10*
