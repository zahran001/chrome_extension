# Project State: Rubber-Band AI

**Last Updated:** 2026-02-25

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
**Current Plan:** 2 of 7
**Status:** In progress — Plan 01 complete, Plan 02 next

**Progress:** [#---------] 1/7 plans complete (14%)

**What's Next:** Execute plan 02 — BYOK popup (KEY-01-04)

**Stopped At:** Completed 01-core-mvp/01-01-PLAN.md

---

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01-core-mvp | 01-01 | 5min | 2 | 23 |

- **v1 Scope:** 30 requirements across 3 phases
- **Phase 1 Load:** 25 requirements (Selection, Extraction, Streaming, Panel, BYOK, Testing)
- **Phase 2 Load:** 3 requirements (Routing, VLM fallback, Restricted pages)
- **Phase 3 Load:** 1 requirement (Large selection warning)
- **Code Complexity:** Moderate — core logic is AABB collision + TreeWalker + streaming ports; VLM path adds OffscreenCanvas screenshot
- **Risk Level:** Low (isolated extension, no backend, BYOK mitigates API dependency)

---
| Phase 01-core-mvp P01-01 | 5 | 2 tasks | 23 files |

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
2. Popup BYOK (KEY-01-04) — foundation for all subsequent features
3. CS activation + canvas (SEL-01-04, 06) — user interaction layer
4. AABB/TreeWalker (EXT-01-03) — text extraction
5. Ports + SW streaming (LLM-01-04) — API integration
6. Dialog render (PNL-01-06) — results display
7. Integration tests — coverage for all above

### Blockers / Decisions Pending

- None — all requirements clear, architecture validated

---

## Session Continuity

**Last session:** 2026-02-25T06:18:39.052Z

**Handoff:** Plan 02 (BYOK popup) ready to execute. All stubs in place, build pipeline working.

---

*State initialized: 2026-02-23 (roadmapping phase)*
*Last plan completed: 01-01 on 2026-02-25*
