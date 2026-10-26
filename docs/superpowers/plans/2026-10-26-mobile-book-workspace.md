# Mobile book workspace implementation plan

**Goal:** Combine the user's selected mobile concepts 2, 4 and 5 into the existing learning site and publish the verified result.

**Visual truth:** `outputs/mobile-design-exploration-20261026/displayed-options.json` in the parent workspace resolves the selected images. The combined reference is `C:/Users/Admin/.codex/generated_images/01a176dc-a4c8-7722-978b-18d0c725496a/exec-3adaaea2-ef28-4184-a099-213b7321eb91.png`. Three states belong to one experience: cream reading, explicit old/new knowledge links, focused bulk editor. Latest user steering unifies all three in cream with a forest-green accent; no dark mode switch. The historical mls-writing-dark selector is retained only as a layout-state gate. Existing product runtime is retained; this is not a fresh prototype.

**Architecture:** Keep app-owned navigation, audio, storage and learning engines. The mobile shell owns three primary mode controls and moves the original player into reading flow, restoring it at the desktop breakpoint. Existing guided and bulk components gain scoped mobile presentation branches. No data migration, API or curriculum change.

**Tech stack:** Existing vanilla JS/CSS/HTML, Node built-in tests, CUA in-app-browser verification, GitHub Pages.

## Contracts and ownership

- Root: `mobile-learning-shell.js`, new `mobile-book-workspace.css`, `app.js`, `output-practice.js`, `index.html`, release metadata and integration tests.
- Guided worker: `sentence-practice.js/css`, `tests/sentence-mobile245.test.cjs`.
- Bulk worker: active `batch-sentence-practice.js/css`, `tests/batch-mobile245.test.cjs`.
- Shell adds `mls-book-workspace`, `mls-mobile`, and `mls-writing-dark` on body. The dark class is set before bulk rendering. `onBreakpoint` flushes drafts and rerenders the active reader without resetting its mode.
- `openTab(tab)` enters study before selecting the app tab; mobile proxy buttons use `data-mobile-tab`, not the app's globally rewritten `data-tab`.
- `OutputPractice.onModeChange(mode)` synchronizes shell state before guided/bulk render.
- Preserve the original unique audio IDs by moving one `.player` node; never clone audio controls or mount inside the replaced reader content.

## Constraints and review focus

- Preserve `zhixin-study-v1`, sentencePractice, sentenceBatches, legacy sentenceBatch, backups, schedules, 96x12 questions and all audio.
- No automatic vocabulary selections, invented completed progress or AI correctness claims.
- Mobile source/advanced controls stay reachable via disclosures; desktop behavior remains available.
- Keep input caret stable during typing; invalidate old async work on navigation.
- Player/nav do not cover editing controls; inline audio reserves no fixed bottom spacing.
- Restore player, course panel, inert state and focus when leaving mobile or destroying shell.

## Tasks

- [x] Add failing tests for presentation states, proxy routes and original-player identity; implement shell and app integration.
- [x] Add mobile guided knowledge timeline and compact disclosure controls, with regression tests.
- [x] Add focused editor and progressive advanced controls, preserving lifecycle tests.
- [x] Inspect reading, guided and bulk states against selected references at 390x844; verify 320px and desktop restoration.
- [x] Verify audio, lesson96, sources, draft reload/copy/backup, drawer and console; run the full suite.
- [ ] Save design-qa.md, merge any concurrent remote changes, publish and verify the live build.

Real phone keyboard and actual next-day retention remain separate pending acceptance; responsive browser checks do not substitute for them.

Integration note: retained subsequent sentence-aligned reading, twelve-task practice packs, first Book1 passages and daily-output coach from origin/main. Daily tasks stay reachable through the mobile menu. Final merged automated suite: 484 passing tests; real phone acceptance remains pending.
