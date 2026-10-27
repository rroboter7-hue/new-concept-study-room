'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const {harness}=require('./leo-coach-harness.cjs');
const KEY='zhixin-study-v1';

function reviewCatalog(h){
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','review-practice.js'),'utf8'),h.c,{filename:'review-practice.js'});
 const panel=Object.create(h.c.ReviewPractice.prototype);
 panel.options={getLessons:h.api.sentencePractice.options.getLessons};
 return ()=>panel.cards();
}

test('ordinary draft saves retain the lesson array and the cached review catalog',async()=>{
 const h=await harness({pilot:false}),getLessons=h.api.sentencePractice.options.getLessons,cards=reviewCatalog(h),lessons=getLessons(),catalog=cards(),current=h.api.current;
 for(const rawText of ['A first retained draft.','A revised retained draft.']){
  assert.equal(h.api.batchPractice.options.saveDraft(current.id,{mode:'free',rawText}),true);
  assert.ok(getLessons()===lessons,'saving a draft must not invalidate unchanged lesson data');
  assert.ok(cards()===catalog,'the real review panel must retain its existing catalog');
  assert.equal(h.api.current,current,'saving retains the active lesson object');
 }
 assert.equal(h.stored.sentenceBatches[current.id].rawText,'A revised retained draft.');
});

test('external imported lesson additions, same-ID replacement and removal refresh the lesson catalog',async()=>{
 const sharedStorage=new Map([[KEY,JSON.stringify({words:[],records:{},futureField:{note:'legacy'}})]]),a=await harness({pilot:false,sharedStorage}),b=await harness({pilot:false,sharedStorage}),getLessons=b.api.sentencePractice.options.getLessons,current=b.api.current;
 a.c.crypto=webcrypto;b.c.crypto=webcrypto;
 const imported={...a.c.StudyCore.fromText('This imported lesson has its own sentence.',{book:2,number:97,title:'Imported cache fixture'}),id:'cache-imported'};
 let previous=getLessons();
 a.api.restoreBackup({format:'zhixin-backup-v1',data:{words:[],records:{},imported:[imported]}});
 await b.storageEvent();assert.notEqual(getLessons(),previous);assert.equal(getLessons().find(l=>l.id===imported.id).title,imported.title);assert.equal(b.api.current,current);
 previous=getLessons();const changed={...imported,title:'Replaced imported fixture',paragraphs:[{en:'This is the replacement source text.',zh:''}]};
 a.api.restoreBackup({format:'zhixin-backup-v1',data:{words:[],records:{},imported:[changed]}},{mode:'replace'});
 await b.storageEvent();assert.notEqual(getLessons(),previous);assert.equal(getLessons().find(l=>l.id===imported.id).title,changed.title);assert.equal(getLessons().find(l=>l.id===imported.id).paragraphs[0].en,changed.paragraphs[0].en);assert.equal(b.api.data.futureField,undefined);assert.equal(b.api.current,current);
 previous=getLessons();
 a.api.restoreBackup({format:'zhixin-backup-v1',data:{words:[],records:{}}},{mode:'replace'});
 await b.storageEvent();assert.notEqual(getLessons(),previous);assert.equal(getLessons().some(l=>l.id===imported.id),false);assert.equal(b.api.current,current);
 previous=getLessons();await b.storageEvent();assert.ok(getLessons()===previous,'repeated unchanged storage events retain the catalog');
});
