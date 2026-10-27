'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),H=require('../mistake-history.js');
const pack={lessonId:'lesson',revision:'v2',tasks:[{id:'task',type:'choice',prompt:'Which meaning?',options:['公共的','私人的'],answer:1,rule:'private 表示私人的。',contrastExamples:[{en:'This is a private room.',zh:'这是私人房间。',sourceLabel:'自编对比例句'}]}]};
const mistake={taskId:'task',question:'Which meaning?',answer:'私人的',explanation:'旧版规则',sourceType:'authored-practice-pack'};
test('current task resolves the saved learner response, current answer and retry identity',()=>{
 const row=H.resolve('lesson',{...mistake,revision:'v2',selectedAnswer:'公共的',reason:'这里表示私人使用。'},{pack});
 assert.equal(row.status,'current-pack');assert.equal(row.answer,'私人的');assert.equal(row.selectedAnswer,'公共的');assert.equal(row.reason,'这里表示私人使用。');assert.equal(row.canRetry,true);assert.equal(row.revision,'v2');
});
test('legacy pack records without revision need exact question and answer match before gaining current retry',()=>{
 assert.equal(H.resolve('lesson',mistake,{pack}).canRetry,true);
 for(const changed of [{...mistake,question:'another question'},{...mistake,answer:'旧版答案'}])assert.equal(H.resolve('lesson',changed,{pack}).canRetry,false);
});
test('an older revision retains its own evidence and never adopts the changed current answer',()=>{
 const row=H.resolve('lesson',{...mistake,revision:'v1',answer:'旧版答案',selectedAnswer:'当时的回答'},{pack});
 assert.equal(row.status,'saved-pack');assert.equal(row.answer,'旧版答案');assert.equal(row.selectedAnswer,'当时的回答');assert.equal(row.canRetry,false);assert.match(row.sourceLabel,/作答时/);
});
test('old current-session data can recover an answer only when the same task revision matches',()=>{
 const session={revision:'v2',answers:{task:{value:0,submittedAt:123}}};
 assert.equal(H.resolve('lesson',mistake,{pack,session}).selectedAnswer,'公共的');
 assert.equal(H.resolve('lesson',mistake,{pack,session:{...session,revision:'v1'}}).selectedAnswer,'');
});
test('saved pack questions do not accidentally match legacy questions by a reused concept ID',()=>{
 const bank={hasLesson:()=>true,questionsForLesson:()=>[{conceptId:'shared',question:'unrelated',options:['WRONG'],answer:0}]};
 const row=H.resolve('lesson',{...mistake,taskId:'missing',conceptId:'shared'},{pack,bank});assert.equal(row.answer,'私人的');assert.equal(row.status,'saved-pack');
});
test('old bank and unregistered saved questions remain readable with clear provenance',()=>{
 const bank={hasLesson:()=>true,questionsForLesson:()=>[{conceptId:'grammar',question:'Choose is',options:['is','are'],answer:0,explanation:'单数主语。'}]};
 const current=H.resolve('lesson',{conceptId:'grammar',question:'Choose is',answer:'is'},{bank});assert.equal(current.status,'current-bank');assert.equal(current.answer,'is');
 const old=H.resolve('imported',{question:'Old question',answer:'saved answer'},{});assert.equal(old.status,'saved-legacy');assert.equal(old.answer,'saved answer');
 assert.equal(H.resolve('lesson',{taskId:'missing'},{}).status,'unavailable');
});
test('a reused bank concept cannot silently replace a historical question and answer',()=>{
 const bank={hasLesson:()=>true,questionsForLesson:()=>[{conceptId:'same-concept',question:'New question',options:['new answer'],answer:0}]};
 const row=H.resolve('lesson',{conceptId:'same-concept',question:'Old question',answer:'saved old answer'},{bank});
 assert.equal(row.status,'saved-legacy');assert.equal(row.question,'Old question');assert.equal(row.answer,'saved old answer');
});
