# Stack Research: Chrome MV3 AI Extension

## Recommended Stack

| Tool | Version | Purpose | Confidence |
|------|---------|---------|------------|
| Chrome MV3 | — | Extension platform | High |
| TypeScript | 5.x | Type safety across all extension contexts | High |
| Vite + CRXJS | vite@5, @crxjs/vite-plugin@2 | Build tooling with MV3-aware HMR | High |
| Vitest | 2.x | Unit + JSDOM integration tests | High |
| @vitest/browser + JSDOM | 2.x | DOM headless testing environment | High |
| Playwright | 1.44+ | E2E service worker lifecycle tests | High |
| @google/generative-ai | 0.15+ | Gemini SDK (text + vision, streaming) | High |
| Native Canvas API | — | Rubber-band overlay rendering | High |
| Native dialog / popover | — | Top Layer UI — no library needed | High |

## Build Tooling

### Recommended: Vite + CRXJS v2

CRXJS (`@crxjs/vite-plugin`) is the de-facto standard for MV3 extension development in 2025. It handles:
- Automatic manifest.json processing with Vite's module graph
- Content script HMR (hot reload without extension reload)
- Service worker bundling with correct MV3 module format
- Correct code-splitting that doesn't violate MV3 CSP

**Setup:**
```
npm create vite@latest rubber-band-ai -- --template vanilla-ts
npm install -D @crxjs/vite-plugin@beta
```

**Why not alternatives:**
- **Webpack**: Known MV3 issues with dynamic imports, service worker format, and chunking — avoid
- **WXT Framework**: Good abstraction but adds complexity; overkill for this project's minimal-dependency goal
- **Plain files (no bundler)**: Viable for very simple extensions; loses TypeScript, tree-shaking, and import resolution across contexts — not recommended for this complexity level
- **Plasmo**: Opinionated framework, can fight you on custom architectures like the cascade heuristic

### TypeScript

Worth adding. Chrome extension APIs have excellent `@types/chrome` coverage. Type safety across the content script ↔ service worker message boundary (where most bugs live) is high value. Overhead is minimal with Vite.

## Testing

### Unit + Integration: Vitest + JSDOM

```
npm install -D vitest jsdom @vitest/coverage-v8
```

- **AABB math**: Pure functions, test with Vitest
- **TreeWalker logic**: Needs DOM — use JSDOM environment in Vitest (`environment: 'jsdom'` in vitest.config)
- **Routing heuristic**: Pure logic, Vitest

### E2E: Playwright + chrome extension support

Playwright 1.44+ has first-class Chrome extension support:
```typescript
const context = await chromium.launchPersistentContext('', {
  headless: false,
  args: ['--load-extension=./dist', '--disable-extensions-except=./dist']
});
```

Use for:
- Service worker wakeup assertions
- chrome.runtime.connect port lifecycle
- Top Layer dialog injection verification
- Cross-process message passing

**Note:** Playwright E2E tests for MV3 must run headful (not headless) — service workers behave differently in headless mode in some Chrome versions.

## API Integration

### Gemini SDK: @google/generative-ai

```
npm install @google/generative-ai
```

**Streaming approach for service worker:**

The SDK's `generateContentStream()` returns an async iterable. In MV3 service workers, use `chrome.runtime.connect()` (long-lived port) to stream chunks back to the content script:

```typescript
// Service worker side
const port = chrome.runtime.connect({ name: 'stream' });
const stream = await model.generateContentStream(request);
for await (const chunk of stream) {
  port.postMessage({ chunk: chunk.text() });
}
port.postMessage({ done: true });
```

**Why not raw fetch + SSE:** The SDK handles SSE parsing, error normalization, and retry logic. Raw fetch works but requires more boilerplate. Stick with SDK.

**Vision (multimodal):** Same SDK, `inlineData` with base64 JPEG:
```typescript
{ inlineData: { mimeType: 'image/jpeg', data: base64String } }
```

## What NOT to Use

| Library | Reason |
|---------|--------|
| Tesseract.js | ~3MB bundle, inferior to VLM for mixed content — explicitly excluded |
| React / Vue | Overkill for popup (plain HTML) and result panel (injected dialog) |
| Webpack | MV3 service worker bundling issues, dynamic import problems |
| Axios | Fetch is available in SW — no need for Axios |
| Any state management lib | Extension state is simple; chrome.storage.local is the store |
| LangChain / Vercel AI SDK | Adds abstraction with no benefit for single-provider BYOK |
| TailwindCSS | Fine for popup, but injected dialog must be shadow DOM isolated — Tailwind class pollution is a risk |

## Key Constraints & Gotchas

1. **Service Worker format**: CRXJS handles this, but the SW must be a single entry point (no dynamic `import()` at top level in some Chrome versions). Use static imports.

2. **Content Security Policy**: Extension pages (popup) have a strict default CSP. `eval()` and inline scripts are blocked. Vite's dev server injects inline scripts — CRXJS patches this for extension context.

3. **`chrome.tabs.captureVisibleTab`**: Requires `"activeTab"` permission (granted on user gesture) OR `"tabs"` + host permissions. The keyboard shortcut command counts as a user gesture — `"activeTab"` is sufficient for MVP.

4. **Module type in manifest**: Service workers in MV3 must declare `"type": "module"` in manifest.json to use ES modules. CRXJS handles this automatically.

5. **OffscreenCanvas vs Offscreen Document**: OffscreenCanvas (the canvas API) IS available in service workers. The Offscreen Document API (chrome.offscreen) is a separate thing for running DOM APIs. For canvas cropping only, plain `new OffscreenCanvas()` in the SW is sufficient.

## Summary

- **Build**: Vite + CRXJS v2 + TypeScript
- **Test**: Vitest (unit/JSDOM) + Playwright (E2E, headful)
- **API**: @google/generative-ai SDK with streaming via chrome.runtime.connect ports
- **UI**: Native canvas + native dialog/popover — zero UI libraries needed
- **Key constraint**: SW stays alive during stream via long-lived port; port close = SW can sleep
