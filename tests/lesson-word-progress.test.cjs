const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../sentence-core.js');
const lesson = (id, number, vocabulary = [], usage = []) => ({ id, book: 1, number, title: id, vocabulary, usage });
const answers = value => ({ affirmative: `I use ${value} today.`, negative: `She does not use ${value}.`, yesno: `Do you use ${value}?`, wh: `Where do they use ${value}?`, combined: `We use ${value} at home.` });
const target = { key: 'word:b1-l3:book', word: 'book' };
function progress(options) {
  assert.equal(typeof core.lessonProgress, 'function', 'lessonProgress must derive persisted per-target practice');
  return core.lessonProgress(options);
}

test('expanded vocabulary drives current and learned targets without changing phrase sources or lesson data', () => {
  const old = lesson('b1-l1', 1, [{ word: 'old', meaning: '旧的' }], [{ phrase: 'look at', meaning: '看', sourceSentence: 'Look at it.', sourceLocation: '课文第1句' }]);
  const current = lesson('b1-l3', 3, [{ word: 'original', meaning: '原来的' }]);
  const input = JSON.stringify([old, current]);
  const result = core.context({ lessons: [old, current], currentLesson: current, records: { 'b1-l1': { attempts: 1 } }, includePhrases: true, getVocabulary(item) {
    return item.id === current.id ? [{ word: 'book', meaning: '书', isLessonNew: true, sourceSentence: 'Read a book.', sourceLocation: '课文第2句' }, { word: 'old', meaning: '旧的', isLessonNew: false }] : [{ word: 'earlier', meaning: '早先', isLessonNew: true }];
  } });
  assert.deepEqual(result.targets.map(item => item.word), ['book', 'old', 'earlier', 'look at']);
  assert.equal(result.targets[0].key, 'word:b1-l3:book');
  assert.equal(result.targets[0].isLessonNew, true);
  assert.equal(result.targets[1].isLessonNew, false);
  assert.equal(result.targets[0].sourceSentence, 'Read a book.');
  assert.equal(result.targets[0].sourceLocation, '课文第2句');
  assert.equal(result.targets[3].sourceSentence, 'Look at it.');
  assert.deepEqual(result.oldWords.map(item => item.word), ['earlier']);
  assert.deepEqual(result.oldPhrases.map(item => item.phrase), ['look at']);
  assert.equal(JSON.stringify([old, current]), input);
});

test('context provider fallback keeps raw vocabulary when unavailable and respects an empty supplied array', () => {
  const current = lesson('b1-l3', 3, [{ word: 'book', meaning: '书' }]);
  for (const getVocabulary of [() => null, () => { throw Error('offline'); }]) assert.equal(core.context({ lessons: [current], currentLesson: current, getVocabulary }).targets[0].word, 'book');
  assert.deepEqual(core.context({ lessons: [current], currentLesson: current, getVocabulary: () => [] }).targets, []);
  const inherited = Object.assign(Object.create({ getVocabulary: () => [] }), { lessons: [current], currentLesson: current });
  assert.equal(core.context(inherited).targets[0].word, 'book');
});

test('progress survives reload and finds a complete checked variant across modes and rounds', () => {
  const second = { key: 'word:b1-l3:chair', word: 'chair' };
  const drafts = JSON.parse(JSON.stringify({
    [core.draftKey('b1-l3', target.key)]: { targetKey: target.key, checkedAt: 0, answers: { affirmative: 'A book.' } },
    [core.modeDraftKey('b1-l3', target.key, 'flexible')]: { targetKey: target.key, checkedAt: 50, answers: answers('book') },
    [core.roundDraftKey('b1-l3', second.key, 'round-2', 'flexible')]: { targetKey: second.key, checkedAt: 10, answers: { affirmative: 'A chair.' } }
  }));
  assert.deepEqual(progress({ targets: [target, second], drafts }), { total: 2, done: 1, items: [
    { key: target.key, written: 5, checked: true, complete: true }, { key: second.key, written: 1, checked: true, complete: false }
  ] });
});

test('progress never combines partial rounds or transfers completion between targets', () => {
  const full = answers('book');
  const drafts = [
    { targetKey: target.key, checkedAt: 9, answers: { affirmative: full.affirmative, negative: full.negative, yesno: full.yesno } },
    { targetKey: target.key, checkedAt: 9, answers: { wh: full.wh, combined: full.combined } },
    { targetKey: 'word:b1-l4:book', checkedAt: 9, answers: full }
  ];
  assert.deepEqual(progress({ targets: [target], drafts }), { total: 1, done: 0, items: [{ key: target.key, written: 3, checked: true, complete: false }] });
});

test('five written sentences require a checked complete draft and make no mastery or grammar claim', () => {
  const unsubmitted = progress({ targets: [target], drafts: [{ targetKey: target.key, checkedAt: 0, answers: answers('book') }] });
  assert.deepEqual(unsubmitted.items[0], { key: target.key, written: 5, checked: false, complete: false });
  const bad = [
    { ...answers('book'), combined: 'Missing target.' },
    { ...answers('book'), combined: answers('book').affirmative },
    { ...answers('book'), combined: 'book ' + 'x'.repeat(400) }
  ];
  for (const value of bad) assert.equal(progress({ targets: [target], drafts: [{ targetKey: target.key, checkedAt: 1, answers: value }] }).done, 0);
  const result = progress({ targets: [target], drafts: [{ targetKey: target.key, checkedAt: 1, answers: { ...answers('book'), affirmative: 'Book grammar obviously uncertain.' } }] });
  assert.equal(result.done, 1);
  assert.deepEqual(Object.keys(result.items[0]).sort(), ['checked', 'complete', 'key', 'written']);
});

