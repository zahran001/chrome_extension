# Phase 1: Core MVP - Research

**Researched:** 2026-02-23
**Domain:** Chrome Extension MV3, DOM selection UI, LLM streaming, Top Layer dialog rendering
**Confidence:** HIGH

## Summary

Phase 1 is a complete, isolated MVP requiring five technical domains: Chrome Extension MV3 foundations (service workers, messaging, storage), DOM interaction (canvas-based rubber-band selection UI, TreeWalker-based text extraction), LLM integration (Gemini API streaming), modern DOM rendering (Top Layer API with Shadow DOM), and comprehensive testing (Vitest + Playwright). The architecture is well-established and stable. All technologies are mature, widely documented, and have active ecosystem support. The primary implementation challenge is coordinating event cleanup (canvas teardown, pointer state restoration) to prevent page freeze and careful DOM visibility filtering to extract only visible text. The architecture deliberately sidesteps alternatives (no custom OCR, no backend state, BYOK eliminates API account complexity).

**Primary recommendation:** Use CRXJS v2 + Vite + TypeScript for build tooling; Gemini API (@google/generative-ai) for streaming; native Chrome APIs (storage.local, runtime.connect, Top Layer dialog) for core features; Vitest + JSDOM for unit tests; Playwright for E2E tests covering service worker lifecycle and Top Layer injection.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Selection UI behavior:**
- Release mouse ends drag → confirm button appears just outside bottom-right corner
- Confirm button submits to Gemini
- Escape cancels at any point (mid-drag or after release, before confirm)
- Rubber-band visual: semi-transparent fill (~20% opacity) with animated dashed border (marching ants style)

**Results panel presentation:**
- Panel appears fixed at center of viewport (regardless of selection position)
- AI response streams word-by-word with blinking cursor at insertion point
- Dismissed via Escape OR visible close button (X)
- Panel is ephemeral: close = gone, no persistence
- Available actions: Copy button, Retry with custom prompt (text input field below response, user types context, submits with Enter or Send button to re-run against same selection)

**First-run & key setup flow:**
- First activation with no API key: selection mode activates normally, then when user confirms, panel shows setup prompt with button to open settings
- Settings popup UX: API key field with masked input (eye icon toggle to reveal), "Test key" button (makes validation call to Gemini, shows 'Key valid ✓' or specific error), On save: inline success state (field turns green + "Key saved" message, no auto-close)

**Error UX:**
- All errors surface inside results panel, replacing streaming area
- Format: human-readable summary + actionable suggestion (e.g. "API key invalid — check your key in settings")
- Errors include clickable action buttons where applicable (e.g. "Open Settings" button for key errors)
- Mid-stream connection failure: preserve partial response, append error notice ("Stream interrupted — partial response shown")
- No raw API error codes shown to users
- `port.onDisconnect` (SW killed by Chrome) must be explicitly wired to mid-stream failure path, not left unhandled

**Implementation Constraints:**
- **Shadow DOM CSS:** Use `import styles from './panel.css?inline'` (Vite inline import) + `shadowRoot.adoptedStyleSheets = [sheet]` via `CSSStyleSheet`. Standard CSS imports do not reach inside Shadow Root — this pattern is REQUIRED, not optional.
- **TreeWalker filter:** In addition to skipping `display:none` and zero-opacity nodes, add zero-dimension fast-fail during AABB pass: `if (rect.width === 0 || rect.height === 0) return NodeFilter.FILTER_REJECT`. Cheap and catches geometrically-empty nodes without extra style computation.
- **XSS — hard constraint:** Phase 1 MUST use `textContent` exclusively when rendering streamed Gemini output. `innerHTML` is prohibited anywhere in Phase 1. (Forward note for planner: Phase 2 Markdown rendering must be gated on DOMPurify or equivalent sanitizer before any HTML injection.)

### Claude's Discretion

