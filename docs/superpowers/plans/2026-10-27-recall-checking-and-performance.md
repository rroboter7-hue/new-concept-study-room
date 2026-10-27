# Checked lesson recall and efficient delivery

**Goal:** Replace repeated generic prompts with source-verified questions for every one of the 276 reading lessons, add choice and short-answer feedback, and reduce initial downloads and deployed storage.

**Architecture:** Author two content questions per lesson (choice + closed-fact short answer) in four independent data files. Compile validated, versioned per-book JSON and load only the selected book. Keep recall answers/results in their own saved state, including backup/restore; never imply a recall score is complete course mastery. Exact accepted short-answer aliases pass, explicit misconceptions receive targeted errors, and unmatched free prose is marked for checking rather than semantically approved.

## Source and grading constraints

- Match lesson ID, book, number, title and the SHA-256 of the exact English body; every question carries an exact quote from an indexed source paragraph.
- One choice question with three distinct plausible answers and specific wrong-option explanations; one concise factual short answer with explicit English/Chinese aliases and common mistakes.
- No answer-bearing evidence in the unanswered question. Feedback shows the learner answer, correction, explanation and original evidence.
- Editing an answer invalidates old feedback. Empty answers, loading failures, aborted/late requests and storage failures get recoverable feedback.
- Do not call remote AI or collect learner responses. Long paraphrases are not graded as correct by keyword presence.
- Preserve reading translations, word definitions, practice/daily-review state, source navigation and the user's requested section order.

## Delivery tasks

1. Add red tests for source validation, grading/negation/aliases, stale feedback and per-lesson state. Implement core and browser panel; integrate persistence and backups.
2. Independently author all 552 questions, validate coverage/evidence, and review difficult or ambiguous entries.
3. Move the 2.65 MB inline text library to JSON documents with a small catalogue and robust on-demand fetching, preserving every source section.
4. Produce a runtime-only Pages artifact. Convert WAV derivatives to MP3 for the published site while retaining original repository audio; rewrite every runtime map and verify all referenced files. Keep PDF/dictionary data and licenses.
5. Compare file-byte and startup-script totals with baseline; run regressions and mobile/desktop browser flows; publish and verify the original URL.

## Baseline

At e461bd4 the Git tree is 932,810,009 bytes: audio 792,865,651; PDF 124,023,162; dictionary 3,639,967. Sixty bootstrap scripts total 9,931,828 bytes (gzip sum 2,275,805). WAV accounts for 163,858,690 bytes in 2,255 files. Text library alone is 2,654,682 bytes. These are measured sizes, not guaranteed network transfer times.
