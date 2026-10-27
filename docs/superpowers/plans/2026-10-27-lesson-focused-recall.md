# Lesson-focused post-reading flow

**Goal:** Reduce repeated old-word lists below each passage and put the reader's recall of the current lesson first.

**Scope:** The user specified the order: current-lesson self recall, knowledge recurrence, habitual expressions. Reuse the existing retell and phrase practice; do not change lesson content, dictionaries, vocabulary exercises, saved words, review schedules, or mobile navigation.

**Approach:** Adjust presentation in `app.js` and `recurrence.css`. Keep full source-backed recurrence data for review/provenance but exclude single-word entries from the automatic post-reading section. Show phrase and grammar recurrence behind a closed disclosure. Add a short current-title recall guide and an action opening this lesson's existing English retell mode. Follow recurrence with a compact disclosure of current-lesson expressions and an action into existing phrase practice. No new learning scores or drafts are created by merely opening these sections.

## Steps

- [x] Add behavior tests for ordering, no automatic old-word list, empty vocabulary/usage, escaping, audio-only lessons, and same-lesson retell/phrase actions.
- [x] Verify the tests fail before implementing the presentation.
- [x] Implement the three-section flow and reuse existing actions without resetting drafts or submitted results.
- [x] Run focused and full tests, independently review the patch, then verify desktop and mobile rendered behavior.
- [ ] Refresh changed asset versions, publish to the original Pages site, verify the deployed flow.

## Review focus

- Keep `openKnowledge` vocabulary anchors and all full lesson vocabulary intact.
- Filter before rendering and before this section's old-knowledge practice selection so no hidden word drills are introduced by the button.
- Do not show already submitted output feedback under a different output mode.
- Notes, imported lessons, zero-phrase lessons and audio-only lessons remain meaningful.
- Keep all controls within 320 px mobile width and retain keyboard-accessible native disclosures.

## Validation

- Nine new behavior tests passed after observed failing runs.
- Full suite: 526 passed, zero failed before merging concurrent Book 1 completion.
- Independent review found and verified the fixed step-navigation issue.
- Browser: desktop, 390 px and 320 px; ordered sections, hidden old-word cards, collapsed knowledge, same-lesson retell draft retention, phrase navigation, no horizontal overflow, no console errors. Courses without questions omit the empty comprehension action.

## Concurrent content integration

Preserved upstream `5d10a09` Book 1 completion, including both new bootstrap scripts, the 72 reading units, translations, and audio mappings. The first full merged run reported one environment failure: `all reading lessons have local audio and every Book1 printed word has a readable pronunciation file` cannot stat media excluded by this sparse checkout. The complete non-media suite is rerun with exactly that test explicitly skipped, without changing the upstream test. Independent exact-commit Git-tree verification confirms all 276 lesson targets and all 1,187 unique Book 1 pronunciation files exist and exceed 1,000 bytes, with no missing mappings or short files. This checks repository presence/size rather than decoding or listening.