- Exact color/accent for the rubber-band selection box (must work on light and dark pages)
- Panel width and max-height, internal padding and typography
- Exact copy for AI-generated prompts (how intent is inferred from selected content)
- Loading/thinking state while waiting for first token to arrive
- Specific test coverage patterns and test file organization

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEL-01 | User can activate rubber-band selection mode via keyboard shortcut (Alt+S default) | Canvas event handlers (mousedown/mousemove/mouseup), AbortController for cleanup |
| SEL-02 | Cursor changes to crosshair when selection mode is active | CSS cursor property, pointer-events manipulation |
| SEL-03 | User sees real-time rubber-band rectangle while dragging | Canvas 2D context drawing, marching ants animation via CSS border-image or SVG stroke-dashoffset |
| SEL-04 | Scrolling disabled during drag (viewport-locked selection) | overflow: hidden on document.body, pointer-events: none, AbortController signal |
| SEL-06 | User can cancel selection at any time by pressing Escape | keydown event listener, cleanup handler to restore pointer-events and scroll |
| EXT-01 | Extension uses TreeWalker to extract visible DOM text nodes within selection bounds (fast path) | TreeWalker + NodeFilter.SHOW_TEXT + custom acceptNode filter |
| EXT-02 | AABB collision test determines which text nodes fall within selection rectangle | getBoundingClientRect() + axis-aligned bounding box math (rect.left < x && x < rect.right && rect.top < y && y < rect.bottom) |
| EXT-03 | Visibility filter skips `display:none`, `visibility:hidden`, zero-opacity nodes | getComputedStyle() checks, zero-dimension fast-fail (width === 0 \|\| height === 0) |
| LLM-01 | Extension sends extracted content to Gemini API and streams response token-by-token | @google/generative-ai SDK, fetch with ReadableStream body reader, or native SDK streaming |
| LLM-02 | AI auto-detects intent from content (explain / summarize / solve) — no user mode selection | Gemini system prompt engineering |
| LLM-03 | Streaming uses `chrome.runtime.connect()` long-lived port between service worker and content script | chrome.runtime.connect() with named port, chrome.runtime.onConnect listener in SW |
| LLM-04 | Service worker stays alive during streaming via open port connection (5-minute window) | Open ports prevent SW suspension per MV3 spec |
| PNL-01 | Result panel renders as Top Layer `<dialog>` with Shadow DOM style isolation | HTMLDialogElement.showModal(), attachShadow({ mode: 'open' }), adoptedStyleSheets pattern |
| PNL-02 | Panel displays loading skeleton within 500ms of selection confirmation | Immediate dialog injection + CSS skeleton loader animation |
| PNL-03 | AI response streams word-by-word into panel in real time | textContent += chunk pattern inside Shadow DOM, blinking cursor via CSS animation |
| PNL-04 | User can copy full response to clipboard via copy button | navigator.clipboard.writeText() |
| PNL-05 | User can close panel by pressing Escape or clicking close button | dialog.close(), Escape key handler |
| PNL-06 | Panel shows distinct, actionable error states (invalid key / rate limited / network / restricted) | Conditional rendering based on error type, error.message inspection |
| KEY-01 | User can enter Gemini API key via extension popup | chrome.storage.local.set() / .get(), popup UI form input |
| KEY-02 | API key persisted in `chrome.storage.local` | chrome.storage.local.set({ geminiKey: "..." }) |
| KEY-03 | User can toggle key visibility (show/hide) in popup | type="password" vs type="text" toggle, eye icon button |
| KEY-04 | On first activation with no key stored, extension auto-opens popup | chrome.runtime.openOptionsPage() or window.open(chrome.runtime.getURL('/popup.html')) from content script via chrome.runtime.sendMessage() |
| TST-01 | Vitest unit tests cover AABB collision math with edge cases | Test library: Vitest (native ESM, TypeScript support, fast) |
| TST-02 | Vitest + JSDOM integration tests cover TreeWalker visible text extraction | JSDOM for DOM simulation, getComputedStyle mocking, test fixtures |
| TST-03 | Playwright E2E tests cover service worker wakeup and chrome.runtime port lifecycle | Playwright headful Chrome, extension loading, port message flow verification |
| TST-04 | Playwright E2E tests cover Top Layer dialog injection on static local HTML page | Static test page, dialog.showModal() verification, Shadow DOM style application |

---

## Standard Stack

### Core Build & Runtime

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 3-8 | Fast, modern bundler with ESM-native development | Official CRXJS recommendation, zero-config with plugin, HMR support for extension development |
| @crxjs/vite-plugin | 2.3.0 | Chrome Extension manifest-first build plugin | MV3-first design, handles web_accessible_resources, service worker bundling, content script injection |
| TypeScript | 5.x | Static typing and developer experience | Phase constraints require type safety; @types/chrome provides MV3 API definitions |
| Chrome MV3 APIs | Native | Service workers, messaging, storage, permissions | Foundation of extension architecture; no polyfills needed |

### DOM & UI

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| HTMLDialogElement (native) | — | Top Layer modal dialog rendering | Phase 1 locked decision; works in all modern Chrome versions |
| Shadow DOM (native Web Components API) | — | CSS isolation for result panel | Phase 1 requirement; prevents host page CSS bleed; adoptedStyleSheets pattern for stylesheet sharing |
| Canvas 2D Context (native) | — | Rubber-band selection rectangle drawing | Fast, real-time visual feedback; supports marching ants animation |
| Fetch Streams API (native) | — | Token-by-token response streaming | Built-in ReadableStream support; used by @google/generative-ai SDK |

### LLM Integration

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @google/generative-ai | 1.42.0+ | Gemini API client with streaming support | Official Google SDK; handles token streaming, supports vision in Phase 2 |
| chrome.runtime.connect() (native) | — | Long-lived message port for service worker ↔ content script | MV3 requirement for streaming; keeps SW alive 5 minutes |

### Testing

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | Latest | Unit + integration tests (AABB math, TreeWalker extraction) | Fast, ESM-native, JSDOM support, TypeScript native |
| JSDOM | Latest | DOM simulation for unit tests | Lightweight DOM tree for TreeWalker filter testing without browser |
| Playwright | Latest | E2E tests (service worker, port lifecycle, Top Layer injection) | Headful Chrome; required for extension-specific testing (SW lifecycle, ports, permissions) |

### Development & Typing

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/chrome | Latest | TypeScript definitions for Chrome Extension APIs | Required for type safety in service worker, messaging, storage code |
| vite-plugin-web-components (optional) | — | Shadow DOM + Web Components support in Vite | Convenience only; Vite handles CSS inline imports natively |

### Installation

