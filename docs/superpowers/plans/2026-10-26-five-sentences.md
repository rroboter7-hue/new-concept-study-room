# Five Sentence Practice Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Add five-sentence practice combining four sentence forms and previously studied vocabulary/phrases.

**Architecture:** Pure contextual/checking core, delegated DOM practice component, existing output-training integration. Sentence writing remains local and draft-based with no semantic correctness score. The separately authorized dictionary adapter queries only the clicked English word.

**Tech Stack:** Existing HTML/CSS/JavaScript, Node built-in test runner, IAB browser validation.

**Spec:** ../specs/2026-10-26-five-sentences-design.md

## Global Constraints

- Exactly5 sentences, ordered affirmative/negative/yesno/wh/combined.
- Old sources must be earlier and recorded studied or explicitly chosen for this round.
- Each sentence≤400 characters. Unknown grammar/meaning is review-required, never silently correct.
- No external API for sentence writing, automatic mastery score, production publish or edits to another chat's files. One-click dictionary lookup is the explicit separate external-service exception.

## Review Focus

- Correct inflections and irregular do/did forms must not be rejected by literal-word matching.
- Missing or malformed study history must not fabricate learned sources or crash the page.
- Switching word/course and reloading must retain distinct drafts and saved source selections.
- Unsupported valid sentences and subject-WH questions must be reviewable rather than falsely marked wrong.
- Storage failure and HTML-like input must preserve draft input without XSS or a fake saved state.

## Task1: Context and checking core

Files: create sentence-core.js and tests/sentence-core.test.cjs. Implements exact core interfaces in spec.

- [x] Write failing behavior tests for five-row ordering, earlier-studied/manual source filtering, target/phrase inflections, unsupported sentence feedback and duplicate combined sentence.
- [x] Verify RED with `node --test tests/sentence-core.test.cjs`.
- [x] Implement minimum pure core with no DOM/storage/network side effects.
- [x] Verify GREEN, including future-source rejection, word-boundary matching, contractions, Does…play / Did…go and Who… subject questions.

## Task2: Draft-first practice component

Files: create sentence-practice.js; follows constructor/render/flush and callbacks in spec.

- [x] Exercise rendering/save behavior against the real core; no score/mastery callback.
- [x] Implement target/source/old-word/phrase selection, five steps, references, per-row checks and local save status.
- [x] Prevent input loss during re-render, context changes and failed saves; encode all interpolated content.

## Task3: Integrate and verify

Files: modify output-practice.js, app.js, index.html, README.md; create sentence-practice.css and a local dev server if needed.

- [x] Integrate optional mode under output training; add recognized loaded state and backup persistence.
- [x] Reuse existing styles, accessible labels, visible focus and mobile single-column layout.
- [x] Run all project tests and syntax checks; independently review changes.
- [x] Serve local preview and verify mobile selection→five inputs→check→switch→reload→retained drafts, plus original spelling/reading mode.
- [x] Save screenshot evidence and report exact limitations. Provide reviewable local result; publish only after the user authorizes publishing.

## Added dictionary scope

- [x] One click shows local Chinese immediately and automatically requests online English without a second query button.
- [x] Request cancellation, escaped bounded results, verified Chinese dictionary link, timeout/failure fallback, pending-save enrichment and apostrophe normalization are covered.
- [x] Actual browser lookup returned a Free Dictionary API result for private, with local Chinese retained.

## Final verification

74 Node tests pass; syntax checks and git diff --check pass. IAB verified 390px and 320px flows, per-target draft isolation, refresh restoration, existing spelling mode, actual online lookup, rapid word changes and popup scrolling. 320px document width equals its available 305px client area with the desktop scrollbar; no horizontal overflow. No browser warning/error logs during the final smoke flow. Sentence feedback remains a bounded rule check with human review for unsupported structures. Public deployment unchanged.
