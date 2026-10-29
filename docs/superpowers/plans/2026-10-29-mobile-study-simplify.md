# Mobile study simplification implementation plan

> For agentic workers: implement independent file-owned tasks with focused regression checks; root integrates, reviews, verifies actual rendered flows, and publishes.

**Goal:** Apply the user-approved six-flow audit while preserving the current blue/white theme, learner drafts, honest review grading, and safe course cache updates.

**Architecture:** Keep the existing static application, modules and storage schemas. Consolidate existing controls instead of adding parallel navigation. Derive UI from existing state; no new backend or dependencies.

**Approved spec:** User asks to diagnose the observed audio false message, simplify word library, writing actions, retell copying and daily-review controls, and directly publish after verification. Existing audit: workspace interaction-audit-20261029/report.md.

## Constraints and review focus

- Do not edit the dirty peer checkout; independent worktree from e192cae.
- No changes to source course text, grading standards, due-date semantics or mastery evidence.
- Preserve source/meaning provenance in optional detail; avoid breaking long words at 390px.
- Action consolidation must not cover editor caret or mobile keyboard, and must retain fallback copying.
- Copy requirements must treat learner content as untrusted text, request corrections and content comparison without inventing a score.
- Audio readiness must be fixed at its actual cause, preserve play user gestures and asynchronous lesson-change guards.
- Review options appear only after appropriate answer feedback; independently correct recall remains required for remembered grades.
- Save failures and navigation races must still preserve edits and prevent unsafe route commit/update reload.

## Tasks

1. Root: reproduce audio initialization error with actual app harness/browser; add a regression that fails on observed cause, fix minimally, and verify shelf/Continue/stage switches plus failed navigation.
2. Word-library owner: simplify wide word entries showing word/POS/meaning, optional metadata, retain categories/search/selection state and keyboard access; CSS and UI-focused checks.
3. Writing owner: consolidate existing checking/copying into a compact reachable action area, simplify progress hierarchy; preserve five inputs, notes, focus and automatic saving. Verify long drafts/copy failure and mobile reflow.
4. Daily-review owner: show grading controls only after applicable feedback, concise state-specific explanation, >=44px mode controls; preserve scheduling and independent recall gates with focused tests.
5. Root: retell primary action copies title, learner answer and explicit checking requirements; secondary key-point navigation, fallback text and draft/focus/navigation-race regression checks.
6. Integrate: independent code review, relevant tests, source and packaged mobile/desktop UI QA, safe cache update checks, full CI, publish main and verify live build. Save screenshots outside source; close temporary local servers and preserve commit on branch.
