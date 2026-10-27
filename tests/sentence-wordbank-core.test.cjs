const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../sentence-core.js');

const lesson = (id, book, number, vocabulary = [], usage = []) => ({ id, book, number, title: id, vocabulary, usage });
const word = (value, pos, meaning) => ({ word: value, pos, meaning });
const phrase = (value, meaning) => ({ phrase: value, meaning });
const current = lesson('b2-l9', 2, 9);
function bank(options) {
  assert.equal(typeof core.wordBank, 'function', 'wordBank must expose the pure old-word selector');
  return core.wordBank(options);
}

test('word bank offers earlier books and lessons without requiring site learning records', () => {
  const previousBook = lesson('b1-l120', 1, 120, [word('send', 'v.', '寄送')]);
  const previousLesson = lesson('b2-l8', 2, 8, [word('neat', 'adj.', '整齐的')], [phrase('enter for', '报名参加')]);
  const present = { ...current, vocabulary: [word('refuse', 'v.', '拒绝')] };
  const future = lesson('b2-l10', 2, 10, [word('allow', 'v.', '允许')]);
  const laterBook = lesson('b3-l1', 3, 1, [word('visit', 'v.', '拜访')]);
  const result = bank({ lessons: [future, present, laterBook, previousLesson, previousBook], currentLesson: present });
  assert.deepEqual(result.map(item => [item.category, item.label]), [['verb', 'send'], ['adjective', 'neat'], ['phrase', 'enter for']]);
  assert.deepEqual(result[0], {
    key: 'word:b1-l120:send', category: 'verb', word: 'send', label: 'send', meaning: '寄送', pos: 'v.',
    source: { id: 'b1-l120', book: 1, number: 120, title: 'b1-l120' },
    sources: [{ id: 'b1-l120', book: 1, number: 120, title: 'b1-l120' }], aliases: ['word:b1-l120:send']
  });
  assert.equal(result[2].phrase, 'enter for');
  assert.equal(result[2].word, undefined);
  assert.equal(result[2].pos, '');
  assert.deepEqual(bank({ lessons: [previousLesson], currentLesson: current }).map(item => item.label), ['neat', 'enter for']);
});

test('normalized expressions merge across lessons while retaining real sources and old draft keys', () => {
  const first = lesson('b1-l4', 1, 4, [word('call', 'v.', '拜访'), word('call', 'v.', '拜访')], [phrase('look at', '看')]);
  const second = lesson('b2-l2', 2, 2, [word('ＣＡＬＬ', 'v.', '登门')], [phrase('Look   at', '看着'), phrase('call', '拜访')]);
  const result = bank({ lessons: [second, first, first], currentLesson: current });
  assert.equal(result.length, 3);
  assert.deepEqual(result[0].aliases, ['word:b1-l4:call', 'word:b2-l2:call']);
  assert.deepEqual(result[0].sources.map(item => item.id), ['b1-l4', 'b2-l2']);
  assert.equal(result[0].source.id, 'b1-l4');
  assert.equal(result[0].key, 'word:b1-l4:call');
  assert.equal(result[0].meaning, '拜访；登门');
  assert.deepEqual(result[1].aliases, ['phrase:b1-l4:look%20at', 'phrase:b2-l2:look%20at']);
  assert.equal(result[2].category, 'phrase', 'a usage expression is separate from a vocabulary verb');
  assert.equal(result[2].key, 'phrase:b2-l2:call');
});

test('same-category meanings retain different senses without repeating glosses or exceeding the meaning bound', () => {
  const first = lesson('b1-l1', 1, 1, [word('call', 'v.', '打电话；拜访')]);
  const second = lesson('b2-l1', 2, 1, [word('CALL', 'v.', '拜访;  呼叫'), word('call', 'v.', '打电话')]);
  const result = bank({ lessons: [second, first], currentLesson: current });
  assert.equal(result.length, 1);
  assert.equal(result[0].meaning, '打电话；拜访；呼叫');
  assert.deepEqual(result[0].aliases, ['word:b1-l1:call', 'word:b2-l1:call']);
  const longFirst = lesson('b1-l1', 1, 1, [word('long', 'adj.', '甲'.repeat(900))]);
  const longSecond = lesson('b2-l1', 2, 1, [word('long', 'adj.', '乙'.repeat(900))]);
  const combined = bank({ lessons: [longFirst, longSecond], currentLesson: current })[0];
  assert.equal(combined.meaning.length, 1200);
  assert.equal(combined.meaning, '甲'.repeat(900) + '；' + '乙'.repeat(299));
});