```bash
npm install vite @crxjs/vite-plugin typescript
npm install --save-dev @types/chrome @types/node
npm install @google/generative-ai
npm install --save-dev vitest @vitest/ui jsdom playwright
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CRXJS | Webpack + chrome-extension-webpack-plugin | More configuration overhead; Vite is faster for dev |
| Gemini API (BYOK) | OpenAI / Anthropic APIs | Requires different SDK; same streaming pattern applies; Gemini is simplest for BYOK |
| Shadow DOM | iframed popup (doc note: Phase 2 may include iframed content editor; Phase 1 stays in ShadowRoot) | Harder to coordinate with Top Layer; ShadowRoot is lighter |
| Native Canvas | SVG overlay | Canvas is faster for real-time dragging feedback; SVG is heavier for animation |
| JSDOM in tests | Happy DOM | JSDOM is more complete DOM simulation; Happy DOM is lighter but less realistic |
| Playwright for E2E | Cypress | Playwright is faster, native Chrome ext support via MV3 launch flags |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── manifest.json              # MV3 manifest (entry point for CRXJS)
├── service-worker.ts          # Service worker: Gemini API integration, ports
├── content-script.ts          # Content script: selection UI, extraction, dialog injection
├── popup.html                 # Popup: BYOK settings form
├── popup.ts                   # Popup script: storage read/write
├── ui/
│   ├── selection-renderer.ts  # Canvas drawing, marching ants
│   ├── panel.ts               # Top Layer dialog, Shadow DOM setup
│   ├── panel.css              # Shadow DOM stylesheet (imported as ?inline)
│   └── popup.css              # Popup styling
├── extraction/
│   ├── tree-walker.ts         # TreeWalker with visibility filter
│   ├── aabb.ts                # AABB collision detection
│   └── visibility.ts          # getComputedStyle checks
├── llm/
│   ├── gemini.ts              # @google/generative-ai client setup
│   ├── streaming.ts           # Port-based streaming orchestration
│   └── prompts.ts             # Intent detection system prompt
├── storage/
│   └── keys.ts                # chrome.storage.local wrapper
└── tests/
    ├── aabb.test.ts           # AABB math edge cases
    ├── extraction.test.ts      # TreeWalker + JSDOM fixtures
    ├── service-worker.e2e.ts   # Playwright: port lifecycle
    └── fixtures/
        └── selection-page.html # Static test page
```

### Pattern 1: TreeWalker with Visibility Filter

**What:** Extract all visible text nodes within a selection bounds using TreeWalker + getBoundingClientRect() collision + getComputedStyle() visibility check.

**When to use:** Fast path for text-heavy pages (default Phase 1 behavior); avoids screenshot overhead.

**Example:**

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/TreeWalker
function extractVisibleTextInBounds(
  root: Element,
  selectionRect: DOMRect
): string[] {
  const textChunks: string[] = [];

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node) {
        const textNode = node as Text;
        if (!textNode.textContent?.trim()) return NodeFilter.FILTER_REJECT;

        const parent = textNode.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Visibility check: display:none, visibility:hidden, opacity:0
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return NodeFilter.FILTER_REJECT;
        }

        // AABB collision: rect.width === 0 || rect.height === 0 fast-fail
        const rect = parent.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return NodeFilter.FILTER_REJECT;

        // Axis-aligned bounding box intersection
        if (rect.left <= selectionRect.right &&
            rect.right >= selectionRect.left &&
            rect.top <= selectionRect.bottom &&
            rect.bottom >= selectionRect.top) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );

  let node;
  while (node = walker.nextNode()) {
    textChunks.push((node as Text).textContent!);
  }
  return textChunks;
}
```

### Pattern 2: Long-Lived Port Streaming Between Service Worker & Content Script

**What:** Establish a chrome.runtime.connect() port that stays open while Gemini streams, keeping the service worker alive for up to 5 minutes.

**When to use:** Any LLM streaming from a service worker; essential for MV3 (no persistent background pages).

**Example:**

```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/runtime
// Content script: initiate port
const port = chrome.runtime.connect({ name: 'llm-stream' });
port.onMessage.addListener((msg) => {
  if (msg.type === 'token') {
    resultPanel.appendChild(msg.text); // Append token to Shadow DOM
  } else if (msg.type === 'done' || msg.type === 'error') {
    port.disconnect();
  }
});
port.postMessage({ type: 'extract', text: selectedText });

// Service worker: receive port, stream response
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'llm-stream') {
    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'extract') {
        try {
          const stream = await geminiClient.generateContentStream({
            contents: [{ parts: [{ text: msg.text }] }]
          });
          for await (const chunk of stream.stream) {
            const text = chunk.text();
            port.postMessage({ type: 'token', text });
          }
          port.postMessage({ type: 'done' });
        } catch (err) {
          port.postMessage({ type: 'error', message: err.message });
        }
      }
    });

    port.onDisconnect.addListener(() => {
      // Handle premature disconnect (SW killed by Chrome)
    });
  }
});
```

### Pattern 3: Shadow DOM with adoptedStyleSheets (Vite Inline Import)

**What:** Use Vite's `?inline` import to load CSS as a CSSStyleSheet object, adopt it into Shadow DOM, ensuring styles are isolated and shared across components.

**When to use:** Result panel rendering in Top Layer dialog; prevents host page CSS interference.

**Example:**

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/adoptedStyleSheets
import panelStyles from './panel.css?inline';

function injectResultPanel(geminiResponse: AsyncGenerator<string>) {
  const dialog = document.createElement('dialog');
  dialog.style.position = 'fixed';
  dialog.style.top = '50%';
  dialog.style.left = '50%';
  dialog.style.transform = 'translate(-50%, -50%)';

  const shadow = dialog.attachShadow({ mode: 'open' });

  // Convert CSS string to CSSStyleSheet
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(panelStyles);
  shadow.adoptedStyleSheets = [sheet];

  // Render content
  const responseDiv = document.createElement('div');
  responseDiv.className = 'response-text';
  shadow.appendChild(responseDiv);

  document.body.appendChild(dialog);
  dialog.showModal();

  // Stream tokens
  for await (const chunk of geminiResponse) {
    responseDiv.textContent += chunk;
  }
}
```

### Pattern 4: Marching Ants Animated Border (SVG stroke-dashoffset)

**What:** Use SVG stroke with animated dash-offset to create the "marching ants" selection border effect.

