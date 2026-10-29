/* Exact, reviewed gloss corrections for the sentence-practice word bank only. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudySentenceWordbankData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var corrections = [
    { number: 11, word: 'catch', before: '特殊疑问词', after: '接住；抓住' },
    { number: 29, word: 'air', before: '空气', after: '给……通风' },
    { number: 29, word: 'empty', before: '空的', after: '倒空' },
    { number: 37, word: 'make', before: '多模仿少创造', after: '制作；做' },
    { number: 83, word: 'leave', before: '原型', after: '离开；出发' },
    { number: 107, word: 'suit', before: '西服；套装', after: '适合' }
  ];
  function ownValue(value, field) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    var descriptor = Object.getOwnPropertyDescriptor(value, field);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
  }
  // This gloss describes the utterance in the verified Book 1 passage, not
  // every noun/verb sense of pardon. Reject copied or changed source bodies.
  function contextForLesson(lesson, word) {
    if (word !== 'pardon' || ownValue(lesson, 'source') === 'imported' ||
        ownValue(lesson, 'id') !== 'nce-b1-4be758-l001' || ownValue(lesson, 'book') !== 1 ||
        ownValue(lesson, 'number') !== 1 || ownValue(lesson, 'title') !== '第1课 · Excuse me!') return null;
    var textbook = ownValue(lesson, 'textbook'), paragraphs = ownValue(lesson, 'paragraphs');
    var body = ['Excuse me!', 'Yes?', 'Is this your handbag?', 'Pardon?', 'Is this your handbag?', 'Yes, it is.', 'Thank you very much.'];
    if (ownValue(textbook, 'sourceUrl') !== 'resources/df385269f6502f20.pdf' ||
        ownValue(textbook, 'sourceSha256') !== 'df385269f6502f201fc5689683f9163205202e8b0b735fd9a388b2c7982ba2b3' ||
        ownValue(textbook, 'bodySha256') !== 'fe78f1fcf2f3ae53f849aa7c442cbb33406c533e80a6918b85d15e644c21a9e5' ||
        !Array.isArray(paragraphs) || paragraphs.length !== body.length ||
        !body.every(function (line, i) { return ownValue(paragraphs[i], 'en') === line; })) return null;
    return { word: 'pardon', phonetic: '/ˈpɑːdn/', pos: 'int.', meaning: '请再说一遍', example: 'Pardon?',
      meaningKind: 'lesson', meaningSource: '本课语境校对', sourceLabel: '第一册第1课 · Pardon?',
      sourceLessonId: ownValue(lesson, 'id'), sourcePage: 5,
      meaningProvenance: { version: 1, kind: 'self-authored-context',
        source: 'https://www.oxfordlearnersdictionaries.com/definition/english/pardon_1',
        sourceLessonId: ownValue(lesson, 'id'), sourceSentence: 'Pardon?' } };
  }
  function vocabularyForLesson(lesson, rows) {
    if (!Array.isArray(rows)) return [];
    var book = ownValue(lesson, 'book'), number = ownValue(lesson, 'number');
    return rows.map(function (row) {
      var reviewed = contextForLesson(lesson, ownValue(row, 'word'));
      if (reviewed && !ownValue(row, 'pos') && ownValue(row, 'meaningSource') !== 'unavailable' &&
          ownValue(row, 'contextMeaningStale') !== true && ownValue(row, 'needsContextReview') !== true &&
          ['原谅', '原谅；请再说一遍'].includes(ownValue(row, 'meaning'))) {
        return Object.assign({}, row, reviewed);
      }
      var correction = book === 1 && corrections.find(function (item) {
        return item.number === number && item.word === ownValue(row, 'word') && item.before === ownValue(row, 'meaning');
      });
      return correction ? Object.assign({}, row, { meaning: correction.after }) : row;
    });
  }
  function usageForLesson(lesson) {
    var rows = ownValue(lesson, 'usage');
    if (!Array.isArray(rows)) return [];
    var isGrammarSource = ownValue(lesson, 'book') === 1 && ownValue(lesson, 'number') === 89;
    var isUsedToSource = ownValue(lesson, 'book') === 2 && ownValue(lesson, 'number') === 31;
    return rows.filter(function (row) {
      return !(isGrammarSource && ownValue(row, 'phrase') === 'have done' && ownValue(row, 'meaning') === '现在完成时');
    }).map(function (row) {
      return isUsedToSource && ownValue(row, 'phrase') === 'used to do' && ownValue(row, 'meaning') === '活动'
        ? Object.assign({}, row, { meaning: '过去常常做某事' }) : row;
    });
  }

  return Object.freeze({ vocabularyForLesson: vocabularyForLesson, usageForLesson: usageForLesson, contextForLesson: contextForLesson });
});
