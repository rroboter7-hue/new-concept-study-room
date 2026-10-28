'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../sentence-revisit.js');
const DAY=86400000,NOW=1700000000000;
const sample={lessonId:'b2-l1',lessonTitle:'A private conversation',book:2,number:1,original:'He go home.',corrected:'He goes home.',reason:'第三人称单数，go 改为 goes。',target:'go'};
function added(input=sample,id='sr:test',now=NOW){const result=R.add({},input,{now,id});assert.equal(result.ok,true);return result.state;}
test('saving an explicit correction schedules first revisit one day later without asserting grammar mastery',()=>{
 const state=added(),entry=state.entries['sr:test'];assert.equal(entry.dueAt,NOW+DAY);assert.equal(entry.stage,0);assert.equal(entry.corrected,sample.corrected);assert.equal(R.queue(state,{now:NOW}).length,0);assert.equal(R.queue(state,{now:NOW+DAY}).length,1);assert.equal(entry.mastered,undefined);
});
test('manual remembered ratings schedule the next three-day and seven-day revisits and retain the learner evidence',()=>{
 let state=added();let result=R.rate(state,'sr:test','remembered','He goes home.',{now:NOW+DAY,revealed:true});assert(result.ok);state=result.state;assert.equal(state.entries['sr:test'].stage,1);assert.equal(state.entries['sr:test'].dueAt,NOW+4*DAY);assert.equal(state.entries['sr:test'].lastRecall,'He goes home.');
 result=R.rate(state,'sr:test','remembered','He goes home.',{now:NOW+4*DAY,revealed:true});assert(result.ok);assert.equal(result.state.entries['sr:test'].dueAt,NOW+11*DAY);assert.equal(result.state.entries['sr:test'].stage,2);
});
test('again does not erase a correction or call it mastered; a blank answer and unrevealed answer cannot earn a remembered rating',()=>{
 const state=added();for(const args of [['remembered','',{revealed:true}],['remembered','He goes home.',{revealed:false}]])assert.equal(R.rate(state,'sr:test',args[0],args[1],{now:NOW+DAY,...args[2]}).ok,false);
 const next=R.rate(state,'sr:test','again','He go home.',{now:NOW+DAY,revealed:true});assert(next.ok);assert.equal(next.state.entries['sr:test'].stage,0);assert.equal(next.state.entries['sr:test'].dueAt,NOW+2*DAY);assert.equal(next.state.entries['sr:test'].corrected,sample.corrected);
});
test('revisits are limited to ten due entries and do not silently include future entries',()=>{
 let state={};for(let i=0;i<12;i++)state=R.add(state,{...sample,original:'He go home '+i+'.',corrected:'He goes home '+i+'.'},{now:NOW+i,id:'sr:item'+i}).state;
 state=R.add(state,{...sample,original:'Later original.',corrected:'Later correction.'},{now:NOW+DAY,id:'sr:future'}).state;
 assert.equal(R.queue(state,{now:NOW+DAY+100}).length,10);assert.equal(R.queue(state,{now:NOW+DAY+100})[0].id,'sr:item0');assert(R.queue(state,{now:NOW+DAY+100}).every(e=>e.id!=='sr:future'));
});
test('capture and recall drafts preserve text and bind to the explicit lesson or sentence, never the next selected lesson',()=>{
 let state=R.saveDraft({},'b2-l1',{original:'  He go',corrected:'He goes',reason:'原因',target:'go'},{now:NOW});state=R.saveDraft(state,'b2-l2',{original:'Another'},{now:NOW+1});assert.equal(state.drafts['b2-l1'].original,'  He go');assert.equal(state.drafts['b2-l2'].original,'Another');
 state=R.saveRecall(added(),'sr:test','He goes h',{now:NOW});assert.equal(state.entries['sr:test'].recallDraft,'He goes h');
});
test('blank, identical, duplicate and invalid-source corrections are rejected without mutating existing records',()=>{
 const state=added();for(const input of [{...sample,original:''},{...sample,corrected:sample.original},{...sample,lessonId:'<script>'}])assert.equal(R.add(state,input,{now:NOW,id:'sr:next'}).ok,false);
 assert.equal(R.add(state,sample,{now:NOW,id:'sr:next'}).ok,false);assert.deepEqual(Object.keys(state.entries),['sr:test']);
});
test('editing a saved correction preserves its identity and returns the corrected version to a one-day revisit',()=>{
 const state=added();const result=R.add(state,{...sample,id:'sr:test',corrected:'He goes home every day.'},{now:NOW+2*DAY});assert(result.ok);assert.deepEqual(Object.keys(result.state.entries),['sr:test']);assert.equal(result.state.entries['sr:test'].createdAt,NOW);assert.equal(result.state.entries['sr:test'].dueAt,NOW+3*DAY);assert.equal(result.state.entries['sr:test'].stage,0);
});
test('sanitization bounds imported strings, ignores poisoned accessors and strips forged mastery fields',()=>{
 const state=added(),poison={};Object.defineProperty(poison,'entries',{get(){throw Error('must not execute');},enumerable:true});assert.deepEqual(R.sanitize(poison),{version:1,entries:{},drafts:{}});
 state.entries['sr:test'].corrected='x'.repeat(9000);state.entries['sr:test'].stage=99;state.entries['sr:test'].mastered=true;state.entries['sr:test'].dueAt=Infinity;
 const clean=R.sanitize(state);assert.equal(clean.entries['sr:test'].corrected.length,2000);assert.equal(clean.entries['sr:test'].stage,0);assert.equal(clean.entries['sr:test'].mastered,undefined);assert(Number.isFinite(clean.entries['sr:test'].dueAt));
});
test('rendering a scheduled correction hides its answer before recall reveal and escapes saved text',()=>{
 const state=added({...sample,original:'<img src=x onerror=alert(1)>',corrected:'Safe correction.'});const controller=new R.SentenceRevisit({getState:()=>state,now:()=>NOW+DAY,document:null});const html=controller.renderReview();assert.match(html,/&lt;img/);assert(!html.includes('Safe correction.'));assert.match(html,/查看订正/);assert.match(html,/自行核对/);controller.destroy();
});

