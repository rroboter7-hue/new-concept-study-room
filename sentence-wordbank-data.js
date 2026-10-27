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
  function vocabularyForLesson(lesson, rows) {
    if (!Array.isArray(rows)) return [];
    var book = ownValue(lesson, 'book'), number = ownValue(lesson, 'number');
    return rows.map(function (row) {
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

  return Object.freeze({ vocabularyForLesson: vocabularyForLesson, usageForLesson: usageForLesson });
});
