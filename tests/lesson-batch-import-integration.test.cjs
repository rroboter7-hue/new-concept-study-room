const test = require('node:test');
const assert = require('node:assert/strict');
const {harness} = require('./leo-coach-harness.cjs');

const currentId = 'nce-b2-eef57c-l001';
const otherId = 'nce-b2-eef57c-l002';
const key = (lesson, target, mode = 'transform', round = '') => round
  ? `round:v1:${encodeURIComponent(lesson)}:${encodeURIComponent(target)}:${encodeURIComponent(round)}:${mode}`
  : mode === 'flexible'
    ? `v2:flexible:${encodeURIComponent(lesson)}:${encodeURIComponent(target)}`
    : `v1:${encodeURIComponent(lesson)}:${encodeURIComponent(target)}`;
const plain = value => JSON.parse(JSON.stringify(value));
const payload = text => JSON.parse(text.split('BEGIN_STUDY_SENTENCE_DATA_JSON\n')[1]);

test('real app imports this lesson across targets, modes and rounds, keeps pending writing, then copies the full review once', async () => {
  const transform = `word:${currentId}:retired%20book`, flexible = `word:${currentId}:retired%20pen`, phrase = `phrase:${currentId}:read%20about`;
  const drafts = {
    [key(currentId, transform)]: {targetKey:transform,answers:{affirmative:'I read a retired book.',negative:'I do not read a retired book.'},selectedOldKeys:['word:older:sister','word:older:teacher','phrase:older:look%20at']},
    [key(currentId, flexible, 'flexible')]: {targetKey:flexible,mode:'flexible',answers:{affirmative:'A retired pen lies here.',negative:'My friend borrowed this pen.'}},
    [key(currentId, phrase, 'flexible', 'daily-2026-10-27')]: {targetKey:phrase,mode:'flexible',roundKey:'daily-2026-10-27',answers:{combined:'We read about birds.\n目标词：This is still part of my answer.\n'}},
    [key(otherId, `word:${otherId}:breakfast`)]: {answers:{affirmative:'Other lesson writing must stay out.'}},
    [`selection:v1:${currentId}`]: {mode:'flexible',answers:{affirmative:'Selection metadata must stay out.'}}
  };
  const h = await harness({pilot:false,realOutput:true,loaded:{lastLesson:currentId,sentencePractice:drafts,sentenceBatches:{[currentId]:{mode:'free',rawText:'Keep my manual sentence.',notes:'Keep my feedback notes.'}}}});
  const copies = [];
  h.c.navigator.clipboard = {writeText:async text => copies.push(text)};
  h.api.setTab('output');h.api.output.switchMode('sentences');await h.flush();
  await h.input('[data-sentence-input="answer"]','This latest sentence has not reached the save timer.');
  const sentencePractice = h.api.sentencePractice, activeKey = sentencePractice.active.key;
  const records = JSON.stringify(h.api.data.records), game = JSON.stringify(h.api.data.game);
  h.api.output.switchMode('batch');await h.flush();
  await h.click('[data-batch-action="lesson"]');
  const batch = h.api.batchPractice, imported = batch.active.draft.rawText, parsed = batch.parseCurrent();
  assert(imported.startsWith('Keep my manual sentence.\n\n'));
  assert.equal(batch.active.draft.notes,'Keep my feedback notes.');
  assert.equal(sentencePractice.active.key,activeKey,'import does not change the selected target');
  assert.equal(parsed.rows.length,7);
  assert.equal(parsed.rows.filter(row => row.kind === 'free').length,5);
  assert.equal(parsed.rows.find(row => row.kind === 'negative').sourceOriginal,'I read a retired book.');
  const contextual = parsed.rows.find(row => row.kind === 'negative');
  assert.deepEqual(plain(contextual.context.oldWords),['sister','teacher']);
  assert.deepEqual(plain(contextual.context.oldPhrases),['look at']);
  assert(parsed.rows.some(row => row.text === 'We read about birds.\n目标词：This is still part of my answer.\n'));
  assert(parsed.rows.some(row => row.text === 'This latest sentence has not reached the save timer.'));
  assert.doesNotMatch(imported,/Other lesson writing|Selection metadata/);
  await h.click('[data-batch-action="lesson"]');
  assert.equal(batch.active.draft.rawText,imported,'unchanged re-import does not duplicate content');
  await h.click('[data-batch-action="copy-all"]');
  assert.equal(copies.length,1);
  const all = payload(copies[0]);
  assert.equal(all.rows.length,parsed.rows.length);
  assert.deepEqual(all.rows.map(row => row.text),Array.from(parsed.rows,row => row.text));
  assert.equal(all.lessonTitle,h.api.current.title);
  assert.equal(h.stored.sentenceBatches[currentId].rawText,imported);
  assert.equal(JSON.stringify(h.api.data.records),records,'import and copy do not grade the lesson');
  assert.equal(JSON.stringify(h.api.data.game),game,'import and copy do not award learning credit');
});

test('real app current-draft shortcut labels flexible writing as free sentences without changing its selected target', async () => {
  const h = await harness({pilot:false,realOutput:true,loaded:{lastLesson:currentId}});
  h.api.setTab('output');h.api.output.switchMode('sentences');await h.flush();
  assert.equal(h.api.sentencePractice.active.draft.mode,'flexible');
  await h.input('[data-sentence-input="answer"]','My first independent sentence.');
  await h.click('[data-sentence-action="step"][data-sentence-step="1"]');
  await h.input('[data-sentence-input="answer"]','My second independent sentence is affirmative too.');
  const targetKey = h.api.sentencePractice.active.draft.targetKey;
  h.api.output.switchMode('batch');await h.flush();
  await h.click('[data-batch-action="guided"]');
  const parsed = h.api.batchPractice.parseCurrent();
  assert.equal(parsed.rows.length,2);
  assert(parsed.rows.every(row => row.kind === 'free' && row.sourceOriginal === ''));
  assert.doesNotMatch(parsed.notices.join('\n'),/缺少原句/);
  assert.equal(h.api.sentencePractice.active.draft.targetKey,targetKey);
  assert.match(h.api.batchPractice.active.draft.rawText,/自由句：My second independent sentence/);
});

test('edited source writing appends a fresh group while reader edits in the batch box remain intact', async () => {
  const h = await harness({pilot:false,realOutput:true,loaded:{lastLesson:currentId}});
  h.api.setTab('output');h.api.output.switchMode('sentences');await h.flush();
  await h.input('[data-sentence-input="answer"]','My original source sentence.');
  h.api.output.switchMode('batch');await h.flush();
  await h.click('[data-batch-action="lesson"]');
  const first = h.api.batchPractice.active.draft.rawText;
  await h.input('[data-batch-input="text"]','My own batch introduction.\n\n'+first);
  await h.input('[data-batch-input="notes"]','Feedback belongs to the reader.');
  h.api.output.switchMode('sentences');await h.flush();
  await h.input('[data-sentence-input="answer"]','My updated source sentence.');
  h.api.output.switchMode('batch');await h.flush();
  await h.click('[data-batch-action="lesson"]');
  const draft = h.api.batchPractice.active.draft;
  assert(draft.rawText.startsWith('My own batch introduction.\n\n'+first));
  assert.equal((draft.rawText.match(/My original source sentence\./g)||[]).length,1);
  assert.equal((draft.rawText.match(/My updated source sentence\./g)||[]).length,1);
  assert.equal(draft.notes,'Feedback belongs to the reader.');
  const beforeRepeat = draft.rawText;
  await h.click('[data-batch-action="lesson"]');
  assert.equal(draft.rawText,beforeRepeat);
});
