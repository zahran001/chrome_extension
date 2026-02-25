---
phase: 01-core-mvp
plan: "03"
subsystem: extraction
tags: [aabb, treewalker, dom, jsdom, vitest, typescript, visibility]

# Dependency graph
requires:
  - phase: 01-01
    provides: Vite + CRXJS build pipeline, Vitest + JSDOM unit test infrastructure, todo stub test files
provides:
  - src/extraction/aabb.ts — rectsIntersect() and pointInRect() pure functions with Rect interface
  - src/extraction/visibility.ts — isVisible() checking display, visibility, opacity, clientWidth/clientHeight
  - src/extraction/tree-walker.ts — extractVisibleText() using SHOW_TEXT TreeWalker + AABB + visibility filter
  - 10 passing AABB tests (aabb.test.ts), 6 passing visibility tests (visibility.test.ts), 7 passing extraction tests (extraction.test.ts)
  - XSS constraint enforced: tree-walker.ts uses textNode.data only, never innerHTML
affects:
  - 01-05 (content-script) — imports extractVisibleText from tree-walker.ts
  - 01-07 (integration) — extraction layer tested end-to-end

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED-GREEN cycle: failing test committed before implementation, then implementation committed to make it pass"
    - "JSDOM mock pattern: vi.spyOn(window, 'getComputedStyle') for computed style simulation"
    - "JSDOM layout mock pattern: mockLayout helper sets getBoundingClientRect + clientWidth + clientHeight per element"
    - "TreeWalker acceptNode filter order: visibility -> zero-dim fast-fail -> AABB (per CLAUDE.md constraint)"

key-files:
  created:
    - src/extraction/aabb.ts
    - src/extraction/visibility.ts
    - src/extraction/tree-walker.ts
  modified:
    - tests/unit/aabb.test.ts
    - tests/unit/visibility.test.ts
    - tests/unit/extraction.test.ts

key-decisions:
  - "TreeWalker uses getBoundingClientRect for zero-dimension check (not clientWidth/clientHeight) — single layout call for both dimension fast-fail and AABB, and compatible with JSDOM mocking"
  - "JSDOM requires per-element getBoundingClientRect + clientWidth/clientHeight mocks — global getComputedStyle mock alone insufficient for dimension checks"
  - "rectsIntersect touching-edge case returns true (inclusive) — rubber-band selection where user drags exactly to element edge should still capture text"

patterns-established:
  - "mockLayout helper pattern: combined getBoundingClientRect + clientWidth + clientHeight mock in one call for extraction tests"
  - "TreeWalker filter order: always visibility first (cheap), then zero-dim (one layout call), then AABB (no extra layout)"

requirements-completed:
  - EXT-01
  - EXT-02
  - EXT-03
  - TST-01
  - TST-02

# Metrics
duration: 4min
completed: 2026-02-25
---

# Phase 1 Plan 03: Content Extraction Summary

**AABB collision detection, visibility filter, and TreeWalker text extraction modules with 23 passing tests covering hidden element filtering, zero-dimension fast-fail, and inclusive AABB bounds checking**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T06:21:14Z
- **Completed:** 2026-02-25T06:25:46Z
- **Tasks:** 3 (one per feature, each with RED/GREEN TDD cycle)
- **Files modified:** 6

## Accomplishments
- Three pure extraction modules fully implemented with TypeScript strict types and zero TS errors
- 23 new passing unit tests (10 AABB + 6 visibility + 7 TreeWalker) bringing total unit suite to 30 tests passing
- XSS constraint enforced by design: `textNode.data` only in tree-walker.ts, no `innerHTML` anywhere
- CLAUDE.md visibility check order strictly followed: visibility -> zero-dim fast-fail -> AABB

## TDD Commit Sequence

RED/GREEN cycles for each feature:

1. **RED — AABB tests** - `d7d9e72` (test)
2. **GREEN — AABB impl** - `a1b8b2f` (feat)
3. **RED — Visibility tests** - `098e79f` (test)
4. **GREEN — Visibility impl** - `74966af` (feat)
5. **RED — TreeWalker tests** - `2aa1775` (test)
6. **GREEN — TreeWalker impl + test fix** - `d858def` (feat)

No REFACTOR commit — code was already clean after GREEN.

**Plan metadata:** (docs commit — see below)

## Test Cases Covered

### aabb.test.ts (10 tests)
- `rectsIntersect: overlapping rects returns true`
- `rectsIntersect: non-overlapping rects returns false`
- `rectsIntersect: touching edge returns true (inclusive)`
- `rectsIntersect: zero-size rect (width=0) returns false`
- `rectsIntersect: zero-size rect (height=0) returns false`
- `rectsIntersect: negative coordinates handled correctly`
- `rectsIntersect: one rect fully inside another returns true`
- `pointInRect: point inside returns true`
- `pointInRect: point on boundary returns true`
- `pointInRect: point outside returns false`

