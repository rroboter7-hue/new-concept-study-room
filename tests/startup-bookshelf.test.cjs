'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const options={realPipeline:true,pilot:false,realOutput:true};
const plain=x=>JSON.parse(JSON.stringify(x));
const onShelf=h=>h.document.body.classList.contains('bookshelf-visible');
async function setup(stage){
 const h=await harness({...options,loaded:{records:{historic:{best:78,attempts:2}}}});
 const lesson=h.c.LESSONS.find(row=>row.book===2&&row.number===2);
 await h.api.selectLesson(lesson.id);await h.api.learningPipeline.goStage(stage);await h.flush();return h;
}

test('read-only storage still opens the initial shelf and permits exporting an existing retelling',async()=>{
 const id='nce-b2-eef57c-l002',draft='Keep this saved retelling.\n\nDo not lose its paragraphs.';
 const loaded={lastLesson:id,appRoute:{view:'study',lessonId:id},learningPipeline:{version:2,activeLessonId:id,lessons:{[id]:{stage:4,retellText:draft}}},records:{historic:{best:78,attempts:2}}};
 const h=await harness({...options,loaded,initialStorageWritable:false});
 assert.equal(onShelf(h),true,'showing the initial shelf must not require a storage write');
 assert.equal(h.stored.appRoute.view,'study','launch does not replace the saved route');
 assert(h.document.querySelector('[data-shelf-backup]'));await h.click('[data-shelf-backup]');
 assert.equal(h.api.view,'records','the dedicated backup entry remains available from the read-only shelf');
 assert(h.document.querySelector('#export-backup'));await h.click('#export-backup');
 assert.equal(h.downloads.length,1);const backup=JSON.parse(await h.downloads[0].blob.text());
 assert.equal(backup.data.learningPipeline.lessons[id].retellText,draft);assert.deepEqual(plain(backup.data.records),loaded.records);
 assert.equal(h.stored.learningPipeline.lessons[id].retellText,draft);
});

test('reopening a writing task starts on the bookshelf and continue restores its exact lesson, stage and draft',async()=>{
 const h=await setup(2),id=h.api.current.id,answer='Keep this sentence until I choose to continue.';
 await h.input('[data-free-answer="0"]',answer);await h.api.learningPipeline.flush();await h.flush();
 const before=plain(h.stored),reopened=await harness({...options,loaded:before});
 assert.equal(onShelf(reopened),true,'launch must show the bookshelf even after a saved study route');
 assert.equal(reopened.api.data.appRoute.view,'shelf');assert.equal(reopened.api.current.id,id);
 assert.equal(reopened.api.learningPipeline.record().stage,2);
 assert.deepEqual(plain(reopened.api.data.records),before.records);
 await reopened.click('[data-shelf-continue]');await reopened.flush();
 assert.equal(onShelf(reopened),false);assert.equal(reopened.api.current.id,id);
 assert.equal(reopened.api.learningPipeline.record().stage,2);
 assert.equal(reopened.document.querySelector('[data-free-answer="0"]').value,answer);
 assert.deepEqual(plain(reopened.api.data.records),before.records);
});

test('records and review destinations do not bypass the bookshelf on a later visit',async()=>{
 for(const view of ['records','daily-review']){
  const h=await setup(0),id=h.api.current.id;await h.api.navigate(view);await h.flush();
  const before=plain(h.stored),reopened=await harness({...options,loaded:before});
  assert.equal(onShelf(reopened),true,'saved '+view+' must not cover the launch bookshelf');
  assert.equal(reopened.api.data.appRoute.view,'shelf');assert.equal(reopened.api.current.id,id);
  assert.deepEqual(plain(reopened.api.data.records),before.records);
 }
});

test('returning through the bookshelf preserves a multi-paragraph retelling without recording mastery',async()=>{
 const h=await setup(4),id=h.api.current.id,text='My first paragraph.\n\nMy second paragraph.';
 await h.input('[data-pipeline-retell]',text);await h.api.learningPipeline.flush();await h.flush();
 const before=plain(h.stored),reopened=await harness({...options,loaded:before});
 assert.equal(onShelf(reopened),true);assert.equal(reopened.api.current.id,id);
 assert.equal(reopened.api.learningPipeline.record().retellText,text);
 await reopened.click('[data-shelf-continue]');await reopened.flush();
 assert.equal(onShelf(reopened),false);assert.equal(reopened.api.learningPipeline.record().stage,4);
 assert.equal(reopened.document.querySelector('[data-pipeline-retell]').value,text);
 assert.deepEqual(plain(reopened.api.data.records),before.records);
});

test('all saved stages open the shelf without mounting an editor or binding lesson audio',async()=>{
 const id='nce-b2-eef57c-l002';
 for(const stage of [0,1,2,3,4,5]){
  const loaded={lastLesson:id,appRoute:{view:'study',lessonId:id},learningPipeline:{version:2,activeLessonId:id,lessons:{[id]:{stage,retellText:'A saved retelling.'}}},records:{historic:{best:78,attempts:2}}};
  const h=await harness({...options,loaded});
  assert.equal(onShelf(h),true);assert.equal(h.api.current.id,id);
  assert.equal(h.api.learningPipeline.record().stage,stage);
  assert.equal(h.api.learningPipeline.container,null);
  assert.equal(h.api.learningPipeline.writing,null,'hidden writing stage must not create an editor');
  assert.deepEqual(h.audio.lessonChanges,[],'shelf launch must not bind or fetch lesson audio');
  assert.deepEqual(plain(h.api.data.records),loaded.records);
  await h.click('[data-shelf-continue]');await h.flush();
  assert.equal(onShelf(h),false);assert.equal(h.api.learningPipeline.record().stage,stage);
  assert.deepEqual(h.audio.lessonChanges,[id],'Continue binds the saved lesson audio');
 }
});

test('the study navigation entry also initializes audio when opened directly from the launch shelf',async()=>{
 const h=await harness(options);const id=h.api.current.id;
 await h.api.navigate('study');await h.flush();
 assert.equal(onShelf(h),false);assert.deepEqual(h.audio.lessonChanges,[id]);
 assert(h.api.learningPipeline.container);
});