**When to use:** Real-time visual feedback during drag operations; avoids CSS performance pitfalls.

**Example:**

```typescript
// Source: https://css-tricks.com/svg-marching-ants/
function drawRubberBand(startX: number, startY: number, endX: number, endY: number) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'fixed';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100vw';
  svg.style.height = '100vh';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '10000';

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  rect.setAttribute('x', String(x));
  rect.setAttribute('y', String(y));
  rect.setAttribute('width', String(width));
  rect.setAttribute('height', String(height));
  rect.setAttribute('fill', 'rgba(76, 175, 80, 0.2)');
  rect.setAttribute('stroke', '#4CAF50');
  rect.setAttribute('stroke-width', '2');
  rect.setAttribute('stroke-dasharray', '5,5');

  // Animated dash offset for marching effect
  svg.style.animation = 'marching 0.5s linear infinite';
  svg.innerHTML = `
    <style>
      @keyframes marching {
        0% { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: 10; }
      }
    </style>
  `;

  svg.appendChild(rect);
  document.body.appendChild(svg);
  return svg;
}
```

### Pattern 5: Pointer Event Cleanup During Canvas Drag

**What:** Disable page scrolling and pointer-events during selection drag via AbortController signal; restore on drag end or cancel.

**When to use:** Canvas-based UI that overrides default browser behavior; prevents page freeze.

