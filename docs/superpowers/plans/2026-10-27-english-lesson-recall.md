# English-first lesson recall implementation plan

> **For agentic workers:** Use subagent-driven development for the independent book datasets and inline execution for the shared grading/UI contract.

**Goal:** Replace the comprehension exercise shown by the user with English grammar recall across all 276 reading lessons.

**Architecture:** Keep the existing source-checked choice and short-answer pair, replacing factual content questions with lesson-specific grammar tasks. Author English prompts/options/accepted answers, keep Chinese post-answer grammar explanations, and explicitly prompt for English when a learner enters Chinese. Preserve source evidence, lazy loading, answer revision guards and separate recall records.

**Tech stack:** Existing static JavaScript, authored JSON, Node test runner, GitHub Pages workflow.

**Spec:** User's correction: “这种不要，因为主要练习的是英文”, then “回顾主要是回顾语法知识，不是回顾课文本身”; earlier preference retains both choice and short-answer formats.

## Constraints and review focus

- All 552 prompts and choice options are English. Short answers accept English words/phrases/specific listed sentences; numeric and letter facts remain allowed.
- Each question has an explicit grammar focus and exercise type: gap-fill, transformation, correction, word-order or form-choice. Questions do not ask learners to remember story facts.
- Chinese is available in explanations after checking, not as an accepted English exercise answer.
- Preserve every lesson ID and source hash. Replace evidence with an exact current passage quote illustrating the tested grammar; bind it to its real paragraph index.
- Do not pretend the finite alias matcher is an AI grammar or semantic grader.
- Revisions invalidate obsolete saved submissions without altering course progress or review schedules.

## Tasks

- [x] Add failing tests for English data compilation, language feedback, and English textarea markup; observe failures.
- [x] Replace each book dataset independently with per-lesson grammar tasks, self-review against existing evidence, then cross-review changed content.
- [x] Replace bilingual compiler constraint with an English exercise contract and emit explicit English metadata.
- [x] Add language-required grading feedback, update instructions and English markup; retain Chinese explanations.
- [x] Recompile and run 27 focused checks plus the sparse local suite (684 pass, one Windows symlink skip). Seven full-media checks run in CI. Mobile grammar feedback, edit, English reminder and refresh persistence verified.
- [ ] Bump build identity, publish through the existing Pages workflow and verify the live English exercise.

Review fixes include apostrophe preservation, required commas in non-defining clauses, explicit transformation constraints, and accurate grammar-role explanations.
