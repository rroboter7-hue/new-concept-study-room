const test=require('node:test'),assert=require('node:assert/strict'),C=require('../learning-coach-core.js');
const now=Date.parse('2026-10-27T04:00:00Z'),lesson={id:'lesson',book:2,number:1,title:'Source',hasText:true};
const make=(kind='word')=>C.ensurePlan(null,{now,lesson,candidates:{targets:[{key:'target',kind,target:kind==='word'?'private':'pay attention',meaning:'学习表达'}]},dueCards:Array.from({length:14},(_,i)=>({id:'card'+i,progress:{revision:0}}))});
const submit=(state,task,extra)=>C.record(state,{taskId:task.id,day:task.day,roundKey:task.roundKey,type:task.type,lessonId:task.lessonId,targetKey:task.targetKey,complete:true,assisted:false,...extra},{now});
test('new daily plans use ten review items while sanitizing an older three-card plan retains three',()=>{
 const r=make(),t=r.plan.tasks.find(t=>t.type==='review');assert.equal(t.cardIds.length,10);t.cardIds=t.cardIds.slice(0,3);assert.equal(C.sanitize(r.state).plans[r.plan.day].tasks.find(t=>t.type==='review').cardIds.length,3);
});
test('four-form daily tasks require four bound answers and retain their explicit mode after reload',()=>{
 const r=make(),t=r.plan.tasks.find(t=>t.type==='sentences');assert.equal(t.sentenceMode,'four-forms');assert.equal(t.requiredCount,4);
 const event={sentenceMode:'four-forms',requiredCount:4,answers:['I speak today.','I do not speak today.','Do I speak today?','When do I speak?']};
 assert.equal(submit(r.state,t,{...event,answers:event.answers.slice(0,3)}).accepted,false);
 const done=submit(r.state,t,event);assert(done.accepted);assert(C.taskStatus(C.sanitize(JSON.parse(JSON.stringify(done.state))),t).done);
 assert.equal(submit(r.state,t,{...event,sentenceMode:'phrase-writing'}).accepted,false);
});
test('phrase daily tasks accept one meaningful original sentence and reject empty text',()=>{
 const r=make('phrase'),t=r.plan.tasks.find(t=>t.type==='sentences');assert.equal(t.sentenceMode,'phrase-writing');assert.equal(t.requiredCount,1);
 assert.equal(submit(r.state,t,{sentenceMode:'phrase-writing',answers:['']}).accepted,false);
 assert.equal(submit(r.state,t,{sentenceMode:'phrase-writing',answers:{affirmative:'I pay attention to the lesson.'}}).accepted,true);
});
test('legacy five-sentence tasks cannot be completed by a new four-form event',()=>{
 const r=make(),t=r.plan.tasks.find(t=>t.type==='sentences');delete t.sentenceMode;delete t.requiredCount;delete t.requiredKinds;
 assert.equal(submit(r.state,t,{sentenceMode:'four-forms',answers:['One answer.','Two answer.','Three answer.','Four answer.']}).accepted,false);
 assert.equal(submit(r.state,t,{answers:['One answer.','Two answer.','Three answer.','Four answer.','Five answer.']}).accepted,true);
});
test('switching to another target cannot finish the daily task bound to the original target',()=>{
 const r=make(),t=r.plan.tasks.find(t=>t.type==='sentences'),event={sentenceMode:'four-forms',answers:['I speak today.','I do not speak today.','Do I speak today?','When do I speak?']};
 assert.equal(submit(r.state,t,{...event,targetKey:'next-unfinished-target'}).accepted,false);
 assert.equal(submit(r.state,t,{...event,targetKey:undefined}).accepted,false);
 const done=submit(r.state,t,event);assert(done.accepted);assert.equal(done.state.events[0].targetKey,t.targetKey);
 const changed=JSON.parse(JSON.stringify(done.state));changed.events[0].targetKey='next-unfinished-target';assert.equal(C.taskStatus(changed,t).done,false);
});
test('legacy stored five-sentence evidence without target keys survives while provided mismatches are rejected',()=>{
 const r=make(),t=r.plan.tasks.find(t=>t.type==='sentences');delete t.sentenceMode;delete t.requiredCount;delete t.requiredKinds;delete t.mode;
 const event={answers:['One answer.','Two answer.','Three answer.','Four answer.','Five answer.']};
 assert.equal(submit(r.state,t,{...event,targetKey:'other-target'}).accepted,false);
 const done=submit(r.state,t,{...event,targetKey:undefined});assert(done.accepted);assert(C.taskStatus(JSON.parse(JSON.stringify(done.state)),t).done);
});