test('different categories keep their meanings separate and shared raw keys prefer a reliable verb', () => {
  const adjective = lesson('b1-l1', 1, 1, [word('light', 'adj.', '轻的')]);
  const verb = lesson('b2-l1', 2, 1, [word('light', 'v.', '点亮')]);
  assert.deepEqual(bank({ lessons: [adjective, verb], currentLesson: current }).map(item => [item.key, item.category, item.meaning]), [
    ['word:b1-l1:light', 'adjective', '轻的'], ['word:b2-l1:light', 'verb', '点亮']
  ]);
  for (const vocabulary of [
    [word('light', 'adj.', '轻的'), word('light', 'v.', '点亮')],
    [word('light', 'v.', '点亮'), word('light', 'adj.', '轻的')]
  ]) {
    const sameKey = bank({ lessons: [lesson('b1-l1', 1, 1, vocabulary)], currentLesson: current });
    assert.deepEqual(sameKey.map(item => [item.key, item.category, item.meaning]), [['word:b1-l1:light', 'verb', '点亮']]);
  }
  const unreliableVerb = lesson('b1-l1', 1, 1, [word('light', 'v.', '释义待补充'), word('light', 'adj.', '轻的')]);
  assert.equal(bank({ lessons: [unreliableVerb], currentLesson: current })[0].category, 'adjective');
});

test('part of speech is explicit and supports multiple POS without treating n. or adv. as verbs', () => {
  const earlier = lesson('b2-l1', 2, 1, [
    word('play', 'n./v.', '玩耍'), word('change', 'n. & vt.', '改变'), word('come', 'vi.', '来'),
    word('ready', 'adj. / adv.', '准备好的'), word('open', 'verb; adjective', '打开；开放的'),
    word('gentle', '形容词', '温和的'), word('move', '不及物动词', '移动'),
    word('outside', 'adv.', '在外面'), word('chair', 'n.', '椅子'), word('private', '', '私人的'),
    word('wrong', 'adverb', '错误地'), word('unknown', 'unclassified', '未分类')
  ]);
  assert.deepEqual(bank({ lessons: [earlier], currentLesson: current }).map(item => [item.label, item.category]), [
    ['play', 'verb'], ['change', 'verb'], ['come', 'verb'], ['ready', 'adjective'], ['open', 'verb'], ['gentle', 'adjective'], ['move', 'verb'],
    ['outside', 'adverb'], ['chair', 'noun'], ['private', 'word'], ['wrong', 'adverb'], ['unknown', 'word']
  ]);
});

test('all-word categories retain adjective precedence and accept valid words with omitted POS', () => {
  const earlier = lesson('b2-l1', 2, 1, [
    word('light', 'n.', '光'), word('light', 'adj.', '轻的'),
    word('here', 'adv.', '这里'), { word: 'the', meaning: '这个；定冠词' }, word('at', 'prep.', '在')
  ]);
  assert.deepEqual(bank({ lessons: [earlier], currentLesson: current }).map(item => [item.label, item.category]), [
    ['light', 'adjective'], ['here', 'adverb'], ['the', 'word'], ['at', 'word']
  ]);
});

test('dictionary a. adjectives stay available in the adjective filter across mixed POS rows', () => {
  const earlier = lesson('b2-l1', 2, 1, [
    word('lovely', 'a.', '可爱的'), word('busy', 'adv./a.', '忙碌的'),
    word('young', 'n./a.', '年轻的'), word('open', 'a./v.', '打开；开放的'),
    word('light', 'n.', '光'), word('light', 'a.', '轻的')
  ]);
  const result = bank({ lessons: [earlier], currentLesson: current });
  assert.deepEqual(result.filter(item => item.category === 'adjective').map(item => item.label), ['lovely', 'busy', 'young', 'light']);
  assert.equal(result.find(item => item.label === 'open').category, 'verb');
});

test('word bank excludes empty, placeholder, unreviewed and non-Chinese meanings', () => {
  const earlier = lesson('b2-l1', 2, 1, [
    word('good', 'adj.', '好的'), word('blank', 'adj.', ''), word('todo', 'v.', '释义待补充'),
    word('english', 'v.', 'to walk'), word('missing', 'v.', '原笔记单词（未附中文释义）'),
    word('question', 'v.', '怎么找?'), { ...word('review', 'v.', '复习'), needsContextReview: true }
  ], [
    phrase('look at', '看'), phrase('pending', '原笔记习惯表达（未附独立中文释义）'),
    phrase('unknown', '中文释义待核对'), phrase('empty', '—'), phrase('placeholder', '占位'),
    phrase('none', '暂无释义'), phrase('english', 'take care of'), { ...phrase('review me', '复习'), needsContextReview: true }
  ]);
  assert.deepEqual(bank({ lessons: [earlier], currentLesson: current }).map(item => item.label), ['good', 'look at']);
});

