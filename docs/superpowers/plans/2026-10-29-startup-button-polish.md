# Startup and button refinement plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Goal:** Reduce measured initialization work, preserve reliable recovery and drafts, and refine existing blue/white controls on mobile and desktop.

**Architecture:** Keep ordered classic-script runtime packages and their integrity/catalog health checks. Optimize the knowledge-bank lookup algorithm without changing its output, and mount a lesson only when the user enters it from the shelf. Style existing components rather than adding a new UI framework or navigation.

**Tech Stack:** Vanilla JS/CSS, node:test, GitHub Pages.

**Spec:** Current request to optimize loading speed, stability, interface and buttons; existing six-stage workflow and prior instruction to keep original layout/quotas.

## Constraints
- Keep new words/usages5 sentences and older targets1–2, saved answers and correction notes unchanged.
- Retain source quarantines, sense filtering, exact source provenance and catalog completeness checks.
- Do not equate browser-cache hits or Node CPU timings to hardware Android speed.
- Preserve existing blue/white styling, tiny partial stars and accessible44px controls.
- Do not include unrelated reading-view/sentence-mistake experiments.

## Review focus
- Indexed normalization and duplicate sense exclusions must match the original algorithm exactly.
- Shelf launch must not create quiz attempts, render hidden editors or download lesson audio.
- Continue, records links and explicit lesson navigation must still hydrate the exact saved stage.
- Focus/disabled/keyboard interaction must remain visible; touch must not depend on hover.
- Reduced-motion users must not receive new animated transforms.

## Tasks
- [x] 1. Profile actual checked-in source initialization; snapshot source-bank outputs. Fix repeated full scans with an index; repeat measurements and assert snapshot equivalence.
- [x] 2. Skip hidden stage preparation before bookshelf; tests for no eager lesson work and unchanged Continue/drafts/route safety.
- [x] 3. Refine button hierarchy, neutral borders, pressed/focus/disabled states, compact audio controls and cards using existing CSS. Capture before/after at390 and1280+.
- [ ] 4. Independent review, focused tests, original-source CI, public integrity and UI validation; publish a separate performance/style commit.

## Evidence and decisions
- Public JS already gzip (2,992,681 decoded bytes ->527,419 transmitted bytes) and Cache-Control:max-age=600. Adding generic compression/cache tips is not a useful primary fix.
- Preliminary controlled source profile: ~783ms scripting baseline versus ~453ms with indexed word-sense exclusions; bank audit snapshot identical. Confirm with repeats before claiming improvement.
- The independently approved flow patch7048d07 was cherry-picked as e53ca3f and pushed separately; this performance work starts after it and does not delay that release.

- Repeated source profiling: new learner initialization1004→649ms; saved stage5 initialization1265→631ms (Node VM medians, not phone/network latency). Complete generated-bank snapshot SHA256 remained identical.
- Independent source review approved; focused logic/navigation/callback tests passed. Mobile390 and desktop1280 layout,44px buttons, empty-copy feedback and refresh/Continue checked in browser, no console errors.
- Included exact counterpart1995e00 legacy retest-label patch; its5 app tests passed.
- Release verification continues in GitHub Actions and the original public URL.
