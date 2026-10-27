const test = require('node:test');
const assert = require('node:assert/strict');
const sentences = require('../sentence-core.js');
const batch = require('../batch-sentence-core.js');

const theatre = {
  affirmative: 'I went to the theatre last week.',
  negative: 'I did not go to the theatre last week.',
  yesno: 'Did I go to the theatre last week?',
  wh: 'Where did I go last week?',
  combined: 'My sister likes the theatre.'
};
const book = {
  affirmative: 'I read a book every day.',
  negative: 'I do not read a book every day.',
  yesno: 'Do I read a book every day?',
  wh: 'What do I read every day?',
  combined: 'My sister looks at a book.'
};
function guided(target, answers, extra = {}) {
  return sentences.check({ mode: 'four', target, answers, ...extra });
}
function batchWh(target, original, question) {
  const parsed = batch.parse(`目标词：${target}\n原句：${original}\n特殊疑问句：${question}`, 'conversion');
  return batch.checkRow(parsed.rows[1], { sentenceCheck: sentences.check });
}

test('natural WH replacement is reviewable and completes four-form and legacy practice', () => {
  for (const [target, answers, oldPhrase] of [['theatre', theatre, 'like'], ['book', book, 'look at']]) {
    const result = guided(target, answers);
    const wh = result.rows.find(row => row.kind === 'wh');
    assert.notEqual(wh.status, 'needs-work', answers.wh);
    assert.deepEqual(wh.issues, [], answers.wh);
    assert.equal(wh.status, 'review', 'omission still needs human review');
    assert.match(wh.notes.join(' '), /有限.*人工复核/);
    assert.equal(result.readyForReview, true);
    assert.equal(sentences.completion({ mode: 'four', target, answers }), true);
    assert.equal(sentences.completion({ mode: 'transform', target, answers }), true);
    assert.equal(sentences.completion({ target, answers: { ...answers, combined: '' } }), false);
    const legacy = guided(target, answers, { mode: 'transform', oldWord: 'sister', oldPhrase });
    assert.equal(legacy.readyForReview, true);
    const checked = batchWh(target, answers.affirmative, answers.wh);
    assert.equal(checked.status, 'review');
    assert.deepEqual(checked.issues, []);
  }
});

test('WH omission covers a questioned subject or be-complement without dropping other facts', () => {
  for (const [target, original, question] of [
    ['sister', 'My sister reads a book.', 'Who reads a book?'],
    ['theatre', 'She is at the theatre.', 'Where is she?'],
    ['book', 'It is a book.', 'What is it?']
  ]) {
    const wh = guided(target, { affirmative: original, wh: question }).rows[3];
    assert.deepEqual(wh.issues, [], question);
    assert.equal(wh.status, 'review', question);
    assert.deepEqual(batchWh(target, original, question).issues, [], question);
  }
});

test('WH target omission cannot complete or bypass batch findings for unrelated or malformed questions', () => {
  for (const question of [
    '', 'Where?', 'Where did I?', 'Where did I went last week?',
    'Where did she go last week?', 'Where did I eat last week?',
    'Where do I go last week?', 'Where did I go yesterday?',
    'What did I go last week?', 'Where did I go last week',
    'Where did I go last week? 我不知道', 'Where did I go last week??',
    'Where did I,,, go last week?', 'Where did I go last-week?',
    'Where did I go last week? What did I eat?', '香蕉在哪里？'
  ]) {
    const answers = { ...theatre, wh: question };
    const result = guided('theatre', answers);
    const wh = result.rows[3];
    assert.equal(sentences.completion({ mode: 'four', target: 'theatre', answers }), false, question);
    assert.equal(sentences.completion({ mode: 'transform', target: 'theatre', answers }), false, question);
    assert.equal(result.readyForReview, false, question);
    assert.ok(wh.status === 'needs-work' || wh.status === 'empty', question);
    assert.equal(batchWh('theatre', theatre.affirmative, question).status, 'needs-work', question);
  }
  for (const original of ['', 'I went home last week.', 'I went to the theatre yesterday.']) {
    assert.equal(guided('theatre', { ...theatre, affirmative: original }).rows[3].status, 'needs-work', original);
    assert.equal(batchWh('theatre', original, theatre.wh).status, 'needs-work', original);
  }
});

test('WH replacement does not relax target or old-expression evidence in other modes and rows', () => {
  assert.equal(sentences.completion({ mode: 'flexible', target: 'book', answers: book }), false);
  const missingOld = guided('book', book, { mode: 'transform' }).rows[4];
  assert.equal(missingOld.status, 'needs-work');
  assert.match(missingOld.issues.join(' '), /旧词/);
  assert.match(missingOld.issues.join(' '), /旧用法/);
  const missingTarget = { ...book, combined: 'My sister looks at it.' };
  assert.equal(sentences.completion({ mode: 'transform', target: 'book', answers: missingTarget }), false);
  assert.equal(guided('book', missingTarget, { mode: 'transform', oldWord: 'sister', oldPhrase: 'look at' }).rows[4].status, 'needs-work');
  const duplicate = { ...book, wh: book.yesno };
  assert.equal(sentences.completion({ mode: 'four', target: 'book', answers: duplicate }), false);
  const saved = sentences.sanitizeDraft({ mode: 'four', roundKey: 'daily-four', targetKey: 'word:now:book', answers: book, checkedAt: 10 });
  assert.deepEqual(saved.answers, book);
  assert.equal(saved.roundKey, 'daily-four');
  assert.equal(saved.checkedAt, 10);
  assert.equal(sentences.lessonProgress({ targets: [{ key: 'word:now:book', word: 'book' }], drafts: { saved } }).done, 1);
});
