# Retelling Review and Pronunciation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task in the isolated checkout.

**Goal:** Complete retelling hints, retain a useful correction history and let learners hear their writing targets.

**Architecture:** Reuse source-bound hint, sentence feedback and speech services. A focused retelling-review module owns sentence segmentation, feedback sanitization and summaries; LearningPipeline owns saved per-lesson records and interaction guards. FreeWritingPractice receives an existing speech callback.

**Tech Stack:** Existing vanilla JavaScript UMD modules, CSS, Node test runner and browser UI tests.

**Spec:** docs/superpowers/specs/2026-10-30-retell-review-audio.md

## Constraints and review focus

- Preserve guest/account drafts, backups and five sentences per new target.
- No external upload, new provider, remote AI call, exact-match grading or claims of perfect grammar.
- Bind async results to lesson and draft; preserve active input on late responses.
- Handle abbreviations/names/quotes when splitting prose; include punctuation-only problems.
- Escape source/user text, preserve Unicode names, avoid title-case false positives and invented people.
- Save errors and correction history with failed-save recovery and compatible cloud entity storage.

## Tasks

- [ ] Pin source-name/noun completeness and pronunciation callback behavior with failing tests.
- [ ] Implement complete source-bound hints and accessible target pronunciation; rerun existing hint/writing tests.
- [ ] Pin paraphrase-safe local checks, issue summary, staleness, correction history and async navigation guards with failing tests.
- [ ] Implement focused review module, retell UI actions/storage and manual Doubao copy guidance.
- [ ] Verify backup/account projection round trip, existing pipeline lifecycle and draft protection.
- [ ] Browser-check phone and desktop retelling, long names, pronunciation interaction and correction save/reopen.
- [ ] Commit independently; integrate only after stable account release and feature acceptance checks.
