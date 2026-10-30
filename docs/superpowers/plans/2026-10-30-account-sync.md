# Fixed Account Cloud Sync Implementation Plan

> For agentic workers: use superpowers:executing-plans inline. User approved implementation, switched backend to Cloudflare, and offered generated account/password batch. No further execution-method confirmation is needed.

**Goal:** Five pre-created independent accounts sync text learning records across devices while preserving guest data, drafts and offline work.
**Architecture:** Cloudflare Worker authenticates generated high-entropy credentials and owns all D1 access. The client projects whitelisted learning data into independently versioned entities, automatically retains the latest edit, and keeps account-specific IndexedDB storage with a small synchronous local journal. Existing app integration is an optional, lazily loaded account panel.
**Tech Stack:** Vanilla UMD JavaScript, Worker ESM/Web Crypto, D1/SQLite, Node tests; no frontend framework or remote SDK.
**Spec:** ../specs/2026-10-30-account-sync-design.md with the user-approved Cloudflare amendment below.

## Approved amendment and rulings
- User explicitly selected Cloudflare Workers + D1 instead of Supabase to avoid manual idle restore.
- User subsequently offered a generated account/password batch. Prepare five fixed usernames; generate each password from 32 random bytes. Passwords may be saved by the browser; no public signup, weak custom password endpoint, or public account administration.
- Generated credentials are machine secrets with 256-bit entropy. Store only a purpose-separated HMAC verifier with a Worker secret pepper, never plaintext credentials. Sessions are separate random 256-bit tokens, hashed in D1 and revocable. Do not apply this fast-verifier design to human-chosen passwords.
- D1 has a 2MB row bound and free Workers have a 10ms CPU budget. Store bounded per-entity payloads (256KiB each), not a giant profile row. Total logical profile quota is10MiB/account. Server validates quota and versions atomically; use production CPU/connection validation before enabling accounts.
- Cloudflare account authentication/provisioning is not yet confirmed. Finish reviewable local code/schema/tests before requesting any needed official login. Do not claim live accounts until real remote isolation and cross-device tests pass.

## Global constraints
- Existing guest key remains zhixin-study-v1. Every account gets a separate key derived from authenticated user ID. Switching identity invalidates requests and returns to a clean shelf; never auto-import another person's guest record.
- Only explicit learned data whitelist syncs; no audio/PDF/course payloads, browser caches, credentials, settings or local file references.
- Formal records, review cards, mixed sessions and individual lesson pipeline records are indivisible entities; no hybrid grades or assistance upgrades. User changed the design to automatic last-edit-wins with no conflict picker. Atomically journal calibrated edit timestamps and IDs so older offline uploads do not win by arrival order.
- Cloud requests never block initial bookshelf. A failed local write cannot be shown as saved/synced; failed cloud work stays durable locally.
- No secret/token/password in source, fixtures, command arguments, logs or static site output. Only synthetic test credentials in unit tests; actual batch stored outside repository in an owner-only local file.

## Review focus
- Late identity changes must not write to the wrong local partition or update its UI.
- Crash after cloud ACK but before local metadata checkpoint must retry idempotently without overwriting newer edits. Cloud apply cannot generate a new local edit timestamp.
- Concurrent stale writes, tombstones, malformed payloads and partial network pages cannot silently drop records.
- Ongoing text inputs must not be replaced by incoming sync; account changes must flush before transition.
- Guest migration and disk-full handling must retain an exportable pre-transition snapshot.

## Task 1: Data projection, merge and local partitions
Files: account-data.js, account-bootstrap.js, account-cache.js; tests/account-data.test.cjs, tests/account-bootstrap.test.cjs, tests/account-cache.test.cjs, tests/account-storage-journal.test.cjs.
Interfaces: project(data)->{key:value}; apply(data,entities)->data; merge(base,local,remote)->{value,conflict}; Identity.key(storage,config), current(), activate(user,token), clear(). Keys encode validated JSON paths; words are keyed by normalized word. Unknown fields are rejected. Atomic entity boundaries follow the whitelist in code.
- [ ] RED tests: independent entities, exclusion of imports/settings/secrets; unchanged/matching/divergent edits/deletion; stable word identity; malformed paths/prototype keys; guest/account separation and failed pointer writes.
- [ ] Implement pure projection/apply/merge and optional identity selector; GREEN with node --test tests/account-data.test.cjs tests/account-bootstrap.test.cjs.
- [ ] Add optional StudyStorage.decoratePatch to atomically journal local edit stamps, skipped for source:'cloud'. Existing default behavior remains unchanged.
- [ ] Account cache keeps bulk data in IndexedDB with a durable localStorage WAL and dirty-key transactions; a parallel scoped helper owns this independent adapter only (account-cache.js + its tests), root continues controller/UI. Reject unavailable IndexedDB, preserve WAL on flush failure and other writers' keys; guest key never copied/deleted into another identity.

