# Learning clarity and correction loop implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Goal:** Keep the current six-stage layout while correcting vocabulary presentation, clarifying workload and local storage, and supporting learner-owned corrections.

**Architecture:** Extend existing vanilla JavaScript modules and their saved draft schema compatibly. Preserve source keys and existing answers, do not infer mastery from copies or local rules. Publish only scoped changes after source tests, mobile checks and production integrity validation.

**Tech Stack:** Vanilla JS/CSS, node:test, GitHub Pages.

**Spec:** User's accepted audit table and follow-up messages in this chat, 2026-10-29.

## Global constraints
- New vocabulary/usages each retain 5 cumulative sentences; old targets retain 1–2.
- No compulsory sentence forms, duplicate menus, automatic cross-device sync or invented content provenance.
- Preserve unrelated dirty reading-view and sentence-mistake experiments; no blanket staging.
- Explicit user publication authorization from earlier website work remains applicable.

## Review focus
- Existing drafts and historical extra rows survive schema extension, conflicts and replacement restore.
- Changing a sentence invalidates stale checks/copy feedback without dropping correction notes.
- Unknown POS/source must not be fabricated; normalize lookup separately from display.
- Reference selection remains target-specific and optional.
- Local-rule success and learner-marked corrections never award proficiency.

## Tasks
- [x] 1. Copy current writing group with review instructions, guarded async result and manual fallback. Existing four-file candidate; rerun source tests and mobile fixture before acceptance.
- [x] 2. Vocabulary: POS on recommendations, selected footer/inline references; preserve capitalization for nationality words and display long labels up to two lines. Verify storage keys unchanged and fallback for unknown POS.
- [x] 3. Writing: clarify today's remaining versus cumulative goal; save optional external correction notes/reference and offer retry with original preserved; truthful statuses (local checked/needs review/self marked), no auto mastery.
- [x] 4. Retelling/key points: scene-sized Chinese support, narrator hint, progressive hide controls; prioritize passage-supported grammar examples and label authored/extension sources. Do not globally rewrite 276 lessons with invented content.
- [x] 5. Local data: visible local-device notice and discoverable backup/restore shortcut using existing UI. Measure startup cold/warm if supported; do not add risky lazy loading without evidence.
- [ ] 6. Focused regressions, independent review, mobile render checks, exact staged file inspection; publish to original website; CI and public source/package verification.

## Ledger
- Baseline: 7de9259. Prior copy patch has independent 47-test verification in this chat and counterpart 104-test verification; mobile check pending.
- Ruling: Startup architectural rewrite is gated on measurement; retain robust all-catalog health check in this release unless evidence supports a small safe change.

- User steering: support desktop layouts and tiny three partially-filled frequency stars (~0.1 precision); no added practice button or quota.
- Frequency: wordfreq 3.1.1 (CC BY-SA4 derived data), 7,476 curriculum word forms; 83 exact phrase matches from 10,000 top-sentence subtitle sample, source bias disclosed. Unknown is unmeasured, never low frequency.
- Task3 fix round1: remote answer/fusion ABA now invalidates pending checks; reviewer approved19/19 correction+safety tests.
- Whole staged review and final tools-only follow-up approved, no P1/P2. Targeted99/99, integration89/89 and final app16/16 passed (overlapping suites, not summed). Mobile390 and desktop1440 rendered with no horizontal overflow; no production answers entered.
- Startup decision: retain established package health check/retry. Cold-device Android performance was not measured, so no lazy-load rewrite or speed claim in this release. This retains a few seconds of startup initialization.
