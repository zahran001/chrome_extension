# Project State: Rubber-Band AI

**Last Updated:** 2026-02-25T06:40:41Z

---

## Project Reference

**Name:** Rubber-Band AI Chrome Extension

**Core Value:** Select anything on screen, understand it immediately — without leaving the page or copying text manually.

**Key Constraint:** BYOK (Bring Your Own Key) + zero telemetry + Chrome MV3 only.

**Tech Stack:**
- Build: Vite + CRXJS v2 + TypeScript 5.x
- Test: Vitest + JSDOM + Playwright headful
- API: @google/genai SDK (Gemini text + vision)
- UI: Native canvas API + Top Layer (dialog.showModal) with Shadow DOM

---

## Current Position

**Phase:** 1 (Core MVP)
**Current Plan:** 7 of 7
**Status:** Phase 1 complete — all 7 plans done; awaiting human checkpoint (Task 2 of Plan 07)

**Progress:** [██████████] 100%

**What's Next:** Human verification checkpoint — load extension in Chrome, enter Gemini API key, verify end-to-end flow

**Stopped At:** Completed 01-core-mvp/01-07-PLAN.md Task 1; paused at Task 2 checkpoint:human-verify

---

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01-core-mvp | 01-01 | 5min | 2 | 23 |
| 01-core-mvp | 01-04 | 3min | 2 | 3 |
| 01-core-mvp | 01-05 | 2min | 2 | 4 |

- **v1 Scope:** 30 requirements across 3 phases
- **Phase 1 Load:** 25 requirements (Selection, Extraction, Streaming, Panel, BYOK, Testing)
- **Phase 2 Load:** 3 requirements (Routing, VLM fallback, Restricted pages)
- **Phase 3 Load:** 1 requirement (Large selection warning)
- **Code Complexity:** Moderate — core logic is AABB collision + TreeWalker + streaming ports; VLM path adds OffscreenCanvas screenshot
- **Risk Level:** Low (isolated extension, no backend, BYOK mitigates API dependency)

---
| Phase 01-core-mvp P01-01 | 5 | 2 tasks | 23 files |
| Phase 01-core-mvp P01-02 | 3min | 2 tasks | 5 files |
| Phase 01-core-mvp P01-03 | 4 | 3 tasks | 6 files |
| Phase 01-core-mvp P01-05 | 2 | 2 tasks | 4 files |
| Phase 01-core-mvp P01-06 | 3min | 3 tasks | 3 files |
| Phase 01-core-mvp P01-07 | 5min | 1 tasks | 9 files |

## Accumulated Context

### Key Architectural Decisions

