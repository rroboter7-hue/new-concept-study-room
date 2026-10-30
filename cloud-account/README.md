# Fixed-account progress sync

GitHub Pages remains the frontend. A Cloudflare Worker authenticates five fixed accounts and stores only their learning records in D1. No public signup or account-management endpoint exists. `account-config.js` stays disabled until remote verification succeeds.

## Provisioning

Use the official Wrangler CLI after the owner completes Cloudflare login and confirms the Workers/D1 authorization. Create a D1 database named `zhixin-study-progress`; add its returned ID to the `DB` binding in `wrangler.jsonc`. Apply `schema.sql` to that database.

Run `node cloud-account/generate-accounts.mjs ABSOLUTE_PRIVATE_DIRECTORY` once. The output directory must be outside the website checkout. It creates five unique 256-bit random passwords, their HMAC verifiers in `seed.sql`, the server pepper in `pepper.txt`, and a private credential list. Existing files are never overwritten. Passwords and pepper must never be printed, committed, or copied into the static site.

Apply the generated `seed.sql` to D1; send `pepper.txt` through stdin to `wrangler secret put PASSWORD_PEPPER`. Keep `ALLOWED_ORIGINS` restricted to the existing GitHub Pages origin. Deploy the Worker and test authentication, account isolation, last-edit ordering, logout, and real device access before enabling the public endpoint in `account-config.js`.

These verifiers support the generated high-entropy passwords only. Do not replace them with short human-chosen passwords without switching to an appropriate slow password-hashing scheme.

## Data and behavior

- Syncs progress, wrong answers, saved words, notes, and text drafts. Course files, recordings, settings, and admin secrets stay outside the cloud projection.
- Accounts use separate IndexedDB stores with a small synchronous recovery journal; guest data stays intact. Cached accounts open locally before any cloud request.
- The first login offers migration only when real guest learning data exists. Migration fills missing account entries and preserves the guest original and a recovery snapshot.
- Each entity carries its durable edit time and ID. Newer edits win; late arrivals do not win solely by arriving later. Cloud and browser use the same binary tie ordering.
- Edits upload automatically; visible pages check for remote updates periodically. “立即同步进度” flushes the current editor, uploads local changes, and pulls remote changes.
- Network/auth/storage failures retain local data and never report false success. Account logout preserves local account and guest copies.

## Verification

Run the account tests and affected storage, bookshelf, review, and delivery regressions. Use synthetic data for real browser/cloud tests. Verify two independent device stores, offline reopening, different drafts, same-item latest edit, stale responses, and local save failure. The final source CI and Pages deployment are coordinated through the publishing checkout; do not independently push `main` from this feature worktree.
