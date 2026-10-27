# Learning reliability and reading size implementation plan

**Goal:** Fix the three audited learning failures and add the requested persistent lesson-font controls, then publish to the existing GitHub Pages site.

**Architecture:** Retain the static application and existing learner store. Resolve dictionary senses within the current source, save independent bounded output drafts, and bind review evidence to an actual daily-task round. Font scaling changes reading paragraphs through a CSS variable.

**Constraints:** Preserve all four textbooks, current word audio, historic scores, saved words, backups and honest assisted/mastery labels. No local HTTP server. Use the existing isolated worktree and normal pushes without rewriting history.

- [x] Reproduce invalid cross-lesson meanings and add resolver regressions.
- [x] Reproduce lost retell/dictation drafts and save/reload/assistance regressions.
- [x] Reproduce empty-answer review completion failures and stale-round/empty-scope cases.
- [x] Add bounded 80–160 percent reading controls with saved preferences.
- [x] Integrate the shared learner store, backup/restore, runtime dependency order and review transaction.
- [x] Run scoped regressions, independent review, and all nonserver tests: 768 pass, 3 Windows link-capability skips, no failures after merging the latest grammar and vocabulary updates.
- [ ] Publish through GitHub Actions and verify the three repaired flows and font controls online.

Review focus: corrupted/imported saved meanings; references exposed before switching modes; quota failures and emergency backup; old or unavailable review rounds; small-screen wrapping and preserved reading position.
