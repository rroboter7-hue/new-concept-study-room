const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sources = ['curriculum.js', 'textbook-lessons.js', 'book2-lessons.js', 'book2-translations.js', 'book2-reading-alignment.js', 'phrase-library.js', 'book2-learning-support.js', 'book2-vocabulary.js', 'book2-additional-context-fixes.js', 'book2-quality-support.js', 'book2-reviewed-questions.js', 'study-knowledge.js'];
const plain = value => JSON.parse(JSON.stringify(value));
function load() {
  const window = {}, scope = vm.createContext({ window });
  for (const file of sources) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), scope, { filename: file });
  const baseline = window.StudyKnowledge.create(window.LESSONS, { grammarAudit: window.BOOK2_QUESTION_REVIEWS });
  const file = path.join(root, 'book2-later-question-expansion.js');
  if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), scope, { filename: file });
  assert.ok(window.BOOK2_LATER_QUESTION_EXPANSION, 'the later-lesson reviewed expansion must be available');
  const expanded = window.StudyKnowledge.create(window.LESSONS, { grammarAudit: window.BOOK2_QUESTION_REVIEWS, extraQuestions: window.BOOK2_LATER_QUESTION_EXPANSION });
  return { window, scope, baseline, expanded };
}

test('all eighty-six later lessons retain every graded original and reach twelve effective questions', () => {
  const { window, baseline, expanded } = load();
  const later = window.LESSONS.filter(l => l.book === 2 && l.number >= 11 && l.number <= 96);
  assert.equal(later.length, 86);
  assert.equal(window.BOOK2_LATER_QUESTION_EXPANSION.entries.length, 799);
  assert.deepEqual(plain(expanded.audit.expansionIssues), []);
  for (const l of later) {
    const before = baseline.quizForLesson(l.id), after = expanded.quizForLesson(l.id);
    assert.equal(after.length, Math.max(12, before.length), l.id);
    assert.deepEqual(plain(after.slice(0, before.length)), plain(before), l.id);
  }
  for (const l of window.LESSONS.filter(l => l.book === 2 && l.number <= 10)) {
    assert.deepEqual(plain(expanded.quizForLesson(l.id)), plain(baseline.quizForLesson(l.id)), l.id);
  }
});

test('every addition has a real source excerpt, complete explanations and registered knowledge identities', () => {
  const { window, expanded } = load(), ids = new Set();
  for (const q of window.BOOK2_LATER_QUESTION_EXPANSION.entries) {
    assert.ok(!ids.has(q.id), q.id); ids.add(q.id);
    assert.equal(q.containsOriginalWorkbookExercise, false);
    assert.equal(q.reviewStatus, 'self-reviewed');
    assert.equal(q.sourceType, 'self-authored-reviewed-expansion');
    assert.equal(q.sourceLabel, '自编练习 · 非教材原配习题');
    const source = window.LESSONS.find(l => l.id === q.sourceLessonId);
    assert.ok(source.number <= q.number, q.id);
    assert.ok(source.paragraphs[q.sourceEvidence.sourceParagraphIndex].en.includes(q.sourceEvidence.sourceText), q.id);
    assert.ok(q.rule.length > 12, q.id);
    assert.ok(q.contrastExamples.length >= 2 && q.contrastExamples.every(example => typeof example === 'string' && example.length > 8), q.id);
    assert.equal(new Set(q.options.map(o => o.trim().toLowerCase())).size, q.options.length, q.id);
    q.options.forEach((option, i) => { if (i !== q.answer) assert.ok(q.wrongReasons[option]?.length > 8, q.id + ':' + option); });
    for (const id of q.sourceConceptIds) assert.ok(expanded.get(id), id);
    const variant = expanded.quizForLesson(q.lessonId).find(row => row.id === q.id), registered = expanded.get(q.conceptId);
    assert.ok(variant && registered, q.id);
    assert.equal(variant.lessonId, q.lessonId);
    assert.equal(variant.sourceLessonId, q.sourceLessonId);
    if (q.type === 'vocabulary') {
      const canonical = expanded.wordForLesson(q.sourceLessonId, q.word);
      assert.equal(variant.conceptId, canonical.conceptId);
      assert.equal(registered.id, canonical.conceptId, 'an old alias resolves the one canonical word record');
      assert.equal(registered.lessonId, q.sourceLessonId);
      assert.deepEqual(plain(registered), plain(expanded.get(canonical.conceptId)));
    } else {
      assert.equal(registered.lessonId, q.lessonId);
      assert.equal(registered.sourceLessonId, q.sourceLessonId);
    }
  }
});

