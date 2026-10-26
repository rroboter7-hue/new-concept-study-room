const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const corePath = path.join(__dirname, '..', 'sentence-core.js');
const core = fs.existsSync(corePath) ? require(corePath) : {};
const grammarScope = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'grammar-check.js'), 'utf8'), grammarScope);
const grammarCheck = grammarScope.window.StudyGrammar.check;
const kinds = ['affirmative', 'negative', 'yesno', 'wh', 'combined'];
function call(name, ...args) {
  assert.equal(typeof core[name], 'function', `${name} must implement the pure sentence-practice behavior`);
  return core[name](...args);
}
function row(kind, sentence, target = 'book', extra = {}) {
  return call('check', { answers: { [kind]: sentence }, target: { word: target }, ...extra }).rows.find(item => item.kind === kind);
}
const oldLesson = { id: 'b1-l1', book: 1, number: 1, title: 'Earlier', vocabulary: [{ word: 'sister', meaning: '姐妹' }], usage: [{ phrase: 'look at', meaning: '看' }] };
const unstudiedLesson = { id: 'b1-l2', book: 1, number: 2, title: 'Unrecorded', vocabulary: [{ word: 'go', meaning: '去' }], usage: [{ phrase: 'go to', meaning: '去' }] };
const currentLesson = { id: 'b1-l3', book: 1, number: 3, title: 'Current', vocabulary: [{ word: 'book', meaning: '书' }], usage: [] };
const futureLesson = { id: 'b2-l1', book: 2, number: 1, title: 'Future', vocabulary: [{ word: 'future', meaning: '未来' }], usage: [{ phrase: 'look for', meaning: '寻找' }] };
const lessons = [futureLesson, currentLesson, unstudiedLesson, oldLesson];

test('without history, only current vocabulary is offered and earlier lessons remain explicitly selectable', () => {
  const result = call('context', { lessons, currentLesson, records: {} });
  assert.deepEqual(result.targets.map(item => item.word), ['book']);
  assert.deepEqual(result.oldWords, []);
  assert.deepEqual(result.oldPhrases, []);
  assert.deepEqual(result.earlierLessons.map(item => item.id), ['b1-l1', 'b1-l2']);
  assert.deepEqual(result.targets[0].source, { id: 'b1-l3', book: 1, number: 3, title: 'Current' });
});

test('recorded earlier learning supplies old materials but never current or future lessons', () => {
  const result = call('context', { lessons, currentLesson, records: { 'b1-l1': { completed: true }, 'b1-l2': { attempts: 2 }, 'b1-l3': { completed: true }, 'b2-l1': { attempts: 9 } } });
  assert.deepEqual(result.targets.map(item => item.word), ['book', 'sister', 'go']);
  assert.deepEqual(result.oldWords.map(item => item.word), ['sister', 'go']);
  assert.deepEqual(result.oldPhrases.map(item => item.phrase), ['look at', 'go to']);
});

test('manual sources require exact known earlier IDs and do not alter existing records', () => {
  const records = { 'b1-l1': { completed: false, attempts: 0 } };
  const before = JSON.stringify(records);
  const result = call('context', { lessons, currentLesson, records, sourceLessonIds: ['b1-l1', 'b1-l1', 'b1-l3', 'b2-l1', {}, '../b1-l2', 'missing'] });
  assert.deepEqual(result.oldWords.map(item => item.word), ['sister']);
  assert.deepEqual(result.oldPhrases.map(item => item.phrase), ['look at']);
  assert.equal(JSON.stringify(records), before);
});

test('malformed histories and inherited records cannot fabricate learned materials', () => {
  const records = Object.assign(Object.create({ 'b1-l1': { completed: true } }), { 'b1-l2': { completed: 'true', attempts: '2' } });
  const result = call('context', { lessons: [...lessons, { id: '../broken', book: 0, number: -1 }], currentLesson, records });
  assert.deepEqual(result.oldWords, []);
  assert.deepEqual(call('context', { lessons: null, currentLesson: null, records: null }), { targets: [], oldWords: [], oldPhrases: [], earlierLessons: [] });
});

test('lesson chronology compares books before lesson numbers', () => {
  const bookTwo = { ...currentLesson, id: 'b2-l2', book: 2, number: 2 };
  const lateBookOne = { ...oldLesson, id: 'b1-l120', number: 120 };
  const result = call('context', { lessons: [bookTwo, lateBookOne, futureLesson], currentLesson: bookTwo, records: { 'b1-l120': { attempts: 1 }, 'b2-l1': { completed: true } } });
  assert.deepEqual(result.oldWords.map(item => item.source.id), ['b1-l120', 'b2-l1']);
});

