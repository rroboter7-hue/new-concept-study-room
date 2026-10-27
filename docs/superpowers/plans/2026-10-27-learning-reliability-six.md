# Learning Reliability Six Improvements Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans. Track completion with the checkboxes below.

**Goal:** Repair all six audited learning issues while preserving existing study records and drafts, then publish the verified result to the original site.

**Architecture:** Add source-bound meaning corrections and isolated storage reconciliation where needed; repair finite sentence checks; reuse current pack and review catalogs. Preserve existing public interfaces and stable identifiers wherever possible.

**Tech Stack:** Existing browser JavaScript/CSS, Node built-in tests, CUA browser validation, GitHub Pages deployment.

**Spec:** docs/superpowers/specs/2026-10-27-learning-reliability-six-design.md

## Global constraints

- Keep all existing study records, per-target/mode/round drafts, review schedules and IDs.
- No cloud backend, account requirement, dependency installation or data reset.
- First repair meanings, checker and storage; then history, review and recommendations.
- Preserve the carousel and inline four-form editor and all concurrent published improvements.
- Do not claim finite local checks establish full grammatical correctness or mastery.

## Review focus

- Source-bound corrections must not leak into another lesson or survive changed source text.
- A WH target omission must not waive requirements for empty or unrelated answers.
- Stale-tab writes and backup imports must not erase unrelated or newer work.
- Historic pack revisions must not be silently judged against different current answers.
- Existing review card IDs and recommendation/draft keys must survive corpus expansion.

### Task 1: Context meanings and missing definitions

Owner files: source-bound correction data/helper, dev/build-lesson-word-targets.cjs, dictionary-context.js and focused tests. Root owns index script wiring and generated artifacts.

- [x] Reproduce known misleading senses and missing definitions with source-bound tests.
- [x] Implement reviewed corrections, complete missing forms/names and preserve source provenance and dictionary fallback.
- [x] Run corpus and dictionary/target regression checks; review changes independently.

### Task 2: Guided versus batch sentence checks

Owner files: sentence-core.js, batch-sentence-core.js and focused checker tests. Root later owns recommendation changes in sentence-practice.js.

- [x] Observe RED for the natural WH transformation rejected because the target is questioned.
- [x] Share or align finite WH omission logic without accepting empty/unrelated input or altering draft schema.
- [x] Test four/legacy/batch completion and existing old-word evidence behavior; review independently.

### Task 3: Data preservation

Owner files: app.js storage and backup functions, new storage helper and tests. Root will wait for this owner before changing other app.js sections.

- [x] Observe RED for stale-tab word/record/draft overwrite, explicit deletions and legacy payload recovery.
- [x] Add reconciliation across writes/events with guarded error handling; avoid editor redraw/lost pending input.
- [x] Add merge-first backup recovery, preview, explicit replacement and pre-import recovery snapshot.
- [x] Test all existing backup fields and storage failure recovery; review independently.

### Task 4: Wrong-answer history and review coverage

Owner files after Task 3 freezes: app.js history/catalog wiring, review-engine.js, optional focused resolver helper and tests.

- [x] RED: current pack task IDs fail history lookup; Book 4 has no generated-word review cards.
- [x] Resolve mistakes by task/revision and preserve genuine historical evidence.
- [x] Expand review vocabulary without changing existing card IDs/schedules or mastery requirements.
- [x] Run history, pack, review-engine and review-continuation regressions.

### Task 5: Recommendations grounded in learned range

Owner files after Task 2 freezes: sentence-core.js recommendation helpers if needed, sentence-practice.js, scoped CSS and tests.

- [x] RED: automatic suggestions include never-studied sources outside declared range.
- [x] Add learned-range setting and use studied records/range for automatic suggestions; retain full manual bank.
- [x] Preserve phrase-first quotas, basic exclusions, cooldown, existing selections and per-target drafts.
- [x] Test fresh profiles, externally learned range, existing records and lessons/modes/reload transitions.

### Task 6: Integration and delivery

Root files: index.html, release.json, generated target/dictionary manifests, these docs and verification evidence outside the repo.

- [x] Integrate new helpers in safe script order; regenerate data respecting manifest hash encodings.
- [x] Run complete suite and independent final integration review.
- [x] Exercise disposable browser flows and legacy record/draft preservation; capture screenshots when service permits.
- [ ] Preserve concurrent main, publish normally, verify successful deployment and original live site.

## Verification results

- Full Windows release test run: 1,045 tests; 1,044 passed; 0 failed; 1 skipped because Windows cannot create the test file symlink. Linux CI will exercise that case.
- Independent integration, storage, cache and source-manifest reviews approved.
- All 83 LF-normalized target inputs and 95 raw dictionary selection inputs match; rebuilt target output is identical to source compilation.
- 7,445 targets, 0 missing definitions; 523 explicitly reviewed self-authored contextual senses. Existing 3,963 review card IDs are retained; current catalog has 10,350 cards. Generic dictionary meanings remain visibly distinguished from reviewed senses.
- Storage tests include 80 independent-data preemption cases and 40 same-card stale-hint cases. Realistic first-book profile peak: 2,820,540 UTF-16 bytes under a 5 MiB budget; no claim of unlimited local storage.
- Browser tests at actual 341px width verified the natural WH omission, automatic contextual lookup, draft persistence after reload/range change/backup merge, preserved expanded range controls, and no horizontal overflow. Merge preview and contextual-meaning screenshots saved outside the runtime repository.
- Browser automation connection was intermittent late in testing. Desktop state remained readable and showed the preserved draft; physical phone keyboard testing was not performed.
