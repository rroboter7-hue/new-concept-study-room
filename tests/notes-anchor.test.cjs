'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./support/app-harness.cjs');

function detailsAncestors(node) {
  const result = [];
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') result.push(parent);
  }
  return result;
}

for (const kind of ['vocabulary', 'grammar']) {
  test(`knowledge detour reveals the collapsed ${kind} concept and focuses it`, async () => {
    const h = await harness({ pilot: false });
    // The real harness uses owner for DOM ancestry. Only adapt that boundary.
    Object.defineProperty(Object.getPrototypeOf(h.document.body), 'parentElement', {
      configurable: true,
      get() { return this.owner || null; }
    });

    const lesson = h.c.LESSONS.find(row => row.book === 2 && row.number === 1);
    await h.api.selectLesson(lesson.id);
    const concepts = h.c.StudyKnowledge.bank.questionsForLesson(lesson.id)
      .filter(row => row.type === kind);
    // The fourth grammar concept is outside the first three core cards.
    const concept = concepts[kind === 'grammar' ? 3 : 0];
    assert(concept, `${kind} fixture has a concept`);

    h.api.setTab('usage');
    const before = h.document.getElementById('knowledge-' + concept.conceptId);
    assert(before, 'the source concept has a notes anchor');
    const closedParents = detailsAncestors(before);
    assert(closedParents.length > 0, 'the fixture is inside collapsed notes');
    assert(closedParents.every(parent => parent.open !== true), 'notes start closed');

    h.api.openKnowledge(lesson.id, concept.conceptId);
    await h.flush();
    const target = h.document.getElementById('knowledge-' + concept.conceptId);
    assert(target, 'the knowledge anchor survives the detour');
    const parents = detailsAncestors(target);
    assert(parents.length > 0, 'the target retains its details ancestry');
    assert(parents.every(parent => parent.open === true), 'every details ancestor opens before focus');
    assert.equal(h.document.activeElement, target, 'the exact concept receives focus');
  });
}
