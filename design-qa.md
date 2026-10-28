# Selected vocabulary-library QA — 2026-10-28
final result: passed

Source visual truth: C:/Users/Admin/AppData/Local/Temp/codex-clipboard-e98ef35d-00d6-487e-bc2f-111ddc583ccd.png (selected category-overview mockup).
Rendered implementation: http://127.0.0.1:4191/; mobile390x844, desktop1280x900.
Evidence: ../outputs/integrated-study-2026-10-28/library-before-density.png, library-mobile-final.png, selected-references-inline.png. Source and rendered screenshots were presented together in one comparison input at matching portrait ratio; actual curriculum content replaces illustrative mock words.

## Iterations
- P2 long dictionary definitions, broken English wrapping and contractions in lexical verbs: short taught/source glosses, corrected categories, narrow complete-gloss validation, compact padding and accessible full labels implemented and recaptured.
- P2 recommendation row wrapped into an oversized block: one-row mobile strip and smaller preview cards implemented and recaptured. Word meanings stay brief; full labels remain in More and title/accessibility labels.
- P2 selected references disappeared on returning to writing: selected word+meaning strip now persists beneath entry; actual mobile capture confirms be careful / 小心 and until lunchtime / 直到午餐时间 remain visible.

## Fidelity and interaction surfaces
- Typography: system Chinese sans-serif consistent with existing site; readable hierarchy,14px English/13px short gloss/11px source metadata; full English accessible despite long preview labels using ellipsis.
- Layout: one entry, native picker, source tabs/search, target/recommendation, two-column category sections, full-width usage section, scrolling body and persistent return footer. Desktop900x810 panel centered with no horizontal overflow.
- Colors: existing blue-white surfaces and blue action/selection styling preserved. No semantic status color removed.
- Assets: source contains native controls and typography only; no raster content required. Existing UI controls used; no device chrome fabricated.
- Copy: real first-book/preceding-lesson data, short sourced meanings, no extra writing quota, no invented mastery or population error-frequency claims. Future lessons excluded.
- Behavior: actual mobile one-tap open, first-book scope, category More, paging1→2, keyword garden→花园, Escape with focus restoration, draft/selection restoration and inline references tested. Desktop grouping and console checked; console errors empty.

## Accepted small differences / follow-up polish
- Real source badges and44px touch controls require more scrolling than the illustrative mock. The usage and additional Other-words groups remain available inside the scrolling picker; persistent actions remain visible.
- A few long preview words use accessible ellipsis; More displays full words and brief meanings. No content is truncated in stored data.

## Verification
64/64 final targeted source/UI/app/regression checks passed. Full-source CI and production integrity/audio/UI verification remain release gates, not substituted by this visual QA pass.