**Example:**

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
function setupSelectionMode() {
  const abortController = new AbortController();

  function startDrag(e: MouseEvent) {
    // Disable scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.pointerEvents = 'none';

    // Listen for drag updates
    document.addEventListener('mousemove', onDragMove, { signal: abortController.signal });
    document.addEventListener('mouseup', endDrag, { signal: abortController.signal });
    document.addEventListener('keydown', onEscape, { signal: abortController.signal });
  }

  function endDrag() {
    // Restore state immediately
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    abortController.abort();
    // Optionally show confirm button
  }

  function onEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      endDrag();
      removeRubberBand();
    }
  }

  document.addEventListener('mousedown', startDrag);
}
```

### Anti-Patterns to Avoid

- **Don't use innerHTML for Gemini response:** XSS risk. Always use `textContent` in Phase 1. Phase 2 must gate HTML injection on DOMPurify.
- **Don't forget port.onDisconnect handler:** Service worker can be killed by Chrome (device sleep, network drop). Silent failure = confusing UX. Wire to error panel.
- **Don't trust display:none alone for visibility:** Also check opacity, visibility, and zero dimensions. TreeWalker's whatToShow doesn't filter visibility — custom acceptNode is required.
- **Don't rely on inline <style> tags in Shadow DOM:** Use adoptedStyleSheets pattern (Vite ?inline import) instead. Inline styles can conflict with parent page resets.
- **Don't forget AbortController cleanup:** Leaving event listeners dangling after selection ends = page freeze. Use AbortSignal to auto-unsubscribe.
- **Don't store API keys in plaintext in storage.local:** No encryption. Phase 1 accepts this risk (BYOK = user's responsibility), but document it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rubber-band selection UI | Custom canvas rendering from scratch | Native Canvas 2D Context API | Browser provides optimized rasterization; custom drawing libraries add unnecessary bundle |
| DOM text extraction with visibility filtering | Custom traversal + manual visibility checks | TreeWalker + getComputedStyle | TreeWalker handles node filtering efficiently; manual tree traversal is error-prone and slower |
| AABB collision math | Custom distance/overlap logic | Standard axis-aligned bounding box math (rect overlap test) | AABB is a solved problem; custom implementations introduce floating-point errors |
| LLM streaming from service worker | Custom fetch loop + manual port management | @google/generative-ai SDK + chrome.runtime.connect | SDK handles token buffering, encoding, and error recovery; home-grown ports leak memory |
| CSS isolation in modal dialog | Manually prefix all selectors, fight z-index | Shadow DOM + Top Layer API | Shadow DOM is designed for this; Top Layer eliminates z-index battles; native browser behavior |
| Animated marching ants border | CSS keyframe gradient magic | SVG stroke-dashoffset animation | SVG stroke animation is standardized, performant, and clearer intent than CSS gradient tricks |
| API key persistence | IndexedDB with encryption wrapper | chrome.storage.local (unencrypted, BYOK model) | Extension storage is designed for app config; BYOK means user accepts plaintext risk; no encryption layer needed for MVP |

**Key insight:** Every custom solution in this list trades off complexity and maintenance burden. The ecosystem solutions are faster, more stable, and battle-tested at scale.

---

## Common Pitfalls

### Pitfall 1: Service Worker Timeout During Streaming

**What goes wrong:** Service worker is killed mid-stream because the content script closes the port prematurely or the port never establishes. The response is cut off, and the user sees "interrupted" state with no way to distinguish from a real network error.

**Why it happens:** MV3 service workers are event-driven and terminate after 30 seconds of idle. An open port extends this to 5 minutes, but misconfigured ports or race conditions can cause premature disconnect. Also, if the content script closes the port before the service worker has finished sending tokens, the SW dies and no further messages arrive.

**How to avoid:**
- Always attach a `port.onDisconnect` listener in the service worker.
- Keep the port open during the entire streaming loop; don't close it from content script until service worker sends `{ type: 'done' }` or `{ type: 'error' }`.
- Log port lifecycle events during development (connect, message count, disconnect reason).

**Warning signs:**
- Responses cut off at random token counts.
- "Connection lost" errors appear sporadically but not consistently.
- Service worker logs show no disconnect event when content script shows an error.

### Pitfall 2: TreeWalker Visibility Filter Incomplete

**What goes wrong:** Extracted text includes invisible nodes (display:none, visibility:hidden, opacity:0), inflating token count or sending gibberish context to Gemini. Alternatively, hidden UI text (tooltips, off-screen menus) gets extracted, confusing the AI.

**Why it happens:** `NodeFilter.SHOW_TEXT` in TreeWalker shows all text nodes; the filter must explicitly check computed styles. Developers often forget to add zero-dimension fast-fail, which causes expensive `getComputedStyle()` calls for every node.

**How to avoid:**
- Always implement a custom `acceptNode()` filter that checks:
  - `display !== 'none'` (via getComputedStyle)
  - `visibility !== 'hidden'`
  - `opacity !== '0'`
  - `rect.width > 0 && rect.height > 0` (fast-fail first, before AABB collision)
- Test the filter against a page with hidden sidebars, tooltips, and off-screen content.

**Warning signs:**
- Extracted text is much longer than visible text on the page.
- AI responses mention content not visible in the selection (tooltips, hidden nav menus).
- Performance drops when extracting from complex pages with many hidden elements.

### Pitfall 3: Shadow DOM CSS Doesn't Apply

**What goes wrong:** The result panel appears with no styling (white background, unstyled text, visible scrollbars). This typically means inline `<style>` tags or external `<link>` tags were used, neither of which penetrate the Shadow Root boundary.

**Why it happens:** Shadow DOM enforces style encapsulation. External stylesheets and inline <style> tags don't cross the boundary. The adoptedStyleSheets pattern is the only reliable way to share styles across Shadow DOM without affecting the host page.

**How to avoid:**
- Use Vite's `?inline` import to load CSS as a string: `import styles from './panel.css?inline'`
- Convert the string to a CSSStyleSheet: `const sheet = new CSSStyleSheet(); sheet.replaceSync(styles);`
- Assign to the shadow root: `shadowRoot.adoptedStyleSheets = [sheet];`
- Test with a page that has aggressive global CSS resets (e.g., Bootstrap, Tailwind).

**Warning signs:**
- Panel renders unstyled when injected into the DOM.
- Styles work in isolation (unit test) but break in E2E.
- Host page resets bleed into the panel (text color changes, fonts reset).

### Pitfall 4: XSS via innerHTML with Gemini Response

**What goes wrong:** The LLM response includes user-controlled content (from a selected webpage). Rendering with `innerHTML` can execute embedded scripts or inject malicious HTML. Phase 1 is especially vulnerable because it's the first place LLM output appears.

**Why it happens:** Developers often assume Gemini's output is safe because it's AI-generated. But the input to Gemini is user-selected text, which can include HTML tags, event handlers, or script tags if the page uses `innerHTML` carelessly. The LLM will dutifully reproduce or summarize this content, re-injecting the risk.

**How to avoid:**
- **Phase 1 hard constraint:** Use `textContent` exclusively, never `innerHTML`.
- Validate this in code review: grep for `innerHTML` in content script and panel rendering code.
- Phase 2 (when Markdown rendering is added) must gate all HTML injection behind DOMPurify sanitization.

**Warning signs:**
- Unexpected scripts execute when a result panel appears.
- Custom fonts, colors, or styles from the LLM output appear in the panel.
- Browser console shows uncaught SyntaxError from injected script tags.

### Pitfall 5: Pointer-Events Remain Disabled After Selection Cancel

**What goes wrong:** User starts a selection, presses Escape to cancel, but the page becomes unclickable (no buttons work, links don't respond). This is because `document.body.style.pointerEvents = 'none'` was set during drag but never restored.

**Why it happens:** Manual event cleanup is easy to forget, especially in error paths. If the drag cancellation code path is different from the normal end-drag path (e.g., pressing Escape vs. releasing mouse), one path might not restore the CSS property.

**How to avoid:**
- Use an AbortController and cleanup function that ALWAYS runs:
  ```typescript
  const abort = new AbortController();
  function cleanup() {
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    abort.abort(); // Also removes all listeners
  }
  // Call cleanup() in mouseup, keydown (Escape), and error paths
  ```
- Test the cancel path: start selection, press Escape, try to click a link. Link should be clickable.

**Warning signs:**
- Page freezes after pressing Escape during a selection drag.
- Cursor is still a crosshair even though selection is canceled.
- User must reload the page to regain interaction.

### Pitfall 6: getBoundingClientRect() Returns Zeros for Hidden Elements

**What goes wrong:** AABB collision test always fails for nodes inside a `display:none` container or off-screen, so visible text at the top level isn't extracted (because an ancestor is hidden, the node's rect is all zeros).

**Why it happens:** `getBoundingClientRect()` returns a DOMRect with all zeros if the element is not rendered (display:none, or parent is hidden). The AABB check `rect.width > 0 && rect.height > 0` fast-fail will skip these nodes entirely, which is correct for display:none, but it also means any node inside a hidden parent is skipped.

**How to avoid:**
- The visibility filter's `getComputedStyle()` check should come first, before getBoundingClientRect(). If display is none, reject immediately.
- Only call getBoundingClientRect() on nodes that passed the visibility filter.
- Test with a page where some content is in collapsed <details>, hidden tabs, or aria-hidden ancestors.

**Warning signs:**
- Text inside collapsible sections is never extracted, even when they're expanded.
- getText() returns partial results; some visible paragraphs are missing.

---

## Code Examples

Verified patterns from official sources:

### TreeWalker Extraction with Visibility Filter

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/TreeWalker
// Combined with https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect

function extractVisibleText(
  root: Element,
  selectionBounds: DOMRect
): string {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node) {
        const textNode = node as Text;

        // Skip empty nodes
        if (!textNode.data.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        const parent = textNode.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Visibility: check computed styles first
        const style = getComputedStyle(parent);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          parseFloat(style.opacity) === 0
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        // Zero-dimension fast-fail (cheap before AABB)
        const rect = parent.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          return NodeFilter.FILTER_REJECT;
        }

        // AABB intersection test
        if (
          rect.left <= selectionBounds.right &&
          rect.right >= selectionBounds.left &&
          rect.top <= selectionBounds.bottom &&
          rect.bottom >= selectionBounds.top
        ) {
          return NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_REJECT;
      }
    }
  );

  let extracted = '';
  let node;
  while ((node = walker.nextNode())) {
    extracted += (node as Text).data + ' ';
  }

  return extracted.trim();
}
```

