'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const first='nce-b2-eef57c-l001',second='nce-b2-eef57c-l002';
const options={realPipeline:true,pilot:false,realOutput:true};

test('retelling aids and legacy import are current-lesson bound without changing learner drafts',async()=>{
 const legacy='My own earlier English retelling.\n\nAnother paragraph.';
 const h=await harness({...options,loaded:{lastLesson:second,outputDrafts:{version:1,lessons:{[second]:{mode:'retell',modes:{retell:{answer:legacy}}},other:{mode:'retell',modes:{retell:{answer:'Another lesson must stay separate.'}}}}}}});
 await h.api.selectLesson(second);const ui=h.api.learningPipeline,lesson=h.api.current;
 assert.equal(typeof ui.options.getRetellSupport,'function');
 const before=JSON.stringify(h.api.data.outputDrafts),support=ui.options.getRetellSupport(lesson);
 assert.deepEqual(Array.from(support.characters,row=>row.name),['Lucy']);
 assert.equal(support.sections.length,lesson.paragraphs.length);
 assert(support.sections.every((row,index)=>row.meaning===lesson.paragraphs[index].zh));
 assert(support.words.some(row=>row.word==='ring'));assert(!support.words.some(row=>row.word==='Lucy'));
 assert(!support.usages.some(row=>row.phrase==='turn round'));
 assert.equal(ui.options.getLegacyRetell(lesson),legacy);
 assert.equal(ui.options.getLegacyRetell({id:'missing'}),'');
 assert.equal(JSON.stringify(h.api.data.outputDrafts),before);
 const points=ui.options.getKeyPoints(lesson);
 assert(points.items.every(row=>['grammar','usage'].includes(row.category)));
 assert(!points.items.some(row=>row.category==='usage'&&row.title==='turn round'));
});

test('six-stage app saves full retelling through refresh and copies only the learner English',async()=>{
 const h=await harness({...options,loaded:{lastLesson:second}});await h.api.selectLesson(second);
 const ui=h.api.learningPipeline;await ui.goStage(3);
 assert.match(ui.render(),/data-stage="4"/);await ui.goStage(4);
 const content='  I woke up late on Sunday.\n\nMy aunt Lucy was surprised.  ',copied=[];
 h.c.navigator.clipboard={writeText:async text=>copied.push(text)};
 const input=h.document.querySelector('[data-pipeline-retell]');assert(input);
 await h.input(input,content);assert.equal(h.document.querySelector('[data-pipeline-retell]'),input,'autosave retains the focused textarea');
 assert.equal(h.stored.learningPipeline.version,2);assert.equal(h.stored.learningPipeline.lessons[second].retellText,content);
 assert.match(h.api.lessonProgress(second).summary,/课文复述/);
 await ui.copyRetell();assert.deepEqual(copied,[content],'no article hints, title or checking prompt is copied');
 const backup=h.api.backupData();assert.equal(backup.learningPipeline.lessons[second].retellText,content);
 const reloaded=await harness({...options,loaded:h.stored});await reloaded.api.selectLesson(second);
 assert.equal(reloaded.api.learningPipeline.record().stage,4);
 assert.equal(reloaded.document.querySelector('[data-pipeline-retell]').value,content);
 await reloaded.api.learningPipeline.goStage(5);assert.match(reloaded.api.lessonProgress(second).summary,/重点/);
});

test('old points position migrates to stage five once while preserving existing state',async()=>{
 const loaded={lastLesson:second,learningPipeline:{version:1,lessons:{[second]:{stage:4,scrollPositions:{4:319},reflection:{notes:'My grammar note.'}}}}};
 const h=await harness({...options,loaded});await h.api.selectLesson(second);const ui=h.api.learningPipeline;
 assert.equal(ui.record().stage,5);assert.equal(ui.record().scrollPositions[5],319);
 assert.equal(ui.record().reflection.notes,'My grammar note.');
 await ui.goStage(4);await ui.flush();
 const next=await harness({...options,loaded:h.stored});await next.api.selectLesson(second);
 assert.equal(next.api.learningPipeline.record().stage,4,'new retelling stage must not migrate again');
});

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

test('notes adapter opens stage five key points after retelling stage insertion',async()=>{
 const h=await harness({...options,loaded:{lastLesson:second}});await h.api.selectLesson(second);
 await h.api.setTab('usage');const ui=h.api.learningPipeline;
 assert.equal(ui.record().stage,5);
 assert(h.document.querySelector('.pipeline-key-points'),'key points stage is visible');
 assert.equal(h.document.querySelector('[data-pipeline-retell]'),null,'notes must not open the retelling form');
});
