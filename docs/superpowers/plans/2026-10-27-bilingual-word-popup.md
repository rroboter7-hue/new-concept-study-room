# One-click bilingual word definitions

User requirement: clicking a word shows Chinese and English meanings automatically in the existing popup. Keep pronunciation, notebook, mobile layout and current learning state.

Implementation decision: retain the current English API, add a licensed ECDICT subset as same-origin letter shards, and request both in parallel. Course Chinese remains first; general dictionary definitions and headwords keep explicit provenance. The dictionary ships only definitions for current content and common words; unknown terms remain honestly uncollected, with the existing external-dictionary link available. No new account, paid API, remote student text submission or database migration is needed.

## Steps

- [x] Inspect actual popup/service and reproduce the language gap: English-only API, course Chinese for some words.
- [x] Add failing tests then implement lazy local lookup, validation, bounded fields, cache, abort and timeout.
- [x] Compile a source-pinned, attributed subset and verify its content, source identity and reproducibility.
- [x] Add actual popup tests before merging parallel results, separate languages, preserve notebook metadata and reject stale responses.
- [x] Browser-check Chinese/English, source labels and narrow-screen popover; run full regression and independent review.
- [ ] Publish to the original site without replacing concurrent remote changes, then verify the live popup.

Ownership: root dictionary-service.js and local-service tests/release; data worker dev builder + dictionary-data + data tests; UI worker word-popup functions in app.js + dictionary-ui tests. No changes to quiz grading, SRS or mobile navigation.

Verification: new tests must fail before implementation. Full Node test suite is the final gate. Use CUA for actual browser interactions; test fixtures stay on the local preview. Public verification uses existing words without entering private examples or changing scores.

Progress: 50 dictionary-focused tests pass (including builder, provider timeout/cancellation, UI arrival-order and notebook compatibility). Independent review found no high-priority issues. Mobile 390px and 320px layouts, desktop 1024px, one-click bilingual results, original-form provenance, notebook save and reload were checked via CUA. All 59 corpus-input hashes and all 26 shard/license hashes match. Full regression is waiting for restoration of pre-existing tracked audio omitted by this sparse checkout; no application/test workaround is being introduced.

Regression gate: full Node suite passed 549/549 with local-network permission (the sandbox otherwise blocks localhost range tests). All pre-existing audio files required by the new Book1 release were restored byte-for-byte from tracked Git objects; audio diff is empty. Before publish, merge ca6736d from origin/main to preserve the concurrent lesson-recall flow, then rerun the merged suite.
