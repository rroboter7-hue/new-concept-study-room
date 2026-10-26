const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../review-engine.js'), 'utf8'), context);
const R = context.window.StudyReview;
const NOW = Date.parse('2026-10-24T06:00:00Z');
const DAY = 86400000;
const lesson = {
 id:'review-source-b1-l031', book:1, number:31, title:'Source one',
 vocabulary:[{word:'seat', meaning:'座位'}],
 usage:[
  {phrase:'take off', matchedForm:'taking off', meaning:'脱下', example:'She is taking off her coat.'},
  {phrase:"can't stand", matchedForm:"can't stand", variants:['cannot stand',null,''], meaning:'无法忍受'}
 ],
 quiz:[{type:'grammar', question:'He ____ here.', options:['is','are'], answer:0}]
};
const cards = () => R.cardsForLessons([lesson]);

// A source-listed inflection must not be discarded during review grading.
test('phrase recall accepts the inflected form explicitly supplied by its source', () => {
 const card = cards().find(c => c.target === 'take off');
 assert.equal(R.checkAnswer(card, 'Taking off.').correct, true);
 assert.equal(R.checkAnswer(card, 'take off').correct, true);
 assert.equal(R.checkAnswer(card, 'took off').correct, false, 'unlisted inflections are not invented');
});

// Explicit alternatives belong only to their phrase, not to vocabulary or grammar.
test('phrase recall preserves explicit variants and normalizes curly contraction apostrophes', () => {
 const card = cards().find(c => c.target === "can't stand");
 assert.equal(R.checkAnswer(card, 'cannot stand').correct, true);
 assert.equal(R.checkAnswer(card, 'CAN’T STAND!').correct, true);
 assert.equal(R.checkAnswer({...card, kind:'word'}, 'cannot stand').correct, false);
 assert.equal(R.checkAnswer({...card, kind:'grammar'}, 'cannot stand').correct, false);
});

test('phrase writing matches listed forms as complete token sequences', () => {
 assert.equal(typeof R.hasPhrase, 'function');
 const card = cards().find(c => c.target === "can't stand");
 assert.equal(R.hasPhrase(card, 'I can’t stand this loud noise.'), true);
 assert.equal(R.hasPhrase(card, 'I cannot stand this loud noise.'), true);
 assert.equal(R.hasPhrase(cards().find(c => c.target === 'take off'), 'She is taking off her coat.'), true);
 const atLarge = {kind:'phrase', target:'at large'};
 assert.equal(R.hasPhrase(atLarge, 'The animal is at large.'), true);
 for (const input of ['The cat large is here.', 'They sit at largely empty tables.', 'They stay at-large today.']) {
  assert.equal(R.hasPhrase(atLarge, input), false, input);
 }
 assert.equal(R.hasPhrase(card, 'I cant stand this loud noise.'), false, 'an omitted apostrophe is not a declared variant');
 assert.equal(R.hasPhrase(card, ''), false);
 assert.equal(R.hasPhrase({kind:'word', target:'seat'}, 'I need a seat.'), false);
});

test('phrase recall does not accept a longer sentence or a word-fragment match', () => {
 const card = cards().find(c => c.target === 'take off');
 assert.equal(R.checkAnswer(card, 'I take off my coat.').correct, false);
 assert.equal(R.checkAnswer(card, 'retake off').correct, false);
 assert.equal(R.checkAnswer(cards().find(c => c.target === "can't stand"), 'cant stand').correct, false);
});

test('identical words from two books retain separate sources and independent progress', () => {
 const cs = R.cardsForLessons([
  {...lesson, usage:[], quiz:[]},
  {id:'review-source-b2-l001', book:2, number:1, title:'Source two', vocabulary:[{word:'seat', meaning:'座位'}]}
 ]);
 let state = R.enroll(null, cs, {now:NOW});
 const first = cs.find(c => c.sourceLesson.book === 1);
 const second = cs.find(c => c.sourceLesson.book === 2);
 assert.equal(cs.length, 2);
 assert.notEqual(first.id, second.id);
 state = R.rate(state, first.id, 'good', {now:NOW, revision:0}).state;
 const due = R.queue(state, cs, {now:NOW});
 assert.equal(due.length, 1);
 assert.equal(due[0].sourceLesson.id, 'review-source-b2-l001');
 assert.equal(due[0].sourceLesson.book, 2);
 assert.equal(due[0].sourceLesson.number, 1);
 assert.equal(state.cards[second.id].revision, 0);
 assert.equal(R.queue(state, cs, {now:NOW, lessonId:first.sourceLesson.id}).length, 0);
});

test('JSON reload rejects an old revision even when the card is due again', () => {
 const cs = cards(), id = cs[0].id;
 const initial = R.enroll(null, cs, {now:NOW});
 const rated = R.rate(initial, id, 'good', {now:NOW, revision:0});
 const restored = R.sanitize(JSON.parse(JSON.stringify(rated.state)));
 assert.equal(R.rate(restored, id, 'good', {now:NOW+DAY, revision:0}).accepted, false);
 const current = R.rate(restored, id, 'good', {now:NOW+DAY, revision:1});
 assert.equal(current.accepted, true);
 assert.equal(current.state.cards[id].revision, 2);
 assert.equal(R.rate(current.state, id, 'again', {now:NOW+4*DAY, revision:1}).accepted, false);
 assert.equal(initial.cards[id].revision, 0);
});

test('discarding an unsaved rating leaves the committed queue available for retry', () => {
 const cs = cards(), committed = R.enroll(null, cs, {now:NOW});
 const id = cs[0].id, before = JSON.stringify(committed);
 const proposal = R.rate(committed, id, 'good', {now:NOW, revision:0});
 assert.equal(proposal.accepted, true);
 assert.equal(JSON.stringify(committed), before, 'pure engine must not mutate committed data');
 assert.equal(R.queue(committed, cs, {now:NOW}).length, 4);
 const retry = R.rate(committed, id, 'hard', {now:NOW, revision:0});
 assert.equal(retry.accepted, true);
 assert.equal(retry.state.cards[id].revision, 1);
 assert.equal(R.stats(committed, cs, {now:NOW}).reviewedToday, 0);
});

test('Shanghai today excludes the exact next-midnight deadline until the date switches', () => {
 const at = Date.parse('2026-10-24T15:59:59.999Z');
 const midnight = Date.parse('2026-10-24T16:00:00.000Z');
 const cs = cards().slice(0,2), state = R.enroll(null, cs, {now:NOW});
 state.cards[cs[0].id].dueAt = at;
 state.cards[cs[1].id].dueAt = midnight;
 let stats = R.stats(state, cs, {now:at});
 assert.equal(stats.due, 1);
 assert.equal(stats.todayRemaining, 1);
 assert.equal(stats.nextDueAt, midnight);
 assert.equal(R.dayKey(at), '2026-10-24');
 stats = R.stats(state, cs, {now:midnight});
 assert.equal(stats.due, 2);
 assert.equal(stats.todayRemaining, 2);
 assert.equal(R.dayKey(midnight), '2026-10-25');
});
