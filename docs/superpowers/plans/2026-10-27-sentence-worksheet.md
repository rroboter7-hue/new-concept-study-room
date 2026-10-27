# Unified sentence worksheet

Selected visual: first displayed concept, `outputs/sentence-practice-concepts-2026-10-27/01-worksheet.png` in the parent workspace. The user selected it after requesting fewer words and combining four-form conversion with idiom use.

Implement in the existing production site, retaining its storage, checks, daily evidence and batch export. One worksheet shows target word plus optional phrase together, then four labelled editable sentences, a primary check action and secondary Doubao copy. Move mode switching, references and legacy drafts into a compact more menu. Preserve native phrase daily tasks and legacy draft namespaces rather than migrating or deleting answers. No API or new generated answers.

- [ ] Red/green tests for unified worksheet and optional phrase selection without overwriting answers.
- [ ] Render the selected layout and concise feedback; preserve copy, storage and daily evidence.
- [ ] Simplify mobile chrome for this screen with a working back action.
- [ ] Compare reference and rendered mobile screenshots; verify interactions and desktop responsiveness.
- [ ] Run focused and complete checks, retain concurrent main changes, publish and verify the original site.

Browser plugin is not listed; rendered checks use the available CUA in-app browser and its supported Playwright interface. Local sparse checkout omits original media, so complete original-audio verification runs in CI before deployment.
