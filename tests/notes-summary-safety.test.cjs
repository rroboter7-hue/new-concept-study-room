'use strict';
// Independent review checks. Run against the source app (default), or set
// PILOT_APP_DIST to a candidate app directory. No source files are modified.
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./support/app-harness.cjs');

function visibleHTML(html) {
  const details = [];
  let result = '';
  for (const token of html.match(/<\/?details\b[^>]*>|[^<]+|<[^>]+>/g) || []) {
    if (/^<details\b/i.test(token)) {
      // Unlike the original notes-summary test, an open details stays visible.
      details.push(/\sopen(?:\s|=|>)/i.test(token));
      continue;
    }
    if (/^<\/details/i.test(token)) { details.pop(); continue; }
    if (details.every(Boolean)) result += token;
  }
  return result;
}
function text(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
async function firstLesson() {
  const h = await harness({ pilot: false });
  const lesson = h.c.LESSONS.find(l => l.book === 2 && l.number === 1);
  await h.api.selectLesson(lesson.id);
  return { h, lesson };
}

// Catches default-open details and question/answer lectures outside details.
test('notes lectures preserve their prompt and analysis inside initially closed details', async () => {
  const { h, lesson } = await firstLesson();
  const question = h.c.StudyKnowledge.bank.questionsForLesson(lesson.id).find(q => q.type === 'grammar');
  const html = h.api.renderUsage(), visible = text(visibleHTML(html));
  assert(text(html).includes(question.question), 'full prompt remains accessible');
  assert(text(html).includes(question.explanation), 'full analysis remains accessible');
  assert(!visible.includes(question.question), 'prompt is not visible before expansion');
  assert(!visible.includes('正确形式：'), 'answer label is not visible before expansion');
  assert((html.match(/<details\b/gi) || []).length > 0, 'there is an expandable detail');
  assert.equal((html.match(/<details\b[^>]*\sopen(?:\s|=|>)/gi) || []).length, 0, 'notes details start closed');
});

// Catches a seen-concept shortcut that discards later distinct explanations.
test('grouping one concept retains every distinct rule and contrast example without mutation', async () => {
  const { h, lesson } = await firstLesson();
  const original = h.c.StudyKnowledge.bank;
  const questions = original.questionsForLesson(lesson.id).filter(q => q.type === 'grammar').slice(0, 2);
  for (const q of questions) q.conceptId = 'review-contract-shared-concept';
  const before = JSON.stringify(questions);
  freeze(questions);
  h.c.StudyKnowledge.bank = { ...original, questionsForLesson: () => questions };
  const all = text(h.api.renderUsage());
  for (const q of questions) {
    assert(all.includes(q.rule), 'distinct core rule remains accessible: ' + q.rule);
    assert(all.includes(q.question), 'distinct question remains accessible');
    for (const example of q.contrastExamples) {
      assert(all.includes(typeof example === 'string' ? example : example.en), 'contrast example remains accessible');
    }
  }
  assert.equal(JSON.stringify(questions), before);
});

// Catches deduplication by phrase alone, which loses different meanings/notes.
test('identical phrase labels retain distinct meanings and contextual notes', async () => {
  const { h, lesson } = await firstLesson();
  const base = lesson.usage[0];
  lesson.usage = [
    { ...base, meaning: '注意；留心', note: '强调把注意力放在当前说话者身上。' },
    { ...base, meaning: '重视；认真考虑', note: '强调认真考虑意见，不表示已经采取行动。' }
  ];
  const before = JSON.stringify(lesson.usage);
  freeze(lesson.usage);
  const all = text(h.api.renderUsage());
  for (const usage of lesson.usage) {
    assert(all.includes(usage.meaning), 'distinct meaning remains accessible');
    assert(all.includes(usage.note), 'distinct contextual note remains accessible');
  }
  assert.equal(JSON.stringify(lesson.usage), before);
});
