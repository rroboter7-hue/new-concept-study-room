const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../sentence-core.js');
const word = (label, category = 'noun') => ({ key: `word:b1-l1:${encodeURIComponent(label)}`, aliases: [], label, word: label, category, meaning: '中文释义' });
const phrase = label => ({ key: `phrase:b1-l1:${encodeURIComponent(label)}`, aliases: [], label, phrase: label, category: 'phrase', meaning: '中文用法' });
const words = [word('book'), word('chair'), word('quickly', 'adverb'), word('sister'), word('red', 'adjective'), word('send', 'verb')];
const phrases = [phrase('look at'), phrase('at home')];
const all = [...words, ...phrases];
const answers = extra => ({ affirmative: 'I use newword today.', negative: 'She does not use newword.', yesno: 'Do you use newword?', wh: 'Where do they use newword?', combined: `We use newword ${extra}.` });
const draft = (keys, extra, at = 10) => ({ targetKey: 'word:b1-l2:newword', selectedOldKeys: keys, answers: answers(extra), checkedAt: at });
function recommend(options) {
  assert.equal(typeof core.recommendOldWords, 'function', 'recommendOldWords must rotate practised old expressions');
  return core.recommendOldWords({ lessonId: 'b1-l4', random: () => 0.999, ...options });
}

test('cross-lesson completed uses exclude consumed words and phrases while keeping all unused candidates eligible', () => {
  const drafts = { previous: draft([words[0].key, phrases[0].key], 'with a book to look at') };
  const result = recommend({ items: all, drafts });
  assert.equal(result.length, 4);
  assert.deepEqual(result.map(item => item.label), ['at home', 'chair', 'quickly', 'sister']);
  assert.equal(result.filter(item => item.category === 'phrase').length, 1);
});

test('unused pool stays exclusive even when too small to fill the requested count', () => {
  const items = [words[0], words[1], phrases[0]];
  const result = recommend({ items, drafts: [draft([words[0].key, phrases[0].key], 'with a book to look at')] });
  assert.deepEqual(result.map(item => item.label), ['chair']);
});

test('selection, empty, partial, unchecked and removed choices do not consume recommendations', () => {
  const partial = draft([words[0].key], 'with a book'); delete partial.answers.wh;
  const empty = draft([words[0].key], 'with a book'); empty.answers = {};
  const removed = draft([], 'with a book'); removed.oldWordKey = words[0].key;
  const drafts = [partial, empty, removed, draft([words[0].key], 'with a book', 0), draft([words[0].key], 'with a chair')];
  assert.deepEqual(recommend({ items: [words[0]], drafts }).map(item => item.label), ['book']);
});

test('shown recommendations rotate only when actually used in checked complete answers without a selection', () => {
  const used = { ...draft([], 'with a book'), recommendedOldKeys: [words[0].key, words[1].key] };
  assert.deepEqual(recommend({ items: [words[0], words[1]], drafts: [used] }).map(item => item.label), ['chair']);
  for (const invalid of [{ ...used, checkedAt: 0 }, { ...used, answers: { affirmative: used.answers.affirmative } }]) {
    assert.deepEqual(recommend({ items: [words[0], words[1]], drafts: [invalid] }).map(item => item.label), ['book', 'chair']);
  }
  const inherited = Object.assign(Object.create({ recommendedOldKeys: [words[0].key] }), draft([], 'with a book'));
  assert.deepEqual(recommend({ items: [words[0], words[1]], drafts: [inherited] }).map(item => item.label), ['book', 'chair']);
});

test('legacy selections and merged source aliases count when the expression actually appears in any answer', () => {
  const item = { ...words[0], aliases: [words[0].key, 'word:b1-l9:book'] };
  const used = draft(undefined, 'with a sister'); delete used.selectedOldKeys; used.oldWordKey = 'word:b1-l9:book'; used.answers.affirmative += ' I read books.';
  used.oldPhraseKey = phrases[0].key; used.answers.negative += ' We looked at it.';
  assert.deepEqual(recommend({ items: [item, phrases[0], words[1]], drafts: [used] }).map(item => item.label), ['chair']);
});

test('one spelling across noun and verb sources consumes every source key while preserving unused choices', () => {
  const noun = word('work');
  const verb = { ...word('work', 'verb'), key: 'word:b1-l2:work', aliases: ['word:b1-l2:work', 'word:b1-l9:work'] };
  for (const consumedKey of ['word:b1-l2:work', 'word:b1-l9:work']) {
    const result = recommend({ items: [noun, verb, words[1]], drafts: [draft([consumedKey], 'with work')] });
    assert.deepEqual(result.map(item => item.label), ['chair']);
  }
  assert.deepEqual(recommend({ items: [noun, verb, words[1]], drafts: [], previousKeys: ['word:b1-l2:work'], count: 1 }).map(item => item.label), ['chair']);
  assert.deepEqual(noun.aliases, []);
});

