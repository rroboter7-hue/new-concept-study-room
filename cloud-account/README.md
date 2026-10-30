# Fixed-account progress sync

GitHub Pages remains the frontend. A Cloudflare Worker authenticates five fixed accounts and stores only their learning records in D1. No public signup or account-management endpoint exists. `account-config.js` stays disabled until remote verification succeeds.

## Provisioning

Use the official Wrangler CLI after the owner completes Cloudflare login and confirms the Workers/D1 authorization. Create a D1 database named `zhixin-study-progress`; add its returned ID to the `DB` binding in `wrangler.jsonc`. Apply `schema.sql` to that database.

Run `node cloud-account/generate-accounts.mjs ABSOLUTE_PRIVATE_DIRECTORY` once. The output directory must be outside the website checkout. It creates five unique 256-bit random passwords, their HMAC verifiers in `seed.sql`, the server pepper in `pepper.txt`, and a private credential list. Existing files are never overwritten. Passwords and pepper must never be printed, committed, or copied into the static site.

Apply the generated `seed.sql` to D1; send `pepper.txt` through stdin to `wrangler secret put PASSWORD_PEPPER`. Keep `ALLOWED_ORIGINS` restricted to the existing GitHub Pages origin. Deploy the Worker and test authentication, account isolation, last-edit ordering, logout, and real device access before enabling the public endpoint in `account-config.js`.

The original HMAC-only verifiers accept only the original 43-character random secrets. They never accept short passwords.

## Short assigned credentials and rotation

The five assigned usernames can be shortened to `a01`–`a05`, with distinct uniformly generated eight-character alphanumeric secrets. These use a strictly versioned, account-bound, domain-separated HMAC-SHA256 verifier with an independent 16-byte random salt and the server-only pepper. Login attempts remain limited by account and IP before verification. Session tokens remain independent 256-bit random values; an eight-character password is never a bearer token.

This is the assigned-random-secret scheme for five fixed accounts, not a general password-hashing service for arbitrary user-chosen passwords. It relies on keeping the pepper secret and enforcing the online rate limits; the salt does not make HMAC a slow KDF. A database-and-pepper compromise would allow offline guesses against the eight-character secret space. Native PBKDF2 candidates were tested on Workers Free but exceeded the nominal 10 ms CPU budget (including a cold 20,000-iteration sample at 23 ms); the bounded keyed-verifier design avoids adding a new browser protocol or paid service. Do not accept user-chosen passwords without revisiting the scheme. Keep the shared legacy HMAC helper fast, as it also protects rate-limit bucket identifiers.

Run `node cloud-account/rotate-accounts.mjs ABSOLUTE_SNAPSHOT_JSON ABSOLUTE_CURRENT_ACCOUNTS_JSON ABSOLUTE_PEPPER_TXT ABSOLUTE_UNUSED_PRIVATE_DIRECTORY`. The snapshot contains the seven account rows, including two disabled QA accounts. The command writes a pending private handout and SQL without changing production. Keep every input and output outside the website checkout. Back up the existing private handout before replacing it.

Deploy the backwards-compatible Worker first. The generated `rotation.sql` contains one atomic `UPDATE`, with a materialized guard checking all seven original identities, verifiers, counters and revisions before modifying the five formal accounts. It does not rely on whole-file import transaction semantics. A stale snapshot or a failing row aborts the statement, including session-trigger effects. IDs and learning entries remain untouched; the existing credential trigger revokes old sessions, and conditional session creation rejects a login verified against a concurrently replaced credential. Confirm all new logins, old-credential and old-session rejection, disabled QA status and identical entry/counter snapshots before delivering the replacement handout.

## Data and behavior

- Syncs progress, wrong answers, saved words, notes, and text drafts. Course files, recordings, settings, and admin secrets stay outside the cloud projection.
- Accounts use separate IndexedDB stores with a small synchronous recovery journal; guest data stays intact. Cached accounts open locally before any cloud request.
- The first login offers migration only when real guest learning data exists. Migration fills missing account entries and preserves the guest original and a recovery snapshot.
- Each entity carries its durable edit time and ID. Newer edits win; late arrivals do not win solely by arriving later. Cloud and browser use the same binary tie ordering.
- Edits upload automatically; visible pages check for remote updates periodically. “立即同步进度” flushes the current editor, uploads local changes, and pulls remote changes.
- Network/auth/storage failures retain local data and never report false success. Account logout preserves local account and guest copies.

## Verification

Run the account tests and affected storage, bookshelf, review, and delivery regressions. Use synthetic data for real browser/cloud tests. Verify two independent device stores, offline reopening, different drafts, same-item latest edit, stale responses, and local save failure. The final source CI and Pages deployment are coordinated through the publishing checkout; do not independently push `main` from this feature worktree.
