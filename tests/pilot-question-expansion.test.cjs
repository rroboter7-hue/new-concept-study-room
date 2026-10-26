const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const files = ['curriculum.js', 'textbook-lessons.js', 'book2-lessons.js', 'book2-translations.js', 'phrase-library.js', 'book2-learning-support.js', 'book2-vocabulary.js', 'book2-quality-support.js', 'book2-reviewed-questions.js', 'study-knowledge.js'];
const plain = value => JSON.parse(JSON.stringify(value));
function load(expanded = true) {
  const window = {}, scope = vm.createContext({ window });
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), scope, { filename: file });
  const originals = plain(window.LESSONS);
  if (expanded) vm.runInContext(fs.readFileSync(path.join(root, 'pilot-question-expansion.js'), 'utf8'), scope, { filename: 'pilot-question-expansion.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'knowledge-bootstrap.js'), 'utf8'), scope);
  return { window, originals };
}
const pilot = lessons => lessons.filter(l => l.book === 2 && l.number <= 10);

test('lessons 1–10 each retain their graded prefix and gain exactly twelve registered questions', () => {
  const baseline = load(false).window, { window } = load();
  for (const lesson of pilot(window.LESSONS)) {
    const before = baseline.StudyKnowledge.bank.quizForLesson(lesson.id);
    const after = window.StudyKnowledge.bank.quizForLesson(lesson.id);
    assert.equal(after.length, 12, lesson.id);
    assert.deepEqual(plain(after.slice(0, before.length)), plain(before), 'historical quiz indices must remain stable');
    assert.deepEqual(plain(lesson.quiz), plain(after));
    assert.deepEqual(plain(lesson.quizAudit), plain(baseline.LESSONS.find(l => l.id === lesson.id).quizAudit));
    for (const q of after.slice(before.length)) {
      assert.equal(q.graded, true);
      assert.ok(window.StudyKnowledge.bank.get(q.conceptId), q.id);
      assert.ok(window.StudyKnowledge.bank.questionsForLesson(lesson.id).some(row => row.id === q.id));
    }
  }
  assert.equal(window.BOOK2_QUESTION_EXPANSION.entries.length, 78);
  assert.deepEqual(plain(window.StudyKnowledge.bank.audit.expansionIssues), []);
  for (const lesson of window.LESSONS.filter(l => l.book === 2 && l.number > 10)) {
    assert.deepEqual(plain(lesson.quiz), plain(baseline.LESSONS.find(l => l.id === lesson.id).quiz));
  }
});

test('reviewed additions have complete explanations, stable identities, traceable source text and balanced categories', () => {
  const { window } = load(), bank = window.StudyKnowledge.bank;
  const entries = window.BOOK2_QUESTION_EXPANSION.entries, ids = new Set();
  for (const q of entries) {
    assert.ok(!ids.has(q.id), q.id); ids.add(q.id);
    assert.equal(q.sourceLabel, '自编练习 · 非教材原配习题');
    assert.equal(q.reviewStatus, 'self-reviewed');
    assert.equal(q.containsOriginalWorkbookExercise, false);
    assert.ok(q.rule.length > 8, q.id);
    assert.ok(q.contrastExamples.length >= 2, q.id);
    assert.ok(q.contrastExamples.every(x => typeof x === 'string' && x.length > 5));
    assert.equal(new Set(q.options).size, q.options.length);
    assert.ok(q.answer >= 0 && q.answer < q.options.length);
    q.options.forEach((o, i) => { if (i !== q.answer) assert.ok(q.wrongReasons[o]?.length > 5, q.id + ': ' + o); });
    const source = window.LESSONS.find(l => l.id === q.sourceLessonId);
    assert.ok(source.paragraphs[q.sourceEvidence.sourceParagraphIndex].en.includes(q.sourceEvidence.sourceText), q.id);
    for (const id of q.sourceConceptIds) assert.ok(bank.get(id), id);
    const record = bank.get(q.conceptId);
    assert.equal(record.lessonId, q.lessonId);
    assert.equal(record.sourceLessonId, q.sourceLessonId);
    assert.deepEqual(plain(record.sourceConceptIds), plain(q.sourceConceptIds));
  }
  for (const lesson of pilot(window.LESSONS)) {
    const additions = entries.filter(q => q.lessonId === lesson.id);
    assert.ok(additions.some(q => q.category === 'comprehension'), lesson.id);
    assert.ok(additions.some(q => q.category === 'conversion'), lesson.id);
    assert.ok(additions.some(q => q.type === 'vocabulary'), lesson.id);
    if (lesson.number === 1) continue;
    const retrieval = additions.filter(q => q.sourceLessonId !== q.lessonId);
    assert.ok(retrieval.length >= 2, lesson.id);
    assert.ok(retrieval.some(q => q.type === 'grammar'));
    assert.ok(retrieval.some(q => q.type === 'vocabulary'));
    for (const q of retrieval) {
      assert.ok(q.sourceConceptIds.length > 0);
      assert.ok(window.LESSONS.find(l => l.id === q.sourceLessonId).number < lesson.number);
    }
  }
});

test('vocabulary reversals preserve the actual source meaning and unique word answer', () => {
  const { window } = load(), bank = window.StudyKnowledge.bank;
  for (const q of window.BOOK2_QUESTION_EXPANSION.entries.filter(q => q.type === 'vocabulary')) {
    const registered = bank.quizForLesson(q.lessonId).find(row => row.id === q.id), record = bank.get(q.conceptId);
    assert.equal(registered.direction, 'meaning-to-word');
    assert.equal(registered.options[registered.answer], record.word);
    assert.equal(record.meaning, q.meaning);
    registered.optionConceptIds.forEach((id, i) => {
      const option = bank.get(id);
      assert.equal(option.word, registered.options[i]);
      assert.equal(option.meaning === q.meaning, i === registered.answer, q.id);
    });
  }
});

test('reinstallation is deterministic and neither duplicates additions nor rewrites historical audits', () => {
  const { window } = load(), expected = plain(pilot(window.LESSONS).map(l => ({ quiz:l.quiz, audit:l.quizAudit, vocabulary:l.vocabulary })));
  const next = window.StudyKnowledge.install(window.LESSONS, { grammarAudit: window.BOOK2_QUESTION_REVIEWS, extraQuestions: window.BOOK2_QUESTION_EXPANSION });
  assert.deepEqual(plain(pilot(window.LESSONS).map(l => ({ quiz:l.quiz, audit:l.quizAudit, vocabulary:l.vocabulary }))), expected);
  assert.deepEqual(plain(next.audit.expansionIssues), []);
});

test('every authored question is graded correctly by the existing bank-backed remediation flow', () => {
  const { window } = load(), scope = vm.createContext({ window });
  vm.runInContext(fs.readFileSync(path.join(root, 'learning-remediation.js'), 'utf8'), scope);
  const bank = window.StudyKnowledge.bank;
  for (const authored of window.BOOK2_QUESTION_EXPANSION.entries) {
    const lesson = window.LESSONS.find(l => l.id === authored.lessonId), q = bank.quizForLesson(lesson.id).find(row => row.id === authored.id);
    q.options.forEach((option, index) => {
      const feedback = window.StudyRemediation.describe(q, index, { bank, lesson });
      assert.equal(feedback.isCorrect, index === q.answer, q.id + ': ' + option);
      assert.equal(feedback.correctAnswer, q.options[q.answer], q.id);
      assert.ok(feedback.rule, q.id);
      assert.ok(feedback.reason, q.id);
    });
  }
});

test('unsupported, stale or incomplete authored additions are excluded with an explicit audit reason', () => {
  const { window, originals } = load(), first = plain(window.BOOK2_QUESTION_EXPANSION.entries[0]);
  for (const change of [
    { sourceLessonId:'missing-lesson' },
    { sourceConceptIds:['knowledge:missing:grammar:unknown'] },
    { sourceEvidence:{ sourceParagraphIndex:0, sourceText:'This never appeared in the source.' } },
    { wrongReasons:{} },
    { reviewStatus:'unreviewed' },
    { sourceLabel:'教材原配习题' },
    { answer:99 }
  ]) {
    const poisoned = { ...first, ...change };
    const bank = window.StudyKnowledge.create(originals, { grammarAudit:window.BOOK2_QUESTION_REVIEWS, extraQuestions:{schemaVersion:1, book:2, entries:[poisoned]} });
    assert.equal(bank.quizForLesson(first.lessonId).some(q => q.id === first.id), false);
    assert.equal(bank.audit.expansionIssues.length, 1);
    assert.ok(bank.audit.expansionIssues[0].reason);
  }
});

test('multiple batch manifests are supported without repeated stable IDs', () => {
  const { window, originals } = load(), manifest = window.BOOK2_QUESTION_EXPANSION;
  const bank = window.StudyKnowledge.create(originals, { grammarAudit:window.BOOK2_QUESTION_REVIEWS, extraQuestions:[manifest, manifest] });
  for (const lesson of pilot(originals)) assert.equal(bank.quizForLesson(lesson.id).length, 12);
  assert.ok(bank.audit.expansionIssues.every(issue => issue.code === 'duplicate-question-id'));
});
