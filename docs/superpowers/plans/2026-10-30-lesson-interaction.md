# Lesson interaction improvements

Goal: Remove overlapping lesson/global controls and bring passage/editor into the first viewport on phones and desktop. Preserve all six stages, five sentences for every new word/usage, prior targets, existing draft identities and grades.

Implementation: Scope focus CSS to an active mounted lesson, leaving shelf/tools navigation visible. Reading uses a compact native details grammar card and responsive main/reference grid. Compact mobile headers and writing reference cards; keep continuous five-input editing and existing focus-safe action bar. Desktop has a bounded reading column and a separate reference column. No storage or audio changes.

- [x] RED: overview is closed and passage has an independent layout region.
- [x] GREEN: markup + scoped layout; preserve all source evidence inside expandable card.
- [x] Browser390/320/844 + desktop1280: first passage/textarea visible, global bar hidden only in lesson, actions reachable, no overflow.
- [x] Existing quota, save/navigation, audio and grammar tests; draft reload QA.
- [ ] Independent integrated review and original Pages full CI/public verification.

Coordination: Analysis (2) owns mixed-review. Do not edit its review modules or storage. Publication is serialized through this checkout, with upstream check before push.

Evidence:58 initial layout regressions pass; independent layout reviewer28 pass/no blockers; merged107 tests before answer-signature fix. Mixed reviewer found incomplete phrase answer-rule revision; new test reproduced stale false with changed variants, then32 mixed tests pass after binding full grading metadata in slot3. Phone375px first input557px,5 rows retained, two drafts survive reload;320px no overflow,420px-height focused action bar static. Desktop1265px has separate grammar column and first passage681px. No learner answers entered in production.