test('bare note labels are excluded without rejecting definitions that mention sentences or usage', () => {
  const placeholders = ['句子', '短语', '词组', '例句', '用法', '习惯表达', '的用法', '的用法 :', '的用法：'];
  const earlier = lesson('b2-l1', 2, 1,
    [word('explain', 'v.', '说明句子的用法'), word('bad note', 'v.', '词组')],
    placeholders.map((meaning, index) => phrase(`placeholder ${index}`, meaning)).concat([
      phrase('real usage', '用在句子中的习惯表达'), phrase('real phrase', '一个词组的具体用法'), phrase('a sentence', '一句话；句子')
    ])
  );
  assert.deepEqual(bank({ lessons: [earlier], currentLesson: current }).map(item => item.label), ['explain', 'real usage', 'real phrase', 'a sentence']);
});

test('supplied vocabulary arrays take precedence and damaged provider results fall back to lesson vocabulary', () => {
  const first = lesson('b2-l1', 2, 1, [word('original', 'v.', '原有')]);
  const second = lesson('b2-l2', 2, 2, [word('fallback', 'v.', '回退')]);
  const third = lesson('b2-l3', 2, 3, [word('recover', 'v.', '恢复')]);
  const result = bank({ lessons: [first, second, third, current], currentLesson: current, getVocabulary(item) {
    if (item.id === first.id) return [word('corrected', 'v.', '修正')];
    if (item.id === second.id) return null;
    if (item.id === third.id) throw new Error('damaged lookup');
    throw new Error('current or future vocabulary must not be requested');
  } });
  assert.deepEqual(result.map(item => item.word), ['corrected', 'fallback', 'recover']);
  assert.deepEqual(bank({ lessons: [first], currentLesson: current, getVocabulary: () => [] }), []);
});

test('supplied usage arrays take precedence and damaged provider results fall back to original usage', () => {
  const first = lesson('b2-l1', 2, 1, [], [phrase('original', '原有表达')]);
  const second = lesson('b2-l2', 2, 2, [], [phrase('fall back', '回退')]);
  const third = lesson('b2-l3', 2, 3, [], [phrase('recover from', '从……恢复')]);
  const result = bank({ lessons: [first, second, third, current], currentLesson: current, getUsage(item) {
    if (item.id === first.id) return [phrase('corrected usage', '修正表达')];
    if (item.id === second.id) return null;
    if (item.id === third.id) throw new Error('damaged lookup');
    throw new Error('current or future usage must not be requested');
  } });
  assert.deepEqual(result.map(item => item.phrase), ['corrected usage', 'fall back', 'recover from']);
  assert.deepEqual(bank({ lessons: [first], currentLesson: current, getUsage: () => [] }), []);
  const inheritedProvider = Object.assign(Object.create({ getUsage: () => [phrase('fake usage', '伪造')] }), { lessons: [first], currentLesson: current });
  assert.deepEqual(bank(inheritedProvider).map(item => item.phrase), ['original']);
});

test('malformed and inherited values cannot fabricate word-bank lessons or entries', () => {
  const valid = lesson('b2-l1', 2, 1, [word('valid', 'v.', '有效')]);
  const inheritedLesson = Object.create(valid);
  const inheritedEntry = Object.create(word('inherited', 'v.', '继承'));
  const inheritedMeaning = Object.assign(Object.create({ meaning: '继承释义' }), { word: 'hidden', pos: 'v.' });
  const damaged = lesson('b2-l2', 2, 2, [null, false, [], {}, inheritedEntry, inheritedMeaning,
    { word: {}, pos: 'v.', meaning: '损坏' }, { word: 'bad-pos', pos: {}, meaning: '损坏' }
  ], [null, [], Object.create(phrase('fake usage', '继承')), { phrase: 'bad meaning', meaning: {} }]);
  const result = bank({ lessons: [null, false, {}, inheritedLesson, { ...valid, id: '../bad' }, damaged, valid], currentLesson: current });
  assert.deepEqual(result.map(item => item.label), ['valid']);
  assert.deepEqual(bank(Object.create({ lessons: [valid], currentLesson: current })), []);
  assert.deepEqual(bank({ lessons: [valid], currentLesson: Object.create(current) }), []);
  const inheritedProvider = Object.assign(Object.create({ getVocabulary: () => [word('fake', 'v.', '伪造')] }), { lessons: [valid], currentLesson: current });
  assert.deepEqual(bank(inheritedProvider).map(item => item.label), ['valid']);
  for (const options of [undefined, null, [], 'broken', {}, { lessons: {}, currentLesson: current }]) assert.deepEqual(bank(options), []);
});

