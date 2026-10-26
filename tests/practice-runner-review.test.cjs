'use strict';
// Independent runner review. The production core and runner execute unchanged;
// only persistence, audio completion, and navigation are boundary doubles.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),fixture=require('./practice-pack-fixture.cjs');
const DIST=path.join(__dirname,'..');
function harness(){
 let state={},failNext=0,failSavedFlag=false,failResults=0,eligible=false,hostAcknowledges=false,speakMode='success',pendingAudio;const records=[],resultCalls=[],messages=[],navigation=[],listeners={},audioCalls=[];
 const root={html:'',set innerHTML(v){this.html=String(v);},get innerHTML(){return this.html;},querySelector(){return null;},querySelectorAll(){return [];}};
 const document={addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn),removeEventListener(){},getElementById:id=>id==='unit-practice-content'?root:null};
 const c={console,document,requestAnimationFrame:fn=>fn()};c.window=c;vm.createContext(c);for(const file of ['practice-pack-core.js','lesson-practice.js'])vm.runInContext(fs.readFileSync(path.join(DIST,file),'utf8'),c,{filename:file});const f=fixture(),registry=c.StudyPracticePacks.create(f.manifest,f.lessons,f.bank);assert.equal(registry.issues.length,0);
 const options={registry,getLesson:()=>f.lessons[0],getState:()=>state,saveState:next=>{if(failNext>0){failNext--;return false;}if(failSavedFlag&&next.sessions?.l1?.resultSaved)return false;state=JSON.parse(JSON.stringify(next));return true;},saveResult:payload=>{resultCalls.push(JSON.parse(JSON.stringify(payload)));if(failResults>0){failResults--;return false;}records.push(JSON.parse(JSON.stringify(payload)));return true;},canRetest:()=>eligible,isAttemptSaved:(lessonId,attemptId)=>hostAcknowledges&&records.some(r=>r.lessonId===lessonId&&r.attemptId===attemptId),toast:m=>messages.push(m),speak:word=>{audioCalls.push(word);if(speakMode==='failure')return Promise.reject(new Error('audio unavailable'));if(speakMode==='pending')return new Promise((resolve,reject)=>pendingAudio={resolve,reject});return Promise.resolve();},openKnowledge:(...args)=>navigation.push(['knowledge',...args]),readLesson:()=>navigation.push(['read'])};const ui=new c.LessonPractice(options),pack=registry.get('l1');
 const emitInput=value=>{const input={value,dataset:{packInput:'true'},closest:()=>root,matches:()=>true};for(const fn of listeners.input||[])fn({target:input});return input;};
 async function goTo(index,{wrongAt=-1}={}){while(ui.session().cursor<index){const s=ui.session(),q=pack.tasks.find(q=>q.id===s.queue[s.cursor]);if(q.category==='listening')await ui.playAudio();const value=s.cursor===wrongAt?(q.type==='choice'?(q.answer+1)%4:'wrong'):(q.type==='choice'?q.answer:q.expected[0]);if(q.type==='choice')assert.equal(ui.choose(value),true);else{assert.equal(ui.answer(value),true);assert.equal(ui.submitCurrent(),true);}assert.equal(ui.next(),true);}}
 return {c,ui,pack,registry,root,records,resultCalls,messages,navigation,audioCalls,emitInput,goTo,get state(){return state;},set state(v){state=v;},set failNext(v){failNext=v;},set failSavedFlag(v){failSavedFlag=v;},set failResults(v){failResults=v;},set eligible(v){eligible=v;},set hostAcknowledges(v){hostAcknowledges=v;},set speakMode(v){speakMode=v;},get pendingAudio(){return pendingAudio;},reconstruct(){return new c.LessonPractice(options);}};
}

test('a one-off draft persistence failure must not submit the older text while the input shows the new text',()=>{
 const h=harness();h.ui.start();h.emitInput('appl');h.failNext=1;const input=h.emitInput('apple');assert.equal(input.value,'apple');assert(h.messages.some(x=>/保存/.test(x)));assert.equal(h.ui.submitCurrent(),true);const submitted=h.ui.session().answers.vocabulary1;assert.equal(submitted.value,input.value,'submit the text visible to the learner, not the last durable draft');assert.equal(h.c.StudyPracticePacks.grade(h.pack.tasks[0],submitted.value).correct,true);
});

