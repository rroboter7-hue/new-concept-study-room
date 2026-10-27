'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const {harness:sharedHarness}=require('./leo-coach-harness.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
test('learned-range settings persist real lesson-number bounds without modifying records or old sentence drafts',async()=>{
 const h=await harness({loaded:{sentencePractice:{legacy:{answers:{affirmative:'My existing draft.'}}}}}),beforeRecords=plain(h.api.data.records),beforeDrafts=plain(h.api.data.sentencePractice),options=h.api.sentencePractice.options;
 assert.equal(typeof options.saveLearningRange,'function');
 assert.equal(options.saveLearningRange({version:1,books:{'1':12,'2':9999,'3':-1,'4':0}}),true);
 const range=options.getLearningRange();assert.equal(range.books[1],11);assert.equal(range.books[2],96);assert.equal(range.books[3],0);
 assert.deepEqual(plain(h.stored.settings.learnedRange),plain(range));assert.deepEqual(plain(h.api.data.records),beforeRecords);assert.deepEqual(plain(h.api.data.sentencePractice),beforeDrafts);
 h.setStorageWritable(false);assert.equal(options.saveLearningRange({version:1,books:{'1':1}}),false);assert.equal(options.getLearningRange().books[1],11);
});
test('a checked sentence target can enter spaced review without claiming mastered or read status',async()=>{
 const h=await harness({pilot:false}),id=h.api.current.id;
 assert.equal(Object.keys(h.api.data.review.cards).length,0);
 h.api.sentencePractice.options.onEvidence({lessonId:id,target:'theatre',kind:'word',complete:true,rulesOnly:true,at:h.now});
 const cardId='review:'+encodeURIComponent(id)+':word:theatre',saved=h.api.data.review.cards[cardId];
 assert.ok(saved);assert.equal(saved.stage,0);assert.equal(saved.repetitions,0);assert.equal(saved.lastEvidence,undefined);
 assert.equal(h.c.StudyLearningProgress.describe(h.api.data.records[id]).read,false);
 const before=plain(saved);h.api.sentencePractice.options.onEvidence({lessonId:id,target:'theatre',kind:'word',complete:true,rulesOnly:true,at:h.now});
 assert.deepEqual(plain(h.api.data.review.cards[cardId]),before,'rechecking the same draft never advances a review schedule');
});
test('an explicit replacement deletion of a legacy additive key cannot be resurrected by a stale tab',async()=>{
 const sharedStorage=new Map([['zhixin-study-v1',JSON.stringify({futureField:{note:'old'},words:[],records:{}})]]);
 const a=await sharedHarness({pilot:false,sharedStorage}),b=await sharedHarness({pilot:false,sharedStorage});
 a.api.restoreBackup({format:'zhixin-backup-v1',data:{words:[],records:{}}},{mode:'replace'});
 await b.storageEvent();assert.equal(b.api.data.futureField,undefined);
 await b.api.selectLesson(b.api.current.id);assert.equal(b.stored.futureField,undefined);
});
test('a stale mastery click before the storage event arrives cannot undo another tab deleting a word',async()=>{
 const sharedStorage=new Map([['zhixin-study-v1',JSON.stringify({words:[{word:'book',meaning:'书',mastered:false}],records:{}})]]);
 const a=await sharedHarness({pilot:false,sharedStorage}),b=await sharedHarness({pilot:false,sharedStorage});
 await a.click('[data-view="words"]');await b.click('[data-view="words"]');const oldButton=b.document.querySelector('[data-master="book"]');
 await a.click('[data-remove-word="book"]');await b.click(oldButton);
 const latest=b.c.StudyStorage.read({storage:b.c.localStorage,key:'zhixin-study-v1'});assert.equal(latest.ok,true);assert.equal(latest.data.words.length,0);assert.equal(b.api.data.words.length,0);
});
