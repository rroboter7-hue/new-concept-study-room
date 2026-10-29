'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const options={realPipeline:true,pilot:false,realOutput:true};
async function change(h,selector,value){const node=h.document.querySelector(selector);assert(node,selector);node.value=value;await h.document.dispatch('change',node);await h.flush();}
test('grammar browsing by book and lesson never changes the active course, draft or progress',async()=>{
 const h=await harness(options);await h.api.selectLesson(h.api.current.id);await h.api.learningPipeline.goStage(2);await h.flush();await h.input('[data-free-answer="0"]','Keep my writing draft.');await h.click('[data-main-entry="words"]');
 const current=h.api.current.id,before=JSON.stringify({records:h.stored.records,pipeline:h.stored.learningPipeline,writing:h.stored.freeWriting}),audioChanges=h.audio.lessonChanges.length;
 assert.equal(h.document.querySelector('[data-focus-lesson]').value,current);
 await change(h,'[data-focus-book]','1');const prior=h.c.LESSONS.find(row=>row.book===1&&row.number===5);await change(h,'[data-focus-lesson]',prior.id);
 assert.match(h.document.querySelector('[data-entry-focus-body]').innerHTML,/第1册 · 第5课/);assert.equal(h.api.current.id,current);assert.equal(h.audio.lessonChanges.length,audioChanges);
 assert.equal(JSON.stringify({records:h.stored.records,pipeline:h.stored.learningPipeline,writing:h.stored.freeWriting}),before);
 await h.click('[data-main-entry="records"]');await h.click('[data-main-entry="words"]');assert.equal(h.document.querySelector('[data-focus-lesson]').value,prior.id);
 await h.click('[data-focus-current]');assert.equal(h.document.querySelector('[data-focus-lesson]').value,current);
 await h.click('[data-main-entry="study"]');await h.click('[data-shelf-continue]');assert.equal(h.document.querySelector('[data-free-answer="0"]').value,'Keep my writing draft.');
});
test('all four books can be inspected independently; invalid lesson values are ignored',async()=>{
 const h=await harness(options);await h.click('[data-main-entry="words"]');const original=h.api.current.id;
 for(const book of [1,2,3,4]){await change(h,'[data-focus-book]',String(book));const last=h.c.LESSONS.filter(row=>row.book===book).at(-1);await change(h,'[data-focus-lesson]',last.id);assert.equal(h.document.querySelector('[data-focus-lesson]').value,last.id);assert(h.document.querySelector('[data-entry-focus-body]').innerHTML.includes('第'+book+'册'));}
 const before=h.document.querySelector('[data-entry-focus-body]').innerHTML;await change(h,'[data-focus-lesson]','missing');assert.equal(h.document.querySelector('[data-entry-focus-body]').innerHTML,before);assert.equal(h.api.current.id,original);
});
