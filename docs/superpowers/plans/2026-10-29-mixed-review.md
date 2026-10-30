# Mixed Review Implementation Plan

> For agentic workers: execute inline with superpowers:executing-plans. Review the complete branch before publication.

**Goal:** A compact blue/white review overview starts one mixed group of at most ten source-backed tasks.

**Architecture:** A pure planner resolves historical mistakes against current question versions, combines enrolled due cards and learner-confirmed corrections, and persists a bounded session. A small view owns the overview, one-task workspace and result screen. Reuse StudyReview and StudySentenceRevisit grading/scheduling primitives; formal lesson scores remain unchanged. Preserve the existing ReviewPractice entry for explicit coach/prerequisite tasks.

**Tech Stack:** Existing vanilla JavaScript UMD modules, CSS, Node tests and CUA browser verification; no dependencies or remote services.

**Spec:** User-approved design in this conversation: overview before Start, roughly four historical mistakes/four usages/two confirmed corrections, flex to available taught content, one knowledge point once per group, wrong-only shortcut, collapsed explanations, preserved drafts, delayed retest and no inferred mastery for open writing.

## Global constraints
- At most ten total tasks, across all sources combined; never include future/unlearned course material.
- No new imagery, fonts, framework, network service or learner-data upload.
- Wrong historical revisions cannot acquire current answers; stale tasks are visibly deferred.
- Open writing and self-confirmed corrections are practice, never objective grammar correctness.
- Storage failure keeps the current task and input; leaving/reloading retains the pending group.

## Review focus
- Empty or uneven source pools must not trap the learner or invent mistakes.
- Repeated concepts from multiple stores count once.
- Viewing hints or changing a checked answer never becomes independent-correct evidence.
- A question/source revision changing mid-session cannot accept stale grading.
- Concurrent/storage-failed completion cannot silently lose drafts or overwrite formal scores.

### Task 1: Source planner and bounded state
Files: mixed-review-core.js; tests/mixed-review-core.test.cjs.
- [x] Write failing tests for quotas/fill/dedup, version binding, due/learned constraints, snapshots and completion safety.
- [x] Run RED, implement candidates/plan/sanitize/session/draft/finish pure functions, run GREEN.

### Task 2: Review overview and one-task interaction
Files: mixed-review.js, mixed-review.css; tests/mixed-review-ui.test.cjs.
- [x] Write failing tests for Start/resume/summary, hints, real answers, phrase writing, correction recall and failed saves.
- [x] Run RED, implement one primary action per state with stable persisted input and explicit status.
- [x] Use existing scheduling engines with an atomic app save callback; never grade a lesson attempt.

### Task 3: App, backups and existing review compatibility
Files: app.js, index.html, tests/support/app-harness.cjs; tests/mixed-review-app.test.cjs.
- [x] Add failing real-app tests for overview entry, explicit-task compatibility, refresh/backup/draft and failed-storage recovery.
- [x] Load modules in normal index order, integrate normal review route, hide duplicate correction panel only in hub mode.
- [x] Run targeted regression, verify local mobile/desktop UI and console, request whole-branch peer review.
- [ ] Publish via existing coordinator; verify Pages CI and public original URL; stop temporary preview.

### Review and verification notes (2026-10-30)
- Independent review found three issues: shared vocabulary concept dedup, existing engine hint assistance, and answer-bearing source titles. Each received a failing regression before its fix; fresh review passed all 31 mixed-review tests.
- Local mobile UI completed all 10 mixed tasks and brought all 10 into immediate correction practice. Refresh restored the pending group; navigation preserved writing input. At 320px and 1280px widths there was no horizontal overflow, and no console warnings/errors were captured.
- Runtime bundling completed with six packages and no added media, fonts, dependencies or external services. Existing HTML CRLF is preserved (`git -c core.whitespace=cr-at-eol diff --check`).
- Final deployment and build marker are owned by the existing publishing coordinator to avoid overlapping pushes.
- Full local suite: 1728 tests, 1669 passed, 57 failed, 2 skipped. Failures are in media/delivery/server tests: this independent sparse worktree lacks audio/resources and the sandbox rejects temporary encoder renames and server operations. All 31 mixed-review tests passed in that run. Complete-source CI remains a required publication gate; this local result is not a full-suite pass.
