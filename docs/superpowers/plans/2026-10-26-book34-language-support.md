# Third and fourth book language support

The user requested completion of translations and idiomatic usage for the existing reader. Continue its established sentence-pair display and five phrase-practice modes. Cover all 60 Book 3 and 48 Book 4 passages using the already proofread source text. Chinese is newly authored study material, labelled as unofficial. Preserve original English, source provenance, lesson identities, audio indexes, learning history and prior note-based usage.

## Implementation

1. Author exact-source sentence translations and 4–6 contextual expressions per lesson in three independent JSON batches. Each expression includes a literal source form, whole source sentence, its Chinese translation, practical explanation and zero-based evidence indexes. Classify actual narration, dialogue, thoughts and written text.
2. Add a reproducible builder with strict coverage, identity, source-hash, sentence-order and usage-evidence checks. Its browser payload validates source identity again before applying a lesson, joins paragraph translations for compatibility, merges source-backed usage before legacy notes and exposes only accepted sentence alignments.
3. Extend the shared reader's default alignment lookup to include accepted advanced-book entries. Add translated source examples and accurate textbook provenance to both usage views. Keep existing note labels and all exercise grading behavior.
4. Test rejected source drift, identity mismatches, exact audio index preservation, hidden translations, escaped example translations, source-derived cloze answers and recurrence/review compatibility. Independently review content batches and representative difficult translations.
5. Run the full suite, inspect mobile Book 3/4 reading and phrase modes, publish the original GitHub Pages site, then verify the deployed build and save screenshots.

## Review focus

- No sentence omitted, summarized, duplicated or paired with another source sentence.
- No invented speaker, lost negation, qualification or conditional, or modernized historical assertion.
- No phrase example fabricated or labelled as the printed source when it is a study note.
- Imported/changed lessons must never inherit another lesson's Chinese.
- Existing Book 2, audio, recurring review, saved drafts and new practice packs remain available.