test('draft sanitization bounds every persisted field without interpreting HTML input', () => {
  const result = call('sanitizeDraft', { step: 99, targetKey: 'x'.repeat(1000), sourceLessonIds: ['b1-l1', 'b1-l1', {}, '../bad'], oldWordKey: 'w'.repeat(1000), oldPhraseKey: 'p'.repeat(1000), answers: { affirmative: '<img src=x onerror=alert(1)>', negative: 'n'.repeat(450), yesno: { text: 'bad' }, wh: 'Where is my book?' }, checkedAt: Infinity });
  assert.equal(result.step, 4);
  assert.equal(result.targetKey.length, 600);
  assert.equal(result.oldWordKey.length, 600);
  assert.equal(result.oldPhraseKey.length, 600);
  assert.deepEqual(result.sourceLessonIds, ['b1-l1']);
  assert.equal(result.answers.affirmative, '<img src=x onerror=alert(1)>');
  assert.equal(result.answers.negative.length, 400);
  assert.equal(result.answers.yesno, '');
  assert.deepEqual(Object.keys(result.answers), kinds);
  assert.equal(result.checkedAt, 0);
  assert.equal(call('sanitizeDraft', null).step, 0);
  assert.equal(call('sanitizeDraft', { checkedAt: 123, step: -2 }).checkedAt, 123);
});

test('draft keys preserve separate lessons and targets even when inputs contain delimiters', () => {
  assert.equal(call('draftKey', 'b1-l3', 'word:a:book'), call('draftKey', 'b1-l3', 'word:a:book'));
  assert.notEqual(call('draftKey', 'a:b', 'c'), call('draftKey', 'a', 'b:c'));
  assert.notEqual(call('draftKey', 'b1-l3', 'book'), call('draftKey', 'b1-l4', 'book'));
  assert.notEqual(call('draftKey', 'b1-l3', 'book'), call('draftKey', 'b1-l3', 'sister'));
  assert.match(call('draftKey', '__proto__', '<script>'), /^v1:[A-Za-z0-9_%.-]+:[A-Za-z0-9_%.-]+$/);
});

test('expression coverage recognizes common regular and known irregular forms', () => {
  for (const [sentence, expression] of [
    ['She studied beside the books.', 'study'], ['She studied beside the books.', 'book'],
    ['He is writing.', 'write'], ['They went home.', 'go'], ['They have gone home.', 'go'],
    ['The children are here.', 'child'], ['She looked at the book.', 'look at'],
    ['He takes care of the dog.', 'take care of'], ['Did she go?', 'went']
  ]) assert.equal(call('matchesExpression', sentence, expression), true, `${expression}: ${sentence}`);
});

test('coverage uses word boundaries and keeps phrase words adjacent', () => {
  for (const [sentence, expression] of [
    ['The book is here.', 'he'], ['A cart is outside.', 'art'], ['She looked away at the door.', 'look at'],
    ['Have a look. At home, read.', 'look at'], ['Theater tickets.', 'he'], ['He goed home.', 'go']
  ]) assert.equal(call('matchesExpression', sentence, expression), false, `${expression}: ${sentence}`);
});

test('coverage recognizes common straight and curly apostrophe contractions', () => {
  for (const [sentence, expression] of [
    ["He doesn't read.", 'do not'], ["I'm reading.", 'be'], ['She’s here.', 'she'],
    ['He isn’t here.', 'not'], ["I can't go.", 'can not'], ["She won't go.", 'will not']
  ]) assert.equal(call('matchesExpression', sentence, expression), true, `${expression}: ${sentence}`);
});

test('an empty check returns exactly the five ordered rows and no invented progress', () => {
  const result = call('check', {});
  assert.deepEqual(result.rows.map(item => item.kind), kinds);
  assert.deepEqual(result.rows.map(item => item.status), ['empty', 'empty', 'empty', 'empty', 'empty']);
  assert.equal(result.writtenCount, 0);
  assert.equal(result.readyForReview, false);
  assert.equal(result.rulesOnly, true);
});

test('five supported sentences can finish limited checks with explicit human-review limitations', () => {
  const result = call('check', { answers: { affirmative: 'I read a book.', negative: 'I do not read a book.', yesno: 'Do I read a book?', wh: 'Where do I read a book?', combined: 'My sister looks at a book.' }, target: { word: 'book' }, oldWord: { word: 'sister' }, oldPhrase: { phrase: 'look at' }, grammarCheck });
  assert.deepEqual(result.rows.map(item => item.status), ['ready', 'ready', 'ready', 'ready', 'ready']);
  assert.equal(result.writtenCount, 5);
  assert.equal(result.readyForReview, true);
  for (const item of result.rows) {
    assert.match(item.label, /[\u4e00-\u9fff]/);
    assert.match(item.notes.join(' '), /语义|自然度/);
    assert.deepEqual(item.issues, []);
  }
  assert.equal('score' in result, false);
  assert.equal('mastered' in result, false);
});