test('recommendations avoid previous choices when alternatives exist and do not repeat within one result', () => {
  const previousKeys = [words[0].key, words[1].key, phrases[0].key];
  const result = recommend({ items: all, drafts: {}, previousKeys });
  assert.deepEqual(result.map(item => item.label), ['at home', 'quickly', 'sister', 'red']);
  assert.equal(new Set(result.map(item => item.key)).size, result.length);
  assert.deepEqual(recommend({ items: [words[0]], drafts: {}, previousKeys, count: 4 }).map(item => item.label), ['book']);
});

test('exhausted pools use least recent complete use and break ties with injected randomness', () => {
  const items = [words[0], words[1], words[3]];
  const drafts = [draft([words[0].key], 'with a book', 10), draft([words[0].key], 'with a book', 70), draft([words[1].key], 'with a chair', 20), draft([words[3].key], 'with a sister', 30)];
  assert.deepEqual(recommend({ items, drafts, count: 2 }).map(item => item.label), ['chair', 'sister']);
  const tied = [draft(items.map(item => item.key), 'with a book, a chair and a sister', 30)];
  assert.deepEqual(recommend({ items, drafts: tied, count: 2, random: () => 0 }).map(item => item.label), ['chair', 'sister']);
  assert.deepEqual(recommend({ items, drafts: tied, count: 2, random: () => 0.999 }).map(item => item.label), ['book', 'chair']);
});

test('valid target decoding includes phrase targets but rejects hashes, malformed escapes and false completion', () => {
  for (const targetKey of ['word:long:0123456789abcdef', 'phrase:long:0123456789abcdef', 'word:b1-l2:%E0%A4%A', 'not-a-key', 'word:b1-l2:', 'word:b1-l2:newword:extra']) {
    assert.deepEqual(recommend({ items: [words[0], words[1]], count: 2, drafts: [{ ...draft([words[0].key], 'with a book'), targetKey }] }).map(item => item.label), ['book', 'chair']);
  }
  const valid = draft([words[0].key], 'with a book'); valid.targetKey = 'phrase:b1-l2:newword';
  assert.deepEqual(recommend({ items: [words[0], words[1]], drafts: [valid] }).map(item => item.label), ['chair']);
  const invalid = draft([words[0].key], 'with a book'); invalid.answers.wh = invalid.answers.yesno;
  assert.equal(recommend({ items: [words[0], words[1]], drafts: [invalid] }).length, 2);
});

test('malformed data stays inert and recommendations do not mutate source items or draft records', () => {
  const snapshot = JSON.stringify({ items: all, drafts: [draft([words[0].key], 'with a book')] });
  const frozen = JSON.parse(snapshot); frozen.items.forEach(Object.freeze); frozen.drafts.forEach(item => { Object.freeze(item.answers); Object.freeze(item); });
  recommend({ items: Object.freeze(frozen.items), drafts: Object.freeze(frozen.drafts) });
  assert.equal(JSON.stringify(frozen), snapshot);
  const trap = () => { throw Error('do not run imported getter'); };
  const accessorDraft = Object.defineProperty({}, 'targetKey', { get: trap });
  const accessorContainer = Object.defineProperty({}, 'fake', { enumerable: true, get: trap });
  const inherited = Object.create(draft([words[0].key], 'with a book'));
  assert.equal(recommend({ items: [words[0], words[0], Object.create(words[1]), null], drafts: [inherited, accessorDraft] }).length, 1);
  assert.equal(recommend({ items: [words[0]], drafts: accessorContainer }).length, 1);
  for (const count of [0, -1, '4', NaN, Infinity]) assert.deepEqual(recommend({ items: all, count }), []);
  for (const items of [undefined, null, {}, 'bad']) assert.deepEqual(recommend({ items }), []);
});

test('recommended draft keys are independently bounded and deduplicated while existing fields survive', () => {
  const input = { recommendedOldKeys: ['  a  ', 'a', null, '', {}, ...Array.from({ length: 25 }, (_, i) => `key-${i}`)], selectedOldKeys: ['selected'], oldWordKey: 'legacy', targetKey: 'target', checkedAt: 12, mode: 'flexible', answers: { affirmative: 'A book.' } };
  const result = core.sanitizeDraft(input);
  assert.equal(result.recommendedOldKeys.length, 20);
  assert.deepEqual(result.recommendedOldKeys.slice(0, 3), ['a', 'key-0', 'key-1']);
  assert.deepEqual(result.selectedOldKeys, ['selected']);
  assert.equal(result.oldWordKey, 'legacy'); assert.equal(result.targetKey, 'target'); assert.equal(result.checkedAt, 12); assert.equal(result.mode, 'flexible'); assert.equal(result.answers.affirmative, 'A book.');
  assert.deepEqual(core.sanitizeDraft(null).recommendedOldKeys, []);
  assert.deepEqual(core.sanitizeDraft(Object.create({ recommendedOldKeys: ['fabricated'] })).recommendedOldKeys, []);
});
