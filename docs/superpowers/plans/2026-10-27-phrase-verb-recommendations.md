# Phrase-first Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Recommend useful expressions and verbs, while excluding introductory material and preserving saved practice.

**Architecture:** Add an opt-in profile to the existing recommendation core and a shared eligibility predicate. Revalidate cached recommendation keys in the current UI; retain the complete manual bank and all practice history. Rebuild source manifests and publish to the original GitHub Pages site.

**Tech Stack:** Existing plain JavaScript, Node tests, offline builders and CUA mobile verification.

**Spec:** docs/superpowers/specs/2026-10-27-phrase-verb-recommendations.md

## Global constraints

- Default writing mix: three eligible expressions and one verb where available; never fill with basic or unrelated categories.
- Curated exclusions express a practice preference, not a proficiency-level certificate.
- Keep source items, aliases, answers, selections, completion history and generic API callers compatible.
- No paid service, new dependency, wholesale course edit or unreviewed placeholder exposure.

## Review focus

- Basic inflections and parameterized simple phrases cannot bypass the exclusions.
- Useful phrasal expressions with common component verbs remain eligible.
- Short unused pools are not filled with consumed or unrelated words.
- Cached old-policy suggestions migrate without deleting text or manually chosen expressions.
- All key aliases continue to consume only actually used expressions in checked complete rounds.

### Task 1: Core profile

Files: sentence-core.js; tests/phrase-verb-recommendations.test.cjs.

- [x] Add failing tests for the eligibility predicate and phrases-verbs profile mix/exclusions/rotation/short-pool behavior.
- [x] Implement recommendationEligible(item) and recommendOldWords({profile:'phrases-verbs',...}); keep generic behavior intact.
- [x] Run new and existing recommendation/progress tests; independently review the focused diff.

### Task 2: UI persistence and policy hint

Files: sentence-practice.js; targeted UI tests.

- [x] Add a failing integration test that old noun/basic suggestions are replaced, valid sets remain stable, and answers/selections/history survive.
- [x] Opt writing UI into the profile, revalidate cached sets with the shared predicate and explain the eligible categories briefly.
- [x] Run relevant UI checks and render the current mobile page.

### Task 3: Verify and deliver

Files: index.html; release.json; generated source manifests; this plan.

- [x] Refresh source manifests, run full regression and inspect current-source recommendation samples.
- [ ] Preserve latest main updates, publish normally and verify the live mobile build.
- [ ] Report the source coverage audit separately from the completed recommendation change.

Verification before final remote sync: core19 new tests plus old rotation/progress/wordbank56/56 pass; UI73/73 pass. Independent reviews found and resolved five verified name homographs and v1 alias cache canonicalization. Full regression852 tests:851 pass,0 fail,1 OS symlink skip (outputs/phrase-verb-recommendations/full-tests-final.log). Current-source manifests validate89 raw dictionary inputs and77 UTF8-LF lesson inputs. CUA390px real old-cache migration replaced noun/basic suggestions, retained the puma answer and manual on-the-right selection; target switches/reload kept the group stable, explicit refresh replaced the group without editing the answer. At320px the header controls do not overlap and there is no horizontal overflow.

Final sync preserved main00c2218 Chinese grammar instructions and source categorization. Rebuilt manifests validate with their declared encodings. The105 focused merged checks all pass (merged-focused-tests.log); GitHub Pages runs the complete merged suite before deployment. No unreviewed usage rows or placeholder glosses were promoted. The usage coverage audit remains a separate incomplete-content finding.

Final mobile integration preserved main db0d5b0, including four-form and single-phrase writing and review groups. Mode-aware recommendation consumption and bounded history now use requiredKinds(mode); hidden legacy answers cannot consume or crowd out active-mode expressions. Core70/70 and UI/quick/mobile96/96 pass; root affected merged checks pass (mobile-merged-tests.log). Full merged suite is also required by the Pages deployment workflow.
