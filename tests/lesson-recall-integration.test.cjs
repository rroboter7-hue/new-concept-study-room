'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./leo-coach-harness.cjs');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../recall-data/book2.json'),'utf8'));
const fetchBook=async()=>({ok:true,json:async()=>data});
test('real lesson recall answers persist independently, survive reload and travel through backup restoration',async()=>{
 const h=await harness({pilot:false,realRecall:true,recallFetch:fetchBook});await h.api.lessonRecall.ready;await h.flush();const entry=data.lessons.find(l=>l.lessonId===h.api.current.id),choice=entry.questions.find(q=>q.type==='choice'),short=entry.questions.find(q=>q.type==='short'),records=JSON.stringify(h.api.data.records),review=JSON.stringify(h.api.data.review);
 assert(h.document.querySelector('#lesson-recall-content').innerHTML.includes(choice.prompt));await h.click('[data-recall-choice="'+choice.answer+'"]');await h.input('[data-recall-input="'+short.id+'"]',short.answers[0]);await h.click('[data-recall-action="submit"]');assert.equal(h.api.data.lessonRecall.lessons[entry.lessonId].submitted,true);assert.equal(JSON.stringify(h.api.data.records),records);assert.equal(JSON.stringify(h.api.data.review),review);
 const backup=JSON.parse(JSON.stringify({data:h.api.backupData()}));assert.equal(backup.data.lessonRecall.lessons[entry.lessonId].answers[short.id],short.answers[0]);
 const restored=await harness({pilot:false,realRecall:true,recallFetch:fetchBook,loaded:h.stored});await restored.api.lessonRecall.ready;assert.match(restored.document.querySelector('#lesson-recall-content').innerHTML,/已确认 2/);await restored.h?.flush?.();
 const changed=structuredClone(backup);changed.data.lessonRecall.lessons[entry.lessonId].submitted=false;changed.data.lessonRecall.lessons[entry.lessonId].answers[short.id]='changed';restored.api.restoreBackup(changed);assert.equal(restored.api.lessonRecall.snapshot().lessons[entry.lessonId].answers[short.id],'changed');assert.doesNotMatch(restored.document.querySelector('#lesson-recall-content').innerHTML,/已确认 2/);
});

test('Book2 lesson1 checks auxiliary agreement and past negative grammar rather than story facts',async()=>{
 const h=await harness({pilot:false,realRecall:true,recallFetch:fetchBook});await h.api.lessonRecall.ready;
 await h.click('[data-recall-choice="0"]');await h.input('[data-recall-input="content-2"]','I did not enjoyed the play.');await h.click('[data-recall-action="submit"]');
 const incorrect=h.document.querySelectorAll('.recall-feedback.incorrect');assert.equal(incorrect.length,2);assert.match(incorrect[0].innerHTML,/were/);assert.match(incorrect[1].innerHTML,/动词原形/);
 await h.click('[data-recall-choice="2"]');await h.input('[data-recall-input="content-2"]',"I didn't enjoy the play.");await h.click('[data-recall-action="submit"]');assert.match(h.document.querySelector('.recall-result-summary').innerHTML,/已确认 2/);
});
test('built recall files cover every published reading and agree with exact source facts',()=>{
 const builder=require('../dev/build-lesson-recall.cjs'),lessons=builder.loadLessons();let count=0;for(let book=1;book<=4;book++){const compiled=JSON.parse(fs.readFileSync(path.join(__dirname,'../recall-data/book'+book+'.json'),'utf8')),source=JSON.parse(fs.readFileSync(path.join(__dirname,'../dev/lesson-recall-book'+book+'.json'),'utf8')),rebuilt=builder.compile(source,lessons);assert.deepEqual(compiled,rebuilt);assert.equal(compiled.lessons.length,[0,72,96,60,48][book]);for(const l of compiled.lessons){for(const q of l.questions){assert.equal(q.evidence.quote.includes('\uFFFD'),false);if(q.type==='short')for(const alias of q.answers)assert.equal(require('../lesson-recall-core.js').grade(q,alias).status,'correct');count++;}}}assert.equal(count,552);
});

test('published grammar recall requires English questions, choices and accepted short answers in every lesson',()=>{
 const han=/\p{Script=Han}/u;
 for(let book=1;book<=4;book++){
  const compiled=JSON.parse(fs.readFileSync(path.join(__dirname,'../recall-data/book'+book+'.json'),'utf8'));
  assert.equal(compiled.language,'en');
  assert.equal(compiled.scope,'grammar');
  for(const lesson of compiled.lessons)for(const q of lesson.questions){
   assert.equal(q.focus,'grammar');assert(q.grammarPoint.trim());assert(['gap-fill','transformation','correction','word-order','form-choice'].includes(q.exercise));
   assert.equal(han.test(q.prompt),false,lesson.lessonId+' prompt');
   if(q.type==='choice')for(const option of q.options)assert.equal(han.test(option),false,lesson.lessonId+' option');
   else {assert.equal(q.answerLanguage,'en');for(const answer of q.answers)assert.equal(han.test(answer),false,lesson.lessonId+' accepted answer');}
  }
 }
});

test('English compiler rejects Chinese exercise text and Chinese success aliases while keeping Chinese explanations',()=>{
 const builder=require('../dev/build-lesson-recall.cjs'),lesson=builder.loadLessons().find(l=>l.book===2&&l.number===1),source=JSON.parse(fs.readFileSync(path.join(__dirname,'../dev/lesson-recall-book2.json'),'utf8')).lessons[0];
 const batch={version:1,book:2,language:'en',scope:'grammar',lessons:[structuredClone(source)]};
 const [choice,short]=batch.lessons[0].questions;
 Object.assign(choice,{prompt:'Complete the sentence in the past continuous: They ___ talking loudly.',options:['was','are','were'],answer:2,focus:'grammar',grammarPoint:'Past continuous',exercise:'gap-fill',wrongReasons:['They 要用 were。','过去进行时用 were。','']});
 Object.assign(short,{prompt:'Change to a negative sentence (past simple): I enjoyed the play.',answers:['I did not enjoy the play.',"I didn't enjoy the play."],focus:'grammar',grammarPoint:'Past simple: negatives',exercise:'transformation'});
 const compiled=builder.compile(batch,[lesson]);assert.equal(compiled.language,'en');assert.equal(compiled.lessons[0].questions[1].answerLanguage,'en');
 for(const mutate of [b=>b.lessons[0].questions[0].prompt='中文题目',b=>b.lessons[0].questions[0].options[0]='中文选项',b=>b.lessons[0].questions[1].answers.push('剧院')]){const bad=structuredClone(batch);mutate(bad);assert.throws(()=>builder.compile(bad,[lesson]),/English/);}
 const nonGrammar=structuredClone(batch);delete nonGrammar.lessons[0].questions[0].grammarPoint;assert.throws(()=>builder.compile(nonGrammar,[lesson]),/grammar/);
});
