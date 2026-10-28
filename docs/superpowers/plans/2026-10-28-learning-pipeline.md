# Fixed Learning Pipeline Implementation Plan

> **For agentic workers:** Use subagent-driven-development for isolated core/audio/writing modules; root owns app integration and rendered verification.

**Goal:** Replace competing study menus with a resumable five-stage lesson flow: optional reading/audio, 70/30 grammar choices, free sentence practice, recap, lesson key points.

**Architecture:** Keep canonical lessons, source recordings, legacy drafts and storage reconciliation. Add pure question/attempt planning, an independent free-writing draft namespace, a focused pipeline renderer, and exact-text synthetic sentence audio. The existing app remains the owner of lessons, dictionaries, audio and backup import/export.

**Tech stack:** Existing browser JavaScript/CSS, StudyStorage, Node built-in tests; Windows SAPI source synthesis and portable FFmpeg for static MP3 assets.

**Spec:** User message in this chat dated 2026-10-28: stages 0–4, 70% current / 30% prior, five freely combined sentences per new word/phrase, 1–2 per selected prior target, persistent drafts and route, automatic objective mistakes, grounded lesson summary.

## Global constraints

- No forced affirmative/negative/question quotas in the new writing workflow; preserve old four-form drafts.
- Prior material must come from earlier lessons, with earlier books limited to confirmed studied material.
- Report unavailable question counts honestly rather than duplicating or inventing a 70/30 ratio.
- Local checking is conservative and labelled; no external upload of learner sentences or exposed API keys.
- Synthesized clips are labelled as synthetic, match exact reading units, and do not replace the original full-lesson recording.
- Preserve inputs on failed saves; refresh resumes lesson/stage/question/active draft rather than showing the shelf again.

## Review focus

- A reload immediately after typing must preserve the latest draft and active location.
- Different meanings of the same phrase and temporarily removed targets must not erase saved writing.
- A review mistake belongs in the current recap while retaining its original lesson identity.
- Silent/unsupported browser speech must use a real clip or show a clear failure, never pretend playback completed.
- First lessons and books with fewer verified questions must display honest composition/shortfall.

## Tasks

- [ ] Pure core and objective attempt history: learning-pipeline-core.js + tests; RED→GREEN, real-bank and prior-book cases.
- [ ] Source-grounded question provider and lesson key points: no invented textbook sentences, exact lesson identity, all-book coverage.
- [ ] Free-writing module and sentence feedback: five free rows, prior targets, fusion, autosave, errors and stale async results.
- [ ] Audio lifecycle and real MP3 generation: voice readiness, exact mapping, loop/follow, cancellation, 276-lesson corpus and file validation.
- [ ] Root app integration: new fields/backup/route state, focused five-stage UI, dictionary and original audio callbacks.
- [ ] Restore localhost:4191; fix sparse media preview redirects; validate refresh, choices, writing, recap and audio in browser.
- [ ] Run changed-area tests, independent review, full CI and publish to the existing site after source verification.