test('merely containing the target does not claim a complete sentence passed', () => {
  const result = row('affirmative', 'book');
  assert.equal(result.status, 'review');
  assert.match(result.notes.join(' '), /结构|完整|片段/);
});

test('combined sentence requires both selected earlier materials and a distinct old word', () => {
  const missing = row('combined', 'My sister looks at a book.');
  assert.equal(missing.status, 'needs-work');
  assert.match(missing.issues.join(' '), /旧词/);
  assert.match(missing.issues.join(' '), /用法|短语/);
  const same = row('combined', 'I look at the books.', 'book', { oldWord: { word: 'books' }, oldPhrase: { phrase: 'look at' } });
  assert.equal(same.status, 'needs-work');
  assert.match(same.issues.join(' '), /不同|同一/);
});

test('combined sentence cannot repeat an earlier row after case, punctuation and contraction normalization', () => {
  const result = call('check', { answers: { negative: "My sister doesn't look at the book.", combined: 'my sister does not look at the book!' }, target: { word: 'book' }, oldWord: { word: 'sister' }, oldPhrase: { phrase: 'look at' } });
  const combined = result.rows[4];
  assert.equal(combined.status, 'needs-work');
  assert.match(combined.issues.join(' '), /重复|新句/);
});

test('Do, Does and Did questions accept the base verb including known irregular targets', () => {
  for (const [sentence, target] of [['Do they play?', 'play'], ['Does she play?', 'play'], ['Did he go?', 'go'], ['Does my sister read a book?', 'book']]) {
    assert.equal(row('yesno', sentence, target, { grammarCheck }).status, 'ready', sentence);
  }
});

test('Do, Does and Did questions identify inflected verbs and obvious pronoun disagreement', () => {
  for (const [sentence, target] of [['Does she plays?', 'play'], ['Did he went?', 'go'], ['Do she play?', 'play'], ['Does they play?', 'play']]) {
    const result = row('yesno', sentence, target, { grammarCheck });
    assert.equal(result.status, 'needs-work', sentence);
    assert.match(result.issues.join(' '), /原形|does|do/i);
  }
  assert.match(row('negative', 'He does not goes home.', 'go').issues.join(' '), /原形/);
});

test('be agreement is checked in both statements and inverted questions', () => {
  for (const [kind, sentence] of [['affirmative', 'I is reading a book.'], ['negative', 'They was not reading a book.'], ['yesno', 'Are he reading a book?'], ['wh', 'Where is they reading a book?']]) {
    assert.equal(row(kind, sentence).status, 'needs-work', sentence);
  }
  for (const [kind, sentence] of [['affirmative', 'I am reading a book.'], ['negative', "They weren't reading a book."], ['yesno', 'Is he reading a book?'], ['wh', 'Where are they reading a book?']]) {
    assert.equal(row(kind, sentence, 'book', { grammarCheck }).status, 'ready', sentence);
  }
});

test('subject-WH questions do not wrongly require an auxiliary', () => {
  const result = row('wh', 'Who plays with the book?', 'book', { grammarCheck });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.issues, []);
});

test('unsupported valid structures remain reviewable instead of being declared wrong', () => {
  const result = row('wh', 'Under what circumstances might the book have been written?', 'book', { grammarCheck });
  assert.equal(result.status, 'review');
  assert.deepEqual(result.issues, []);
  assert.match(result.notes.join(' '), /覆盖|复核/);
});

test('recognizable row-type mistakes produce specific feedback', () => {
  assert.equal(row('affirmative', 'Do I read a book?').status, 'needs-work');
  assert.equal(row('negative', 'I read a book.').status, 'needs-work');
  assert.equal(row('yesno', 'Where do I read a book?').status, 'needs-work');
  assert.equal(row('wh', 'Do I read a book?').status, 'needs-work');
});

test('real grammar rules produce suggestions without upgrading uncertain findings to definite errors', () => {
  const definite = row('affirmative', 'I enjoy to read a book.', 'book', { grammarCheck });
  assert.equal(definite.status, 'needs-work');
  assert.match(definite.issues.join(' '), /enjoy/);
  const uncertain = row('affirmative', 'He play with a book.', 'book', { grammarCheck });
  assert.equal(uncertain.status, 'review');
  assert.match([...uncertain.issues, ...uncertain.notes].join(' '), /第三人称|现在时/);
});