### Chrome Runtime Port-Based Streaming

```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/runtime
// Content script
function initiateGeminiStream(selectedText: string) {
  const port = chrome.runtime.connect({ name: 'gemini-stream' });

  port.onMessage.addListener((message) => {
    if (message.type === 'token') {
      // Append token to panel (using textContent, not innerHTML)
      updatePanel(message.text);
    } else if (message.type === 'done') {
      console.log('Stream complete');
      port.disconnect();
    } else if (message.type === 'error') {
      showErrorPanel(message.error);
      port.disconnect();
    }
  });

  port.onDisconnect.addListener(() => {
    // Handle SW crash mid-stream
    showErrorPanel('Connection interrupted. Stream cut off.');
  });

  port.postMessage({ type: 'generateContent', text: selectedText });
}

// Service worker
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'gemini-stream') {
    port.onMessage.addListener(async (message) => {
      if (message.type === 'generateContent') {
        try {
          const apiKey = await chrome.storage.local.get('geminiApiKey');
          const genAI = new GoogleGenerativeAI(apiKey.geminiApiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

          // Use the SDK's streaming capabilities
          const stream = await model.generateContentStream({
            contents: [{ parts: [{ text: message.text }] }]
          });

          for await (const chunk of stream.stream) {
            if (!chunk.text()) continue;
            port.postMessage({ type: 'token', text: chunk.text() });
          }

          port.postMessage({ type: 'done' });
        } catch (error) {
          port.postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    });
  }
});
```

### Shadow DOM with adoptedStyleSheets (Vite Pattern)

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/adoptedStyleSheets
// panel.ts
import panelStyles from './panel.css?inline'; // Vite inline import

export function createResultPanel(): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('data-id', 'gemini-result-panel');

  // Viewport-centered, fixed positioning
  Object.assign(dialog.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    margin: '0',
    padding: '0',
    border: 'none',
    backgroundColor: 'transparent',
    zIndex: '2147483647' // Large z-index (Top Layer will override)
  });

  // Attach shadow root
  const shadow = dialog.attachShadow({ mode: 'open' });

  // Inject styles via adoptedStyleSheets
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(panelStyles);
  shadow.adoptedStyleSheets = [sheet];

  // Build content structure
  const container = document.createElement('div');
  container.className = 'panel-container';

  const header = document.createElement('div');
  header.className = 'panel-header';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => dialog.close();
  header.appendChild(closeBtn);

  const responseDiv = document.createElement('div');
  responseDiv.className = 'response-text';

  const actionBar = document.createElement('div');
  actionBar.className = 'action-bar';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.textContent = 'Copy';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(responseDiv.textContent || '');
  };
  actionBar.appendChild(copyBtn);

  container.appendChild(header);
  container.appendChild(responseDiv);
  container.appendChild(actionBar);
  shadow.appendChild(container);

  return dialog;
}
```

### AABB Collision Detection

```typescript
// Source: https://noonat.github.io/intersect/
interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function rectsIntersect(rect1: Rect, rect2: Rect): boolean {
  return (
    rect1.left <= rect2.right &&
    rect1.right >= rect2.left &&
    rect1.top <= rect2.bottom &&
    rect1.bottom >= rect2.top
  );
}

export function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
```

### Marching Ants Selection Border (SVG)

```typescript
// Source: https://css-tricks.com/svg-marching-ants/
export function drawMarchingAntsRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 10000;
  `);

  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', String(x));
  rect.setAttribute('y', String(y));
  rect.setAttribute('width', String(width));
  rect.setAttribute('height', String(height));
  rect.setAttribute('fill', 'rgba(76, 175, 80, 0.2)');
  rect.setAttribute('stroke', '#4CAF50');
  rect.setAttribute('stroke-width', '2');
  rect.setAttribute('stroke-dasharray', '5,5');
  rect.setAttribute('style', 'animation: marching 0.5s linear infinite;');

  // Add animation keyframes
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    @keyframes marching {
      0% { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: 10; }
    }
  `;
  defs.appendChild(style);

  svg.appendChild(defs);
  svg.appendChild(rect);

  return svg;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MV2 persistent background pages | MV3 service workers (event-driven) | 2023 (enforced 2025) | Reduced memory/battery; requires port-based async coordination |
| Manual CSS z-index layering | Top Layer API + dialog.showModal() | 2022+ browser support | Eliminates z-index wars; native stacking context |
| iframed content scripts | Shadow DOM + Web Components | 2023+ ecosystem adoption | Better encapsulation without cross-origin risks |
| XMLHttpRequest | Fetch API + ReadableStream | 2017 (matured 2020+) | Cleaner streaming, better error handling |
| Custom TreeWalker implementations | Native TreeWalker API | Always (but underused) | Built-in, optimized, solves visibility filtering natively |
| Webpack + babel loaders | Vite + esbuild | 2020+ adoption | 100x faster dev, native ESM, HMR out of box |
| CRA + Craco | CRXJS + Vite | 2021+ | Extension-aware bundling; handles web_accessible_resources, manifest injection |

