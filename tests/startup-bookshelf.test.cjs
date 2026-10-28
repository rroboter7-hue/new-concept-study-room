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
