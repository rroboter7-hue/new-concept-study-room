# Mobile All-Lesson Words Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make all newly appearing lesson words reachable in five-sentence practice with a denser mobile layout and stable, rotating old-expression recommendations.

**Architecture:** Generate an immutable lesson-word manifest from the actual bootstrap, enrich context through the existing vocabulary callback, and derive progress/recommendation consumption from compatible saved drafts. Extend the existing writing class and scoped CSS; keep target selection separate from optional old-word multi-selection.

**Tech Stack:** Plain browser JavaScript/CSS, offline Node builders/tests, CUA browser verification, GitHub Pages.

**Spec:** docs/superpowers/specs/2026-10-27-all-lesson-words.md

## Global Constraints

- Green/ivory styling, no new dependencies or paid service.
- All 276 source-backed reading lessons; first occurrence includes title/body exact word forms, with honest unknown meanings.
- Existing drafts, target keys, mode/round isolation, optional selections, backups and assistance flags remain compatible.
- Checked five-sentence practice is not mastery or semantic correctness.
- Recommendation changes never overwrite text or change the current target.

## Review Focus

- Imported/malformed state must not manufacture completion or execute inherited getters.
- Repeated spellings, apostrophes, hyphens and course ordering must not omit actual new forms.
- Switching targets/modes/rounds and reloading preserves independent answers and recommendations.
- Selecting, speaking or clearing a word never counts as practising it or unexpectedly opens the phone keyboard.
- Small screens, large text, long phrases and keyboard-height viewports retain a scrollable list and reachable footer.

### Task 1: Source-bound new words (data worker)

Files: lesson-word-targets.js; dev/build-lesson-word-targets.cjs; tests/lesson-word-targets.test.cjs.

- [x] Add failing fixture/source tests for new spellings, normalization, ordering, source sentences, unknown retention and immutable legacy vocabulary merging.
- [x] Implement `StudyLessonWordTargets.vocabularyForLesson(lesson)` and `newWordsForLesson(lesson)` with `isLessonNew/sourceSentence/sourceLocation` metadata.
- [x] Generate from current bootstrap and verify all source tokens are covered at their first appearance; rerun the isolated tests.

### Task 2: Progress and old-word rotation (core worker)

Files: sentence-core.js; tests/lesson-word-progress.test.cjs; tests/old-word-rotation.test.cjs; relevant word-bank tests.

- [x] Observe red tests for context vocabulary callbacks/metadata; `lessonProgress({targets,drafts})`; `recommendOldWords({items,drafts,lessonId,previousKeys,count,random})`; sanitized `recommendedOldKeys`.
- [x] Implement same-round checked completion, actual-used old-expression detection, unused-first recommendations and least-recent fallback without mutation. Include valid earlier nouns/adverbs under all words.
- [x] Verify partial/unchecked drafts do not consume old words and saved complete drafts prevent next-lesson repeat while candidates remain.

### Task 3: Writing/picker UI (UI worker)

Files: sentence-practice.js; targeted sentence UI/mobile/picker tests.

- [x] Observe red tests for complete mandatory queue, next unfinished word, target draft preservation, recommendation stability/refresh/consumption and no automatic search focus.
- [x] Integrate context/progress/recommendation APIs, persist per-lesson suggestions through the existing selection draft, and render compact queue/cards/footer.
- [x] Re-run UI and source-integration tests; keep pronunciation and multi-selection independent.
- [x] Bound the large picker DOM: zero rows while closed, 80 initially, explicit +80 paging, full-bank search and retained drafts/selections.

### Task 4: Styling and bootstrap (root)

Files: sentence-practice.css; mobile-book-workspace.css if necessary; app.js; index.html; release.json; dictionary input manifest.

- [x] Wire vocabulary enrichment and generated data order, preserve existing reviewed corrections.
- [x] Add scoped dense mobile styles with clear 44px touch regions, visible input and long-expression wrapping; preserve desktop.
- [x] Set cache keys and rebuild generated source manifests from their original offline inputs.

### Task 5: Verify, publish and inspect (root + independent reviewer)

- [x] Run relevant Node tests, then full regression with localhost permission for media-range tests.
- [x] Verify local 390px/320px/short-height behavior, no keyboard autofocus, search/selection/audio/close, independent target drafts and next-lesson rotation using disposable local data.
- [x] Review final diff independently and fix material issues.
- [ ] Merge concurrent main updates without overwriting, run affected merged checks, publish normally and verify live build/screenshots.

Pre-merge verification: 669/669 full tests pass (full-tests-before-merge.log). CUA 390x844 showed14 fully visible old-word cards with search unfocused; 320x740 and390x420 remain scrollable with a reachable58px footer and no horizontal overflow. Local five-sentence private round with four shown but unselected old expressions reached1/12; switching targets/reload preserved independent answers. Nextlesson recommendations excluded allfour used expressions and stayedstable onreload. Manualrefresh/expanding currentwords preserved text. Independent review findings fixed with red-green tests: a. POS, cross-POS aliases, sparse/inherited sourcebinding, checked-evidence sanitation and recommendation history. Complete import retains261 honestly pending meanings;7448 first spellings/forms over276lessons.

Final merged verification: preserved main through13d4377, including reviewed vocabulary, source spelling, complete static Book2 word audio, grammar practice, bounded caches and optimized delivery. The corrected source now has7447 first spellings/forms and260 pending meanings. Both generated input manifests match their files (82 dictionary inputs,70 lesson-word inputs). Full regression:753 tests,752 pass,0 fail,1 skipped because Windows does not allow the required file symlink (full-tests-publish-candidate.log). Independent picker review found no material regression. CUA measured closed picker0 rows/835 DOM nodes, open80 rows, explicit expansion160, full-bank scientist search, selection retention and close cleanup;390x844 shows14 complete cards,320x740 and390x420 keep the58px footer reachable without horizontal overflow.
