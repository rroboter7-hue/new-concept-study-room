const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '..', 'sentence-wordbank-data.js');
const data = fs.existsSync(sourcePath) ? require(sourcePath) : {};
const corrections = [
  { number: 11, word: 'catch', before: '特殊疑问词', after: '接住；抓住' },
  { number: 29, word: 'air', before: '空气', after: '给……通风' },
  { number: 29, word: 'empty', before: '空的', after: '倒空' },
  { number: 37, word: 'make', before: '多模仿少创造', after: '制作；做' },
  { number: 83, word: 'leave', before: '原型', after: '离开；出发' },
  { number: 107, word: 'suit', before: '西服；套装', after: '适合' }
];
function vocabulary(lesson, rows) {
  assert.equal(typeof data.vocabularyForLesson, 'function', 'word-bank vocabulary corrections must be available');
  return data.vocabularyForLesson(lesson, rows);
}
function usage(lesson) {
  assert.equal(typeof data.usageForLesson, 'function', 'word-bank usage filtering must be available');
  return data.usageForLesson(lesson);
}

test('six reviewed Book1 senses correct only their exact lesson and original definition', () => {
  for (const row of corrections) {
    const result = vocabulary({ book: 1, number: row.number }, [{ word: row.word, pos: 'v.', meaning: row.before }]);
    assert.deepEqual(result, [{ word: row.word, pos: 'v.', meaning: row.after }], row.word);
    for (const lesson of [{ book: 2, number: row.number }, { book: 1, number: row.number + 1 }, { book: '1', number: row.number }]) {
      assert.equal(vocabulary(lesson, [{ word: row.word, meaning: row.before }])[0].meaning, row.before);
    }
    for (const meaning of [row.after, '另一条已核对释义', row.before + ' ']) {
      assert.equal(vocabulary({ book: 1, number: row.number }, [{ word: row.word, meaning }])[0].meaning, meaning);
    }
    assert.equal(vocabulary({ book: 1, number: row.number }, [{ word: row.word.toUpperCase(), meaning: row.before }])[0].meaning, row.before);
  }
});

test('corrected word-bank rows leave the original course and metadata untouched', () => {
  const original = Object.freeze({ word: 'make', meaning: '多模仿少创造', pos: 'v.', phonetic: '/meɪk/', sourcePage: 90 });
  const untouched = Object.freeze({ word: 'listen', meaning: '听；倾听', pos: 'v.' });
  const rows = Object.freeze([original, untouched]);
  const lesson = Object.freeze({ book: 1, number: 37, vocabulary: rows });
  const result = vocabulary(lesson, rows);
  assert.notEqual(result, rows);
  assert.notEqual(result[0], original);
  assert.equal(original.meaning, '多模仿少创造');
  assert.equal(result[0].meaning, '制作；做');
  assert.equal(result[0].phonetic, '/meɪk/');
  assert.equal(result[0].sourcePage, 90);
  assert.equal(result[1], untouched);
  assert.equal(lesson.vocabulary, rows);
});

test('Book1 lesson89 grammar notation is excluded only on the exact phrase and meaning', () => {
  const grammar = Object.freeze({ phrase: 'have done', meaning: '现在完成时', note: '原笔记结构说明' });
  const actualPhrase = Object.freeze({ phrase: 'have a look', meaning: '看一看' });
  const alreadyCorrected = Object.freeze({ phrase: 'have done', meaning: '已经做过某事' });
  const changedLabel = Object.freeze({ phrase: 'Have done', meaning: '现在完成时' });
  const rows = Object.freeze([grammar, actualPhrase, alreadyCorrected, changedLabel]);
  const lesson = Object.freeze({ book: 1, number: 89, usage: rows });
  assert.deepEqual(usage(lesson), [actualPhrase, alreadyCorrected, changedLabel]);
  assert.deepEqual(usage({ book: 1, number: 87, usage: rows }), [...rows]);
  assert.deepEqual(usage({ book: 2, number: 89, usage: rows }), [...rows]);
  assert.equal(lesson.usage.length, 4);
});

test('Book2 lesson31 used to do receives its reviewed meaning only for the exact dirty source value', () => {
  const original = Object.freeze({ phrase: 'used to do', meaning: '活动', note: 'source note' });
  const corrected = Object.freeze({ phrase: 'used to do', meaning: '过去常常做某事' });
  const different = Object.freeze({ phrase: 'used to', meaning: '活动' });
  const rows = Object.freeze([original, corrected, different]);
  const result = usage(Object.freeze({ book: 2, number: 31, usage: rows }));
  assert.equal(result[0].meaning, '过去常常做某事');
  assert.notEqual(result[0], original);
  assert.equal(result[0].note, 'source note');
  assert.equal(result[1], corrected);
  assert.equal(result[2], different);
  assert.equal(original.meaning, '活动');
  assert.equal(usage({ book: 2, number: 30, usage: rows })[0].meaning, '活动');
  assert.equal(usage({ book: 1, number: 31, usage: rows })[0].meaning, '活动');
  assert.equal(usage({ book: 2, number: 31, usage: [{ phrase: 'used to do', meaning: '活动 ' }] })[0].meaning, '活动 ');
});

test('damaged or inherited lookup fields do not activate exact corrections', () => {
  const original = { word: 'make', meaning: '多模仿少创造' };
  assert.deepEqual(vocabulary(Object.create({ book: 1, number: 37 }), [original]), [original]);
  const inheritedMeaning = Object.assign(Object.create({ meaning: '多模仿少创造' }), { word: 'make' });
  assert.equal(vocabulary({ book: 1, number: 37 }, [inheritedMeaning])[0], inheritedMeaning);
  assert.deepEqual(vocabulary(null, null), []);
  assert.deepEqual(vocabulary({}, 'broken'), []);
  assert.deepEqual(vocabulary({ book: 1, number: 37 }, [null, false, {}]), [null, false, {}]);
  assert.deepEqual(usage(null), []);
  assert.deepEqual(usage({ book: 1, number: 89, usage: 'broken' }), []);
  const inheritedLesson = Object.assign(Object.create({ book: 1, number: 89 }), { usage: [{ phrase: 'have done', meaning: '现在完成时' }] });
  assert.equal(usage(inheritedLesson).length, 1);
});

test('the standalone browser build exposes the same correction API without mutating global lesson data', () => {
  assert.equal(fs.existsSync(sourcePath), true, 'the standalone data module must exist');
  const c = { LESSONS: [{ book: 1, number: 37, vocabulary: [{ word: 'make', meaning: '多模仿少创造' }] }] };
  c.window = c; vm.createContext(c);
  vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), c);
  assert.equal(typeof c.StudySentenceWordbankData.vocabularyForLesson, 'function');
  assert.equal(typeof c.StudySentenceWordbankData.usageForLesson, 'function');
  assert.equal(c.LESSONS[0].vocabulary[0].meaning, '多模仿少创造');
  assert.equal(c.StudySentenceWordbankData.vocabularyForLesson(c.LESSONS[0], c.LESSONS[0].vocabulary)[0].meaning, '制作；做');
});
