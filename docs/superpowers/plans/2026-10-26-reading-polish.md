# Reading polish implementation plan

**Goal:** Keep a clear reading position and accurate system-speech highlight while making the existing translation control usable on phones.

**Scope:** Existing reading UI only. Preserve course IDs, textbook English, audio assets, exercise counts and learner storage.

- [x] Inspect touch target, repaint lifecycle, stale alignment fallback and source scan notes.
- [x] RED/GREEN: retain a single-sentence paragraph translation as a labelled reference when alignment is stale.
- [x] RED/GREEN: separate ReadingView controller, exact audio lesson identity, same-root/same-lesson anchor restoration, MP3/no-root and thrown-action safety.
- [x] Move the existing translation checkbox to a sticky reading-only toolbar; enlarge existing touch targets and wrap speaker labels.
- [x] Browser verify mobile/deep-reading checkbox, same sentence offset, TTS repaint, word popup and other tabs.
- [ ] Full regression, source-preserving review, publish and public smoke.

Source scan checks confirm lesson16 this. note and lesson90 cats appear in the supplied scan. Keep source text and its existing notes instead of silently correcting it.
