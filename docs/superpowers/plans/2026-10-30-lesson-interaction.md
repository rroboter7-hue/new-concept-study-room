# Lesson interaction improvements

Goal: Remove overlapping lesson/global controls and bring passage/editor into the first viewport on phones and desktop. Preserve all six stages, five sentences for every new word/usage, prior targets, existing draft identities and grades.

Implementation: Scope focus CSS to an active mounted lesson, leaving shelf/tools navigation visible. Reading uses a compact native details grammar card and responsive main/reference grid. Compact mobile headers and writing reference cards; keep continuous five-input editing and existing focus-safe action bar. Desktop has a bounded reading column and a separate reference column. No storage or audio changes.

- [ ] RED: overview is closed and passage has an independent layout region.
- [ ] GREEN: markup + scoped layout; preserve all source evidence inside expandable card.
- [ ] Browser390/320/844 + desktop1280: first passage/textarea visible, global bar hidden only in lesson, actions reachable, no overflow.
- [ ] Existing quota, save/navigation, audio and grammar tests; draft reload QA.
- [ ] Independent integrated review and original Pages full CI/public verification.

Coordination: Analysis (2) owns mixed-review. Do not edit its review modules or storage. Publication is serialized through this checkout, with upstream check before push.
