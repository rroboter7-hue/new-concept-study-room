# Integrated study optimization implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge useful legacy learning tools into a simpler, reliable five-stage flow without reducing the requested sentence quotas.

**Architecture:** Add a pure source-aware writing-target adapter, keep independent free-writing drafts, and improve the existing pipeline rather than creating more modes. Use explicit adapter callbacks for legacy sentences and clipboard copying. Existing storage and publication mechanisms remain authoritative.

**Tech Stack:** Browser JavaScript/CSS, Node built-in tests, existing static GitHub Pages build.

**Spec:** `docs/superpowers/specs/2026-10-28-integrated-study.md`

## Global constraints
- New word/new usage = 5 sentences; prior target = 1–2, using 2 as the default.
- Free sentence-form combinations; no compulsory four-form quota.
- Preserve old drafts, scores, source texts, audio identities, backup fields and multi-tab guards.
- No automatic external sending; clipboard export is user-triggered and accurately labels limited local checks.
- Use the existing linked worktree; root alone edits app.js/index.html/release/build and publishes.

## Review focus
- Irregular inflections and noun/verb ambiguity must not merge unrelated targets.
- Same-label quota reclassification must not hide existing rows or erase extra answers.
- Day rollover, refresh, failed saving and asynchronous checks must retain drafts.
- Legacy exports must stay lesson-bound, complete and safely escaped.
- Recap actions must use the intended question/target and preserve true attempt history.

### Task 1: Source-aware target adapter
Files: create `writing-target-plan.js`, `tests/writing-target-plan.test.cjs`.
Interface: `StudyWritingTargets.forLesson(lesson,{lessons,learnedLessonIds,getVocabulary,getNewWords,getUsage})` returns `{words,phrases,priorWords,priorPhrases}` accepted by FreeWritingPractice.
- [ ] RED: Book 2 L2 turn round/have a conversation are prior targets with count 2, not new five-sentence targets; rang/repeated use source-supported ring/repeat labels; names excluded; real cumulative goals retained.
- [ ] GREEN: Use approved canonical vocabulary/forms and earlier source appearances, conservative ambiguity handling, stable `storageLabel` for changed display labels; cap optional prior additions to a small batch.
- [ ] Verify all 276 lessons produce valid source-bound targets and no duplicate normalized labels, current count 5/prior count 1–2.

### Task 2: Simpler writing workspace and daily batches
Files: `free-writing-practice.js/css`, corresponding tests only.
Inputs: Task 1 target lists; support `storageLabel` in target keys so new display labels preserve old identities.
- [ ] RED: Persistent daily plan chooses up to two unfinished current targets and one prior target; cumulative five-sentence quota remains; rollover does not reset answers.
- [ ] GREEN: Show today's progress first and cumulative progress in a disclosure; previous/next target; one group-level optional phrase-reference area instead of five repeated selectors; preserve stored per-row fusion data and all drafts.
- [ ] Verify cursor-safe autosave, stale checks, failed saves, extra rows, storageLabel compatibility and keyboard layout through existing behavioral tests.

### Task 3: Actionable recap, review and legacy tools
Files: `learning-pipeline.js/css`, `learning-pipeline-core.js`, create `lesson-sentence-export.js`, corresponding tests.
Interfaces: pipeline optional `getSentences(lesson)`, `copyText(text)`; export helper `StudyLessonSentenceExport.collect({lessonId,freeWriting,sentencePractice,sentenceBatches,outputDrafts})` and `prompt(lesson,rows)`.
- [ ] RED: Exact-lesson legacy drafts + new rows are visible and copyable without overwriting source namespaces; empty/clipboard failure remains usable; concise quiz feedback has full details collapsed.
- [ ] GREEN: Show learner choice and short rule, explicit retry from recap, jump to a writing target for correction, lesson-specific grammar recall prompts; long metadata under details. Add copying of all lesson sentences including manual-check instructions.
- [ ] RED/GREEN: Rolling earlier review prefers real wrong/overdue knowledge while preserving 7+3, no future sources, stable snapshots and multi-tab question bindings.
- [ ] Verify corrected attempts retain error history; ungraded local suggestions remain distinct from objective errors.

### Task 4: Integration, review and publication (root)
Files: app/index/release/host CSS, integration and delivery tests.
- [ ] RED/GREEN: Wire target and export adapters, clipboard fallback, recap actions, preserved backup/refresh state; do not instantiate legacy-only interactive panels until needed if safe.
- [ ] Fix the known present-continuous explanation display using actual source sentences without rewriting grading or inventing examples.
- [ ] Run focused tests, fresh whole-change review, browser mobile/desktop writing → checking → recap → retry → reload → copying, console and screenshot checks.
- [ ] Explicitly stage only this task, commit, non-force push authorized main update, wait for complete source CI and deployment, verify published asset integrity and representative audio, inspect production UI.

## Ledger rulings
- The previous proposal is the approved design; this document records it, rather than reopening settled choices.
- Existing unrelated modifications to reading-view.js and its tests are preserved and excluded from task commits.
- No new server-backed AI service or automatic cross-device sync is introduced; the user's free manual-copy workflow is retained.
