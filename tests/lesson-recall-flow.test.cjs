'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {harness}=require('./leo-coach-harness.cjs');

async function lessonFlow(overrides={}){
 const h=await harness({pilot:false,realOutput:true});
 for(const name of ['recurrence.js','phrase-practice.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),h.c,{filename:name});
 const source=h.c.LESSONS.find(l=>l.book===3&&l.number===1),lesson=h.c.LESSONS.find(l=>l.book===3&&l.number===2);
 Object.assign(source,{vocabulary:[{word:'orchard',meaning:'果园',pos:'n.'}],usage:[{phrase:'look at',meaning:'看；注视',example:'I look at the orchard.'}],grammar:[{title:'一般现在时',knowledgeId:'present-simple'}]});
 Object.assign(lesson,{title:'A walk in the orchard',vocabulary:[],paragraphs:[{en:'I look at the orchard. We visit it every day.',zh:'我看着果园。我们每天都去。'}],usage:[{phrase:'every day',meaning:'每天',example:'We visit it every day.',exampleZh:'我们每天都去。'}],grammar:[{title:'一般现在时',knowledgeId:'present-simple',example:'We visit it every day.'}]},overrides);
 await h.api.selectLesson(lesson.id);await h.flush();
 return {h,source,lesson};
}

test('reading puts current-lesson self recall before knowledge recurrence and current expressions',async()=>{
 const {h,lesson}=await lessonFlow(),html=h.html(),recall=h.document.querySelector('.lesson-recall-section'),recurrence=h.document.querySelector('.recurrence-section'),phrases=h.document.querySelector('.lesson-phrases-section');
 assert(recall,'self recall appears after the reading');assert(recurrence,'knowledge recurrence remains available');assert(phrases,'current expressions follow recurrence');
 assert(html.indexOf('lesson-recall-section')<html.indexOf('recurrence-section'));assert(html.indexOf('recurrence-section')<html.indexOf('lesson-phrases-section'));
 assert.match(recall.innerHTML,/本课自主回顾/);assert(recall.innerHTML.includes(lesson.title));assert.equal(recall.querySelectorAll('li').length,3,'three concise prompts guide independent recall');
 assert.match(recurrence.innerHTML,/知识点复现/);assert.match(phrases.innerHTML,/习惯用法/);
});

test('automatic recurrence omits old word cards while retaining phrase and grammar provenance and review data',async()=>{
 const {h,source,lesson}=await lessonFlow(),index=h.c.StudyRecurrence.build(h.c.LESSONS),raw=index.forLesson(lesson.id,{limit:100}),before=JSON.stringify({source,lesson}),cardsBefore=JSON.stringify(h.c.StudyReview.cardsForLessons([source,lesson]));
 assert(raw.some(r=>r.kind==='vocabulary'&&r.label==='orchard'),'fixture includes a real old-word hit');
 const section=h.document.querySelector('.recurrence-section');assert(section);assert.doesNotMatch(section.innerHTML,/<strong>orchard<\/strong>/);assert.doesNotMatch(section.innerHTML,/单词 · 来源/);
 assert.match(section.innerHTML,/look at/);assert.match(section.innerHTML,/一般现在时/);assert.match(section.innerHTML,/来源第3册第1课/);
 const list=section.querySelector('details.recurrence-list');assert(list,'knowledge is available on demand');assert.equal(list.getAttribute('open'),null,'old knowledge starts closed');
 h.api.setTab('reading');assert.equal(JSON.stringify({source,lesson}),before);assert.equal(JSON.stringify(h.c.StudyReview.cardsForLessons([source,lesson])),cardsBefore,'word cards remain usable outside this presentation');
});

test('word-only and empty-usage lessons keep a compact three-step flow without a repeated word list',async()=>{
 const {h}=await lessonFlow({usage:[],grammar:[],paragraphs:[{en:'Orchard.',zh:'果园。'}]});
 const section=h.document.querySelector('.recurrence-section');assert(section);assert.match(section.innerHTML,/知识点复现/);assert.equal(section.querySelectorAll('.recurrence-row').length,0);assert.equal(section.querySelector('[id="review-prerequisites"]'),null,'no button offers an empty hidden-word exercise');
 assert(h.document.querySelector('.lesson-recall-section'));assert(h.document.querySelector('.lesson-phrases-section'));assert.doesNotMatch(h.html(),/<strong>orchard<\/strong>/);
});

test('self-recall action opens this lesson in retell mode without submitting or discarding its draft',async()=>{
 const {h,lesson}=await lessonFlow();let pauses=0;h.audio.pause=()=>{pauses++;};
 h.api.output.mode='write';await h.click('[data-lesson-recall]');assert.equal(h.api.activeTab,'output');assert.equal(h.api.output.mode,'retell','recall selects retelling instead of the previous output mode');await h.input('[data-output-input="answer"]','We walked around the orchard yesterday.');h.api.setTab('reading');
 const records=JSON.stringify(h.api.data.records),review=JSON.stringify(h.api.data.review),focusCalls=h.api.mobileShell.focusCalls;
 await h.click('[data-lesson-recall]');
 assert.equal(h.api.current.id,lesson.id);assert.equal(h.api.activeTab,'output');assert.equal(h.api.output.mode,'retell');assert.equal(h.api.output.answer,'We walked around the orchard yesterday.');assert.equal(h.document.querySelector('[data-output-input="answer"]').value,'We walked around the orchard yesterday.');
 assert(pauses>0,'audio is paused before writing');assert(h.api.mobileShell.focusCalls>focusCalls,'the writing surface is brought into view');assert.equal(JSON.stringify(h.api.data.records),records);assert.equal(JSON.stringify(h.api.data.review),review);assert.equal(h.api.output.result,null,'opening recall is not a graded submission');
});

test('current-expression action enters the existing phrase practice in the same lesson',async()=>{
 const {h,lesson}=await lessonFlow(),section=h.document.querySelector('.lesson-phrases-section');assert(section);const button=section.querySelector('[data-open-tab="phrases"]');assert(button);
 let pauses=0;h.audio.pause=()=>pauses++;const focused=h.api.mobileShell.focusCalls;
 await h.click(button);assert.equal(h.api.activeTab,'phrases');assert.equal(h.api.current.id,lesson.id);assert(h.document.querySelector('#phrase-content'));assert(pauses>0,'pause audio before phrase study');assert(h.api.mobileShell.focusCalls>focused,'show the beginning of the new learning step');
});

test('current-understanding action opens practice at the beginning and pauses playback',async()=>{
 const {h,lesson}=await lessonFlow({quiz:[{type:'comprehension',question:'Where do they go?',options:['The orchard.','The sea.'],answer:0,explanation:'They go to the orchard.'}]});let pauses=0;h.audio.pause=()=>pauses++;const focused=h.api.mobileShell.focusCalls;
 await h.click(h.document.querySelector('.lesson-recall-section').querySelector('[data-open-tab="practice"]'));
 assert.equal(h.api.activeTab,'practice');assert.equal(h.api.current.id,lesson.id);assert(pauses>0);assert(h.api.mobileShell.focusCalls>focused);assert.equal(h.document.querySelector('.reader-panel').scrollOptions.block,'start');
});

test('recall does not advertise a comprehension action when the lesson has no questions',async()=>{
 const {h}=await lessonFlow({quiz:[]});assert.equal(h.document.querySelector('.lesson-recall-section').querySelector('[data-open-tab="practice"]')===null,true,'no empty understanding-practice action');assert(h.document.querySelector('[data-lesson-recall]'),'retelling stays available without a question bank');
});

test('recall and expression previews safely render user-provided title and phrase text',async()=>{
 const {h,lesson}=await lessonFlow();lesson.title='<img src=x onerror=alert(1)> Test';lesson.usage=[{phrase:'look <at>',meaning:'看 <img src=x>',example:'Look at it.'}];h.api.setTab('reading');
 const recall=h.document.querySelector('.lesson-recall-section'),phrases=h.document.querySelector('.lesson-phrases-section');assert(recall);assert(phrases);assert.match(recall.innerHTML,/&lt;img/);assert.match(phrases.innerHTML,/&lt;at&gt;/);assert.equal(recall.querySelectorAll('img').length,0);assert.equal(phrases.querySelectorAll('img').length,0);
});

test('audio-only lessons do not show reading recall or unsupported knowledge and phrase sections',async()=>{
 const {h,lesson}=await lessonFlow();lesson.audioOnly=true;h.api.setTab('reading');assert.equal(h.document.querySelector('.lesson-recall-section'),null);assert.equal(h.document.querySelector('.recurrence-section'),null);assert.equal(h.document.querySelector('.lesson-phrases-section'),null);assert.match(h.html(),/本课音频已接入/);
});
