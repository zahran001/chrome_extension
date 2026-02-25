# Requirements: Rubber-Band AI

**Defined:** 2026-02-23
**Core Value:** Select anything on screen, understand it immediately — without leaving the page or copying text manually.

## v1 Requirements

### Selection & Activation

- [x] **SEL-01**: User can activate rubber-band selection mode via keyboard shortcut (Alt+S default)
- [x] **SEL-02**: Cursor changes to crosshair when selection mode is active
- [x] **SEL-03**: User sees a real-time rubber-band rectangle while dragging
- [x] **SEL-04**: Scrolling is disabled during drag (viewport-locked selection)
- [ ] **SEL-05**: A non-blocking warning overlay appears when selection exceeds 800×800px
- [x] **SEL-06**: User can cancel selection at any time by pressing Escape

### Content Extraction

- [x] **EXT-01**: Extension uses TreeWalker to extract visible DOM text nodes within selection bounds (fast path)
- [x] **EXT-02**: AABB collision test determines which text nodes fall within selection rectangle
- [x] **EXT-03**: Visibility filter skips `display:none`, `visibility:hidden`, and zero-opacity nodes
- [ ] **EXT-04**: Routing heuristic detects visual complexity (canvas, SVG, cross-origin iframe) and selects extraction path
- [ ] **EXT-05**: Visual fallback path: service worker captures viewport via `captureVisibleTab`, crops via OffscreenCanvas, sends to Gemini Vision
- [ ] **EXT-06**: Extension gracefully handles restricted pages (chrome://, PDF viewer, Chrome Web Store) — content scripts cannot run on these pages, so the Service Worker must check `tab.url` on hotkey/icon activation and trigger a `chrome.notifications.create` warning instead of attempting dialog injection

### LLM Integration

- [x] **LLM-01**: Extension sends extracted content to Gemini API and streams the response token-by-token
- [x] **LLM-02**: AI auto-detects intent from content (explain / summarize / solve) — no user mode selection required
- [x] **LLM-03**: Streaming uses `chrome.runtime.connect()` long-lived port between service worker and content script
- [x] **LLM-04**: Service worker stays alive during streaming via open port connection (active ports prevent SW suspension for up to 5 minutes — sufficient for all expected LLM response durations)

### Result Panel

- [x] **PNL-01**: Result panel renders as a Top Layer `<dialog>` with Shadow DOM style isolation
- [x] **PNL-02**: Panel displays a loading skeleton within 500ms of selection confirmation
- [x] **PNL-03**: AI response streams word-by-word into the panel in real time
- [x] **PNL-04**: User can copy the full response to clipboard via a copy button
- [x] **PNL-05**: User can close panel by pressing Escape or clicking the close button
- [x] **PNL-06**: Panel shows distinct, actionable error states: invalid API key / rate limited / network error / restricted page

### BYOK / Settings

- [x] **KEY-01**: User can enter their Gemini API key via the extension popup
- [x] **KEY-02**: API key is persisted in `chrome.storage.local`
- [x] **KEY-03**: User can toggle key visibility (show/hide) in the popup
- [x] **KEY-04**: On first activation with no key stored, extension automatically opens the popup

### Testing

- [x] **TST-01**: Vitest unit tests cover AABB collision math with edge cases
- [x] **TST-02**: Vitest + JSDOM integration tests cover TreeWalker visible text extraction
- [x] **TST-03**: Playwright E2E tests cover service worker wakeup and chrome.runtime port lifecycle
- [x] **TST-04**: Playwright E2E tests cover Top Layer dialog injection on a static local HTML page

## v2 Requirements

### Multi-Provider

- **PROV-01**: Abstract provider interface supporting OpenAI, Anthropic, Gemini
- **PROV-02**: User can select active provider in settings

### History

- **HIST-01**: Results persisted in IndexedDB with a rolling FIFO window capped at 50 interactions — on write #51, sort by auto-incrementing ID, delete the oldest record before inserting the new one (prevents unbounded growth; Base64 VLM payloads can reach 1–3MB per entry)
- **HIST-02**: User can clear history

### Panel Enhancements

- **PNL-V2-01**: Follow-up question input in result panel
- **PNL-V2-02**: Markdown rendering with code block syntax highlighting

## Out of Scope

| Feature | Reason |
|---------|--------|
| Account / login system | Contradicts zero-infrastructure, zero-telemetry principle |
| Cloud sync | Privacy violation risk; ephemeral is the feature |
| Usage analytics / telemetry | Core promise is zero data collection |
| Subscription / upgrade prompts | BYOK means no monetization via the extension |
| Always-on overlay mode | Keyboard activation only — reduces permission surface |
| Offline / local model inference | Browser BYOK only; no local model installation required |
| Mobile / Firefox support | Chrome MV3 only for v1 |
| Social sharing | Not the use case |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEL-01 | Phase 1 | Complete |
| SEL-02 | Phase 1 | Complete |
| SEL-03 | Phase 1 | Complete |
| SEL-04 | Phase 1 | Complete |
| SEL-05 | Phase 3 | Pending |
| SEL-06 | Phase 1 | Complete |
| EXT-01 | Phase 1 | Complete |
| EXT-02 | Phase 1 | Complete |
| EXT-03 | Phase 1 | Complete |
| EXT-04 | Phase 2 | Pending |
| EXT-05 | Phase 2 | Pending |
| EXT-06 | Phase 2 | Pending |
| LLM-01 | Phase 1 | Complete |
| LLM-02 | Phase 1 | Complete |
| LLM-03 | Phase 1 | Complete |
| LLM-04 | Phase 1 | Complete |
| PNL-01 | Phase 1 | Complete |
| PNL-02 | Phase 1 | Complete |
| PNL-03 | Phase 1 | Complete |
| PNL-04 | Phase 1 | Complete |
| PNL-05 | Phase 1 | Complete |
| PNL-06 | Phase 1 | Complete |
| KEY-01 | Phase 1 | Complete |
| KEY-02 | Phase 1 | Complete |
| KEY-03 | Phase 1 | Complete |
| KEY-04 | Phase 1 | Complete |
| TST-01 | Phase 1 | Complete |
| TST-02 | Phase 1 | Complete |
| TST-03 | Phase 1 | Complete |
| TST-04 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---

*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after roadmapping*
