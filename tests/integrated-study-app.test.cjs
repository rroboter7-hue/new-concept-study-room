'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const first='nce-b2-eef57c-l001',second='nce-b2-eef57c-l002';
const options={realPipeline:true,pilot:false,realOutput:true};

test('the real lesson flow separates earlier usages and keeps source-supported dictionary labels',async()=>{
 const h=await harness({...options,loaded:{lastLesson:second,records:{[first]:{attempts:1}}}});
 await h.api.selectLesson(second);const ui=h.api.learningPipeline;await ui.goStage(2);
 const targets=ui.writing.targets();
 for(const phrase of ['turn round','have a conversation']){
  const target=targets.find(row=>row.label===phrase);assert(target,phrase);
  assert.equal(target.prior,true,phrase+' is earlier knowledge');assert.equal(target.requiredCount,2);
 }
 for(const word of ['ring','repeat'])assert(targets.some(row=>row.label===word&&row.requiredCount===5&&!row.prior),word+' has a current five-sentence goal');
 assert(!targets.some(row=>['rang','repeated'].includes(row.label)));
 assert(targets.filter(row=>!row.prior).every(row=>row.requiredCount===5));
});

test('recap combines lesson-bound legacy batch writing and new free writing without altering the old draft',async()=>{
 const old='This earlier batch sentence is still available.';
 const h=await harness({...options,loaded:{lastLesson:second,sentenceBatches:{[second]:{mode:'free',rawText:old},other:{mode:'free',rawText:'Do not mix another lesson.'}}}});
 await h.api.selectLesson(second);const ui=h.api.learningPipeline;await ui.goStage(2);
 const target=ui.writing.targets()[0],written='This new sentence belongs to the same lesson.';
 ui.writing.editAnswer(target.key,0,written);await ui.flush();await ui.goStage(3);
 const rows=ui.sentences();assert(rows.some(row=>row.answer===old));assert(rows.some(row=>row.answer===written));
 assert(!rows.some(row=>row.answer==='Do not mix another lesson.'));
 assert.equal(h.api.data.sentenceBatches[second].rawText,old);
 const backup=h.api.backupData();assert.equal(backup.sentenceBatches[second].rawText,old);
 assert.match(ui.render(),/复制本课全部句子/);
});

test('legacy game initializes only when explicitly opened from the simplified study flow',async()=>{
 const h=await harness(options);assert(!h.api.game,'unused game should not initialize during ordinary study');
 await h.api.navigate('game');await h.flush();assert(h.api.game);
 assert.equal(h.api.view,'game');
});

test('dictionary relabeling and prior reclassification keep existing lesson free-writing identities and extra answers',async()=>{
 const ringKey='word:'+second+':rang',phraseKey='phrase:'+second+':turn%20round',draftKey='free-writing:v1:'+second;
 const loaded={lastLesson:second,records:{[first]:{attempts:1}},freeWriting:{[draftKey]:{version:1,lessonId:second,activeTargetKey:ringKey,targets:{
  [ringKey]:{answers:['The telephone rang twice.','','','',''],feedback:[],fusion:[]},
  [phraseKey]:{answers:['I turn round.','Please turn round.','He turned round again.','',''],feedback:[],fusion:[]}
 }}}};
 const h=await harness({...options,loaded});await h.api.selectLesson(second);const ui=h.api.learningPipeline;await ui.goStage(2);
 const ring=ui.writing.targets().find(row=>row.label==='ring');assert.equal(ring.key,ringKey);
 assert.equal(h.document.querySelector('[data-free-answer="0"]').value,'The telephone rang twice.');
 const phrase=ui.writing.targets().find(row=>row.label==='turn round');assert.equal(phrase.key,phraseKey);assert.equal(phrase.requiredCount,2);
 ui.writing.selectTarget(phrase.key);assert.match(ui.writing.render(),/He turned round again\./);
 assert.equal(h.document.querySelector('[data-free-answer="4"]'),null,'unused extra legacy rows are not extra required inputs');
 await ui.flush();const backup=h.api.backupData();
 assert.equal(backup.freeWriting[draftKey].targets[phraseKey].answers[2],'He turned round again.');
 await ui.goStage(3);assert(ui.sentences().some(row=>row.answer==='The telephone rang twice.'));
 assert(ui.sentences().some(row=>row.answer==='He turned round again.'));
});
