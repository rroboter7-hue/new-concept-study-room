'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=fs.existsSync(require.resolve('../core.js').replace(/core\.js$/,'mixed-review-core.js'))?require('../mixed-review-core.js'):{};
const NOW=1800000000000,lesson={id:'b2-l1',book:2,number:1,title:'A lesson'};
const item=(kind,i,extra={})=>({key:kind+':'+i,revision:'v1',kind,title:kind+' '+i,concept:kind+':'+i,sourceAt:0,...extra});
test('mixed groups share one ten-item budget with four mistakes, four usages and two corrections',()=>{
 const rows=['mistake','phrase','correction'].flatMap(kind=>Array.from({length:15},(_,i)=>item(kind,i))),group=C.plan(rows,{now:NOW});
 assert.equal(group.length,10);assert.deepEqual(['mistake','phrase','correction'].map(k=>group.filter(r=>r.kind===k).length),[4,4,2]);
 assert.deepEqual(group.slice(0,3).map(row=>row.kind),['mistake','phrase','correction']);
});
test('uneven pools fill the group without fabricating errors; wrong-only never includes other types',()=>{
 const rows=[item('mistake',0),...Array.from({length:13},(_,i)=>item('phrase',i))];
 assert.equal(C.plan(rows,{now:NOW}).length,10);assert.equal(C.plan(rows,{now:NOW,mode:'mistakes'}).length,1);assert.deepEqual(C.plan([]),[]);
});
test('same knowledge counts once, repeated mistakes rank first and future local retests wait',()=>{
 const rows=[item('mistake',1,{wrongCount:1}),item('mistake',2,{wrongCount:4}),item('phrase',3,{concept:'mistake:2'})];
 let group=C.plan(rows,{now:NOW});assert.equal(group.length,2);assert.equal(group[0].key,'mistake:2');
 const s=C.complete(C.begin({},group,{now:NOW}),group[0],{status:'correct',answer:'Answer',independent:true},{now:NOW});assert(s.accepted);
 assert.equal(C.plan(rows,{now:NOW,state:s.state}).length,1);
 assert(C.plan(rows.map(r=>r.key===group[0].key?{...r,sourceAt:NOW+1}:r),{now:NOW+1,state:s.state}).some(r=>r.key===group[0].key));
});
test('session snapshots and input survive serialization without changing source scores',()=>{
 const row=item('phrase',1),s=C.begin({},[row],{now:NOW}),before=JSON.stringify(s);
 const next=C.saveDraft(s,row,{input:'My own sentence.',mode:'writing',assisted:true},{now:NOW+1});
 assert.equal(JSON.stringify(s),before);assert.equal(C.draft(JSON.parse(JSON.stringify(next)),row).input,'My own sentence.');
 assert.equal(C.active(next,[{...row,revision:'changed'}]).stale,true);
 assert.equal(C.complete(next,{...row,revision:'changed'},{status:'correct',answer:'x',independent:true},{now:NOW}).accepted,false);
});
test('help and self checking cannot become independent-correct evidence or duplicate completion',()=>{
 const row=item('mistake',1),s=C.saveDraft(C.begin({},[row],{now:NOW}),row,{input:'Answer',assisted:true,checked:true},{now:NOW});
 assert.equal(C.complete(s,row,{status:'correct',answer:'Answer',independent:true},{now:NOW}).accepted,false);
 const result=C.complete(s,row,{status:'corrected',answer:'Answer'},{now:NOW});assert(result.accepted);assert(result.state.history[row.key].nextDueAt>NOW);
 assert.equal(C.complete(result.state,row,{status:'corrected',answer:'Answer'},{now:NOW}).accepted,false);
});
test('only matching current historical question versions can be retried',()=>{
 const q={id:'q1',question:'She ___ every day.',options:['walk','walks'],answer:1,explanation:'第三人称单数。'};
 const opts={lessons:[lesson],pipeline:{lessons:{[lesson.id]:{mistakes:{q1:{question:q,wrongCount:3,lastAt:NOW,lastCorrect:false}}}}},getQuestions:()=>[q],now:NOW};
 const rows=C.collect(opts);assert.equal(rows.length,1);assert.equal(rows[0].q.answer,1);
 assert.equal(C.collect({...opts,getQuestions:()=>[{...q,answer:0}]}).length,0);
 assert.equal(C.collect({...opts,getQuestions:()=>[{...q,options:['walks','walks']}]}).length,0);
});
test('only enrolled due cards and due confirmed corrections from existing lessons are eligible',()=>{
 const cards=[{id:'r1',kind:'phrase',target:'get angry',prompt:'生气',sourceLesson:lesson},{id:'r2',kind:'word',target:'book',prompt:'书',sourceLesson:lesson}];
 const options={lessons:[lesson],cards,review:{cards:{r1:{dueAt:NOW,revision:0},r2:{dueAt:NOW+1,revision:0}}},sentences:{entries:{'sr:x':{id:'sr:x',lessonId:lesson.id,original:'He go.',corrected:'He goes.',dueAt:NOW,updatedAt:NOW}}},now:NOW};
 assert.deepEqual(C.collect(options).map(r=>r.kind),['phrase','correction']);
 assert.equal(C.collect({...options,lessons:[]}).length,0);
});
test('immediate correction practice keeps the independent delayed-retest history unchanged',()=>{
 const row=item('mistake',1),original=C.complete(C.begin({},[row],{now:NOW}),row,{status:'retry',answer:'Wrong'},{now:NOW}).state;
 const practice=C.begin(original,[row],{now:NOW+1,practice:true}),result=C.complete(practice,row,{status:'corrected',answer:'Correct'},{now:NOW+2});
 assert(result.accepted);assert.deepEqual(result.state.history,original.history);assert.equal(result.state.session.practice,true);
});
test('an earlier lesson mistake captured in a later lesson resolves against its true source',()=>{
 const earlier={...lesson,id:'b1-l9',book:1,number:9},q={id:'old-q',question:'He ___ a teacher.',options:['is','are'],answer:0,pipeline:{sourceLessonId:earlier.id}};
 const rows=C.collect({lessons:[lesson,earlier],pipeline:{lessons:{[lesson.id]:{mistakes:{'old-q':{question:q,wrongCount:1}}}}},getQuestions:id=>id===earlier.id?[q]:[],now:NOW});
 assert.equal(rows.length,1);assert.equal(rows[0].sourceLesson.id,earlier.id);
});
test('completed review preserves the attempted answer and repeat errors affect future priority',()=>{
 const row=item('mistake',1),s=C.saveDraft(C.begin({},[row],{now:NOW}),row,{input:'wrong',firstAnswer:'first wrong',checked:true,assisted:true},{now:NOW}),next=C.complete(s,row,{status:'retry',answer:'wrong'},{now:NOW}).state;
 assert.equal(next.history[row.key].answer,'wrong');assert.equal(next.history[row.key].firstAnswer,'first wrong');assert.equal(next.history[row.key].lapses,1);
 const nextRows=C.plan([item('mistake',0),row],{state:next,now:NOW+600001});assert.equal(nextRows[0].key,row.key);
});
test('explicit shared knowledge IDs deduplicate different questions without conflating unrelated same-stem tasks',()=>{
 const a={id:'a',question:'She ___ every day.',options:['walk','walks'],answer:1,conceptId:'third-person'},b={id:'b',question:'He ___ every day.',options:['go','goes'],answer:1,conceptId:'third-person'};
 const opts=questions=>({lessons:[lesson],pipeline:{lessons:{[lesson.id]:{mistakes:Object.fromEntries(questions.map(q=>[q.id,{question:q,wrongCount:1}]))}}},getQuestions:()=>questions,now:NOW});
 assert.equal(C.plan(C.collect(opts([a,b]))).length,1);
 const other={...b,question:a.question,conceptId:''};assert.equal(C.plan(C.collect(opts([{...a,conceptId:''},other]))).length,2);
});
test('a historical vocabulary mistake and its enrolled recall card share one knowledge slot',()=>{
 const conceptId='knowledge:b2-l1:word:private',q={id:'private-q',question:'private 在本课中的意思是？',options:['私人的','公开的'],answer:0,conceptId};
 const rows=C.collect({lessons:[lesson],pipeline:{lessons:{[lesson.id]:{mistakes:{[q.id]:{question:q,wrongCount:1}}}}},getQuestions:()=>[q],cards:[{id:'private',kind:'word',target:'private',prompt:'私人的',conceptId,sourceLesson:lesson}],review:{cards:{private:{dueAt:NOW,revision:0}}},now:NOW});
 assert.equal(rows.length,2);assert.equal(C.plan(rows,{now:NOW}).length,1);assert.equal(C.plan(rows,{now:NOW})[0].kind,'mistake');
});
