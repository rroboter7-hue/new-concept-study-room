# Sentence Reading Implementation Plan

> **For agentic workers:** Use subagent-driven implementation for the independent bilingual data ranges, with root owning integration.

**Goal:** Make source/translation and dialogue turns visibly correspond sentence by sentence.

**Architecture:** Guarded bilingual content + shared pure reading model + existing app/audio integration.

**Tech Stack:** Vanilla JavaScript, static JSON build source, Node built-in tests, CUA browser verification.

**Spec:** ../specs/2026-10-26-sentence-reading.md

## Constraints

- Do not alter textbook English, course identity, questions, audio assets or learner storage.
- Do not infer translation pairing from equal counts or punctuation alone.
- Keep narrator/thoughts/quoted notes distinct; attribute speech only where context supports it.
- Keep word lookup, translation switching and audio sentence indexes working.

- [x] Confirm source/translation storage and reproduce old paragraph-only mobile layout.
- [x] Author and independently cross-check Book2 1–32,33–64,65–96 exact-source sentence translations.
- [x] RED/GREEN shared splitter, guarded model, grouping, escaping, checkbox and audio-index integrity.
- [x] Integrate the existing reader/audio and style desktop/mobile blocks.
- [x] Complete browser interaction checks and fresh full-suite validation.
- [ ] Merge any current remote changes, publish existing site and verify public release.

## Review focus

Check quoted terms versus speech, continuing quotes, inverted attributions, name abbreviations/initials, times/decimals, punctuation-only OCR fragments, stale alignment source and imported text fallback. Cross-check every English character and row index; retain untranslated third/fourth book content honestly.