test('progress rejects inherited and accessor fields without running getters or truncating invalid answers', () => {
  const trap = () => { throw Error('getter must stay inert'); };
  const inheritedDraft = Object.create({ targetKey: target.key, checkedAt: 1, answers: answers('book') });
  const inheritedAnswers = Object.create(answers('book'));
  const accessorDraft = Object.defineProperty({}, 'targetKey', { get: trap });
  const accessorAnswers = Object.defineProperty({}, 'affirmative', { get: trap });
  const drafts = { inheritedDraft, accessorDraft, inheritedAnswers: { targetKey: target.key, checkedAt: 1, answers: inheritedAnswers }, accessorAnswers: { targetKey: target.key, checkedAt: 1, answers: accessorAnswers }, invalid: { targetKey: target.key, checkedAt: Infinity, answers: { affirmative: 'x'.repeat(401), negative: {}, yesno: '   ' } } };
  assert.deepEqual(progress({ targets: [target, target, null, Object.create(target)], drafts }), { total: 1, done: 0, items: [{ key: target.key, written: 0, checked: true, complete: false }] });
  for (const value of [undefined, null, {}, { targets: 'bad', drafts: [] }, Object.create({ targets: [target], drafts })]) assert.deepEqual(progress(value), { total: 0, done: 0, items: [] });
});

test('answer sanitation requires a fresh check after truncation without discarding draft context', () => {
  const original = { targetKey: target.key, answers: { ...answers('book'), combined: 'We use book ' + 'x'.repeat(500) }, checkedAt: 10,
    sourceLessonIds: ['b1-l1'], oldWordKey: 'word:b1-l1:chair', oldPhraseKey: 'phrase:b1-l1:look%20at', selectedOldKeys: ['word:b1-l1:chair'], recommendedOldKeys: ['word:b1-l1:chair'], mode: 'flexible', roundKey: 'round-1', assisted: true, evidenceTargetKey: target.key };
  assert.equal(progress({ targets: [target], drafts: [original] }).done, 0);
  const sanitized = core.sanitizeDraft(original);
  assert.equal(sanitized.checkedAt, 0, 'modified imported answers need a new check');
  assert.equal(sanitized.answers.combined.length, 400);
  assert.deepEqual(progress({ targets: [target], drafts: [sanitized] }).items[0], { key: target.key, written: 5, checked: false, complete: false });
  for (const field of ['targetKey', 'sourceLessonIds', 'oldWordKey', 'oldPhraseKey', 'selectedOldKeys', 'recommendedOldKeys', 'mode', 'roundKey', 'assisted', 'evidenceTargetKey']) assert.deepEqual(sanitized[field], original[field], field);
  assert.equal(original.checkedAt, 10);
  assert.equal(core.sanitizeDraft({ ...original, answers: answers('book') }).checkedAt, 10);
});

test('invalid own answers and accessor or inherited fields cannot retain fabricated checked evidence', () => {
  for (const value of [null, 42, {}, []]) {
    const sanitized = core.sanitizeDraft({ targetKey: target.key, checkedAt: 10, answers: { ...answers('book'), combined: value } });
    assert.equal(sanitized.checkedAt, 0);
    assert.equal(sanitized.answers.combined, '');
  }
  const trap = () => { throw Error('sanitization must not invoke getters'); };
  const getterAnswers = Object.defineProperty({ ...answers('book') }, 'combined', { get: trap });
  const getterDraft = Object.defineProperty({ targetKey: target.key, checkedAt: 10 }, 'answers', { get: trap });
  assert.equal(core.sanitizeDraft({ targetKey: target.key, checkedAt: 10, answers: getterAnswers }).checkedAt, 0);
  assert.equal(core.sanitizeDraft(getterDraft).checkedAt, 0);
  const inherited = core.sanitizeDraft(Object.create({ answers: answers('book'), targetKey: target.key, checkedAt: 10 }));
  assert.equal(inherited.checkedAt, 0);
  assert.equal(inherited.targetKey, '');
  assert.deepEqual(inherited.answers, { affirmative: '', negative: '', yesno: '', wh: '', combined: '' });
});

test('optional old knowledge permits checked practice without choices while the default stays strict', () => {
  const options = { target: 'book', answers: answers('book') };
  const strict = core.check(options);
  assert.equal(strict.readyForReview, false);
  assert.equal(strict.rows.find(item => item.kind === 'combined').issues.length, 2);
  const optional = core.check({ ...options, requireOldKnowledge: false });
  assert.equal(optional.readyForReview, true);
  assert.deepEqual(optional.rows.find(item => item.kind === 'combined').issues, []);
});

test('optional old knowledge still checks selected expressions and target or sentence requirements', () => {
  const options = { target: 'book', answers: answers('book'), requireOldKnowledge: false };
  for (const selection of [{ oldWord: 'chair' }, { oldPhrase: 'look at' }, { oldWord: 'books' }]) {
    assert.equal(core.check({ ...options, ...selection }).rows.find(item => item.kind === 'combined').status, 'needs-work');
  }
  for (const combined of ['The target is absent.', options.answers.affirmative, 'book ' + 'x'.repeat(400)]) {
    assert.equal(core.check({ ...options, answers: { ...options.answers, combined } }).rows.find(item => item.kind === 'combined').status, 'needs-work');
  }
});
