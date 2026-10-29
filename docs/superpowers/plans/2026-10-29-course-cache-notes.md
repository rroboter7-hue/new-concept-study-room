# Course cache and note-state implementation plan

> For agentic workers: implement and review each independent task with its focused tests before integration.

**Goal:** Repeat visits load the bookshelf and course code from a verified browser cache; correction-note entries visibly show saved content; audit the four-book reading corpus without inventing missing text.

**Architecture:** Keep the current static GitHub Pages application. Add an origin/scope-limited, versioned course cache with atomic installation, compatible HTML/assets, graceful unsupported/quota failure, and no automatic reload while editing. User data stays in existing storage. Notes derive their visual state from existing correction fields and retain editor focus.

**Constraints:** Preserve the six-stage flow, drafts, backup and route-save gates. Cache text/code/practice and small shell assets, not the entire audio/PDF library. Updates must retain the usable previous version until the next version is fully ready. No new accounts or dependencies.

1. Cache owner: inspect runtime packaging and lifecycle; implement cache/client/build wiring and meaningful cold/warm/offline/update/failure tests. Report browser limitations.
2. Root: add immediate correction-note highlighting and an explicit existing-record label, including save/reload/merge/clear states without rerendering active editors; verify mobile and desktop.
3. Corpus auditor: compare actual 72/96/60/48 reading units to their source contracts, lesson identifiers, body hashes and paragraph/translation evidence. Distinguish Book 1 paired lessons from omissions; provide an evidence-based audit and fix only confirmed defects.
4. Integrate: read-only code review, targeted tests, genuine packaged warm/offline browser runs, full CI, direct publish and public verification. Do not claim a real-phone benchmark or word-for-word PDF audit unless performed.
