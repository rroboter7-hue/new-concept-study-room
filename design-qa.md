# Mobile workspace design QA

final result: passed

Scope: the user's selected concepts 2, 4 and 5, followed by the explicit request to use one color scheme. The release keeps the existing learning engines and is available at `?pilot=all`; the ordinary no-query entry remains compatible with its existing layout.

## Visual target and rendered evidence

- Source visual truth: `C:/Users/Admin/Documents/Codex/2026-10-13/w-s-m/outputs/mobile245-release/selected-unified-design.png` (1459 x 1078 PNG, three adjacent unframed content panels).
- Local implementation: `http://127.0.0.1:4182/?pilot=all&build=mobile245-local`, actual meta build `2026-10-26-mobile245`.
- Reading: `C:/Users/Admin/Documents/Codex/2026-10-13/w-s-m/outputs/mobile245-release/12-reading-final.jpg`.
- Guided writing: `C:/Users/Admin/Documents/Codex/2026-10-13/w-s-m/outputs/mobile245-release/13-guided-final.jpg`.
- Bulk writing: `C:/Users/Admin/Documents/Codex/2026-10-13/w-s-m/outputs/mobile245-release/14-bulk-final.jpg`.
- CSS viewport: 390 x 844. CUA returns 375 x 812 JPEG captures, a uniform approximately 0.9615 capture scale. DOM layout checks use CSS coordinates. Browser scrollbar reduces document client width to 375px; document scroll width also measures 375px.
- Density normalization: compare each cream content panel of the reference independently, excluding the blue board, against the unframed implementation viewport, using relative content width. The generated board supplies no authoritative CSS viewport/device-scale metadata, so pixel-exact typography claims are deliberately avoided. Both source and all three implementation captures were opened together in the same comparison input. Readable full captures also provide the focused comparison of the title/audio row, source timeline/return controls, editor and primary actions; extra raster crops were unnecessary.
- State: Book 2, lesson 3. Guided step 5 has explicitly selected `postcard`, `private` and `in the end`, with real lesson 1 source links. Bulk uses the user's retained literal five-line draft and conversion mode. These selections differ from the mock's illustrative phrase and are intentionally not fabricated or automatically selected.

## Comparison history and fixes

1. **P2: excessive reading chrome and scrolling drift.** Initial capture `01-reading-initial.png` showed a large progress panel above the story; earlier focus scrolling could hide the mode navigation. Hid routine progress/source chrome behind reachable tools, kept the lesson-return banner visible, and changed mobile mode transitions to immediate header focus. Post-fix reading evidence: `09-reading-merged.png`.
2. **P2: editor/check action pushed below the mobile viewport.** `06-guided-verified.png` placed the combined editor below the three tall source rows; initial bulk controls similarly consumed too much height. Compressed the real source timeline, put short source/meaning metadata on one line, visually hid redundant vocabulary repetition, moved other practice modes after the main editor, and shortened the resizable bulk editor to 270px. Guided input remains 116px and 17px type. Post-fix `10-guided-final.png` places the full check button at CSS y790–843; final bulk evidence `11-bulk-final.png` shows both primary check and manual-copy actions.
3. **P2: mixed light/dark palette.** The user's final instruction replaced the earlier mixed-color combined draft. All three screens now use cream `#fbf9f3`, forest green `#265b50`, ink `#17342e` and muted sage surfaces. The historical `mls-writing-dark` class only gates a layout branch and does not apply a dark theme.
4. **P1: disabled-shell callback exception and library-context loss on resize.** Added the disabled/destroyed guard and limited study rerendering to the study route. Verified ordinary no-query output works, and a library writing draft remains identical with exactly one output root across 390 -> 761 -> 390px.
5. **P2: hidden audio provenance and misleading fixed question-count CTA.** The reading tools menu exposes the unique translation checkbox, audio type and audio-source link. The CTA now says “读完，去练习” and preserves existing practice progress. Actual course 96 selection and its twelve-question data were checked before the remote merge; the merged release retains the new twelve-task runner and its complete regression suite.
6. **P1/P2 integration risks from concurrent reading updates.** Preserved the remote sentence-aligned translations, practice-pack engine, source-return state, Book 1 sources, backups and audio state. Extended mobile type to `.reading-pair`, retained the actual source-return banner, excluded static inline audio from bottom occlusion, and labelled non-Book-2 source lessons correctly. Final reading, translation toggle, audio provenance, old-course return and restored guided draft were verified in the merged tree.

