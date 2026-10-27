# Sentence Word Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement the user-selected old-word bottom sheet in the existing sentence practice.

**Architecture:** Keep the static vanilla-JS application. Extend the DOM-free sentence core with a deduplicated prior-course word bank and bounded draft selections. SentencePractice owns the native modal dialog, filtering, selection chips and persistence; existing audio supplies pronunciation.

**Tech Stack:** JavaScript, CSS, HTML, node:test, CUA browser.

**Spec:** docs/superpowers/specs/2026-10-27-sentence-word-picker.md

## Global Constraints
- Preserve four-book content, source text, reading/audio/mobile updates.
- No new dependencies, no local server start, no changes to mastery records from selecting words.
- Three categories: verbs, adjectives, idiomatic expressions; no repeated visible source-lesson labels.
- Preserve existing drafts, per-target/mode/round separation and finite-check limitations.

## Review Focus
- Prior-course words are available even without browser learning history; current/future content stays excluded.
- POS and meanings must be reliable; duplicates have one selectable identity.
- Empty selection stays empty after refresh; old single selections migrate once.
- Modal filtering and changing categories must not lose focus, selections or writing drafts.
- Small screens and keyboard scrolling preserve access to the confirmation bar.

### Task 1: Word-bank model and draft migration
- [x] Write and run failing tests for scope, POS, deduplication, search inputs and migration.
- [x] Add `StudySentences.wordBank(options)` and `selectedOldKeys` sanitization in sentence-core.js.
- [x] Run the new and existing sentence-core suites.

### Task 2: Selected drawer UI and integration
- [x] Write failing interaction tests in tests/sentence-word-picker.test.cjs.
- [x] Replace source selectors with a drawer entry and selected chips; add accessible category/search/list/footer behavior in sentence-practice.js/css.
- [x] Reuse app icon and audio callbacks, migrate saved selections, preserve checks and drafts; update superseded UI assertions.
- [x] Run sentence and output integration suites plus a fresh reviewer.

### Task 3: Rendered verification and release
- [x] Use existing local file/browser support without starting a server; capture matching mobile and desktop states.
- [x] Verify multi-select, search, pronunciation, remove/clear, close/confirm/focus and refresh persistence; compare with selected mock.
- [x] Record design QA, bump release build, run full supported suite, preserve remote updates and publish verified changes.