**Deprecated/outdated:**
- **MV2 background pages:** Chrome no longer accepts MV2 extensions. Service workers are mandatory.
- **XMLHttpRequest for streaming:** Fetch with ReadableStream is the standard; XHR is legacy.
- **Direct innerHTML for user content:** XSS risk; must use textContent or DOMPurify.
- **Manual adoption stylesheets with <link>:** adoptedStyleSheets (CSSStyleSheet) is the modern pattern.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 1.x + JSDOM + Playwright |
| Config file | vitest.config.ts / playwright.config.ts |
| Quick run command | `npm run test:unit` (AABB + TreeWalker unit tests, ~5s) |
| Full suite command | `npm run test` (unit + E2E with Playwright, ~30s) |
| Estimated runtime | ~30 seconds (E2E), ~5 seconds (unit only) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEL-01 | Keyboard shortcut (Alt+S) activates selection mode | E2E | `playwright test --project=chrome e2e/selection.spec.ts` | ❌ Wave 0 gap |
| SEL-02 | Cursor changes to crosshair | E2E | `playwright test --project=chrome e2e/selection.spec.ts::cursor-change` | ❌ Wave 0 gap |
| SEL-03 | Real-time rubber-band rectangle visible during drag | E2E | `playwright test --project=chrome e2e/selection.spec.ts::rubber-band-visual` | ❌ Wave 0 gap |
| SEL-04 | Scrolling disabled during drag | E2E | `playwright test --project=chrome e2e/selection.spec.ts::scroll-lock` | ❌ Wave 0 gap |
| SEL-06 | Escape cancels selection | E2E | `playwright test --project=chrome e2e/selection.spec.ts::escape-cancel` | ❌ Wave 0 gap |
| EXT-01 | TreeWalker extracts visible text within bounds | unit | `npm run test:unit -- extraction.test.ts` | ❌ Wave 0 gap |
| EXT-02 | AABB collision detects text nodes in selection | unit | `npm run test:unit -- aabb.test.ts` | ❌ Wave 0 gap |
| EXT-03 | Visibility filter skips hidden/zero-dimension nodes | unit | `npm run test:unit -- visibility.test.ts` | ❌ Wave 0 gap |
| LLM-01 | Gemini API receives extracted text and returns streaming response | E2E | `playwright test --project=chrome e2e/streaming.spec.ts::gemini-stream` | ❌ Wave 0 gap |
| LLM-02 | AI infers intent (explain/summarize/solve) from content | E2E | `playwright test --project=chrome e2e/streaming.spec.ts::intent-detection` (manual inspection) | ❌ Wave 0 gap |
| LLM-03 | chrome.runtime.connect() establishes port; messages flow SW ↔ CS | E2E | `playwright test --project=chrome e2e/port-lifecycle.spec.ts` | ❌ Wave 0 gap |
| LLM-04 | Service worker stays alive for 5-minute window; no timeout mid-stream | E2E | `playwright test --project=chrome e2e/port-lifecycle.spec.ts::sw-timeout` (manual timing) | ❌ Wave 0 gap |
| PNL-01 | Result panel renders as Top Layer dialog with Shadow DOM isolation | E2E | `playwright test --project=chrome e2e/panel.spec.ts::top-layer-dialog` | ❌ Wave 0 gap |
| PNL-02 | Loading skeleton appears within 500ms of confirmation | E2E | `playwright test --project=chrome e2e/panel.spec.ts::loading-skeleton` | ❌ Wave 0 gap |
| PNL-03 | Response streams word-by-word into panel | E2E | `playwright test --project=chrome e2e/panel.spec.ts::streaming-tokens` | ❌ Wave 0 gap |
| PNL-04 | Copy button copies full response to clipboard | E2E | `playwright test --project=chrome e2e/panel.spec.ts::copy-button` | ❌ Wave 0 gap |
| PNL-05 | Escape or close button dismisses panel | E2E | `playwright test --project=chrome e2e/panel.spec.ts::dismiss-panel` | ❌ Wave 0 gap |
| PNL-06 | Distinct error states (invalid key, rate limited, network, restricted page) | E2E | `playwright test --project=chrome e2e/panel.spec.ts::error-states` | ❌ Wave 0 gap |
| KEY-01 | User can enter API key in popup | E2E | `playwright test --project=chrome e2e/popup.spec.ts::enter-key` | ❌ Wave 0 gap |
| KEY-02 | API key persisted in chrome.storage.local | unit | `npm run test:unit -- storage.test.ts` | ❌ Wave 0 gap |
| KEY-03 | Key visibility toggle (show/hide) in popup | E2E | `playwright test --project=chrome e2e/popup.spec.ts::toggle-visibility` | ❌ Wave 0 gap |
| KEY-04 | First activation without key auto-opens popup | E2E | `playwright test --project=chrome e2e/first-run.spec.ts::auto-open-popup` | ❌ Wave 0 gap |
| TST-01 | AABB collision math handles edge cases (zero-size, negative coords, partial overlap) | unit | `npm run test:unit -- aabb.test.ts` | ❌ Wave 0 gap |
| TST-02 | TreeWalker + JSDOM integration: extraction works with hidden/off-screen nodes | unit | `npm run test:unit -- extraction.test.ts` | ❌ Wave 0 gap |
| TST-03 | Playwright: service worker wakeup on first message; port.onDisconnect fires on SW kill | E2E | `playwright test --project=chrome e2e/port-lifecycle.spec.ts` | ❌ Wave 0 gap |
| TST-04 | Playwright: Top Layer dialog injection on static local HTML page | E2E | `playwright test --project=chrome e2e/panel.spec.ts::static-page-injection` | ❌ Wave 0 gap |