test('conversion rows remind the learner to preserve the affirmative sentence context', () => {
  const result = call('check', { target: { word: 'book' }, answers: { affirmative: 'I read a book.', negative: 'I do not read a book.', yesno: 'Do I read a book?', wh: 'Where do I read a book?' } });
  for (const item of result.rows.slice(1, 4)) assert.match(item.notes.join(' '), /原句|第一句|情境/);
});

test('checks reject oversized sentences and tolerate unavailable optional grammar checks', () => {
  assert.equal(row('affirmative', 'I read a book. ' + 'a'.repeat(400)).status, 'needs-work');
  const result = row('affirmative', 'I read a book.', 'book', { grammarCheck() { throw new Error('unavailable'); } });
  assert.equal(result.status, 'review');
  assert.match(result.notes.join(' '), /暂|未完成|不可用/);
});

test('supported doubled-consonant forms do not also accept their misspelled undoubled alternatives', () => {
  assert.equal(call('matchesExpression', 'She stopped by the bookshop.', 'stop'), true);
  assert.equal(call('matchesExpression', 'She stoped by the bookshop.', 'stop'), false);
  assert.equal(call('matchesExpression', 'He is planing a trip.', 'plan'), false);
  assert.equal(call('matchesExpression', 'He is planning a trip.', 'plan'), true);
});

test('ambiguous lexical verbs after did remain reviewable rather than being falsely corrected', () => {
  for (const sentence of ['Did he saw the book in half?', 'Did she found a book club?']) {
    const result = row('yesno', sentence);
    assert.equal(result.status, 'review', sentence);
    assert.deepEqual(result.issues, [], sentence);
  }
});

test('not only is not mistaken for a definite negative-sentence error', () => {
  const result = row('affirmative', 'I am not only reading a book but also taking notes.');
  assert.equal(result.status, 'review');
  assert.deepEqual(result.issues, []);
});

test('context keys survive draft bounds even for long valid imported IDs and words', () => {
  const imported = { id: 'a' + ':'.repeat(159), book: 1, number: 3, title: 'Imported', vocabulary: [{ word: 'w'.repeat(160) }, { word: 'w'.repeat(159) + 'x' }], usage: [] };
  const result = call('context', { lessons: [imported], currentLesson: imported });
  assert.notEqual(result.targets[0].key, result.targets[1].key);
  for (const item of result.targets) assert.equal(call('sanitizeDraft', { targetKey: item.key }).targetKey, item.key);
});

test('perfect negatives with have, has and had remain reviewable without a false missing-negation error', () => {
  for (const sentence of ['I have not read the book.','I have never read the book.','She has not read the book.','She has never read the book.','I had not read the book.',"I haven't read the book.",'She hasn’t read the book.',"I hadn't read the book."]) {
    const result = row('negative', sentence, 'book', {grammarCheck});
    assert.equal(result.status,'review',sentence);
    assert.deepEqual(result.issues,[],sentence);
    assert.match(result.notes.join(' '),/覆盖|复核/,sentence);
  }
});

test('negative perfect sentences are not marked ready in the affirmative row', () => {
  for (const sentence of ['I have not read the book.','She has never read the book.','I had not read the book.']) {
    assert.equal(row('affirmative',sentence,'book',{grammarCheck}).status,'review',sentence);
  }
});

test('perfect-auxiliary review does not remove the supported lexical have polarity checks', () => {
  assert.equal(row('affirmative','I have a book.').status,'ready');
  assert.equal(row('negative','I have no book.').status,'ready');
  assert.equal(row('negative','I have a book.').status,'needs-work');
  assert.equal(row('affirmative','I have no book.').status,'needs-work');
  assert.equal(row('affirmative','I have read the book.').status,'review');
});

test('supported sing forms recognize sang and sung without accepting the separate verb singed', () => {
  assert.equal(call('matchesExpression','She sang a song.','sing'),true);
  assert.equal(call('matchesExpression','She has sung a song.','sing'),true);
  assert.equal(call('matchesExpression','She singed a song.','sing'),false);
  assert.equal(row('affirmative','She sang a song.','sing').status,'ready');
  assert.equal(row('affirmative','She singed a song.','sing').status,'needs-work');
});

test('supported show forms include the irregular participle shown and the regular past showed', () => {
  assert.equal(call('matchesExpression','She has shown me the book.','show'),true);
  assert.equal(call('matchesExpression','She showed me the book.','show'),true);
  assert.equal(row('affirmative','She showed me the book.','show').status,'ready');
});
