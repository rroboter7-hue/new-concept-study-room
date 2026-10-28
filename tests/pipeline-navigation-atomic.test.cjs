'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const options={realPipeline:true,pilot:false,realOutput:true};
const plain=value=>JSON.parse(JSON.stringify(value));
async function enter(){const h=await harness(options);await h.api.selectLesson(h.api.current.id);await h.flush();return h;}
const next=(h,number=2)=>h.c.LESSONS.find(l=>l.book===2&&l.number===number);
function identity(h){return {current:h.api.current.id,pipeline:h.api.learningPipeline.lesson.id,route:plain(h.api.data.appRoute),shelf:plain(h.api.data.shelf),storedRoute:plain(h.stored.appRoute),storedLast:h.stored.lastLesson,audio:h.audio.lessonChanges.at(-1)};}
async function turns(count){for(let n=0;n<count;n++)await Promise.resolve();}

test('failed new-lesson persistence leaves the original lesson, audio, route and continuation together',async()=>{
 const h=await enter(),ui=h.api.learningPipeline,before=identity(h),html=h.html(),container=ui.container;
 h.setStorageWritable(false);assert.equal(await h.api.selectLesson(next(h).id),false);
 assert.deepEqual(identity(h),before);assert.equal(h.html(),html);assert.equal(ui.container,container);assert.equal(ui.status,'error');
 h.setStorageWritable(true);assert.equal(await h.api.selectLesson(next(h).id),true);await h.flush();
 assert.equal(h.api.current.id,next(h).id);assert.equal(ui.lesson.id,next(h).id);assert.equal(h.audio.lessonChanges.at(-1),next(h).id);
 assert.equal(h.stored.appRoute.lessonId,next(h).id);assert.equal(h.stored.shelf.lastByBook[2],next(h).id);
});

test('an unsaved original free-writing input survives a blocked lesson change and saves before a successful retry',async()=>{
 const h=await enter(),ui=h.api.learningPipeline,old=h.api.current.id;await ui.goStage(2);await h.flush();
 const input=h.document.querySelector('[data-free-answer="0"]'),answer='Keep this sentence with its original lesson.';assert(input);
 h.setStorageWritable(false);await h.input(input,answer);const before=identity(h);
 assert.equal(await h.api.selectLesson(next(h).id),false);assert.deepEqual(identity(h),before);assert.equal(h.document.querySelector('[data-free-answer="0"]'),input);assert.equal(input.value,answer);
 const contains=(data)=>Object.values(data.freeWriting||{}).filter(row=>row.lessonId===old).flatMap(row=>Object.values(row.targets||{})).some(row=>row.answers?.includes(answer));
 assert(contains(h.api.backupData()));h.setStorageWritable(true);assert.equal(await h.api.selectLesson(next(h).id),true);assert(contains(h.stored));assert.equal(h.audio.lessonChanges.at(-1),next(h).id);
});

test('a quick lesson change followed by return cannot leave the next continuation using the previous audio',async()=>{
 const h=await enter(),first=h.api.selectLesson(next(h).id);await turns(3);const back=h.api.showBookshelf();await Promise.all([first,back]);await h.flush();
 assert.equal(h.document.body.classList.contains('bookshelf-visible'),true);assert.equal(h.api.data.appRoute.view,'shelf');
 assert.equal(h.api.learningPipeline.lesson.id,h.api.current.id);assert.equal(h.audio.lessonChanges.at(-1),h.api.current.id);
 assert.equal(h.stored.appRoute.lessonId,h.api.current.id);assert.equal(h.stored.shelf.lastByBook[2],h.api.current.id);
 await h.api.navigate('study');await h.flush();assert.equal(h.audio.lessonChanges.at(-1),h.api.current.id);assert.equal(h.api.learningPipeline.lesson.id,h.api.current.id);
});

test('the latest of two rapid lesson choices owns the route, pipeline, continuation and audio',async()=>{
 const h=await enter(),first=h.api.selectLesson(next(h,2).id);await turns(3);const last=h.api.selectLesson(next(h,3).id);await Promise.all([first,last]);await h.flush();
 const expected=next(h,3).id;assert.equal(h.api.current.id,expected);assert.equal(h.api.learningPipeline.lesson.id,expected);assert.equal(h.audio.lessonChanges.at(-1),expected);
 assert.equal(h.stored.appRoute.lessonId,expected);assert.equal(h.stored.shelf.lastByBook[2],expected);
});

test('a failed return-route save keeps the original mounted learning view available',async()=>{
 const h=await enter(),ui=h.api.learningPipeline,before=identity(h),container=ui.container;h.setStorageWritable(false);
 assert.equal(await h.api.showBookshelf(),false);assert.deepEqual(identity(h),before);assert.equal(ui.container,container);assert.equal(h.document.body.classList.contains('bookshelf-visible'),false);
 h.setStorageWritable(true);assert.equal(await h.api.showBookshelf(),true);assert.equal(h.document.body.classList.contains('bookshelf-visible'),true);assert.equal(h.stored.appRoute.view,'shelf');
});

test('a failed destination-route save cannot unmount the current lesson or display a different destination',async()=>{
 const h=await enter(),ui=h.api.learningPipeline,before=identity(h),container=ui.container;h.setStorageWritable(false);
 assert.equal(await h.api.navigate('records'),false);assert.deepEqual(identity(h),before);assert.equal(ui.container,container);assert.equal(h.api.view,'study');
 h.setStorageWritable(true);assert.equal(await h.api.navigate('records'),true);assert.equal(h.api.view,'records');assert.equal(h.stored.appRoute.view,'records');
});


test('a destination save failure keeps an already-saved original free-writing editor mounted',async()=>{
 const h=await enter(),ui=h.api.learningPipeline;await ui.goStage(2);await h.flush();
 const input=h.document.querySelector('[data-free-answer="0"]');assert(input);await h.input(input,'This saved sentence is still open for editing.');
 const before=identity(h);h.setStorageWritable(false);assert.equal(await h.api.selectLesson(next(h).id),false);
 assert.deepEqual(identity(h),before);assert.equal(h.document.querySelector('[data-free-answer="0"]'),input);assert.equal(input.value,'This saved sentence is still open for editing.');assert.equal(ui.status,'error');
 h.setStorageWritable(true);assert.equal(await h.api.selectLesson(next(h).id),true);assert.equal(h.audio.lessonChanges.at(-1),next(h).id);
});

test('a successful retry clears the stale save error before the learner resumes the original lesson',async()=>{
 const h=await enter(),ui=h.api.learningPipeline;h.setStorageWritable(false);assert.equal(await h.api.showBookshelf(),false);assert.equal(ui.status,'error');
 h.setStorageWritable(true);assert.equal(await h.api.showBookshelf(),true);await h.api.navigate('study');await h.flush();
 assert.notEqual(ui.status,'error');assert.doesNotMatch(ui.saveMessage(),/保存失败/);
});
