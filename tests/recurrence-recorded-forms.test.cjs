const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const w={};w.window=w;vm.createContext(w);vm.runInContext(fs.readFileSync(path.join(__dirname,'../recurrence.js'),'utf8'),w);
const lesson=(id,number,en,usage=[])=>({id,book:3,number,title:id,paragraphs:[{en}],usage,vocabulary:[],grammar:[]});
const usage=(matchedForm)=>({phrase:'go out of one’s way',matchedForm,meaning:'特意费力去做',example:'I '+matchedForm+' to help.'});
test('recorded phrase forms are recognized without guessing arbitrary pronouns or word gaps',()=>{
 const source=lesson('source',1,'I went out of my way to help.',[usage('went out of my way')]);
 const target=lesson('target',2,'I went out of my way to help.');
 const rows=w.StudyRecurrence.build([source,target]).forLesson('target',{studiedIds:['source']});
 assert.equal(rows.length,1);assert.equal(rows[0].label,'go out of one’s way');assert.equal(rows[0].matchedForm,'went out of my way');assert.equal(rows[0].origin.studied,true);
 const different=lesson('different',3,'We went out of their way to help.');assert.equal(w.StudyRecurrence.build([source,different]).forLesson('different').length,0);
});
test('a later introduction contributes its recorded form without leaking that form to earlier lessons',()=>{
 const early=lesson('early',1,'I went out of my way to help.',[usage('went out of my way')]);
 const before=lesson('before',2,'She went out of her way to help.');
 const later=lesson('later',3,'She went out of her way to help.',[usage('went out of her way')]);
 const after=lesson('after',4,'She went out of her way to help.');
 const index=w.StudyRecurrence.build([early,before,later,after]);
 assert.equal(index.forLesson('before').length,0,'a future form must not be attributed to an earlier origin');
 const rows=index.forLesson('after',{studiedIds:['later']});assert.equal(rows.length,1);assert.equal(rows[0].origin.lessonId,'later');assert.deepEqual(Array.from(rows[0].origins,o=>o.lessonId),['later']);
});
test('the same recorded form keeps all eligible source lessons for studied-origin selection',()=>{
 const a=lesson('a',1,'I went out of my way to help.',[usage('went out of my way')]),b=lesson('b',2,'I went out of my way to help.',[usage('went out of my way')]);
 const target=lesson('target',3,'I went out of my way to help.'),rows=w.StudyRecurrence.build([a,b,target]).forLesson('target',{studiedIds:['b']});
 assert.equal(rows.length,1);assert.equal(rows[0].origin.lessonId,'b');assert.deepEqual(Array.from(rows[0].origins,o=>o.lessonId),['a','b']);
});
test('a studied source is not hidden by an earlier occurrence of another recorded form',()=>{
 const a=lesson('a',1,'I went out of my way to help.',[usage('went out of my way')]);
 const b=lesson('b',2,'She went out of her way to help.',[usage('went out of her way')]);
 const target=lesson('target',3,'I went out of my way to help. She went out of her way to help.'),index=w.StudyRecurrence.build([a,b,target]);
 const rows=index.forLesson('target',{studiedIds:['b']});assert.equal(rows.length,1);assert.equal(rows[0].origin.lessonId,'b');assert.equal(rows[0].matchedForm,'went out of her way');assert.match(rows[0].evidence.sentence,/She went/);
 const other=index.forLesson('target',{studiedIds:['a']});assert.equal(other[0].origin.lessonId,'a');assert.match(other[0].evidence.sentence,/I went/);
});