test('each lesson mixes current passage reading, conversion, words and two earlier concept retrievals', () => {
  const { window, expanded } = load(), entries = window.BOOK2_LATER_QUESTION_EXPANSION.entries;
  const conversionOriginals = new Set();
  for (let n = 11; n <= 96; n++) {
    const added = entries.filter(q => q.number === n), prior = added.filter(q => q.sourceLessonId !== q.lessonId);
    assert.ok(added.some(q => q.category === 'comprehension'), n);
    assert.ok(added.filter(q => q.category === 'conversion').length >= 2, n);
    assert.ok(added.some(q => q.type === 'vocabulary' && q.sourceLessonId === q.lessonId), n);
    assert.ok(prior.length >= 2, n);
    assert.ok(prior.some(q => q.type === 'vocabulary'), n);
    assert.ok(prior.some(q => q.type === 'grammar'), n);
    for (const q of prior) {
      assert.ok(q.sourceConceptIds.length, q.id);
      assert.ok(q.sourceConceptIds.every(id => expanded.get(id).lessonId === q.sourceLessonId), q.id);
    }
    const original = added.find(q => q.id.endsWith('-negative')).originalSentence;
    assert.ok(!conversionOriginals.has(original), n); conversionOriginals.add(original);
  }
});

test('reverse vocabulary uses confirmed exact senses and options with distinct words and definitions', () => {
  const { window, expanded } = load();
  for (const q of window.BOOK2_LATER_QUESTION_EXPANSION.entries.filter(q => q.type === 'vocabulary')) {
    assert.equal(q.direction, 'meaning-to-word');
    assert.equal(q.options[q.answer], q.word);
    const source = expanded.get(q.sourceConceptIds[0]);
    assert.equal(source.word, q.word); assert.equal(source.meaning, q.meaning);
    const optionRecords = q.optionConceptIds.map(id => expanded.get(id));
    assert.equal(new Set(optionRecords.map(r => r.meaning)).size, optionRecords.length, q.id);
    assert.equal(new Set(optionRecords.map(r => r.word.toLowerCase())).size, optionRecords.length, q.id);
    optionRecords.forEach((record, i) => assert.equal(record.word, q.options[i]));
    assert.equal(q.word === 'spectacle' || q.number === 11 && q.word === 'turn', false, q.id);
  }
});

test('reviewed examples preserve actual lesson actions, actors and tense through transformations', () => {
  const { window } = load(), entries = window.BOOK2_LATER_QUESTION_EXPANSION.entries;
  const correct = (number, key) => { const q = entries.find(q => q.number === number && q.id.endsWith('-' + key)); assert.ok(q); return q.options[q.answer]; };
  assert.equal(correct(11, 'negative'), 'I was not having dinner at a restaurant.');
  assert.equal(correct(12, 'yesno'), 'Will Captain Charles Alison sail from Portsmouth tomorrow?');
  assert.equal(correct(17, 'negative'), 'My aunt Jennifer is not an actress.');
  assert.equal(correct(29, 'yesno'), 'Can this wonderful plane carry seven passengers?');
  assert.equal(correct(68, 'negative'), 'I did not cross the street.');
  assert.equal(correct(93, 'yesno'), 'Was the actual figure made of copper?');
  assert.equal(correct(94, 'yesno'), 'Do the children practise holding their breath under water?');
  assert.equal(correct(96, 'negative'), 'A Festival for the Dead is not held once a year in Japan.');
  const meanings = [
    [18, '小狗把包拿进了花园'], [43, '1929 年'], [75, '一名年轻女子和她的两个小女儿'],
    [90, '巨大鱼类使潜水员感到害怕'], [96, '每年一次']
  ];
  for (const [number, expected] of meanings) assert.equal(correct(number, 'reading'), expected);
});

