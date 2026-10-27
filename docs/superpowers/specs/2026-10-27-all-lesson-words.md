# Mobile lesson-word practice and rotating old knowledge

User scope: improve the current mobile writing layout and old-word picker; practise all newly appearing lesson words in five sentences; optionally combine previous words/phrases; after a recommended old expression is actually practised, prefer different ones next lesson.

Build on the existing green/ivory interface, source-backed lessons, local finite checks and independent per-target drafts. No external AI service or account is added.

## Decisions

- New words are the first appearance of an exact spelling/word form in title and body, across book/lesson order. Normalize case and curly apostrophes; do not guess lemmas or omit names/function words. Labels distinguish new words/forms. Existing targets and old drafts remain available.
- Generate source-bound targets for all 276 reading lessons. Use reviewed course Chinese and bundled dictionary meanings; unknown meanings remain explicitly pending. Preserve source sentences and never generate an example as though it came from the text.
- Show the current lesson's mandatory words, active word, written five-sentence progress, and next unfinished word. A word is practised only after checking five distinct target-containing sentences; this is not a claim of correct grammar or mastery. Partial rounds cannot be combined into a false completion.
- Keep the current target separate from optional old expressions. Recommend up to three words and one phrase from earlier lessons. Persist the set per lesson; target switches, typing and reload do not reshuffle it. A manual refresh changes suggestions without deleting text or selections.
- Only checked complete practice that actually contains selected or shown recommended expressions consumes recommendations. Unused choices and partial drafts do not. Prefer never-consumed expressions; after exhaustion, revisit the least recently used. Do not fill an available unused pool with recently used words just to reach four.
- Mobile old-word picker: nearly full available screen, no search autofocus on open/clear/removal, all/verb/adjective/phrase/selected filters, two-column word cards, phrases/long words across a full row, separate pronunciation and selection controls, compact single-row footer.
- Compact the main writing page: short progress/hint, visible target queue, optional recommendations, input and action controls before advanced settings. Preserve all five stages, both practice modes, browser-local save, import/backup compatibility and reference/assistance flags.

## Acceptance

Source completeness and first-occurrence invariants have automated tests. Progress, rotation, draft isolation, malformed storage, keyboard focus and picker semantics have red/green tests. Render on 390px, 320px and a short keyboard-like viewport; verify local interaction with disposable data and public reading/selection without entering private examples or changing scores. Preserve concurrent remote releases and verify the deployed build before completion.
