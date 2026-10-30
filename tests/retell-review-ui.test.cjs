'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Pipeline=require('../learning-pipeline.js');
const lesson={id:'retell-test',book:2,number:2,title:'Retelling',paragraphs:[{en:'The original story.',zh:'原故事。'}]};
function setup(extra={}){
 let state=extra.state||{},failure=false;const notes=[];
 const ui=new Pipeline({getLesson:()=>lesson,getState:()=>state,saveState:async next=>{if(failure)return false;state=structuredClone(next);return true;},toast:m=>notes.push(m),checkSentence:async sentence=>({issues:sentence==='she were late'?[{type:'tense',message:'核对 was。',original:'were',replacement:'was'},{type:'punctuation',message:'补句末标点。'}]:[]}),...extra});
 return {ui,notes,state:()=>state,setFailure:value=>failure=value};
}
test('retell checks and corrections survive a fresh instance without replacing the original draft',async()=>{
 const h=setup();await h.ui.setLesson(lesson);await h.ui.goStage(4);h.ui.setRetellText('she were late');
 assert.equal(typeof h.ui.checkRetell,'function');assert.equal(await h.ui.checkRetell(),true);
 const entry=h.ui.record().retellReviews[0];assert.equal(entry.sourceText,'she were late');
 h.ui.setRetellCorrection(entry.id,'notes','Use was and a full stop.');h.ui.setRetellCorrection(entry.id,'retry','She was late.');h.ui.setRetellCorrection(entry.id,'summary','第三人称单数过去式：was；句末加句号。');
 assert.equal(await h.ui.recordRetellCorrection(entry.id),true);
 assert.equal(h.ui.record().retellText,'she were late');
 const restored=setup({state:h.state()});await restored.ui.setLesson(lesson);
 const saved=restored.ui.record().retellReviews[0];assert.equal(saved.retry,'She was late.');assert(saved.recordedAt>0);assert.match(saved.summary,/was/);
 h.ui.setRetellText('Another version.');await h.ui.flush();assert.match(h.ui.retellHTML(),/原稿已修改/);
 assert.equal(await h.ui.checkRetell(),true);assert.equal(h.ui.record().retellReviews.length,2);assert.equal(h.ui.record().retellReviews[0].retry,'She was late.');
 h.ui.destroy();restored.ui.destroy();
});
test('a delayed language check cannot overwrite edits or attach results to another lesson',async()=>{
 let finish;const h=setup({checkSentence:()=>new Promise(resolve=>finish=resolve)});await h.ui.setLesson(lesson);await h.ui.goStage(4);h.ui.setRetellText('First draft.');
 assert.equal(typeof h.ui.checkRetell,'function');const pending=h.ui.checkRetell();
 h.ui.setRetellText('My newer draft.');finish({issues:[]});assert.equal(await pending,false);
 assert.equal(h.ui.record().retellText,'My newer draft.');assert.equal((h.ui.record().retellReviews||[]).length,0);
 h.ui.destroy();
});
test('failed saving leaves review and correction input available for retry',async()=>{
 const h=setup();await h.ui.setLesson(lesson);await h.ui.goStage(4);h.ui.setRetellText('she were late');
 assert.equal(typeof h.ui.checkRetell,'function');h.setFailure(true);assert.equal(await h.ui.checkRetell(),false);
 assert.equal(h.ui.status,'error');assert.equal(h.ui.record().retellText,'she were late');assert.equal(h.ui.record().retellReviews.length,1);h.ui.destroy();
});
test('editing away and back invalidates an older in-flight check even when the text matches again',async()=>{
 let finish;const h=setup({checkSentence:()=>new Promise(resolve=>finish=resolve)});await h.ui.setLesson(lesson);await h.ui.goStage(4);h.ui.setRetellText('First draft.');
 const pending=h.ui.checkRetell();h.ui.setRetellText('Another draft.');h.ui.setRetellText('First draft.');finish({issues:[{type:'grammar',message:'Late result'}]});
 assert.equal(await pending,false);assert.equal((h.ui.record().retellReviews||[]).length,0);h.ui.destroy();
});
