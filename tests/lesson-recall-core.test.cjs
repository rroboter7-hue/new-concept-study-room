'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'../lesson-recall-core.js'),core=fs.existsSync(file)?require(file):{};
const lesson={id:'lesson-1',book:2,number:1,title:'A journey',paragraphs:[{en:'Anna went to Rome by train. She stayed for three days.'}]};
function entry(){return {lessonId:'lesson-1',book:2,number:1,title:'A journey',bodyFingerprint:core.fingerprint?.(lesson),revision:'abc123',questions:[{id:'content-1',type:'choice',prompt:'安娜如何去罗马？',options:['乘火车','坐飞机','步行'],answer:0,explanation:'原文说明乘火车。',wrongReasons:['','并非乘飞机。','并非步行。'],evidence:{paragraphIndex:0,quote:'Anna went to Rome by train.'}},{id:'content-2',type:'short',prompt:'她停留多久？请填写天数，中文或英文均可。',answers:['three days','3 days','三天'],explanation:'原文为三天。',commonMistakes:[{answers:['two days','两天'],feedback:'是三天，并非两天。'}],evidence:{paragraphIndex:0,quote:'She stayed for three days.'}}]};}
test('recall content is rejected when source identity, text or evidence drifts',()=>{
 assert.equal(typeof core.validateEntry,'function');const e=entry();assert.equal(core.validateEntry(e,lesson).ok,true);
 for(const altered of [{...lesson,id:'other'},{...lesson,title:'Other'},{...lesson,paragraphs:[{en:'Anna flew to Rome.'}]}])assert.equal(core.validateEntry(e,altered).ok,false);
 const bad=structuredClone(e);bad.questions[0].evidence.quote='She went by bus.';assert.equal(core.validateEntry(bad,lesson).ok,false);
});
test('choice feedback identifies the selected misconception and never accepts invalid indexes',()=>{
 assert.equal(typeof core.grade,'function');const q=entry().questions[0];assert.equal(core.grade(q,0).status,'correct');const wrong=core.grade(q,'1');assert.equal(wrong.status,'incorrect');assert.equal(wrong.explanation,'并非乘飞机。');assert.equal(wrong.expected,'乘火车');assert.equal(core.grade(q,'').status,'missing');assert.equal(core.grade(q,99).status,'missing');
});
test('short facts accept explicit bilingual aliases but cannot pass from negation or keyword stuffing',()=>{
 assert.equal(typeof core.grade,'function');const q=entry().questions[1];for(const answer of ['THREE DAYS!','３ days','三天。'])assert.equal(core.grade(q,answer).status,'correct',answer);
 assert.equal(core.grade(q,'two days').status,'incorrect');assert.equal(core.grade(q,'not three days').status,'unmatched');assert.equal(core.grade(q,'three days or two days').status,'unmatched');assert.equal(core.grade(q,'I disagree that she stayed three days.').status,'unmatched');assert.equal(core.grade(q,'').status,'missing');
 assert.equal(core.grade(q,'≠ three days').status,'unmatched');assert.equal(core.grade({...q,answers:['3']},'-3').status,'unmatched');
});
test('answer changes invalidate submission and retain other lessons without trusting saved scores',()=>{
 assert.equal(typeof core.update,'function');const e=entry();let state=core.update(null,e,'content-1',0);state=core.update(state,e,'content-2','three days');const submitted=core.submit(state,e);assert.equal(submitted.accepted,true);assert.equal(submitted.results.filter(x=>x.status==='correct').length,2);
 const next=core.update(submitted.state,e,'content-2','two days');assert.equal(next.lessons[e.lessonId].submitted,false);assert.equal(next.lessons[e.lessonId].answers['content-1'],0);assert.equal(submitted.state.lessons[e.lessonId].submitted,true,'inputs are immutable');
 const other={...e,lessonId:'other'};const both=core.update(next,other,'content-1',2);assert.equal(both.lessons[e.lessonId].answers['content-2'],'two days');assert.equal(core.submit(core.update(null,e,'content-1',0),e).accepted,false);
 const changed={...e,revision:'updated'};assert.deepEqual(core.answersFor(both,changed),{});
});
test('saved recall state bounds untrusted data and never restores supplied grading claims',()=>{
 assert.equal(typeof core.sanitize,'function');const raw=JSON.parse('{"lessons":{"__proto__":{"revision":"bad"},"lesson-1":{"revision":"abc123","answers":{"content-1":0,"content-2":"three days"},"submitted":true,"score":100}}}');const saved=core.sanitize(raw);assert.equal(Object.hasOwn(saved.lessons,'__proto__'),false);assert.equal(saved.lessons['lesson-1'].score,undefined);assert.equal(saved.lessons['lesson-1'].answers['content-1'],0);assert.equal(core.grade(entry().questions[1],core.answersFor(saved,entry())['content-2']).status,'correct');
});

test('English practice asks for English before accepting Chinese aliases or mixed-language answers',()=>{
 const q={...entry().questions[1],answerLanguage:'en',answers:['three days','3 days','She stayed for three days.','三天']};
 for(const value of ['三天','three days（三天）']){const result=core.grade(q,value);assert.equal(result.status,'english-required');assert.equal(result.correct,null);assert.match(result.explanation,/英文/);}
 for(const value of ['three days','3 days','She stayed for three days.'])assert.equal(core.grade(q,value).status,'correct');
 assert.equal(core.grade({...q,answers:['3']},'3').status,'correct');
 assert.equal(core.grade(q,'not three days').status,'unmatched');
});

test('grammar grading preserves possessive and contraction apostrophes instead of accepting spaces',()=>{
 const q={...entry().questions[1],focus:'grammar',answerLanguage:'en',answers:["Tim's"]};
 assert.equal(core.grade(q,'Tim’s').status,'correct');
 assert.equal(core.grade(q,'Tim s').status,'incorrect');for(const wrong of ['Tim s','Tims'])assert.notEqual(core.grade(q,wrong).status,'correct',wrong);
 const negative={...q,answers:["I didn't enjoy it."]};assert.equal(core.grade(negative,'I didn’t enjoy it!').status,'correct');assert.notEqual(core.grade(negative,'I didn t enjoy it.').status,'correct');
});

test('non-defining clause grammar requires both commas while allowing whitespace and final punctuation variation',()=>{
 const q={...entry().questions[1],focus:'grammar',punctuation:'commas',answers:['The operation, which lasted for four hours, was difficult.']};
 for(const correct of ['The operation,which lasted for four hours,was difficult','The operation , which lasted for four hours , was difficult!'])assert.equal(core.grade(q,correct).status,'correct');
 for(const wrong of ['The operation which lasted for four hours was difficult.','The operation, which lasted for four hours was difficult.'])assert.equal(core.grade(q,wrong).status,'incorrect');
});