1. **Gemini-only for MVP** (rationale: simplifies BYOK, single API surface, handles both text + vision)
2. **Top Layer API for UI** (eliminates z-index arms race without DOM hacks)
3. **VLM over client-side OCR** (smaller bundle, better accuracy, spatial reasoning in one pass)
4. **Viewport-locked drag** (bounds selection area — prevents token explosion, keeps heuristic sound)
5. **Ephemeral results** (privacy-first — no storage risk, simpler state management)
6. **Auto-detect intent** (removes UX friction — AI infers explain/summarize/solve from content)
7. **moduleResolution: bundler in tsconfig** (required for Vite 5.x + CRXJS to work correctly; standard Node16 resolution fails with ESM imports)
8. **CRXJS requires all web_accessible_resources to exist at build time** (src/ui/panel.css stub created in Plan 01 to unblock build; full styles added in Plan 04)
9. **Playwright fullyParallel: false** (Chrome extensions require a single shared browser instance; parallel workers each try to load extension separately and fail)
10. **Gemini key validation via GET /v1beta/models** (zero token cost; 200=valid, 400=invalid, 429=rate-limited; distinct messages shown to user)
11. **hasApiKey whitespace guard** (returns false for whitespace-only keys — prevents cryptic Gemini errors; trim().length check)
12. **TreeWalker uses getBoundingClientRect for zero-dim check** (single layout call for both fast-fail and AABB; compatible with JSDOM per-element mock strategy)
13. **rectsIntersect touching-edge = true (inclusive)** (rubber-band drag to exact element edge still captures text — user intent is to select the element)
14. **JSDOM mock pattern for extraction tests** (getBoundingClientRect + clientWidth/clientHeight both need mocking; consolidated in mockLayout() helper)
15. **panel.ts stub created for static import** (dynamic import unreliable in CRXJS content scripts — Plan 04 creates minimal stub, Plan 06 overwrites with full implementation)
16. **Dual AbortController pattern** (startAbort for mode lifetime + perDragAbort for drag lifetime — layered cleanup scopes for content-script event listeners)
17. **port.onDisconnect must be wired before port.onMessage** (CLAUDE.md hard rule — enforced in Plan 04 content-script confirm handler)
18. **@google/genai SDK (not deprecated @google/generative-ai)** — GoogleGenAI({ apiKey }), ai.models.generateContentStream, config.abortSignal field
19. **chrome.tabs.create for open-popup** — chrome.action.openPopup() requires user gesture and silently fails from message handlers
20. **port.onDisconnect wired before await createGeminiClient()** — ensures no disconnect events missed during async client initialization
21. **innerHTML replaced with explicit DOM removal in panel.ts** (while(body.firstChild) pattern achieves true zero-innerHTML compliance; eliminates any innerHTML even for static skeleton/error clearing)
22. **StreamPanel event handlers as arrow function class properties** (handleToken, handleDone, handleError, handleInterrupted — required for removeEventListener by reference in dismiss())
23. **rba-dismiss listener uses { once: true }** (prevents stale listeners from accumulating across retry invocations of openStreamPort())
24. **Shadow DOM host is inner div (not dialog):** dialog element not in allowlist for attachShadow — inner div host required; panel tests query via dialog.firstElementChild.shadowRoot
25. **sendMessage timeout guard:** Promise.race with 3s fallback for check-api-key — prevents silent hang when SW wakes slowly in E2E test environment
26. **launchPersistentContext for Playwright:** non-persistent context does not inject content scripts or register SW for MV3 extensions; single shared context with workers:1 required
27. **HTTP fixture server (not file://):** content scripts with <all_urls> do not auto-inject on file:// pages; HTTP server needed for E2E tests (webServer in playwright.config.ts)

### Critical Implementation Notes

**Phase 1 (must address):**
- Canvas teardown: Use AbortController; restore pointer-events immediately on mouseup/cancel — failure = page freeze
- Shadow DOM for dialog: Host page CSS bleeds into dialog children — `attachShadow` + `all: initial` required
- TreeWalker visibility filter: `NodeFilter.SHOW_TEXT` includes hidden text — add `getComputedStyle` check
- textContent not innerHTML: Never render Gemini response as HTML — XSS risk
- Port onDisconnect handler: SW may be killed mid-stream — show "interrupted" error, not silence

**Phase 2 (must address):**
- captureVisibleTab guard: Try/catch + URL check for `chrome://` and PDF pages
- Gemini finish reason: Handle `SAFETY` and `MAX_TOKENS` finishReason explicitly

### Requirements Mapping

All 30 v1 requirements mapped to phases (see ROADMAP.md):
- Phase 1: 25 reqs (SEL-01-04, 06; EXT-01-03; LLM-01-04; PNL-01-06; KEY-01-04; TST-01-04)
- Phase 2: 3 reqs (EXT-04-06)
- Phase 3: 1 req (SEL-05)
- v2 (deferred): PROV-01, PROV-02, HIST-01, HIST-02, PNL-V2-01, PNL-V2-02

### Build Order (Phase 1 Execution Path)

1. [x] Scaffold (TST-01-04) — build tooling, test infrastructure, all stubs
2. [x] Popup BYOK (KEY-01-04) — storage wrapper + settings popup complete
3. [x] AABB/TreeWalker (EXT-01-03) — text extraction complete, 23 passing tests
4. [x] CS activation + rubber-band (SEL-01-04, 06) — SelectionRenderer + content-script state machine complete
5. [x] Ports + SW streaming (LLM-01-04) — service worker + Gemini streaming complete
6. [x] Dialog render (PNL-01-06) — Top Layer panel + Shadow DOM + streaming complete
7. [x] Integration tests (TST-03-04) — 30 unit tests + 23 E2E tests passing; 6 fixme for API-key-gated streaming

### Blockers / Decisions Pending

- None — all requirements clear, architecture validated

---

## Session Continuity

**Last session:** 2026-02-25T22:04:00Z

**Handoff:** Plan 07 (Integration Tests) Task 1 complete. 30/30 Vitest unit tests pass. 23/23 meaningful Playwright E2E tests pass (6 streaming tests correctly marked test.fixme for API key requirement). Two bugs fixed: dialog.attachShadow → inner div host; sendMessage timeout guard. SUMMARY.md created. Awaiting Task 2 human checkpoint: user must load extension, enter API key, and verify end-to-end flow. After user types "approved", Phase 1 is complete.

---

*State initialized: 2026-02-23 (roadmapping phase)*
*Last plan completed: 01-07 on 2026-02-25 (task 1 done; task 2 awaiting human verification)*
