'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs'),Data=require('../account-data.js');
const options={realPipeline:true,pilot:false,realOutput:true};
test('actual app retell input, error history, correction, backup and account projection retain the exact learner text',async()=>{
 const h=await harness(options),lesson=h.c.LESSONS.find(row=>row.book===2&&row.number===2);
 await h.api.selectLesson(lesson.id);const ui=h.api.learningPipeline;await ui.goStage(4);await h.flush();
 await h.input('[data-pipeline-retell]','She were late， yesterday');
 await h.click('[data-pipeline-action="check-retell"]');await h.flush();
 const entry=ui.record().retellReviews[0];assert(entry);assert(entry.report.rows.some(row=>row.issues.some(issue=>issue.type==='tense')));assert(entry.report.rows.some(row=>row.issues.some(issue=>issue.type==='punctuation')));
 const before=h.document.querySelector('[data-pipeline-retell]'),retry=h.document.querySelector('[data-pipeline-retell-correction="retry"]');retry.focus();
 await h.input(retry,'She was late yesterday.');assert.equal(h.document.activeElement,retry);assert.equal(h.document.querySelector('[data-pipeline-retell]'),before);
 await h.input('[data-pipeline-retell-correction="summary"]','was，句末加句号。');
 await h.click('[data-pipeline-action="record-retell-correction"]');
 assert.equal(ui.record().retellText,'She were late， yesterday');assert(ui.record().retellReviews[0].recordedAt);
 const backup=h.api.backupData(),projection=Data.project(backup),key=JSON.stringify(['learningPipeline','lessons',lesson.id]);
 assert.equal(projection[key].retellReviews[0].retry,'She was late yesterday.');
 const restored=await harness({...options,loaded:backup});await restored.click('[data-shelf-continue]');
 assert.equal(restored.document.querySelector('[data-pipeline-retell]').value,'She were late， yesterday');assert.equal(restored.document.querySelector('[data-pipeline-retell-correction="retry"]').value,'She was late yesterday.');
 await restored.input('[data-pipeline-retell]','I am telling the story differently.');
 assert.equal(restored.document.querySelector('[data-retell-stale]').hidden,false);
 assert.equal(Object.keys(restored.api.data.records).length,0,'retelling feedback must not invent formal grades');
});
test('actual app target-name click calls the existing audio boundary and keeps its five-answer target',async()=>{
 const h=await harness(options),lesson=h.c.LESSONS.find(row=>row.book===2&&row.number===2);await h.api.selectLesson(lesson.id);const ui=h.api.learningPipeline;await ui.goStage(2);await h.flush();
 const target=ui.writing.currentTarget(),before=h.document.querySelector('[data-free-answer="0"]');
 await h.input(before,'A retained draft.');await h.click('[data-free-action="speak"]');
 assert.equal(h.audio.spoken.at(-1),target.label);assert.equal(h.document.querySelector('[data-free-answer="0"]'),before);assert.equal(before.value,'A retained draft.');assert.equal(h.document.querySelectorAll('[data-free-answer]').length,5);
});
