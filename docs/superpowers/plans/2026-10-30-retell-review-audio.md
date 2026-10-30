# Retelling Review and Pronunciation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task in the isolated checkout.

**Goal:** Complete retelling hints, retain a useful correction history and let learners hear their writing targets.

**Architecture:** Reuse source-bound hint, sentence feedback and speech services. A focused retelling-review module owns sentence segmentation, feedback sanitization and summaries; LearningPipeline owns saved per-lesson records and interaction guards. FreeWritingPractice receives an existing speech callback.

**Tech Stack:** Existing vanilla JavaScript UMD modules, CSS, Node test runner and browser UI tests.

**Spec:** docs/superpowers/specs/2026-10-30-retell-review-audio.md

## Constraints and review focus

- Preserve guest/account drafts, backups and five sentences per new target.
- No external upload, new provider, remote AI call, exact-match grading or claims of perfect grammar.
- Bind async results to lesson and draft; preserve active input on late responses.
- Handle abbreviations/names/quotes when splitting prose; include punctuation-only problems.
- Escape source/user text, preserve Unicode names, avoid title-case false positives and invented people.
- Save errors and correction history with failed-save recovery and compatible cloud entity storage.

## Tasks

- [x] Pin source-name/noun completeness and pronunciation callback behavior with failing tests.
- [x] Implement source-bound hints and accessible target pronunciation; rerun existing hint/writing tests.
- [x] Pin paraphrase-safe local checks, issue summary, staleness, correction history and async navigation guards with failing tests.
- [x] Implement focused review module, retell UI actions/storage and manual Doubao copy guidance.
- [x] Verify backup/account projection round trip, existing pipeline lifecycle and draft protection.
- [x] Browser-check phone and desktop retelling, long names, pronunciation interaction and correction save/reopen.
- [ ] Commit independently; integrate only after stable account release and feature acceptance checks.

## Verification ledger

- Initial focused regression: 188 passed. Expanded four-book hint/source and review checks: 193 passed before final attribution refinements.
- Independent review found ordinary dialogue openers in name hints, missing initial/quoted names, a quoted-question punctuation false positive, and focus loss on late rechecks. Each was reproduced RED then fixed GREEN; final focused attribution/persistence/feedback checks passed 22 tests.
- Final expanded regression after fixes: 193 passed, 0 failed. Source-hint construction and retention of current targets checked across available four-book lessons; this is not a claim of complete human semantic proofreading.
- Browser QA on a synthetic-only localhost origin: 390x844 and 1280x900 layouts have no horizontal overflow, saved correction survives a safe reload, original draft stays unchanged, pronunciation click produces no console errors. No iPhone hardware or audible-output verification claimed.
- Native worktree creation could not target the nested repository; used a separate local Git checkout under the authorized workspace. Primary account release merge is untouched.
- Release is held because the separate account service is not yet reachable on the user's phone without VPN. No frontend main push, no production learner-data migration or automatic upload.
