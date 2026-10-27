'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./leo-coach-harness.cjs');
test('actual app excludes the unglossed lesson-one expression and retains independently glossed phrases',async()=>{const h=await harness({pilot:false,realCoach:true}),lesson=h.api.current;assert(lesson.usage.some(x=>x.phrase==='Is the seat taken?'&&x.meaning.includes('未附独立中文释义')),'source placeholder remains available to manual study');const rows=h.api.coachCandidates(lesson).targets;assert(!rows.some(x=>x.target==='Is the seat taken?'));assert(rows.some(x=>x.target==='pay attention'&&x.kind==='phrase'&&x.meaning==='注意；留心'));assert(rows.some(x=>x.target==='private'&&x.kind==='word'));});
test('empty, placeholder and missing-Chinese word/phrase meanings cannot enter a daily plan',async()=>{
 const h=await harness({pilot:false,realCoach:true}),lesson=h.api.current;
 lesson.vocabulary=[{word:'emptyword',meaning:''},{word:'placeholderword',meaning:'占位释义'},{word:'missingword',meaning:'未提供中文释义'},{word:'englishonly',meaning:'an English definition'}];
 lesson.usage=[{phrase:'empty phrase',meaning:' '},{phrase:'missing phrase',meaning:'原笔记习惯表达（未附独立中文释义）'},{phrase:'placeholder phrase',meaning:'占位释义，待完善'},{phrase:'pay attention',meaning:'注意；留心'}];
 // Inject the same invalid rows at the canonical provider used by both editors
 // and daily tasks; modifying only lesson.vocabulary leaves reviewed rows valid.
 h.c.StudyKnowledge={...h.c.StudyKnowledge,bank:{...h.c.StudyKnowledge.bank,vocabularyForLesson:()=>lesson.vocabulary}};
 const candidates=h.api.coachCandidates(lesson);assert.deepEqual(Array.from(candidates.targets,x=>x.target),['pay attention']);
 const result=h.c.StudyCoach.ensurePlan(h.api.data.coach,{now:h.now,reset:true,lesson:{...lesson,hasText:true},candidates,dueCards:[]}),task=result.plan.tasks.find(t=>t.type==='sentences');assert.equal(task.target,'pay attention');assert.equal(task.kind,'phrase');
});
