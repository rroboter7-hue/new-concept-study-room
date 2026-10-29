'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const options={realPipeline:true,pilot:false,realOutput:true};
const plain=value=>JSON.parse(JSON.stringify(value));
async function workspace(){
 const h=await harness(options),pipeline=h.api.learningPipeline;assert(pipeline);
 await h.api.selectLesson(h.api.current.id);await pipeline.goStage(2);await h.flush();
 const writing=pipeline.writing;assert(writing);const target=writing.targets()[0];assert(target);
 return {h,pipeline,writing,target,key:writing.active.key};
}
function externalSave(h,change){
 const storage=h.c.localStorage,api=h.c.StudyStorage,latest=api.read({storage});assert.equal(latest.ok,true);
 const session=api.createSession({storage,writer:'free-writing-external-test',initial:latest.data}),next=plain(latest.data);change(next);
 const result=session.commit(next);assert.equal(result.ok,true);return api.read({storage}).data;
}

test('real app bridge preserves independent free-writing rows saved by another writer and survives reload',async()=>{
 const {h,pipeline,writing,target,key}=await workspace(),locks=[];
 h.c.navigator.locks={request:async(name,settings,commit)=>{locks.push({name,settings});return commit();}};
 writing.editAnswer(target.key,0,'My first local sentence.');assert.equal(await pipeline.flush(),true);
 externalSave(h,data=>{data.freeWriting[key].targets[target.key].answers[1]='Another tab saved this sentence.';});
 writing.editAnswer(target.key,2,'My third local sentence.');assert.equal(await pipeline.flush(),true);
 const expected=['My first local sentence.','Another tab saved this sentence.','My third local sentence.'];
 assert.deepEqual(plain(h.stored.freeWriting[key].targets[target.key].answers.slice(0,3)),expected);
 assert.equal(writing.active.draft.targets[target.key].answers[1],expected[1]);
 assert(locks.length>=2);assert(locks.every(lock=>lock.name==='zhixin-study-v1:free-writing:'+key&&lock.settings.mode==='exclusive'));
 const reloaded=await harness({...options,loaded:h.stored});assert.equal(reloaded.api.learningPipeline.writing,null);await reloaded.click('[data-shelf-continue]');await reloaded.flush();const restored=reloaded.api.learningPipeline.writing;
 assert(restored);assert.deepEqual(plain(restored.active.draft.targets[target.key].answers.slice(0,3)),expected);
});

test('real app bridge rejects a same-row conflict while keeping remote storage, local editor and emergency backup',async()=>{
 const {h,pipeline,writing,target,key}=await workspace();
 await h.input('[data-free-answer="0"]','Our original sentence.');await pipeline.flush();
 externalSave(h,data=>{data.freeWriting[key].targets[target.key].answers[0]='The remote version stays saved.';});
 await h.input('[data-free-answer="0"]','My local unfinished version.');assert.equal(await pipeline.flush(),false);
 assert.equal(h.stored.freeWriting[key].targets[target.key].answers[0],'The remote version stays saved.');
 assert.equal(writing.active.draft.targets[target.key].answers[0],'My local unfinished version.');
 assert.equal(h.document.querySelector('[data-free-answer="0"]').value,'My local unfinished version.');
 assert.match(writing.render(),/第\s*1\s*句.*(?:另一个窗口|冲突)/);
 assert.equal(await pipeline.flush(),false,'an unresolved retry must not overwrite the remote version');
 assert.equal(h.stored.freeWriting[key].targets[target.key].answers[0],'The remote version stays saved.');
 assert.equal(h.api.backupData().freeWriting[key].targets[target.key].answers[0],'My local unfinished version.');
});

test('replacing a backup invalidates a queued old writing save and later writes from that old editor',async()=>{
 const {h,pipeline,writing,target,key}=await workspace();
 await h.input('[data-free-answer="0"]','The version intentionally restored.');await pipeline.flush();
 const backup=plain(h.api.backupData());let release;
 h.c.navigator.locks={request:(name,settings,commit)=>new Promise(resolve=>{release=()=>resolve(commit());})};
 writing.editAnswer(target.key,0,'An old queued edit must not replace the restored version.');
 const pending=pipeline.flush();for(let index=0;index<6&&!release;index++)await Promise.resolve();
 assert.equal(typeof release,'function','the old save is waiting for its Web Lock');
 h.api.restoreBackup({format:'zhixin-backup-v1',data:backup},{mode:'replace'});
 assert.equal(h.stored.freeWriting[key].targets[target.key].answers[0],'The version intentionally restored.');
 release();assert.equal(await pending,false,'a save from the invalidated editor must not be accepted');
 assert.equal(h.stored.freeWriting[key].targets[target.key].answers[0],'The version intentionally restored.');
 h.c.navigator.locks={request:async(name,settings,commit)=>commit()};
 writing.editAnswer(target.key,0,'A later write from the invalidated editor.');
 assert.equal(await writing.flush(),false,'the old editor remains invalid even when it initiates saving after restore');
 assert.equal(writing.active.draft.targets[target.key].answers[0],'A later write from the invalidated editor.');
 assert.equal(h.stored.freeWriting[key].targets[target.key].answers[0],'The version intentionally restored.');
 await h.api.selectLesson(h.api.current.id);await h.flush();
 const fresh=h.api.learningPipeline.writing;assert(fresh);assert.notEqual(fresh,writing);
 fresh.editAnswer(target.key,0,'The new editor can safely keep learning.');
 assert.equal(await pipeline.flush(),true);assert.equal(h.stored.freeWriting[key].targets[target.key].answers[0],'The new editor can safely keep learning.');
});
