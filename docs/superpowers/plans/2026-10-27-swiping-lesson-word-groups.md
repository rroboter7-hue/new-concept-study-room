# Swiping Lesson Word Groups Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Browse four-word lesson groups in either direction and practise out of order while retaining each target's saved work.

**Architecture:** Extend the existing SentencePractice queue with transient group state and native scroll snap; retain the established target selection/save path. Scoped CSS defines phone and desktop cards. Keep core data and recommendation semantics unchanged.

**Tech Stack:** Existing JavaScript/CSS, Node tests, CUA browser verification and GitHub Pages.

**Spec:** docs/superpowers/specs/2026-10-27-swiping-lesson-word-groups.md

## Global constraints

- Four cards per group, native swipe, explicit backward/forward controls and no automatic target selection on browse.
- Keep original ordering, all-word access, per-target drafts/progress, mode isolation and old-expression recommendations.
- No new dependency, storage-schema change or horizontal gesture handler that blocks vertical scrolling.
- Fresh reload reveals the selected target; preserve newer site changes during release.

## Review focus

- Native scroll changes must update the pager without replacing the editor or swallowing text.
- Card selection, next unfinished, all-word collapse and resize must keep the correct group visible.
- Offscreen cards must not trap keyboard users or announce every page as current.
- Stale render/scroll callbacks must not overwrite another lesson's group state.
- Tail groups, empty lessons and unavailable mock layout APIs remain safe.

### Task 1: Queue behavior and regressions

Files: sentence-practice.js; tests/sentence-lesson-queue.test.cjs; necessary targeted sentence UI tests.

- [x] Observe failing tests for group boundaries, scroll/pager, no target switch on browsing, independent drafts and restored target visibility.
- [x] Implement grouped rendering, native scroll handling, keyboard/buttons and safe mounting/restoration.
- [x] Run relevant sentence/quick/picker tests and review the behavior diff independently.

### Task 2: Visual layout

Files: sentence-practice.css.

- [x] Add native scroll-snap groups, compact controls, active-word hint and reduced-motion styling in the current palette.
- [x] Verify phone320/390px and desktop layout, no horizontal page overflow and usable focus.

### Task 3: Delivery

Files: index.html; release.json; generated source manifests; this plan.

- [x] Rebuild manifests respecting declared hash encodings; run full appropriate regression.
- [x] Exercise real local browse/select/return/reload flows with disposable data and save screenshots.
- [x] Preserve concurrent main, publish normally, verify full deployment checks and live mobile result.

Pre-release evidence:87/87 targeted checks pass, with initial RED for absent grouping and modified-arrow interception. Independent lifecycle review and33 queue tests passed. CUA390px actually browsed group2 without changing a partial puma answer or recommendations, completed five trail sentences in group2, restored the puma partial answer in group1, and reloaded onto selected completed trail in group2. Arrow keys reached group8;320px and1280px resize preserved group8 with no horizontal page overflow. Next-unfinished revealed somehow in group2. Local screenshot01-browse-next-preserved.jpg is outside the repository. Browser plugin not available; used supported CUA Playwright APIs. Native phone touch remains a physical-device acceptance item.

Full regression after preserving current main and whole-lesson batch import/export:921 tests,920 passed,1 skipped,0 failed. Generated lesson inputs validated as UTF-8 LF and dictionary selection inputs as raw bytes. Release cache tags consistently use2026-10-27-swiping-word-groups.

Concurrent main e895b7c four-inline forms merged before delivery; redraw preserves both carousel scheduling and named-field focus. Independent integration review43/43 and affected96/96 pass. Final merged full suite:930 tests,929 passed,1 skipped,0 failed. Source hashes rebuilt and validated again; local reload and next-group retain the saved puma draft.

Delivery verified:6113c2d was normally pushed to main, then retained as an ancestor of1f25b06. Latest release only changed deployment preparation, index cache keys and release metadata, preserving the carousel code. Run40464268351 passed complete-source tests, optimized-site validation and Pages deployment. Live build2026-10-27-four-forms-inline at390px showed40 cards in10 groups, four visible cards, native scrollLeft329 for group2, working previous/next and unchanged active puma/answer on browsing. No horizontal overflow or console errors. Actual public screenshot02-live-mobile-word-groups.jpg is stored outside the repository. Local preview stopped after process identity verification. Physical phone touch remains unverified.