### visibility.test.ts (6 tests)
- `isVisible: visible element returns true`
- `isVisible: display:none element returns false`
- `isVisible: visibility:hidden element returns false`
- `isVisible: opacity:0 element returns false`
- `isVisible: zero-width element returns false`
- `isVisible: zero-height element returns false`

### extraction.test.ts (7 tests)
- `extractVisibleText: returns text from visible elements within bounds`
- `extractVisibleText: skips display:none elements`
- `extractVisibleText: skips visibility:hidden elements`
- `extractVisibleText: skips opacity:0 elements`
- `extractVisibleText: skips zero-dimension elements`
- `extractVisibleText: handles nested elements`
- `extractVisibleText: returns empty string when nothing in bounds`

## Files Created/Modified
- `src/extraction/aabb.ts` — `Rect` interface, `rectsIntersect()` (zero-size fast-fail + inclusive AABB), `pointInRect()`
- `src/extraction/visibility.ts` — `isVisible()`: getComputedStyle display/visibility/opacity + clientWidth/clientHeight
- `src/extraction/tree-walker.ts` — `extractVisibleText()`: SHOW_TEXT TreeWalker with visibility → zero-dim → AABB filter
- `tests/unit/aabb.test.ts` — replaced 9 todos with 10 real assertions
- `tests/unit/visibility.test.ts` — replaced 6 todos with 6 real assertions using getComputedStyle mock
- `tests/unit/extraction.test.ts` — replaced 7 todos with 7 real assertions using mockLayout helper

## Decisions Made
- **TreeWalker uses getBoundingClientRect for zero-dim check:** Single layout call serves both fast-fail and AABB. Also aligns with JSDOM mock strategy (getBoundingClientRect is mockable per-element; clientWidth requires Object.defineProperty)
- **Touching edge = intersection (inclusive):** Rubber-band selection where user drags to exact element edge should capture that element's text
- **mockLayout helper in tests:** Combined `vi.spyOn(el, 'getBoundingClientRect')` + `Object.defineProperty(clientWidth/clientHeight)` prevents test duplication across 7 extraction tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TreeWalker invisible false negative in positive test cases**
- **Found during:** Feature 3 GREEN phase (TreeWalker implementation)
- **Issue:** Initial tests mocked `getComputedStyle` and `getBoundingClientRect` on parent element `p`, but `isVisible()` checks `element.clientWidth === 0`. JSDOM always returns 0 for `clientWidth`/`clientHeight` — `isVisible()` was rejecting visible elements in positive test cases
- **Fix:** Added `Object.defineProperty` for `clientWidth`/`clientHeight` alongside `getBoundingClientRect` mock, extracted into `mockLayout()` helper. Also updated test fixture to pass layout dimensions to the correct element (text parent, not root div)
- **Files modified:** tests/unit/extraction.test.ts
- **Verification:** All 7 extraction tests pass after fix
- **Committed in:** d858def (Feature 3 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug — JSDOM limitation mismatch)
**Impact on plan:** Auto-fix was necessary for tests to correctly validate the implementation. No scope creep — tests still validate the same behavioral contract.

## JSDOM Limitations Encountered

1. **`getBoundingClientRect()` always returns zeros** — Worked around by mocking per-element with `vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(makeDOMRect(...))`

2. **`getComputedStyle()` returns empty strings** — Worked around by `vi.spyOn(window, 'getComputedStyle').mockReturnValue({display, visibility, opacity})` as a global mock per test

3. **`clientWidth`/`clientHeight` always return 0** — Worked around by `Object.defineProperty(el, 'clientWidth', { value: W, configurable: true })` per element. Requires `configurable: true` to allow per-test overrides with `vi.restoreAllMocks()`

The `mockLayout()` helper encapsulates all three workarounds for clean test code.

## Issues Encountered
None — plan executed smoothly once JSDOM limitations were accounted for in the test strategy.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `extractVisibleText(root, selectionBounds)` is ready to be imported by content-script.ts (Plan 05)
- All three extraction modules export clean TypeScript interfaces
- Full unit suite at 30/30 passing — no regressions introduced
- TypeScript compiles without errors (`npx tsc --noEmit` exits 0)

---
*Phase: 01-core-mvp*
*Completed: 2026-02-25*

## Self-Check: PASSED

- src/extraction/aabb.ts exists on disk (verified)
- src/extraction/visibility.ts exists on disk (verified)
- src/extraction/tree-walker.ts exists on disk (verified)
- tests/unit/aabb.test.ts exists on disk (verified)
- tests/unit/visibility.test.ts exists on disk (verified)
- tests/unit/extraction.test.ts exists on disk (verified)
- .planning/phases/01-core-mvp/01-03-SUMMARY.md exists on disk (verified)
- All 6 task commits exist: d7d9e72, a1b8b2f, 098e79f, 74966af, 2aa1775, d858def