test('a successful formal result callback is not repeated if only the saved-result flag fails to persist',async()=>{
 const h=harness();h.ui.start();await h.goTo(11);const q=h.pack.tasks[11];h.ui.answer(q.expected[0]);h.ui.submitCurrent();h.failSavedFlag=true;h.ui.next();assert.equal(h.records.length,1);h.failSavedFlag=false;h.ui.commitResult();assert.equal(h.records.length,1,'retrying the receipt flag must not write another formal attempt');assert.equal(h.ui.session().resultSaved,true);
});

test('failed final-result persistence can be retried once without losing completed answers or double-submitting later',async()=>{
 const h=harness();h.ui.start();h.failResults=1;await h.goTo(12);assert.equal(h.records.length,0);assert.equal(h.ui.session().resultSaved,false);assert.equal(h.c.StudyPracticePacks.result(h.ui.session(),h.pack).complete,true);assert.equal(h.ui.commitResult(),true);assert.equal(h.records.length,1);assert.equal(h.ui.commitResult(),false);assert.equal(h.records.length,1);
});

test('listening cannot be submitted before completion, after a playback failure, or while audio is pending',async()=>{
 const h=harness();h.ui.start();await h.goTo(6);const q=h.pack.tasks[6];h.ui.answer(q.expected[0]);assert.equal(h.ui.submitCurrent(),false);h.speakMode='failure';await h.ui.playAudio();assert.equal(h.ui.submitCurrent(),false);assert.equal(h.ui.session().audioPlayed[q.id],undefined);assert.match(h.ui.audioStatus[q.id],/失败/);h.speakMode='pending';const playing=h.ui.playAudio();assert.equal(h.ui.submitCurrent(),false);h.pendingAudio.resolve();await playing;assert.equal(h.ui.submitCurrent(),true);assert.equal(h.ui.submitCurrent(),false);assert.equal(h.c.StudyPracticePacks.result(h.ui.session(),h.pack).answered,7);
});

test('restoring a saved listening answer without successful-playback evidence must not count it as submitted',async()=>{
 const h=harness();h.ui.start();await h.goTo(6);const q=h.pack.tasks[6];await h.ui.playAudio();h.ui.answer(q.expected[0]);h.ui.submitCurrent();const old=JSON.parse(JSON.stringify(h.state));delete old.sessions.l1.audioPlayed[q.id];h.state=old;const restored=h.reconstruct();assert.equal(h.c.StudyPracticePacks.result(restored.session(),h.pack).answered,6,'an unverified listening answer must return to the listening step');assert.equal(restored.submitCurrent(),false);
});

test('correction and inline follow-up marks never change the original full result or write another formal attempt',async()=>{
 const h=harness();h.ui.start();await h.goTo(12,{wrongAt:3});assert.equal(h.records.length,1);const formal=JSON.stringify(h.records[0]);assert.equal(h.records[0].correct,11);assert.equal(h.ui.followup('grammar1',h.pack.tasks[3].followup.answer),true);assert.equal(h.c.StudyPracticePacks.result(h.ui.session(),h.pack).correct,11);assert.equal(h.records.length,1);h.ui.retryWrong();assert.equal(h.ui.session().queue.length,1);h.ui.choose(h.pack.tasks[3].answer);h.ui.next();assert.equal(h.ui.commitResult(),false);assert.equal(h.records.length,1);assert.equal(JSON.stringify(h.records[0]),formal);
});

test('knowledge/read detours and runner reconstruction retain the current typed draft and cursor',async()=>{
 const h=harness();h.ui.start();await h.goTo(10);const q=h.pack.tasks[10];h.emitInput('She is read');const before=JSON.stringify(h.state);h.ui.action({dataset:{packAction:'knowledge',packTask:q.id}});h.ui.action({dataset:{packAction:'read'}});assert.equal(JSON.stringify(h.state),before);assert.equal(h.navigation[0][0],'knowledge');assert.equal(h.navigation[0][1],'l1');assert.equal(h.navigation[0][2],q.conceptId);const resumed=h.reconstruct();assert.equal(resumed.session().cursor,10);assert.equal(resumed.session().answers[q.id].value,'She is read');assert(resumed.render().includes('She is read'));
});