## Task 2: Authenticated D1 API and provisioning
Files: cloud-account/worker.mjs, schema.sql, wrangler.jsonc; dev/account-provision.cjs; tests/account-worker.test.cjs.
API: POST /v1/login {username,password}; GET /v1/me; POST /v1/logout; GET /v1/manifest; POST /v1/read {keys}; PUT /v1/entry {key,modifiedAt,writeId,deleted,value}. Every protected route derives owner exclusively from bearer session. Server atomically retains the last edit and returns the winning version. CORS allows the exact configured site origin, plus explicitly configured local test origin. Limit request sizes, usernames, keys, entity count and account bytes; all responses no-store.
- [ ] RED tests with real in-memory SQLite: wrong/expired/revoked auth, CORS, account separation, guessed user_id ignored, stale CAS409, idempotent duplicate, atomic quota, SQL/path injection, logout, login throttling.
- [ ] Implement schema/triggers and Worker using native crypto; GREEN.
- [ ] Provision script generates five credentials and SQL offline into ignored/private output, hides secrets from stdout; remote apply/deploy only after the concrete configuration is ready. Validate with Wrangler local runtime, then real free-plan CPU and endpoints when authorized connection works.

## Task 3: Durable synchronizer
Files: account-sync-client.js; tests/account-sync-client.test.cjs.
Interfaces: create({identity,storage,transport,snapshot,applyRemote,onStatus,now})->{sync,changed,stop,state}. State contains compact remote entity versions, not duplicate value snapshots. Manual sync pulls+pushes; autosave debounces pushes and visible-tab periodic/foreground checks pull. Transport wraps explicit Worker routes, timeout and generic errors without echoing secrets. Token errors require re-login.
- [ ] RED tests: two devices same account, disjoint changes, same entity conflict, deletion, queued offline changes, partial upload/resume, ACK/checkpoint failure, expired login, midflight account change, disk full, newer input during sync.
- [ ] Implement one serialized sync loop, bounded retries, durable conflicts, server-version CAS and idempotent recovery; GREEN.

## Task 4: Account panel and app lifecycle
Files: account-ui.js, account-ui.css, account-config.js, app.js, index.html; tests/account-ui.test.cjs, tests/account-app.test.cjs; minimal opt-in harness extension.
Panel provides login, status, manual “立即同步进度”, import guest prompt, logout. No conflict review. Keep one primary action. No auto focus on mobile. Cloud requests never gate the shelf; account bulk cache opens locally before using its namespace.
- [ ] RED tests: disabled config leaves existing app unchanged; enabled profile shows login; local namespace before app read; persistent input/flush guards; guest migration reversible; logout/other-tab identity switch freezes old UI before reload; remote commit preserves active draft DOM and refreshes read-only views on next entry.
- [ ] Integrate save hook to queue durable sync, add compact blue/white UI, build copy coverage for lazy files; GREEN.

## Task 5: Review, deploy and verify
- [ ] Test focused storage/review/pipeline/backup regressions. Run rendered mobile/desktop workflow with synthetic accounts and two browser sessions. Confirm no horizontal overflow, no extra first-paint API, no secret static file and no console errors.
- [ ] Fresh whole-branch reviewer; fix Critical/Important issues with RED→GREEN.
- [ ] Configure the user's free Cloudflare account, deploy schema/Worker, create five fixed accounts and verify real owner separation and synchronization. If login/terms are needed, explain the exact remaining setup and let the user complete it after local work is ready.
- [ ] Coordinate exact tested commits with the existing unique publisher. Complete-source CI and public build must pass; confirm actual cloud sync before reporting accounts usable. Deliver only the private credential file/link, never commit it.
