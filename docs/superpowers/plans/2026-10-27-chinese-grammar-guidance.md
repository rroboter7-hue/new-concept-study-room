# Chinese guidance for English grammar practice

**User correction:** Practice English, while explaining the task and grammar names in readable Chinese. Keep the existing grammar exercises rather than returning to story comprehension.

**Design:** Add separately authored, source-bound Chinese display instructions for all 552 questions. Keep English practice material, options, accepted answers and grammar checks unchanged. Chinese-only display edits must not invalidate existing answer revisions or drafts.

- [x] Bind Chinese instructions to exact English prompt and grammar-point sources, then compile display fields.
- [x] Render Chinese directions, grammar names, input labels and placeholders with English answer inputs.
- [x] Verify display-only changes preserve answer revisions and existing grading.
- [ ] Check mobile rendering, deploy and confirm original site.

Validation: 29 focused tests pass; all 276 original assessment revisions and English question objects match the previous release. Mobile 390×844 preview has Chinese directions, English inputs and no horizontal overflow. The full sparse local run passes 792 tests; ten media checks require the complete CI checkout, and one Windows symlink case is skipped.
