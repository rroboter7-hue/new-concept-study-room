# Reliable course update implementation plan

**Goal:** Normal phone/desktop reopening uses the current release without changing URLs or deleting learner records/drafts.

**Design:** Network-first bounded document navigation with verified old document fallback. Install a new worker without forcibly navigating existing editors; retain pinned compatible resource caches. If cache storage is full, a verified release can run online without deleting old compatible caches. Client retries update checks on startup/online/resume, with bounded failures; a newer active version reloads only after the app's existing shelf/draft guard approves it. No localStorage/IndexedDB mutation by cache modules.

**Constraints:** Keep original scope, integrity hashes, atomic offline cache completion, origin restrictions and backup schemas; no cache-wide clear, unregister or forced editor reload. Existing legacy clients need to allow the new worker to install before their next navigation; cannot force an unknown editor to reload safely.

- [x] Reproduce stale index, frozen-tab retention budget and missing automatic retry in targeted tests.
- [x] Implement bounded navigation refresh, verified online-only install fallback and automatic activation without editor reload.
- [x] Implement client safe automatic handoff/check/retry and independent storage-preservation tests.
- [x] Test old→new upgrade, offline fallback, failed saves, suspended/other editors, malformed responses and storage failure.
- [ ] Browser mobile/desktop upgrade QA, full CI, original-site deployment and public verification.

Evidence:55 focused tests pass. CUA legacy cached editor remained mounted with2 original drafts while new worker activated; unchanged local URL B→C reopened current HTML immediately and restored same course/stage/both drafts. Phone375px and desktop1265px verified; no learner storage access in worker/client tests (storage getters throw).