test('comprehension contrast examples discuss the actual scene instead of generic study instructions', () => {
  const { window } = load();
  const q = window.BOOK2_LATER_QUESTION_EXPANSION.entries.find(q => q.number === 11 && q.id.endsWith('-reading'));
  assert.ok(q.contrastExamples.every(example => /having dinner at a restaurant/.test(example)));
});

test('later manifest generation is deterministic, idempotent and never overwrites lesson source content', () => {
  const { window, scope } = load(), before = plain(window.LESSONS), manifest = plain(window.BOOK2_LATER_QUESTION_EXPANSION);
  vm.runInContext(fs.readFileSync(path.join(root, 'book2-later-question-expansion.js'), 'utf8'), scope);
  assert.deepEqual(plain(window.BOOK2_LATER_QUESTION_EXPANSION), manifest);
  assert.deepEqual(plain(window.LESSONS), before);
  assert.deepEqual(plain(window.BOOK2_LATER_QUESTION_EXPANSION.unsupportedLessons), []);
});

test('the polar-flight comprehension excerpt includes the destination it asks about', () => {
  const { window } = load();
  const q = window.BOOK2_LATER_QUESTION_EXPANSION.entries.find(q => q.number === 43 && q.id.endsWith('-reading'));
  assert.match(q.sourceEvidence.sourceText, /In 1929/);
  assert.match(q.sourceEvidence.sourceText, /successfully flew over the South Pole/);
});

test('all authored answer choices grade through the existing remediation flow using the source-backed bank', () => {
  const { window, expanded, scope } = load();
  vm.runInContext(fs.readFileSync(path.join(root, 'learning-remediation.js'), 'utf8'), scope);
  for (const raw of window.BOOK2_LATER_QUESTION_EXPANSION.entries) {
    const lesson = window.LESSONS.find(l => l.id === raw.lessonId);
    const q = expanded.quizForLesson(raw.lessonId).find(q => q.id === raw.id);
    q.options.forEach((option, index) => {
      const feedback = window.StudyRemediation.describe(q, index, { bank: expanded, lesson });
      assert.equal(feedback.isCorrect, index === q.answer, q.id + ': ' + option);
      assert.equal(feedback.correctAnswer, q.options[q.answer], q.id);
      assert.ok(feedback.rule && feedback.reason, q.id);
    });
  }
});

test('all 96 expanded lessons and twenty-five balanced packs register through the shipped bootstrap without alias word records', () => {
  const c={document:{addEventListener(){}},URLSearchParams,location:{search:''}};c.window=c;vm.createContext(c);for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script defer src="([^"]+)"/g)){const f=m[1].split('?')[0];if(f==='app.js')break;vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});}
  const window=c, manifests=[c.BOOK2_QUESTION_EXPANSION,c.BOOK2_LATER_QUESTION_EXPANSION],bank=c.StudyKnowledge.bank;
  assert.equal(bank.audit.expansionQuestions.length,877);
  assert.deepEqual(plain(bank.audit.expansionIssues),[]);
  for (const lesson of window.LESSONS.filter(l=>l.book===2)) assert.equal(bank.quizForLesson(lesson.id).length,12,lesson.id);
  const registry = window.StudyPracticePacks.create(window.BOOK2_PRACTICE_PACKS,window.LESSONS,bank);
  assert.deepEqual(plain(registry.issues),[]);assert.equal(registry.lessonIds().length,25);
  for (const raw of manifests.flatMap(m=>m.entries).filter(q=>q.type==='vocabulary')) {
    const canonical=bank.wordForLesson(raw.sourceLessonId,raw.word),alias=bank.get(raw.conceptId);
    assert.equal(alias.id,canonical.conceptId,raw.id);
    assert.equal(alias.meaning,canonical.meaning);
    assert(!bank.vocabularyForLesson(raw.lessonId).some(word=>word.conceptId===raw.conceptId),'no alias dictionary entry is created');
    alias.meaning='external mutation';assert.equal(bank.get(raw.conceptId).meaning,canonical.meaning,'alias reads are cloned');
  }
  assert.equal(bank.get('knowledge:nce-b2-eef57c-l096:word:unregistered-alias'),null);
});
