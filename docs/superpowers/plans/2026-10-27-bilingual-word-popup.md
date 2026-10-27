# One-click bilingual word definitions

User requirement: clicking a word automatically shows Chinese and English meanings in the existing study-site popup, retaining pronunciation and notebook use on phones.

Implementation: retain the English API and add licensed ECDICT data as lazy same-origin letter shards. Chinese and English fields, source labels, POS and examples stay separate. Course Chinese has priority. Shared request identity and cancellation prevent stale replies from replacing a newer popup. Notebook fields remain compatible. Unknown terms are explicitly uncollected.

## Completed steps

- [x] Reproduce the English-only gap and inspect the actual popup/service.
- [x] Add failing tests, then implement validated local lookup, bounded fields, cache, abort and timeout.
- [x] Build and verify a source-pinned ECDICT subset with MIT attribution, input/shard checksums and honest coverage.
- [x] Test automatic parallel arrivals, source priority, stale requests, notebook metadata, and separate language provenance.
- [x] Verify narrow-screen layout and notebook persistence; run independent review and the complete merged regression suite.
- [x] Publish to the original site, preserving concurrent features, and verify the live phone popup.

## Verified result

- Published application commit: e461bd450ee14ae2267ff896b1942982ad8913fd.
- Live build: 2026-10-27-bilingual-v2; GitHub Pages action 40436490533 succeeded.
- Full merged regression: 601 passed, 0 failed/skipped. Dictionary-focused tests: 53 passed. New behavior and the Chinese POS/example fix were observed red before implementation and green after.
- Independent reviews found no actionable high-priority issues. Historical saved fields without a recorded source cannot reliably have their original provenance reconstructed.
- CUA local checks: 390px and 320px mobile, 1024px desktop, automatic bilingual lookup, went to go provenance, save/reload notebook compatibility, popup bounds and 16px mobile definition text.
- Live phone verification: hall shows ECDICT Chinese n. 门厅, 走廊, 会堂 and online English A corridor; a hallway, without online POS or examples leaking into the Chinese section. Course metadata on large also remained independent. Live console errors: none.
- Live screenshot: parent outputs/bilingual-word-popup/05-live-mobile-bilingual-v2.jpg. Full logs and qa.json are in the same parent output directory.
- Preserved concurrent complete Book1 readings/audio, lesson recall flow, source-bound retelling targets and responsive sentence-word picker. All 60 dictionary corpus input hashes match.
- Local tracked media required for full regression was restored from verified Git objects. No audio content or test was weakened. The task preview was stopped, temporary local tab closed and browser viewport reset.

Data: ECDICT pinned commit ab22ad36302cafc6349a050e2b60894855208055; 11,888 entries, 26 shards totaling 3,579,515 bytes. General dictionary coverage is finite; missing definitions remain labelled instead of invented. Full source CSV stays outside the repository for offline reproducibility.
