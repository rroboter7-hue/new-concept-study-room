'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const options={realPipeline:true,pilot:false,realOutput:true};
const plain=value=>JSON.parse(JSON.stringify(value));
const pipeline=h=>{assert(h.api.learningPipeline,'real app constructs LearningPipeline');return h.api.learningPipeline;};
async function enter(h){const controller=pipeline(h);await h.api.selectLesson(h.api.current.id);await h.flush();return controller;}
function freeAnswer(data,lessonId,answer){return Object.values(data.freeWriting||{}).filter(draft=>draft.lessonId===lessonId).flatMap(draft=>Object.values(draft.targets||{})).some(row=>row.answers?.includes(answer));}

test('first visit opens the real bookshelf and does not create learning evidence',async()=>{
 const h=await harness(options);pipeline(h);
 assert.equal(h.document.body.classList.contains('bookshelf-visible'),true);
 assert.equal(h.api.data.appRoute.view,'shelf');
 assert.equal(Object.keys(h.api.data.records).length,0);
});

test('reload resumes the study stage, selected answer and checked result without counting the error again',async()=>{
 const h=await harness(options),ui=await enter(h),id=h.api.current.id;
 await ui.goStage(1);const question=ui.question();assert(question);
 ui.chooseAnswer((question.answer+1)%question.options.length);await ui.checkAnswer();await h.flush();
 const before=plain(h.api.data.learningPipeline.lessons[id]);assert.equal(before.attempts.length,1);
 const reloaded=await harness({...options,loaded:h.stored}),resumed=pipeline(reloaded),record=resumed.record();
 assert.equal(reloaded.api.current.id,id);assert.equal(reloaded.document.body.classList.contains('bookshelf-visible'),false);
 assert.equal(reloaded.api.data.appRoute.view,'study');assert.equal(record.stage,1);assert.equal(record.quiz.submitted,true);
 assert.equal(record.quiz.answers[question.id],before.quiz.answers[question.id]);assert.equal(record.quiz.results[question.id].correct,false);
 assert.equal(record.attempts.length,1);assert.equal(record.mistakes[question.id].consecutiveWrong,1);
 assert.deepEqual(plain(record.quiz.questions),before.quiz.questions,'startup cannot generate a different round');
});

test('free-writing container input persists through real app storage and a fresh bootstrap',async()=>{
 const h=await harness(options),ui=await enter(h),id=h.api.current.id,answer='This independent sentence survives a full reload.';
 await ui.goStage(2);await h.flush();assert(ui.writing);
 await h.input('[data-free-answer="0"]',answer);await ui.flush();await h.flush();
 assert(freeAnswer(h.stored,id,answer));
 const reloaded=await harness({...options,loaded:h.stored}),resumed=pipeline(reloaded);assert.equal(resumed.record().stage,2);
 assert(resumed.writing);assert(freeAnswer(reloaded.api.data,id,answer));
 assert.equal(reloaded.document.querySelector('[data-free-answer="0"]').value,answer);
});

test('backup and replacement restore retain free writing and every pre-existing draft namespace',async()=>{
 const loaded={sentencePractice:{legacy:{answers:{affirmative:'Keep the four-form draft.',negative:'Do not migrate this.'}}},sentenceBatches:{'legacy-lesson':{rawText:'Keep a batch sentence.',notes:'Keep batch notes.'}},outputDrafts:{version:1,lessons:{'legacy-lesson':{mode:'retell',modes:{retell:{answer:'Keep my earlier retell.'}}}}},custom:{note:'Keep unknown fields.'}};
 const h=await harness({...options,loaded}),ui=await enter(h),id=h.api.current.id,answer='A free draft in the backup.';
 await ui.goStage(2);const target=ui.writing.targets()[0];ui.writing.editAnswer(target.key,0,answer);await ui.flush();
 const backup=plain(h.api.backupData());assert(freeAnswer(backup,id,answer));
 ui.writing.editAnswer(target.key,0,'A newer draft to replace.');await ui.flush();
 await h.api.restoreBackup({format:'zhixin-backup-v1',data:backup},{mode:'replace'});await h.flush();
 assert(freeAnswer(h.api.data,id,answer));assert.equal(h.api.data.sentencePractice.legacy.answers.affirmative,'Keep the four-form draft.');
 assert.equal(h.api.data.sentenceBatches['legacy-lesson'].rawText,'Keep a batch sentence.');
 assert.equal(h.api.data.outputDrafts.lessons['legacy-lesson'].modes.retell.answer,'Keep my earlier retell.');assert.equal(h.api.data.custom.note,'Keep unknown fields.');
 const reloaded=await harness({...options,loaded:h.stored});assert(freeAnswer(reloaded.api.data,id,answer));
 assert.equal(reloaded.document.querySelector('[data-free-answer="0"]').value,answer);
});