test('retest start requires eligibility and the current revision; stale revisions cannot accept answers or a formal mark',async()=>{
 const h=harness();assert.equal(h.ui.start({mode:'retest'}),false);assert.equal(h.state.sessions,undefined);h.eligible=true;assert.equal(h.ui.start({mode:'retest'}),true);assert.equal(h.ui.session().mode,'retest');const old=JSON.parse(JSON.stringify(h.state));old.sessions.l1.revision='retired-revision';h.state=old;const before=JSON.stringify(h.state);assert(h.ui.render().includes('题库已更新'));assert.equal(h.ui.answer('apple'),false);assert.equal(h.ui.submitCurrent('apple'),false);assert.equal(h.ui.next(),false);assert.equal(h.ui.commitResult(),false);assert.equal(JSON.stringify(h.state),before);assert.equal(h.records.length,0);
});

test('a retest that loses eligibility before completion cannot be saved as an eligible retest pass',async()=>{
 const h=harness();h.eligible=true;h.ui.start({mode:'retest'});await h.goTo(11);const q=h.pack.tasks[11];h.ui.answer(q.expected[0]);h.ui.submitCurrent();h.eligible=false;h.ui.next();assert.equal(h.records.filter(x=>x.isRetest).length,0,'recheck eligibility when recording a retest, as another tab may have restarted the interval');
});

test('a restored empty correction queue does not crash the learning panel',()=>{
 const h=harness();h.ui.start();const saved=JSON.parse(JSON.stringify(h.state));saved.sessions.l1.mode='correction';saved.sessions.l1.queue=['removed-task-id'];h.state=saved;assert.doesNotThrow(()=>h.ui.render());
});

test('backup snapshots include the latest unsaved draft without rewriting the older durable state',()=>{
 const h=harness();h.ui.start();h.emitInput('appl');h.failNext=1;h.emitInput('apple');assert.equal(h.state.sessions.l1.answers.vocabulary1.value,'appl');const backup=h.ui.snapshot();assert.equal(backup.sessions.l1.answers.vocabulary1.value,'apple');assert.equal(backup.sessions.l1.answers.vocabulary1.submittedAt,null);h.state=JSON.parse(JSON.stringify(backup));assert.equal(h.reconstruct().session().answers.vocabulary1.value,'apple');
});

test('late audio completion from an abandoned attempt cannot authorize a new attempt listening answer',async()=>{
 const h=harness();h.ui.start();await h.goTo(6);const q=h.pack.tasks[6];h.speakMode='pending';const playing=h.ui.playAudio(),oldAudio=h.pendingAudio,oldAttempt=h.ui.session().attemptId;h.ui.start();assert.notEqual(h.ui.session().attemptId,oldAttempt);await h.goTo(6);oldAudio.resolve();await playing;assert.equal(h.ui.session().audioPlayed[q.id],undefined);h.ui.answer(q.expected[0]);assert.equal(h.ui.submitCurrent(),false);
});

test('receipt for an already accepted retest can be saved after eligibility changes, without another formal callback',async()=>{
 const h=harness();h.eligible=true;h.ui.start({mode:'retest'});await h.goTo(11);const q=h.pack.tasks[11];h.ui.answer(q.expected[0]);h.ui.submitCurrent();h.failSavedFlag=true;h.ui.next();assert.equal(h.records.length,1);assert.equal(h.records[0].isRetest,true);h.eligible=false;h.failSavedFlag=false;assert.equal(h.ui.commitResult(),true,'the accepted result only needs its receipt persisted, not reauthorized');assert.equal(h.records.length,1);assert.equal(h.ui.session().resultSaved,true);
});

test('after runner reconstruction a host-acknowledged retest receipt is recovered while ineligible without another result callback',async()=>{
 const h=harness();h.eligible=true;h.ui.start({mode:'retest'});await h.goTo(11);const q=h.pack.tasks[11];h.ui.answer(q.expected[0]);h.ui.submitCurrent();h.failSavedFlag=true;h.ui.next();assert.equal(h.records.length,1);assert.equal(h.ui.session().resultSaved,false);const attemptId=h.ui.session().attemptId,calls=h.resultCalls.length;
 h.eligible=false;h.failSavedFlag=false;h.hostAcknowledges=true;h.state=JSON.parse(JSON.stringify(h.state));const resumed=h.reconstruct();assert.equal(resumed.session().attemptId,attemptId);assert.equal(resumed.commitResult(),true);assert.equal(resumed.session().resultSaved,true);assert.equal(h.records.length,1);assert.equal(h.resultCalls.length,calls,'persistent host acknowledgement must recover only the receipt');
});
