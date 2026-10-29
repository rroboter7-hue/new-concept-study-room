# Four main entries implementation plan

> **For agentic workers:** Execute with superpowers:executing-plans, inline. Final fresh-context review before release.

**Goal:** Make 学习 / 复习 / 词库 / 我的 useful, simple and consistent on phone and desktop; add a brief source-backed lesson focus card.

**Spec:** Human approved the preceding four-entry proposal and direct deployment, then requested each lesson's main tense and brief learning priorities. No login or payment implementation.

**Architecture:** Preserve route names and atomic pipeline saves. Reuse bookshelf, review engine, contextual writing library and records/backup handlers. Keep entry presentation state in memory, separate from learner evidence. Add scoped CSS, no UI dependency.

**Files:** app.js navigation/directory/profile; bookshelf-home.js and mobile-learning-shell.js labels; main-entries.css responsive presentation; index.html wiring; learning-pipeline.js reading focus; regression tests.

## Constraints
- New word/usage 5 sentences, old knowledge1–2, all existing drafts/corrections and cache guards remain.
- Use existing verified contextual meanings and first-book/prior-lesson horizon; never expose future words as learned.
- Viewing, filtering, bookmarking and overview do not award mastery.
- All navigation saves must complete before leaving; failed saves leave current page and editor intact.
- Four tabs have one current marker, visible keyboard focus and >=44px targets. No duplicate navigation bars.
- Tense summaries come from this lesson's grammar notes, not guessed from sentence counts. Non-tense lessons say main grammar rather than inventing a tense.

## Steps
- [x] Regression-first: directory source/category/favorites; filter/scroll persistence; failed-save preservation; overview source/length/escaping.
- [x] Implement four entry presentation and compact directory, profile actions, home continuation order; preserve daily review session on normal tab return.
- [x] Add source-backed reading overview from getKeyPoints with max3 grammar points and1 caution.
- [x] Integrate counterpart's pending mobile simplification/audio changes, then focused tests and browser phone/desktop QA.
- [ ] Final review, full original-media CI, deploy to original Pages URL, verify bundles and live entry flows.

## Ledger
- Native managed-worktree tool rejected nested sourceRoot (not an attached root). Used a new sparse linked worktree inside writable workspace; old experiments untouched.
- Base e192cae. Counterpart owns pending mobile-study-simplify changes; wait for its precise published head before integration/push.
- Approved existing blue/white layout is binding; no new redesign approval needed.

- Final base fd20a08 merged. Independent review passed after fixing shelf detour and exact study-stage scroll restore. New directory/overview/navigation regressions,116 integrated checks,27 continuation/shelf checks,39 dictionary/storage legacy checks passed. Final focused gate19/19.
- Browser QA:320/390/1280, no overflow; one current nav marker; real review draft/filter survives tab return; saved get-up bookmark,120% font and backup preview verified. Published package6 JS/1 CSS generated and source-backed focus shown; no console errors.
- All global entry navigation still waits for existing atomic saves. Presentation filters/positions stay in memory; no new learner-evidence field is written.
- Saved bilingual explanations/notes and existing explicit mastery/removal controls retained inside a disclosure; meanings and examples remain escaped.