7. **Concurrent daily-output integration:** retained task/evidence/assistance state and flexible/transform modes. The new daily coach is reachable through “今日任务” in the learning menu without occupying the default reading/writing viewport. Explanation drafts remain visible and unchanged across 390 -> 761 -> 390px; returning to writing closes the task panel. Final merged screenshots are `12-reading-final.jpg`, `13-guided-final.jpg` and `14-bulk-final.jpg`, compared together against the selected unified reference.

## Required fidelity surfaces

- **Fonts/typography:** Georgia/Times serif story text is 24px/1.75 at 390px; system sans Chinese, 17px/1.85 translations and 17px editors. Compact source labels are secondary metadata; meanings remain 16px. Real titles wrap naturally. Platform font rasterization differs from the generated board and is an accepted rendering difference.
- **Spacing/layout:** book-page composition, three primary modes, vertical source sequence and focused editor follow the reference. Additional five-step and guided/bulk controls preserve existing functionality. Actual full lessons remain scrollable; no fake shortened text is substituted to match the mock. Inline audio and hidden study bottom navigation do not cover editing actions.
- **Colors/tokens:** all three states use the same warm paper/forest palette. White/green text on the primary actions, focus outlines, neutral status text and selected controls remain distinct. No charcoal editor remains.
- **Images/assets/icons:** the selected reference has no photographic or illustrative asset requirements. Standard navigation/audio symbols use the existing app icon system; no generated illustration is replaced by CSS art. Native textarea, range, select and radio controls provide actual behavior rather than a mock raster.
- **Copy/content:** app labels are concise and coherent. Real earlier sources replace illustrative mock selections. “检查五句基本要求” and local-check scope text accurately describe limited checking; no semantic-correctness or mastery claim is introduced. Manual Doubao copy says users paste and send themselves.

## Interactions and responsive evidence

- Reading/guided/bulk mode switching, menu open/close, records and document library navigation.
- Lesson drawer closes and restores inert state; course96 reachable; one `#play` node throughout.
- Original audio playback/pause, speed1.25, loop and seeking; desktop resize restores the original fixed player node.
- Translation off/on changes lesson3 pair translations from11 ->0 ->11; audio mode/source remain reachable under reading tools.
- Explicit guided source selection, native disclosure persistence, draft reload and source lesson return preserve the saved combined sentence.
- Bulk five-line checking, collapsed scope notes, literal input preservation, saved correction notes after reload, and complete manual-copy content verified. No third-party submission occurred.
- 320px: no horizontal overflow (client and scroll width305px), 17px editor font. Desktop widths761/1024 restore desktop presentation without cloning audio or losing library draft. Course controls retain practical 44px targets; long input/source text can wrap and scroll.
- Console: both local mobile workspace and ordinary no-query output tab returned no console errors.
- Automated regression: **484/484 passed**, no skipped/cancelled tests, in `outputs/mobile245-release/final-tests-fixed.log` in the parent workspace. The suite includes active bulk/guided lifecycle, storage compatibility, asynchronous cancellation, canonical curriculum, reading alignment/audio state, practice packs and mobile integration.

## Residual test gaps and accepted differences

- Real phone soft-keyboard behavior and an actual next-day retest remain pending, as previously deferred by the user. Responsive browser tests and simulated schedule boundaries do not substitute for them.
- The mock's prefilled phrases, truncated sample story, exact icon placement and decorative arrows are illustrative. Actual source content and honest editable controls take precedence.
- No actionable P0/P1/P2 findings remain in the compared local implementation. Optional P3 refinement: fine-tune secondary metadata sizing after real-device feedback.

## Implementation checklist

- [x] Uniform palette and selected three-part mobile workflow.
- [x] Real source provenance, existing drafts and original player preserved.
- [x] Design comparison after density fixes and remote integration.
- [x] Responsive browser interactions, console and full regression suite.
- [ ] Verify published build and save public screenshot after deployment.
