'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness,submitWithWrong}=require('./support/app-harness.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
test('failed mark-read leaves the committed record, review schedule and displayed state unchanged',async()=>{
 const h=await harness({pilot:false}),id=h.api.current.id,before=plain(h.stored);h.setStorageWritable(false);await h.click('#complete-lesson');
 assert.deepEqual(plain(h.stored),before);assert.equal(h.c.StudyLearningProgress.describe(h.api.data.records[id]).read,false);
 assert.match(h.document.querySelector('#toast').textContent,/未保存|尚未保存|保存失败/);
 assert.ok(!h.document.querySelector('#toast').textContent.includes('已记录读过'));
});
for(const action of ['remove-word','master'])test('failed '+action+' keeps the saved vocabulary item and its original mastery state',async()=>{
 const h=await harness({pilot:false,loaded:{words:[{word:'book',meaning:'书',mastered:false}]}});await h.click('[data-view="words"]');
 const before=plain(h.stored.words);h.setStorageWritable(false);await h.click('[data-'+action+'="book"]');
 assert.deepEqual(plain(h.stored.words),before);assert.equal(h.api.data.words.length,1);assert.equal(h.api.data.words[0].mastered,false);
 assert.ok(!h.document.querySelector('#toast').textContent.includes('已移出'));
});
test('a card removed by another tab cannot throw or recreate its vocabulary item when a stale mastery button is clicked',async()=>{
 const h=await harness({pilot:false,loaded:{words:[{word:'book',meaning:'书',mastered:false}]}});await h.click('[data-view="words"]');
 const stale=h.document.querySelector('[data-master="book"]');h.api.data.words=[];
 await h.click(stale);assert.equal(h.api.data.words.length,0);
});
test('failed quiz persistence retains answers for retry without claiming a saved score',async()=>{
 const h=await harness({pilot:false});h.setStorageWritable(false);await submitWithWrong(h,[0]);
 assert.equal(h.api.practice.submitted,false);assert.equal(h.stored.records?.[h.api.current.id],undefined);
 assert.ok(Object.keys(h.api.practice.answers).length>0);assert.match(h.document.querySelector('#toast').textContent,/未保存|尚未保存|保存失败/);
});
test('failed mobile read-and-next does not claim read completion or navigate away from the reader',async()=>{
 const h=await harness({pilot:false,realOutput:true}),id=h.api.current.id;h.setStorageWritable(false);h.shells[0].options.onReadNext();await h.flush();
 assert.equal(h.c.StudyLearningProgress.describe(h.api.data.records[id]).read,false);assert.equal(h.api.activeTab,'reading');assert.equal(h.stored.records?.[id],undefined);
});
test('failed word save leaves no phantom favorite or success toast',async()=>{
 const h=await harness({pilot:false});h.c.AbortController=AbortController;h.c.fetch=async()=>{throw new Error('offline test boundary');};await h.click('[data-word="private"]');h.setStorageWritable(false);await h.click('#save-word');
 assert.equal(h.api.data.words.length,0);assert.equal(h.stored.words.length,0);assert.ok(!h.document.querySelector('#toast').textContent.includes('已加入生词本'));
});
