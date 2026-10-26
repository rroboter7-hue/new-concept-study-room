# Book 3 and Book 4 study-language review

This addition translates the user's existing proofread English passages into newly authored Simplified Chinese. It does not claim to reproduce the publisher's official Chinese translation or workbook exercises.

## Coverage

| Book | Lessons | Reading units | New source-backed expressions |
| --- | ---: | ---: | ---: |
| 3 | 60 | 1,301 | 326 |
| 4 | 48 | 754 | 243 |

Every reading unit has a Chinese counterpart. Every new expression has an exact source form, complete source reading unit, matching Chinese example, practical explanation and paragraph/unit coordinates. Existing source English and PDF provenance remain in their original files. Unfinished note glosses are retained separately in `sourceNoteUsage`; completed legacy entries remain in the study list.

## Review method

Each content author checked their full assigned batch. A different reviewer then inspected at least one difficult or longest sentence in each lesson and all new expression meanings/notes. Selected dialogue, conditional, humorous and historical passages received additional full-context checks. This is independent spot checking, not a claim that every translated sentence received independent line-by-line review.

Corrections include the paper-money team's name in Book 3 lesson 7; source-neutral narrator identity in lesson 57; the next-day deadline in lesson 58; the patent disclosure implication in Book 4 lesson 15; individual snakes versus species in lesson 20; the accidental outlaw in lesson 21; humour meaning mood in lesson 24; and heretics versus pagans in lesson 45. Linked example translations were updated with their reading units. The suspect wording in Book 4 lesson 40 remains unchanged in English and is recorded in translation notes.

## Integration checks

- The builder follows the actual HTML script order, including audio-created lesson identities. Sixty-three provisional authoring IDs were mapped to the site's existing IDs; existing audio and history identifiers were not renamed.
- Compile-time and runtime checks verify identity, source hash, paragraph shape, exact sentence text and phrase evidence. Rejected entries cannot supply default reader pairs.
- Chinese can be hidden without removing English or changing speech indexes. Narration, actual speech, thoughts and written text remain distinguishable.
- The two phrase views share escaped examples, Chinese counterparts, highlighted source forms and an allow-listed local PDF link. The page identifies the PDF starting page rather than claiming an exact paragraph page.
- Recorded phrase forms participate in recurrence only through eligible earlier source lessons. Multiple forms retain separate evidence until studied-source selection; cached results do not depend on the first requested study state.
- Live HTML loading, all 108 accepted lessons, 569 cloze/review expressions, source drift rejection, existing practice packs and mobile reading are covered by automated and browser checks.

Run `node dev/build-advanced-language.cjs` to reproduce the browser payload and `node --test` for the complete regression suite. Browser evidence is saved outside the repository under the task's `outputs/book34-language` directory.

Final local regression after preserving the concurrent public mobile-navigation and daily-output release: 490 tests passed, zero failed. Browser checks covered 320/390-pixel widths, Book 3/4 first and last lessons, dialogue labels, source links, matched-form highlighting and a corrected answer changing the result from 5/6 to 6/6.
