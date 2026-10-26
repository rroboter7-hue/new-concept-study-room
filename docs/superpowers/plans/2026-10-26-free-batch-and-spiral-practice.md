# Free batch checking and spiral practice

> **For agentic workers:** Use subagent-driven-development for independent content/core tasks, then integrate and verify together.

**Goal:** Expand the first ten Book 2 lessons to about twelve reviewed questions, revisit earlier knowledge actively, and let learners check any number of sentences locally and copy them for manual Doubao review without API fees.

**Architecture:** Keep the existing static vanilla-JavaScript site and canonical knowledge bank. Add a pure bulk parser/check/prompt module and an independent per-lesson bulk draft panel alongside the existing five-step practice. Append reviewed authored questions through the supported knowledge pipeline. Correct recurrence selection without changing existing review scheduling or mastery criteria.

**Tech stack:** Plain JS/CSS/HTML, Node built-in test runner, existing GitHub Pages hosting.

**Spec:** Approved user requests in this conversation: unlimited sentence count, free local checks plus manual Doubao copy, prior words/usage/grammar revisited in later lessons, all listed mobile pilot follow-ups started. No additional design approval gate is needed.

## Constraints

- Preserve existing draft fields, backup format, study records and audio.
- No paid API, key, backend, automatic transmission to Doubao or fabricated correctness scores.
- No silent truncation of bulk input; storage failures remain visible and in-memory text survives.
- First ten Book 2 lessons receive about twelve effective graded items; identify self-authored content and earlier source lessons accurately.
- Physical phone keyboard and real next-day learning are not verified by viewport emulation or simulated clocks.
- Keep concurrent main-branch changes when publishing; never force push.

## Review focus

- Very large pasted batches remain editable, cancellable, fully copyable, and safely escaped.
- Edits, course switches, restoration and failed saves cannot show stale checks or lose text.
- Conversion groups keep an explicit original and never invent relationships for arbitrary free sentences.
- Retrieval questions have a single defensible answer and trace earlier knowledge without suppressing their current-course grading.
- Due review selection uses actual source concepts and learned knowledge; time-based tests are labelled simulations.

## Tasks

- [ ] Write failing core tests; implement `StudySentenceBatch.parse/checkRow/buildPrompt/sanitizeDraft`.
- [ ] Write UI lifecycle tests; add per-lesson bulk drafts, asynchronous local checking, cancellation and clipboard fallback; integrate backup and flush events.
- [ ] Add and independently review question expansion for Book 2 lessons 1–10; preserve stable old question IDs and original indices.
- [ ] Quantify recurrence coverage; fix irrelevant grammar-card selection and diversity/learned prioritization, with regression tests.
- [ ] Run all regression tests and fresh mobile/desktop browser flows, including copy, reload and review navigation.
- [ ] Merge latest remote changes, publish original website and inspect deployed build. Record physical-phone and longitudinal verification as pending.
