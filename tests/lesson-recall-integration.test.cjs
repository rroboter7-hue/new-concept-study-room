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
test('built recall files cover every published reading and agree with exact source facts',()=>{
 const builder=require('../dev/build-lesson-recall.cjs'),lessons=builder.loadLessons();let count=0;for(let book=1;book<=4;book++){const compiled=JSON.parse(fs.readFileSync(path.join(__dirname,'../recall-data/book'+book+'.json'),'utf8')),source=JSON.parse(fs.readFileSync(path.join(__dirname,'../dev/lesson-recall-book'+book+'.json'),'utf8')),rebuilt=builder.compile(source,lessons);assert.deepEqual(compiled,rebuilt);assert.equal(compiled.lessons.length,[0,72,96,60,48][book]);for(const l of compiled.lessons){for(const q of l.questions){assert.equal(q.evidence.quote.includes('\uFFFD'),false);if(q.type==='short')for(const alias of q.answers)assert.equal(require('../lesson-recall-core.js').grade(q,alias).status,'correct');count++;}}}assert.equal(count,552);
});
