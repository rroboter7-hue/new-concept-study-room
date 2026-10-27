# Import lesson sentence drafts into batch checking

**Request:** Bring the learner's earlier sentences from this lesson into the batch editor, then copy them together for manual review in Doubao.

**Approach:** Collect every saved and in-memory SentencePractice draft for the active practice lesson, across targets, modes and daily rounds. Import labelled groups into the existing editor without replacing manual text; identical groups are skipped on repeat import. Preserve English originals, selected old expressions and the difference between free sentences and four-form conversions. Keep separate retelling, model examples and unrelated lessons out.

- [x] Add and test a pure current-lesson draft collector.
- [x] Add structured batch formatting/parsing and complete single-copy prompt generation.
- [x] Add visible import and copy-all buttons on desktop/mobile; retain segmented copy as an alternative.
- [x] Verify editing, repeat import, save failure, lesson isolation, long copy and manual clipboard fallback.
- [ ] Validate rendered flow and deploy to the original site.

Changed source drafts are appended as a fresh group rather than overwriting text the learner may have edited in the batch box. Historical phrase-writing records cannot be reconstructed; this feature imports persisted five-sentence/free-sentence drafts for both word and phrase targets.

Verification: collector/core/UI/integration tests pass. Full local suite is limited by omitted audio and Windows sandbox file/socket permissions; the complete Linux CI checkout must pass before deployment.
