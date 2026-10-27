# Browsable lesson-word groups

User request: the pictured current-lesson word cards should slide between groups, so learners can browse for inspiration, practise another group first, then return without losing answers.

Keep four words per group (two by two on phones), original course order and existing per-word progress. Use native horizontal scrolling with CSS scroll snap, plus explicit Previous/Next group buttons, a group count and keyboard arrows. Keep the all-words view and next-unfinished shortcut. Browsing a group never selects a target, completes a word, reshuffles old recommendations or changes the editor. Display the current practice word clearly when browsing another group.

Clicking a word keeps the established flush/load-draft path. Return navigation restores its own text, step, mode, assistance and checked status. Selecting a target through any existing shortcut shows its group; expanding/collapsing all words stays compatible. Remember browsing position per lesson and mode in this session; after reload, show the selected target's group. No core storage schema change, dependency or auto-advance timer is needed.

Scope: enhance the existing lesson-word queue shown in the screenshot; preserve the current bounded four-form/phrase selectors, old-word picker, recommendation policy and mode-specific drafts. Native gestures must preserve vertical page scrolling. Controls retain accessible names, reduced-motion behavior and reachable focus; offscreen groups must not add a long invisible tab sequence.

Verify: all words reachable including a partial last group; browsing does not change a partially written answer; selecting a later-group word then returning restores both drafts; unfinished navigation and reload reveal the active target; zero/one/few-word lessons; keyboard and scroll-derived page state; 320px/390px layout and desktop. Actual phone touch behavior must not be claimed from a desktop viewport test.
