# Roadmap: Rubber-Band AI Chrome Extension

**Project:** Rubber-Band AI — Select anything on screen, understand it immediately.

**Status:** Phase 1 Complete (7/7 plans complete; human verification checkpoint pending)

---

## Phases

- [x] **Phase 1: Core MVP** - Keyboard activation, DOM extraction, Gemini streaming, Top Layer results panel, BYOK settings, full test coverage
- [ ] **Phase 2: Multimodal Upgrade** - Routing heuristic for visual content, VLM fallback via screenshot, restricted page handling
- [ ] **Phase 3: Polish** - Large selection warnings, size guardrails, optimistic UI

---

## Phase Details

### Phase 1: Core MVP

**Goal**: Users can select screen regions and instantly get AI-powered explanations via real-time streaming results in a floating panel.

**Depends on**: Nothing (foundation phase)

**Requirements**: SEL-01, SEL-02, SEL-03, SEL-04, SEL-06, EXT-01, EXT-02, EXT-03, LLM-01, LLM-02, LLM-03, LLM-04, PNL-01, PNL-02, PNL-03, PNL-04, PNL-05, PNL-06, KEY-01, KEY-02, KEY-03, KEY-04, TST-01, TST-02, TST-03, TST-04 (25 requirements)

**Success Criteria** (what must be TRUE for users when this phase completes):
1. User activates selection mode with keyboard shortcut (Alt+S default), sees crosshair cursor, and can drag to create a colored rubber-band rectangle with real-time visual feedback
2. Selected DOM text is extracted using TreeWalker with visibility filtering, sent to Gemini API, and response streams word-by-word into a Top Layer dialog panel within 500ms of selection confirmation
3. User can copy the full response to clipboard, close the panel with Escape or close button, and sees distinct error messages (invalid key, rate limited, network error, restricted page)
4. User can enter and store their Gemini API key via extension popup; first activation without a key auto-opens the popup to prompt setup
5. Comprehensive test suite covers AABB collision math, TreeWalker text extraction, service worker port lifecycle, and Top Layer dialog injection on static HTML

**Plans**: 7 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold + Vite/CRXJS/TypeScript build + test infrastructure (all Wave 0 stubs)
- [x] 01-02-PLAN.md — BYOK popup: API key input, visibility toggle, test-key validation, save confirmation + storage/keys.ts unit tests
- [x] 01-03-PLAN.md — Extraction layer TDD: AABB collision, visibility filter, TreeWalker text extraction
- [x] 01-04-PLAN.md — Selection UI content script: Alt+S activation, SVG marching ants, confirm button, Escape cancel + AbortController cleanup
- [x] 01-05-PLAN.md — Service worker + Gemini streaming: port-based token streaming, auto-intent prompt, error classification
- [x] 01-06-PLAN.md — Result panel: Top Layer dialog, Shadow DOM, word-by-word streaming, copy + retry + error states
- [x] 01-07-PLAN.md — Full test suite: E2E test implementation + human verification checkpoint

---

### Phase 2: Multimodal Upgrade

**Goal**: Complex or visual-heavy pages (canvas, SVG, iframes) automatically route to screenshot + VLM fallback; restricted pages show user-friendly warnings instead of failing.

**Depends on**: Phase 1

**Requirements**: EXT-04, EXT-05, EXT-06 (3 requirements)

**Success Criteria** (what must be TRUE for users when this phase completes):
1. Text-light pages (canvas games, animated SVGs, cross-origin iframe content) are detected by a routing heuristic, trigger screenshot capture via `captureVisibleTab`, and send to Gemini Vision with the same streaming and panel experience as Phase 1 text extraction
2. Restricted pages (chrome://, PDF viewer, Chrome Web Store) show a system notification explaining why the extension cannot operate, instead of silently failing or allowing a broken content script to inject
3. Routing heuristic automatically selects between DOM TreeWalker (fast path) and OffscreenCanvas + VLM (visual fallback) based on content type detection — no user configuration needed

**Plans**: TBD

---

### Phase 3: Polish

**Goal**: Large selections and oversized requests are handled gracefully without breaking the browser or exceeding token limits.

**Depends on**: Phase 1

**Requirements**: SEL-05 (1 requirement)

**Success Criteria** (what must be TRUE for users when this phase completes):
1. When user drags a selection larger than 800×800px, a non-blocking warning overlay appears in the selection UI, but the selection proceeds normally if user confirms — no silent truncation
2. (Implicit from architecture) Streaming LLM responses complete within service worker's 5-minute alive window even for large selections; no token overflow or truncation errors visible to user

**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core MVP | 6/7 | In Progress|  |
| 2. Multimodal Upgrade | 0/2 | Not started | — |
| 3. Polish | 0/1 | Not started | — |

---

## Coverage Summary

**Total v1 requirements:** 30
**Mapped to phases:** 30
**Unmapped:** 0 ✓

All requirements have been assigned to exactly one phase. No orphans.

---

*Roadmap created: 2026-02-23*
*Plans created: 2026-02-23 (Phase 1: 7 plans, 5 waves)*
