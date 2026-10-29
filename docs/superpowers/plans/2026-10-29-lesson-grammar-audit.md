# Lesson-specific grammar content audit

**Goal:** Replace repetitive/irrelevant grammar highlights for all276 currently published reading lessons (72/96/60/48), using each actual passage and plain Chinese explanations.

**Scope:** Author learning notes, not official textbook lecture claims. Keep reading texts/audio, quiz bank, learning rules, drafts and records unchanged. Existing book/lesson grammar browser and reading/key-points pages must use one source.

**Architecture:** Four independently authored static UMD data catalogs plus a small source validator. Every official lesson gets1–3 genuinely relevant grammar points; each point has a short heading, simple explanation, an exact English excerpt and one specific common-error caution. Prefer2 points unless passage warrants3. No forcing a tense onto articles, pronouns, imperatives, conditionals or other structural lessons. Registry ignores absent/invalid evidence. Existing generic notes/questions remain a fallback for imported/noncatalog lessons only.

**Source:** Export exact current production lesson objects to outputs/grammar-content-audit-2026-10-29/book-N.json. Editorial summaries must be based on the lesson text; any quoted excerpt must be present verbatim. Never mechanically assign a grammar topic by lesson number or a copied syllabus.

## Tasks
- [x] Export and measure existing duplicate summaries/examples, inspect root fallback path.
- [x] Parallel independent content audits: Book1, Book3, Book4; root audits Book2. Each owns only its data file and evidence report.
- [x] Regression-first registry validation:276 coverage, exact English evidence, source IDs, short text, no generic exercise filler, no silent fallback on invalid official records; preserve imported-note behavior.
- [x] Integrate lesson-key-points with curated items/cautions and clear self-authored provenance; expose one short example in overview for understanding.
- [x] Cross-review authored content against actual passages, run complete coverage/source audit and focused app/navigation/cache tests.
- [ ] Phone/desktop browser checks, full original-media CI, original Pages publish and public integrity/representative content checks.

## Review focus
- Broadly similar tenses may recur legitimately; the explanation/example/caution must address this passage.
- No past tense versus present perfect confusion, no calling every -ing a present continuous, no declaring every passive clause a tense.
- Exact passage excerpts must actually illustrate the named rule; literal inclusion alone is insufficient.
- Earlier/later course browsing cannot change the active lesson, audio, drafts or scores.
- Keep notes small and source-based; no new network API or account requirement.

## Evidence
- Baseline:104 identical modal summaries;41 identical is/be exercise explanations.
- New catalogs:276 lessons /552 points /552 distinct summaries; all552 excerpts match the same source paragraph;213305 source bytes,72666 gzip bytes.
- All4 books received complete passage reading and independent cross-review; corrected mislabels in infinitives/participles, exercise-filler explanations and semantic overstatements.
- Registry15 tests and integration/content47 tests passed. Local full-media testing is deliberately reserved for complete-source GitHub CI.
- Integrated human-approved compact vocabulary multi-column CSS4364573 and inline-icon CSSd29ac37 alongside grammar notes; no changes to records, question banks or audio.

- Final integrated gate:105 tests passed after independent review fixes; missing book/aggregator/catalog entry cannot revive legacy templates; sparse points arrays are rejected.
- CUA verified reading overview, grammar browser and key-points stage use the same authored source; sampled all4 books, including Book3L30 and Book4L36 corrected structures. Mobile375px and desktop1265px show no horizontal overflow; final vocabulary grid2/4columns with inline icons retained.