test('word bank handles damaged Unicode keys without mutating input material', () => {
  const earlier = lesson('b2-l1', 2, 1, [word('x\ud800', 'v.', '损坏字符')], [phrase('look ’round', '回头看')]);
  Object.freeze(earlier.vocabulary[0]); Object.freeze(earlier.vocabulary); Object.freeze(earlier.usage[0]); Object.freeze(earlier.usage); Object.freeze(earlier);
  const result = bank({ lessons: [earlier], currentLesson: current });
  assert.equal(result[0].key, 'word:b2-l1:x%EF%BF%BD');
  assert.equal(result[1].key, "phrase:b2-l1:look%20'round");
  result[0].source.title = 'changed output';
  assert.equal(earlier.title, 'b2-l1');
});

test('old drafts migrate both legacy selections only when the new field is absent', () => {
  const original = { oldWordKey: 'word:b1-l1:send', oldPhraseKey: 'phrase:b1-l2:look%20at', targetKey: 'target', answers: { affirmative: 'I send it.' } };
  const result = core.sanitizeDraft(original);
  assert.deepEqual(result.selectedOldKeys, ['word:b1-l1:send', 'phrase:b1-l2:look%20at']);
  assert.equal(result.oldWordKey, original.oldWordKey);
  assert.equal(result.oldPhraseKey, original.oldPhraseKey);
  assert.equal(result.targetKey, 'target');
  assert.equal(result.answers.affirmative, 'I send it.');
  assert.deepEqual(core.sanitizeDraft({ ...original, selectedOldKeys: [] }).selectedOldKeys, []);
  assert.deepEqual(core.sanitizeDraft({ ...original, selectedOldKeys: null }).selectedOldKeys, []);
  assert.deepEqual(core.sanitizeDraft({ ...original, selectedOldKeys: undefined }).selectedOldKeys, []);
  assert.deepEqual(core.sanitizeDraft({ oldWordKey: 'same', oldPhraseKey: 'same' }).selectedOldKeys, ['same']);
});

test('multi-selection sanitization bounds keys, removes duplicates and preserves explicit clearing', () => {
  const values = ['a', 'a', '', '   ', null, {}, 12, 'x'.repeat(700), ...Array.from({ length: 110 }, (_, index) => `key-${index}`)];
  const input = { selectedOldKeys: values, oldWordKey: 'legacy' };
  const result = core.sanitizeDraft(input);
  assert.equal(Array.isArray(result.selectedOldKeys), true, 'sanitized selections must be an array');
  assert.equal(result.selectedOldKeys.length, 100);
  assert.deepEqual(result.selectedOldKeys.slice(0, 3), ['a', 'x'.repeat(600), 'key-0']);
  assert.equal(result.selectedOldKeys[99], 'key-97');
  assert.equal(values.length, 118);
  assert.deepEqual(core.sanitizeDraft(null).selectedOldKeys, []);
  assert.deepEqual(core.sanitizeDraft({ selectedOldKeys: 'broken', oldWordKey: 'legacy' }).selectedOldKeys, []);
  const inheritedSelection = Object.assign(Object.create({ selectedOldKeys: ['fabricated'] }), { oldWordKey: 'legacy' });
  assert.deepEqual(core.sanitizeDraft(inheritedSelection).selectedOldKeys, ['legacy']);
  assert.deepEqual(core.sanitizeDraft(Object.create({ oldWordKey: 'fabricated' })).selectedOldKeys, []);
});

test('prototype-looking selection strings remain inert data in both new and legacy drafts', () => {
  const result = core.sanitizeDraft({ selectedOldKeys: ['__proto__', 'constructor', 'prototype', '__proto__'] });
  assert.deepEqual(result.selectedOldKeys, ['__proto__', 'constructor', 'prototype']);
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal({}.polluted, undefined);
  const nullPrototype = Object.assign(Object.create(null), { oldWordKey: '__proto__', oldPhraseKey: 'constructor' });
  assert.deepEqual(core.sanitizeDraft(nullPrototype).selectedOldKeys, ['__proto__', 'constructor']);
  const inheritedArray = Object.assign(Object.create({ selectedOldKeys: ['__proto__'] }), { oldWordKey: 'real' });
  assert.deepEqual(core.sanitizeDraft(inheritedArray).selectedOldKeys, ['real']);
  const earlier = lesson('constructor', 1, 1, [word('__proto__', 'v.', '构造')]);
  assert.equal(bank({ lessons: [earlier], currentLesson: current })[0].key, 'word:constructor:__proto__');
});
