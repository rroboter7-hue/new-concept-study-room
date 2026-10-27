const test = require('node:test');
const assert = require('node:assert/strict');
const {harness} = require('./leo-coach-harness.cjs');

const currentId = 'nce-b2-eef57c-l001';
const otherId = 'nce-b2-eef57c-l002';
const key = (lesson, target, mode = 'transform', round = '') => round
  ? `round:v1:${encodeURIComponent(lesson)}:${encodeURIComponent(target)}:${encodeURIComponent(round)}:${mode}`
  : mode === 'flexible'
    ? `v2:flexible:${encodeURIComponent(lesson)}:${encodeURIComponent(target)}`
    : mode === 'four' || mode === 'phrase'
      ? `v3:${mode}:${encodeURIComponent(lesson)}:${encodeURIComponent(target)}`
      : `v1:${encodeURIComponent(lesson)}:${encodeURIComponent(target)}`;
const plain = value => JSON.parse(JSON.stringify(value));
const payload = text => JSON.parse(text.split('BEGIN_STUDY_SENTENCE_DATA_JSON\n')[1]);

test('real app imports this lesson across targets, modes and rounds, keeps pending writing, then copies the full review once', async () => {
  const transform = `word:${currentId}:retired%20book`, flexible = `word:${currentId}:retired%20pen`, phrase = `phrase:${currentId}:read%20about`, four = `word:${currentId}:quiet`, nativePhrase = `phrase:${currentId}:look%20back`;
  const drafts = {
    [key(currentId, transform)]: {targetKey:transform,answers:{affirmative:'I read a retired book.',negative:'I do not read a retired book.'},selectedOldKeys:['word:older:sister','word:older:teacher','phrase:older:look%20at']},
    [key(currentId, flexible, 'flexible')]: {targetKey:flexible,mode:'flexible',answers:{affirmative:'A retired pen lies here.',negative:'My friend borrowed this pen.'}},
    [key(currentId, phrase, 'flexible', 'daily-2026-10-27')]: {targetKey:phrase,mode:'flexible',roundKey:'daily-2026-10-27',answers:{combined:'We read about birds.\n目标词：This is still part of my answer.\n'}},
    [key(currentId, four, 'four')]: {targetKey:four,mode:'four',answers:{affirmative:'It is quiet here.',negative:'It is not quiet here.',yesno:'Is it quiet here?',wh:'Where is it quiet?'}},
    [key(currentId, nativePhrase, 'phrase')]: {targetKey:nativePhrase,mode:'phrase',answers:{affirmative:'We look back at our school days.'}},
    [key(currentId, four, 'four', 'daily-four')]: {targetKey:four,mode:'four',roundKey:'daily-four',answers:{affirmative:'The library was quiet.',negative:'The library was not quiet.'}},
    [key(currentId, nativePhrase, 'phrase', 'daily-phrase')]: {targetKey:nativePhrase,mode:'phrase',roundKey:'daily-phrase',answers:{affirmative:'They look back with pride.'}},
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
  assert.equal(parsed.rows.length,15);
  assert.equal(parsed.rows.filter(row => row.kind === 'free').length,7);
  assert.equal(parsed.rows.find(row => row.kind === 'negative').sourceOriginal,'I read a retired book.');
  const contextual = parsed.rows.find(row => row.kind === 'negative');
  assert.deepEqual(plain(contextual.context.oldWords),['sister','teacher']);
  assert.deepEqual(plain(contextual.context.oldPhrases),['look at']);
  assert(parsed.rows.some(row => row.text === 'We read about birds.\n目标词：This is still part of my answer.\n'));
  assert(parsed.rows.some(row => row.text === 'This latest sentence has not reached the save timer.'));
  for (const original of ['It is quiet here.','The library was quiet.']) {
    const group = parsed.groups.find(group => group.sourceOriginal === original);
    assert(group,'new four-form namespace keeps its conversion original');
    assert(group.rows.some(row => row.kind === 'negative' && row.sourceOriginal === original));
  }
  for (const text of ['We look back at our school days.','They look back with pride.']) {
    const row = parsed.rows.find(row => row.text === text);
    assert(row,'native phrase namespace imports its learner sentence');
    assert.equal(row.kind,'free');assert.equal(row.sourceOriginal,'');
  }
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
  const h = await harness({pilot:false,realOutput:true,loaded:{lastLesson:currentId,sentencePractice:{[`selection:v1:${currentId}`]:{mode:'flexible'}}}});
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

test('real app four-form and native phrase editors both reach batch import with their proper sentence semantics', async () => {
  const h = await harness({pilot:false,realOutput:true,loaded:{lastLesson:currentId}});
  h.api.setTab('output');h.api.output.switchMode('sentences');await h.flush();
  const sentencePractice = h.api.sentencePractice;
  assert.equal(sentencePractice.active.draft.mode,'four','new app defaults to four forms');
  const fourTarget = sentencePractice.active.draft.targetKey;
  const forms = ['The room is quiet.','The room is not quiet.','Is the room quiet?','Where is it quiet?'];
  for (let index=0;index<forms.length;index++) {
    if (index) await h.click(`[data-sentence-action="step"][data-sentence-step="${index}"]`);
    await h.input('[data-sentence-input="answer"]',forms[index]);
  }
  await h.click('[data-sentence-action="writing-mode"][data-sentence-mode="phrase"]');
  assert.equal(sentencePractice.active.draft.mode,'phrase');
  await h.input('[data-sentence-input="answer"]','This native phrase sentence belongs to me.');
  const phraseTarget = sentencePractice.active.draft.targetKey;
  assert.notEqual(phraseTarget,fourTarget);
  h.api.output.switchMode('batch');await h.flush();
  await h.click('[data-batch-action="guided"]');
  let parsed = h.api.batchPractice.parseCurrent();
  assert.equal(parsed.rows.length,1);
  assert.equal(parsed.rows[0].kind,'free');assert.equal(parsed.rows[0].sourceOriginal,'');
  await h.click('[data-batch-action="lesson"]');
  parsed = h.api.batchPractice.parseCurrent();
  assert.equal(parsed.rows.length,5,'whole-lesson import adds four forms and skips the already-imported phrase');
  const converted = parsed.groups.find(group => group.sourceOriginal === forms[0]);
  assert.deepEqual(Array.from(converted.rows,row=>row.kind),['affirmative','negative','yesno','wh']);
  assert.deepEqual(Array.from(converted.rows,row=>row.text),forms);
  assert(parsed.rows.filter(row=>row.kind !== 'free').every(row=>row.sourceOriginal === forms[0]));
  assert.equal(parsed.rows.filter(row=>row.text === 'This native phrase sentence belongs to me.').length,1);
  assert(Object.hasOwn(h.stored.sentencePractice,key(currentId,fourTarget,'four')));
  assert(Object.hasOwn(h.stored.sentencePractice,key(currentId,phraseTarget,'phrase')));
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
