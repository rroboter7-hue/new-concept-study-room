'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const plain=html=>String(html).replace(/<[^>]+>/g,'').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
function defaultHTML(html){let depth=0,result='';for(const token of html.match(/<\/?details\b[^>]*>|[^<]+|<[^>]+>/g)||[]){if(/^<details\b/i.test(token)){depth++;continue;}if(/^<\/details/i.test(token)){depth--;continue;}if(!depth)result+=token;}return result;}

test('Book2 lesson1 notes default to concise source grammar and examples; quiz lectures stay closed',async()=>{
 const h=await harness({pilot:false}),lesson=h.c.LESSONS.find(l=>l.book===2&&l.number===1);await h.api.selectLesson(lesson.id);const before=JSON.stringify(h.c.StudyKnowledge.bank.questionsForLesson(lesson.id)),html=h.api.renderUsage(),visible=defaultHTML(html),text=plain(visible);
 assert.match(visible,/一般过去时/);assert.match(visible,/过去进行时/);assert.match(visible,/could not/);assert.match(text,/Last week I went to the theatre/);assert.match(text,/They were talking loudly/);assert.doesNotMatch(visible,/【自编句型转换】|正确形式|“could”：|“must”：|【自编语法审核】/);assert.doesNotMatch(visible,/How ___ you bear that noise/);assert.match(html,/展开详细讲解/);assert.match(html,/How ___ you bear that noise/);assert.match(html,/改成 could 会改变原句/);assert((visible.match(/notes-core-card/g)||[]).length<=3);assert.equal(JSON.stringify(h.c.StudyKnowledge.bank.questionsForLesson(lesson.id)),before);
});
test('reviewed source grammar keeps essential caveats and original provenance accessible without duplicate quiz prompts',async()=>{
 const h=await harness({pilot:false}),lesson=h.c.LESSONS.find(l=>l.book===2&&l.number===29);await h.api.selectLesson(lesson.id);const rows=h.c.StudyReviewedUsage.grammarNotesFor(lesson),html=h.api.renderUsage(),visible=defaultHTML(html),text=plain(visible);
 assert.match(visible,/过去分词/);assert.match(text,/fallen leaves/);assert.match(visible,/不把全部过去分词机械解释成被动/);for(const row of rows){assert(html.includes(h.c.StudyCore.escapeHTML(row.note)));assert(plain(html).includes(row.example));}assert.match(html,/第 127 页/);assert.doesNotMatch(visible,/正确形式|【自编句型转换】/);assert.match(html,/reviewed-grammar-card/);
});
test('lessons outside reviewed question bank retain their supplied grammar, usage and vocabulary',async()=>{
 const h=await harness({pilot:false}),lesson=h.c.LESSONS.find(l=>l.book===3&&l.number===1);assert.equal(h.c.StudyKnowledge.bank.hasLesson(lesson.id),false);await h.api.selectLesson(lesson.id);const before=JSON.stringify(lesson),html=h.api.renderUsage();assert.match(html,/情态动词/);assert.match(html,/at large/);assert.match(html,/puma/);assert(plain(html).includes(lesson.grammar[0].example));assert.equal(JSON.stringify(lesson),before);
});
test('repeated phrase entries render once and long contextual usage notes remain available',async()=>{
 const h=await harness({pilot:false}),lesson=h.c.LESSONS.find(l=>l.book===2&&l.number===1);await h.api.selectLesson(lesson.id);const copy={...lesson.usage[0],note:'这是限定语境的第一句。只有在明确说明过去时间时才采用本例的过去式。后面的补充说明仍需能展开查看。'.repeat(3)};lesson.usage=[copy,{...copy},...lesson.usage.slice(1)];const html=h.api.renderUsage();assert.equal((html.match(/class="usage-card notes-usage-card"/g)||[]).length,new Set(lesson.usage.map(u=>u.phrase.toLowerCase().trim())).size);assert(html.includes(h.c.StudyCore.escapeHTML(copy.note)));assert.match(html,/展开用法说明/);
});

test('provided-note fallback preserves key points and escapes their text',async()=>{
 const h=await harness({pilot:false}),lesson=h.c.LESSONS.find(l=>l.book===3&&l.number===1);await h.api.selectLesson(lesson.id);lesson.grammar=[];lesson.keyPoints=['只有给出过去的时间背景时，才按该背景选用过去时。','<img src=x onerror="bad()">'];const html=h.api.renderUsage();assert.match(html,/只有给出过去的时间背景/);assert.match(html,/查看原资料要点/);assert(!html.includes('<img src=x'));assert.match(html,/&lt;img/);
});
test('same phrase with distinct senses remains separate and every same-concept question stays available',async()=>{
 const h=await harness({pilot:false}),lesson=h.c.LESSONS.find(l=>l.book===3&&l.number===1);await h.api.selectLesson(lesson.id);lesson.usage=[{phrase:'take off',meaning:'脱下',note:'接衣物。',example:'Take off your coat.'},{phrase:'take off',meaning:'起飞',note:'飞机离地。',example:'The plane took off.'}];const bank=h.c.StudyKnowledge.bank,oldHas=bank.hasLesson,oldQuestions=bank.questionsForLesson;
 const questions=[{type:'grammar',conceptId:'same-rule',rule:'第一条条件。',question:'First question kept?',options:['yes','no'],answer:0,explanation:'First explanation.'},{type:'grammar',conceptId:'same-rule',rule:'第二条条件。',question:'Second question kept?',options:['yes','no'],answer:1,explanation:'Second explanation.'}];bank.hasLesson=()=>true;bank.questionsForLesson=()=>questions;const html=h.api.renderUsage(),text=plain(html);assert.equal((html.match(/class="usage-card notes-usage-card"/g)||[]).length,2);assert.match(text,/脱下/);assert.match(text,/起飞/);assert.match(text,/First question kept/);assert.match(text,/Second question kept/);assert.match(text,/Second explanation/);bank.hasLesson=oldHas;bank.questionsForLesson=oldQuestions;
});
test('same-titled source notes keep distinct conditions and examples; long essential caution is never truncated',async()=>{
 const h=await harness({pilot:false}),lesson=h.c.LESSONS.find(l=>l.book===3&&l.number===1);await h.api.selectLesson(lesson.id);const warning='不能把这里的语法条件省略：'+('必须先有明确语境，再按实际的时态和主语作判断；').repeat(5)+'这条限制需要完整保留。';lesson.grammar=[{title:'同一标题',note:'第一条核心规则。'+warning,example:'He was reading.'},{title:'同一标题',note:'第二条独立条件也必须保留。',example:'They were reading.'}];const html=h.api.renderUsage(),shown=plain(defaultHTML(html)),all=plain(html);assert(shown.includes(warning));assert.match(all,/第二条独立条件/);assert.match(all,/They were reading/);
});
