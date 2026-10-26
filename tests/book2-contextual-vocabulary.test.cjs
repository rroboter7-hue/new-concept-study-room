const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const first = ['curriculum.js', 'textbook-lessons.js', 'book2-lessons.js', 'book2-translations.js', 'phrase-library.js', 'book2-learning-support.js'];
function load(mutate, expand = false) {
  const window = {}, scope = vm.createContext({ window });
  const run = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), scope, { filename: file });
  first.forEach(run);
  if (mutate) mutate(window.LESSONS);
  ['book2-vocabulary.js', 'book2-quality-support.js', 'book2-reviewed-questions.js', 'study-knowledge.js'].forEach(run);
  if (expand) ['pilot-question-expansion.js', 'book2-later-question-expansion.js'].forEach(run);
  const bank = window.StudyKnowledge.install(window.LESSONS, { grammarAudit: window.BOOK2_QUESTION_REVIEWS,
    extraQuestions: expand ? [window.BOOK2_QUESTION_EXPANSION, window.BOOK2_LATER_QUESTION_EXPANSION] : [] });
  return { window, scope, bank, run };
}
const lesson = (window, number) => window.LESSONS.find(l => l.book === 2 && l.number === number);
const correction = (window, word) => window.BOOK2_CONTEXT_CORRECTIONS.find(row => row.word === word);
const spectacleClause = 'This is a moving spectacle, for crowds of people stand on the shore watching the lanterns drifting away until they can be seen no more.';

test('the actual knowledge bank uses the title-specific good-turn sense and the lantern-scene spectacle sense', () => {
  const { window, bank } = load();
  const turn = bank.wordForLesson(lesson(window, 11).id, 'turn');
  assert.equal(turn.meaning, '善行；帮助');
  assert.equal(turn.example, 'One good turn deserves another');
  assert.equal(turn.exampleSourceType, 'lesson-title');
  assert.match(turn.exampleSourceLabel, /标题.*非正文/);
  const spectacle = bank.wordForLesson(lesson(window, 96).id, 'spectacle');
  assert.equal(spectacle.meaning, '景象；场面');
  assert.equal(spectacle.example, spectacleClause);
  assert.equal(spectacle.exampleSourceType, 'lesson-passage');
  assert.equal(spectacle.example.includes('make a spectacle of yourself'), false);
});

test('each authored correction keeps its expected old value, exact source evidence and official dictionary URL', () => {
  const { window } = load();
  const turn = correction(window, 'turn'), spectacle = correction(window, 'spectacle');
  assert.ok(turn && spectacle);
  assert.equal(turn.expectedOld, '转动；转身');
  assert.equal(turn.contextTitle, 'One good turn deserves another');
  assert.equal(turn.sourceEvidence.sourceTitle, lesson(window, 11).textbook.title);
  assert.equal(turn.dictionaryURL, 'https://dictionary.cambridge.org/dictionary/english/good-bad-turn');
  assert.equal(spectacle.expectedOld, '出洋相; 丢人现眼');
  assert.equal(spectacle.sourceEvidence.sourceParagraphIndex, 0);
  assert.equal(spectacle.sourceEvidence.sourceText, spectacleClause);
  assert.ok(lesson(window, 96).paragraphs[0].en.includes(spectacle.sourceEvidence.sourceText));
  assert.equal(spectacle.dictionaryURL, 'https://dictionary.cambridge.org/us/dictionary/english/spectacle');
});

test('source vocabulary audits retain the old meanings and the replaced idiom example', () => {
  const { window } = load();
  const turn = lesson(window, 11).vocabularyAudit.originalVocabulary.find(word => word.word === 'turn');
  const spectacle = lesson(window, 96).vocabularyAudit.originalVocabulary.find(word => word.word === 'spectacle');
  assert.equal(turn.contextCorrections[0].originalItem.meaning, '转动；转身');
  assert.equal(spectacle.contextCorrections[0].originalItem.meaning, '出洋相; 丢人现眼');
  assert.equal(spectacle.contextCorrections[0].originalItem.example, 'Don’t make a spectacle of yourself.');
  assert.equal(spectacle.contextCorrections[0].newValue, '景象；场面');
});

test('corrections skip conflicting titles, changed passages and drifted source vocabulary', () => {
  const { window, bank } = load(lessons => {
    const l11 = lessons.find(l => l.book === 2 && l.number === 11), l96 = lessons.find(l => l.book === 2 && l.number === 96);
    l11.textbook.title = 'A different source title';
    // The display title still matches: it must not override conflicting source metadata.
    l96.paragraphs[0].en = l96.paragraphs[0].en.replace(spectacleClause, 'A different final scene.');
  });
  assert.equal(bank.wordForLesson(lesson(window, 11).id, 'turn').meaning, '转动；转身');
  assert.equal(bank.wordForLesson(lesson(window, 96).id, 'spectacle').meaning, '出洋相; 丢人现眼');
  for (const word of ['turn', 'spectacle']) {
    const row = correction(window, word);
    assert.ok(row);
    assert.equal(window.BOOK2_CONTEXT_CORRECTION_STATUS.find(status => status.id === row.id).status, 'skipped-source-mismatch');
  }
  const drift = load(lessons => lessons.find(l => l.book === 2 && l.number === 11).vocabulary.find(w => w.word === 'turn').meaning = 'Already manually edited');
  assert.equal(drift.bank.wordForLesson(lesson(drift.window, 11).id, 'turn'), null, 'unconfirmed non-Chinese source drift must not be silently corrected');
  assert.equal(drift.window.BOOK2_CONTEXT_CORRECTION_STATUS.find(status => status.id === correction(drift.window, 'turn').id).status, 'skipped-value-drift');
});

test('the exact source display title is accepted only as a fallback and existing passage corrections remain guarded', () => {
  const { window, bank } = load(lessons => {
    const l11 = lessons.find(l => l.book === 2 && l.number === 11), l1 = lessons.find(l => l.book === 2 && l.number === 1);
    delete l11.textbook.title;
    l1.paragraphs.forEach(p => p.en = p.en.replace('‘It’s none of your business,’ the young man said rudely.', 'A different quotation.'));
  });
  assert.equal(bank.wordForLesson(lesson(window, 11).id, 'turn').meaning, '善行；帮助');
  assert.equal(window.BOOK2_CONTEXT_CORRECTION_STATUS.find(row => row.id === 'book2-pilot-l001-business-meaning').status, 'skipped-source-mismatch');
});

test('context corrections are idempotent and leave every expanded lesson at twelve effective questions', () => {
  const { window, bank, run } = load(null, true);
  assert.deepEqual(JSON.parse(JSON.stringify(bank.audit.expansionIssues)), []);
  for (const l of window.LESSONS.filter(l => l.book === 2)) assert.equal(bank.quizForLesson(l.id).length, 12, l.id);
  run('book2-vocabulary.js');
  for (const [number, word] of [[11, 'turn'], [96, 'spectacle']]) {
    const item = lesson(window, number).vocabulary.find(item => item.word === word);
    assert.equal(item.contextCorrections.length, 1, word);
    assert.equal(window.BOOK2_CONTEXT_CORRECTION_STATUS.find(status => status.id === correction(window, word).id).status, 'already-current');
  }
});