test('recording a correction never auto-compares the recall text to the answer when the learner rates it',()=>{
 const state=added();const result=R.rate(state,'sr:test','remembered','My independently judged answer.',{now:NOW+DAY,revealed:true});assert(result.ok);assert.equal(result.state.entries['sr:test'].lastRecall,'My independently judged answer.');assert.equal(result.state.entries['sr:test'].lastRating,'remembered');
});
test('a save failure is reported by the controller without claiming success or discarding the capture values',()=>{
 let next;const controller=new R.SentenceRevisit({getState:()=>({}),saveState:value=>{next=value;return false;},document:null});assert.equal(controller.persist({version:1,entries:{},drafts:{}}),false);assert(next);controller.destroy();
});
test('review exposes a correction only after an explicit reveal and preserves both reference and reason',()=>{
 const state=added();const controller=new R.SentenceRevisit({getState:()=>state,now:()=>NOW+DAY,document:null});controller.revealed.set('sr:test','He goes home.');const html=controller.renderReview();assert(html.includes(sample.corrected));assert(html.includes(sample.reason));assert.match(html,/还需复习/);assert.match(html,/记住了/);controller.destroy();
});

test('oversized raw corrections and drafts are rejected before truncation without changing saved text',()=>{
 const state=added(),before=JSON.stringify(state),long='x'.repeat(2001);
 for(const field of ['original','corrected']){const input={...sample,[field]:long};const result=R.add(state,input,{now:NOW,id:'sr:oversized'});assert.equal(result.ok,false);assert.match(result.error,/2000/);const draft=R.saveDraft(state,sample.lessonId,input,{now:NOW});assert.equal(draft.ok,false);assert.match(draft.error,/2000/);assert.equal(JSON.stringify(state),before);assert.equal(input[field],long);}
});
test('editing retains immutable first original and the twenty most recent previous correction snapshots',()=>{
 let state=added();for(let i=1;i<=23;i++){const result=R.add(state,{...sample,id:'sr:test',original:'Original '+i,corrected:'Correction '+i,reason:'Reason '+i},{now:NOW+i});assert(result.ok);state=result.state;}
 const entry=state.entries['sr:test'];assert.equal(entry.firstOriginal,sample.original);assert.equal(entry.history.length,20);assert.deepEqual(entry.history.at(-1),{original:'Original 22',corrected:'Correction 22',reason:'Reason 22',updatedAt:NOW+22});assert.equal(entry.history[0].corrected,'Correction 3');const roundTrip=R.sanitize(JSON.parse(JSON.stringify(state)));assert.deepEqual(roundTrip.entries['sr:test'].history,entry.history);assert.equal(roundTrip.entries['sr:test'].firstOriginal,sample.original);
});
test('an early or stale cross-tab rating cannot advance a future due correction',()=>{
 const state=added(),before=JSON.stringify(state);for(const rating of ['remembered','again']){const result=R.rate(state,'sr:test',rating,'He goes home.',{now:NOW+DAY-1,revealed:true});assert.equal(result.ok,false);assert.match(result.error,/到期|其他页面/);assert.equal(JSON.stringify(state),before);}
 const first=R.rate(state,'sr:test','remembered','He goes home.',{now:NOW+DAY,revealed:true});assert(first.ok);assert.equal(R.rate(first.state,'sr:test','remembered','He goes home.',{now:NOW+DAY,revealed:true}).ok,false);
});
test('controller freezes ten correction IDs and requires an explicit next-group action for the eleventh',()=>{
 let state={};for(let i=0;i<12;i++)state=R.add(state,{...sample,original:'Original '+i,corrected:'Correction '+i},{now:NOW,id:'sr:group'+i}).state;
 const controller=new R.SentenceRevisit({getState:()=>state,saveState:next=>{state=next;return true;},now:()=>NOW+DAY,document:null});controller.renderReview();const first=controller.currentId;assert(first);state=R.rate(state,first,'remembered','Recall',{now:NOW+DAY,revealed:true}).state;controller.renderReview();assert.equal(controller.roundIds.length,10);
 for(const id of controller.roundIds){if(state.entries[id].dueAt<=NOW+DAY)state=R.rate(state,id,'remembered','Recall',{now:NOW+DAY,revealed:true}).state;}
 const finished=controller.renderReview();assert.match(finished,/本组.*完成/);assert.match(finished,/下一组/);assert.equal(controller.currentId,'');assert.equal(R.queue(state,{now:NOW+DAY}).length,2);
 controller.handleClick({target:{closest:()=>({dataset:{srAction:'next-group'}})}});const next=controller.renderReview();assert.equal(controller.roundIds.length,2);assert(controller.currentId);assert.match(next,/待订正原句/);controller.destroy();
});

test('editing UI explains version retention and safely renders previous correction snapshots',()=>{
 let state=added();state=R.add(state,{...sample,id:'sr:test',corrected:'He goes home now.',reason:'Changed context.'},{now:NOW+1}).state;const controller=new R.SentenceRevisit({getState:()=>state,document:null});const html=controller.historyHTML(state.entries['sr:test']);assert.match(html,/之前的订正/);assert(html.includes(sample.corrected));assert(html.includes(sample.original));assert.match(html,/20/);controller.destroy();
});

test('oversized raw recall drafts and ratings reject before slicing and leave previous recall evidence untouched',()=>{
 const state=R.saveRecall(added(),'sr:test','Previous recall',{now:NOW}),before=JSON.stringify(state),long='R'.repeat(2001);
 const draft=R.saveRecall(state,'sr:test',long,{now:NOW+DAY});assert.equal(draft.ok,false);assert.match(draft.error,/2000/);assert.equal(JSON.stringify(state),before);
 const result=R.rate(state,'sr:test','remembered',long,{now:NOW+DAY,revealed:true});assert.equal(result.ok,false);assert.match(result.error,/2000/);assert.equal(JSON.stringify(state),before);assert.equal(long.length,2001);
});
