# Scoop — Chrome Extension Architecture

## 1. Objective

Build a Chrome Manifest V3 (MV3) extension that enables users to visually select arbitrary screen regions ("rubber-band selection") and perform real-time AI inference for explanation, summarization, and problem-solving.

The system is engineered for sub-500ms Time-to-First-UI-Feedback (optimistic rendering), optimized Time-To-First-Token (TTFB) via streaming, zero operational cost, infinite horizontal scalability, and strict privacy. It relies entirely on a rule-based DOM heuristic and native browser APIs to optimize performance and security.

## 2. Product & Engineering Principles

- **Accessibility First:** Zero infrastructure setup. No local model installation required. Runs entirely inside the browser.
- **Privacy by Design:** Zero product telemetry. No server-side data persistence. Direct-to-provider API calls.
- **Performance:** Rule-based routing, DOM-first extraction, streaming inference, and optimistic UI rendering.
- **Zero-Cost Unit Economics:** Bring Your Own Key (BYOK) eliminates backend inference cost and infrastructure burden.

## 3. High-Level Architecture

The system leverages Chrome's MV3 isolated environments to maintain strict security boundaries:

- **Content Script (Unprivileged):** Handles global mouse event capture, canvas-based rubber-band rendering, local DOM extraction, and the initial routing heuristic. Passes selection coordinates (Box A) to the background process.
- **Background Service Worker (Privileged):** Orchestrates the `chrome.tabs.captureVisibleTab` screenshot capture. It spins up an `OffscreenCanvas` to securely crop the image buffer in the background thread, manages the BYOK local storage, and handles the LLM HTTPS streaming lifecycle safely outside the page context.
- **Top Layer UI:** Renders the floating result panel using the native `<dialog>` or `popover` API to guarantee visual dominance over host-page CSS and stacking contexts.

## 4. The Extraction Engine ("Cascade Heuristic")

To avoid unnecessary network latency and token cost, the system employs a millisecond-fast, rule-based DOM heuristic executed in JavaScript at the edge.

### Path A: DOM Text Extraction (Fast Path)

Triggered when the selection region contains readable DOM text nodes and no complex visual elements (e.g., `<canvas>`, `<svg>`, cross-origin `<iframe>`) are detected.

- **Mechanism:** Uses a `TreeWalker` (`NodeFilter.SHOW_TEXT`) to isolate raw text nodes, bypassing the CSS layout engine.
- **Geometry Logic:** Extracts the bounding box of each text node using `Range.getBoundingClientRect()`. It then performs an Axis-Aligned Bounding Box (AABB) collision test against the user's selection rectangle.
- **Benefits:** Near-zero extraction latency (~2–5ms), minimal token usage, and precise capture of user intent without layout thrashing.

### Path B: Multimodal VLM (Visual Fallback Path)

Triggered instantly if the routing heuristic detects visual complexity or cross-origin security boundaries within the selection box.

- **Mechanism:** The Content Script halts DOM extraction and passes the raw coordinates to the Service Worker. The Service Worker captures the visible viewport, draws the image to a background `OffscreenCanvas`, crops it to the selection bounds, converts it to a Base64 JPEG, and sends it directly to a Vision-Language Model (VLM) like Gemini 1.5 Flash.
- **Design Decision:** Deprecates dedicated client-side OCR libraries (e.g., Tesseract.js) to minimize bundle size. It delegates extraction to native VLM multimodal processing, which provides superior text extraction, spatial reasoning, and chart interpretation in a single pass.

## 5. UI & Stacking Context Strategy (Z-Index Dominance)

To solve the "Z-Index Arms Race" — where host websites use infinite `z-index` values to hide third-party overlays — this extension utilizes the browser's native **Top Layer API**.

- **Implementation:** The floating result panel and rubber-band overlay are injected using `<dialog>.showModal()` or `popover="manual"`.
- **Benefits:** Elements in the Top Layer bypass all standard CSS stacking contexts. This guarantees absolute UI dominance without resorting to brittle `z-index: 2147483647` hacks or complex MutationObservers.

## 6. Proactive Large-Selection Handling

To prevent token explosion, massive latency spikes, and API rejections when a user selects an entire webpage, the system employs a purely visual size heuristic combined with mechanical constraints.

- **Viewport-Locked Selection (MVP):** Scrolling is explicitly disabled during the drag phase. This ensures the logical selection size is strictly bounded by the physical viewport, keeping the pixel-area heuristic mathematically sound.
- **Guardrail:** During the drag, if thresholds are exceeded (e.g., > 800×800 px region), a non-blocking, subtle warning overlay appears: *"Large region detected — consider refining for faster results."*

## 7. Security Model

- **API Key Protection:** User keys are stored exclusively in `chrome.storage.local`. There is no backend key proxy and no hard-coded credentials.
- **Defense-in-Depth CSP:** The extension's `manifest.json` restricts the `connect-src` explicitly to verified LLM provider endpoints (e.g., `https://generativelanguage.googleapis.com`). This provides a strict defense-in-depth boundary that significantly mitigates supply-chain key exfiltration via compromised NPM packages.

## 8. MVP Testing Strategy

Testing balances high-velocity logic validation with targeted End-to-End (E2E) risk mitigation.

- **Pure Logic (Vitest / Jest):** Comprehensive unit testing of the AABB collision math, overlap calculations, and payload size estimation functions.
- **DOM Integration (JSDOM + Vitest):** Headless DOM validation to ensure the `TreeWalker` correctly identifies visible text, skips `display: none` elements, and builds accurate `Range` boxes.
- **Lifecycle E2E (Playwright):** Micro-scoped automated browser testing focused *exclusively* on the highest-risk MV3 boundaries: asserting Service Worker wakeups, cross-process message passing, and Top Layer `<dialog>` injection against a static, local HTML file.

## 9. Development Phases

- **Phase 1 — Core MVP:** Boilerplate MV3 setup, BYOK storage, Top Layer `<dialog>` UI injection, `TreeWalker` DOM extraction, AABB math, and text-based LLM streaming.
- **Phase 2 — Multimodal Upgrade:** Service Worker `OffscreenCanvas` bridge, background image cropping, visual routing heuristic, and VLM fallback integration.
- **Phase 3 — Polish:** Optimistic UI loading skeletons, dynamic prompt structuring, and proactive large-selection warnings.