### Nyquist Sampling Rate

- **Minimum sample interval:** After every committed task → run: `npm run test:unit && npm run test:e2e --reporter=list --timeout 30000` (quick feedback)
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~30 seconds (E2E with Playwright headful Chrome)

### Wave 0 Gaps (must be created before implementation)

- [ ] `tests/unit/aabb.test.ts` — covers SEL-02, EXT-02, TST-01
- [ ] `tests/unit/extraction.test.ts` — covers EXT-01, EXT-03, TST-02
- [ ] `tests/unit/visibility.test.ts` — covers EXT-03
- [ ] `tests/unit/storage.test.ts` — covers KEY-02
- [ ] `tests/e2e/selection.spec.ts` — covers SEL-01, SEL-02, SEL-03, SEL-04, SEL-06
- [ ] `tests/e2e/port-lifecycle.spec.ts` — covers LLM-03, LLM-04, TST-03
- [ ] `tests/e2e/streaming.spec.ts` — covers LLM-01, LLM-02
- [ ] `tests/e2e/panel.spec.ts` — covers PNL-01, PNL-02, PNL-03, PNL-04, PNL-05, PNL-06, TST-04
- [ ] `tests/e2e/popup.spec.ts` — covers KEY-01, KEY-03
- [ ] `tests/e2e/first-run.spec.ts` — covers KEY-04
- [ ] `tests/fixtures/selection-page.html` — static test page for panel injection E2E
- [ ] `vitest.config.ts` — Vitest + JSDOM configuration
- [ ] `playwright.config.ts` — Playwright Chrome extension launch configuration (with extension path, service worker debugging)
- [ ] `tests/conftest.ts` (or Vitest setup file) — shared fixtures (mock Gemini API, mock chrome.storage.local, test element generators)
- [ ] Framework install: `npm install --save-dev @playwright/test` (if not already present)

*(All Wave 0 gaps: test infrastructure must be created before any task implementation. Executor will reference these test paths.)*

---

## Sources

### Primary (HIGH confidence)

- [Chrome Extensions MV3 Official Docs](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) - MV3 architecture, service workers, permissions
- [CRXJS Vite Plugin GitHub](https://github.com/crxjs/chrome-extension-tools) - Manifest-first bundling, release notes v2.3.0
- [@google/generative-ai NPM](https://www.npmjs.com/package/@google/genai) - Gemini API streaming, current version
- [TreeWalker API MDN](https://developer.mozilla.org/en-US/docs/Web/API/TreeWalker) - DOM traversal, node filtering
- [HTMLDialogElement.showModal() MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal) - Top Layer dialog behavior
- [ShadowRoot.adoptedStyleSheets MDN](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/adoptedStyleSheets) - Shadow DOM styling pattern
- [chrome.runtime Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) - Port-based communication, service worker lifecycle
- [chrome.storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage) - Local storage, permissions

### Secondary (MEDIUM confidence, verified with official sources)

- [Message Passing in Chrome Extensions - Clarifying SW behavior](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/nAvia8r1cvo) - Service worker timeout, port keepalive
- [Top Layer API - Dev Community](https://www.oidaisdes.org/native-dialog-and-popover.en/) - Dialog stacking, z-index elimination
- [Fetch API Streaming - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams) - ReadableStream pattern, token-by-token reading
- [getBoundingClientRect() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) - Rect calculation, hidden element behavior
- [pointer-events CSS - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events) - Disabling interaction during drag
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify) - XSS sanitization library (for Phase 2 planning)
- [AABB Collision Detection - Noonan's Intersection Tests](https://noonat.github.io/intersect/) - Math patterns for rect overlap
- [Marching Ants SVG - CSS-Tricks](https://css-tricks.com/svg-marching-ants/) - Animated border patterns

### Tertiary (Verification, patterns)

- [TypeScript Chrome Extension Development - Medium](https://medium.com/@doublekien/chrome-extension-with-typescript-1589aa84e80) - TypeScript + @types/chrome setup
- [Vitest Browser Mode - Official Guide](https://vitest.dev/guide/browser/) - Vitest + Playwright integration
- [Playwright + Vitest Component Testing - DEV Community](https://dev.to/mayashavin/reliable-component-testing-with-vitests-browser-mode-and-playwright-k9m) - Test orchestration patterns
- [Canvas Rubber Band Selection - CodePen Examples](https://codepen.io/stg/pen/YGRpZJ) - UI pattern reference

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All technologies verified with official docs, versions current as of Feb 2026
- Architecture: **HIGH** - MV3 service worker, Top Layer, Shadow DOM are standardized and stable; streaming ports are documented by Chrome
- Pitfalls: **HIGH** - Common mistakes are well-documented in ecosystem; TreeWalker visibility filtering and XSS are known challenges
- Validation: **MEDIUM** - Test framework selection is solid, but specific Chrome extension E2E testing patterns require Wave 0 test infrastructure setup

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (30 days — stack is stable, no major ecosystem shifts expected)

**Known limitations:**
- Service worker timeout behavior has edge cases (SW restart timing, port reconnection); development should validate against actual Chrome behavior.
- Marching ants animation performance is browser-dependent; SVG stroke-dashoffset is recommended but canvas-based animation may be faster on low-end devices.
- JSDOM doesn't perfectly simulate all CSS (shadow-piercing selectors, backdrop pseudo-element) — Playwright E2E tests are required for real browser validation.

