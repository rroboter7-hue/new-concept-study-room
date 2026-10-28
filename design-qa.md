# Bookshelf and learning flow QA — 2026-10-28
final result: blocked (awaiting live visual capture)

## Scope
Selected target: option 2, blue and white bookshelf.
Reference: outputs/nce-home-concepts-20261028/concepts/02-modern-bookshelf.png, 853×1844.
Planned comparison viewport: 390×844 CSS pixels; also inspect 320px and desktop.
Implementation commit: 673451d4a1b483f14a751957183d0817198e892e.

## Verified before live capture
- Existing main reliability, translations, loader recovery and source content retained.
- Source suite: 1164 passed, 3 Windows/fixture skips, 0 failures before final boundary additions.
- Extra app notes tests: correct selected-sentence return and cross-lesson clearing passed.
- Final corrected-sentence boundaries and actual app integration: 32 passed, 0 failures.
- Original four-form drafts, legacy data and storage semantics preserved.
- Dedicated system-voice sentence playback does not claim timed recording excerpts.
- Fixed mobile bottom-nav event propagation and moved shelf return above the compact course header.
- Rejected oversized correction/recall writes; saved correction version history; fixed ten-item round identity.

## Live checks pending
- Homepage fidelity comparison with equal viewport and content state.
- Book expansion/close, book-local resume, search and favorite persistence.
- Exact sentence listening and notes return, translation toggle and whole-lesson playback.
- Correction capture draft/modal, daily review navigation and editor restoration.
- 320px and desktop overflow, keyboard focus, console and asset delivery.
\n## Pass 1 live finding\nP2: a390px mobile content viewport can place the bottom of the review CTA behind the fixed navigation. Reduced heading-to-covers spacing by5px and continue-card vertical padding by3px each side. Post-fix capture pending.\n