test('a failed free-writing save preserves live input and includes it in an emergency backup',async()=>{
 const h=await harness(options),ui=await enter(h),id=h.api.current.id,answer='Do not lose this unsaved free sentence.';
 await ui.goStage(2);const target=ui.writing.targets()[0];h.setStorageWritable(false);ui.writing.editAnswer(target.key,0,answer);
 assert.equal(await ui.flush(),false);assert.match(ui.writing.render(),/保存失败/);assert(freeAnswer(h.api.backupData(),id,answer));
 h.setStorageWritable(true);assert.equal(await ui.flush(),true);assert(freeAnswer(h.stored,id,answer));
});

test('an explicitly saved non-shelf route is restored instead of being covered by the bookshelf',async()=>{
 const h=await harness(options);await enter(h);await h.api.navigate('records');await h.flush();assert.equal(h.api.data.appRoute.view,'records');
 const reloaded=await harness({...options,loaded:h.stored});assert.equal(reloaded.api.view,'records');assert.equal(reloaded.document.body.classList.contains('bookshelf-visible'),false);
 await reloaded.api.showBookshelf();await reloaded.flush();assert.equal(reloaded.api.data.appRoute.view,'shelf');
 const shelfReload=await harness({...options,loaded:reloaded.stored});assert.equal(shelfReload.document.body.classList.contains('bookshelf-visible'),true);
});

test('an unresolved local audio read never delays the first bookshelf or a saved records route',async()=>{
 const first=await harness({...options,audioPending:true});pipeline(first);
 assert.equal(first.document.body.classList.contains('bookshelf-visible'),true);assert.equal(first.api.data.appRoute.view,'shelf');
 const restored=await harness({...options,audioPending:true,loaded:{appRoute:{view:'records'}}});pipeline(restored);
 assert.equal(restored.api.view,'records');assert.equal(restored.api.data.appRoute.view,'records');assert.equal(restored.document.body.classList.contains('bookshelf-visible'),false);
});

test('a new learner objective attempt supplies two-line earlier writing goals without changing legacy grades',async()=>{
 const h=await harness(options),ui=await enter(h),earlier=h.api.current,next=h.c.LESSONS.find(lesson=>lesson.book===earlier.book&&lesson.number===earlier.number+1);
 assert(next);await ui.goStage(1);const question=ui.question();ui.chooseAnswer(question.answer);await ui.checkAnswer();
 assert.equal(h.api.data.records[earlier.id],undefined);assert.equal(ui.record().attempts.length,1);
 await h.api.selectLesson(next.id);await h.flush();await ui.goStage(1);
 const reviews=ui.record().quiz.questions.filter(row=>row.isReview);assert(reviews.length>0);assert(reviews.every(row=>row.pipeline.sourceLessonId===earlier.id&&row.pipeline.studied===true));
 await ui.goStage(2);const prior=ui.writing.targets().filter(target=>target.prior);
 assert.equal(prior.filter(target=>target.kind==='word').length,2);assert.equal(prior.filter(target=>target.kind==='phrase').length,2);
 assert(prior.every(target=>target.requiredCount===2&&target.source.id===earlier.id));assert.equal(h.api.data.records[earlier.id],undefined);
});

test('finishing a round also supplies earlier writing goals while retaining existing old score records',async()=>{
 const h=await harness({...options,loaded:{records:{historic:{best:64,attempts:3}}}}),ui=await enter(h),earlier=h.api.current,next=h.c.LESSONS.find(lesson=>lesson.book===earlier.book&&lesson.number===earlier.number+1);
 await ui.goStage(5);await ui.finish();await h.flush();assert(h.api.data.learningPipeline.lessons[earlier.id].finishedAt);assert.equal(ui.record().attempts.length,0);
 await h.api.selectLesson(next.id);await h.flush();await ui.goStage(2);const prior=ui.writing.targets().filter(target=>target.prior);
 assert.equal(prior.length,4);assert(prior.every(target=>target.requiredCount===2&&target.source.id===earlier.id));
 assert.equal(h.api.data.records[earlier.id],undefined);assert.deepEqual(plain(h.api.data.records.historic),{best:64,attempts:3});
});
