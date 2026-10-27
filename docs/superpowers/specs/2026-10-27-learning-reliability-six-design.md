# Six learning reliability improvements

The user approved all six findings from the functional audit and requested this order: meanings, sentence-check false rejections and data preservation first; then wrong-answer history, spaced review coverage and prior-expression recommendations. Existing study records and every kind of draft must survive. Publish to the original GitHub Pages site only after verification.

## Approach

Use additive, compatible repairs in the existing JavaScript application. Preserve lesson IDs, sentence target keys, storage keys, practice modes, saved answers, review schedules and the current mobile layout. A reset/rebuild would discard user work, and a new cloud account/sync backend is outside this request. Small pure helpers may isolate storage reconciliation and source-bound meanings for testing.

## Required behavior

1. Prefer a Chinese meaning appropriate to the actual lesson sentence. Correct confirmed misleading technical/name senses, fill the missing ordinary forms and label proper names accurately. Source-bound corrections must fail closed when the source text changes. Generic dictionary meanings remain distinguishable from lesson-reviewed definitions; English definitions and automatic dictionary fallback continue working.
2. Accept a natural WH question when its question word replaces the target component of the original sentence. Guided and batch checks must agree. Keep empty/non-English/malformed input checks and the warning that finite rules do not certify semantic or grammatical correctness.
3. Prevent a stale tab from replacing another tab's unrelated records, words or drafts. Preserve explicit deletions and user changes. Existing storage payloads remain readable. Backup recovery defaults to preserving/merging local work, exposes what will change and provides a recoverable pre-import snapshot; deliberate replacement stays an explicit option.
4. Resolve saved unit-pack mistakes using their task ID and revision, including the stored answer/explanation when authoritative for that version. Continue supporting old question-bank mistakes and clearly mark genuinely obsolete questions.
5. Connect expanded, defined lesson vocabulary to the existing review catalog without changing existing card IDs or schedules. Do not treat a completed sentence exercise as mastered. Fourth-book word review must be available, and dictionary corrections must not invalidate saved evidence or scheduling.
6. Base automatic old-expression recommendations on actual studied lessons plus a user-declared previously learned range. Keep the full earlier vocabulary bank available for manual selection, phrase/verb preference, basic-word exclusions, rotation cooldown and independently saved drafts. New settings must default safely and not erase existing selections.

## Verification

Reproduce each confirmed defect before fixing it. Test old payloads and drafts, two independent tabs, merge versus replace backup recovery, source drift, WH omission versus unrelated questions, current/old pack revisions, stable review card IDs, Book 4 review coverage, and recommendation range/record changes. Exercise mobile reading/lookup, guided checking, wrong-answer revisit and saved drafts in a disposable local origin. Run the full repository suite and inspect deployment checks, then verify the original live site. Record screenshot-service or physical-device limits honestly.
