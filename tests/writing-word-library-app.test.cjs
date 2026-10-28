'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const first='nce-b2-eef57c-l001',second='nce-b2-eef57c-l002';
const options={realPipeline:true,realOutput:true,pilot:false};
async function enter(loaded={}){const h=await harness({...options,loaded:{lastLesson:second,...loaded}});await h.api.selectLesson(second);await h.api.learningPipeline.goStage(2);return h;}
async function open(h){await h.click('[data-library-action="open"]');const dialog=h.document.querySelector('[data-library-dialog]');assert(dialog?.hasAttribute('open'));return dialog;}
test('classified library opens lazily, selects references and leaves five-sentence answers and quotas intact',async()=>{
 const h=await enter({records:{[first]:{attempts:1}}}),ui=h.api.learningPipeline;
 const field=h.document.querySelector('[data-free-answer="0"]');await h.input(field,'My existing sentence is safe.');const before=JSON.stringify(ui.writing.ensure().draft.targets),counts=ui.writing.targets().map(row=>row.requiredCount);
 await open(h);assert(h.document.querySelector('[data-library-section="verb"]'));const card=h.document.querySelector('[data-library-key]');assert(card);
 await h.click(card);assert.equal(h.document.querySelector('[data-free-answer="0"]'),field);
 assert.equal(field.value,'My existing sentence is safe.');assert.equal(JSON.stringify(ui.writing.ensure().draft.targets),before);
 assert.deepEqual(ui.writing.targets().map(row=>row.requiredCount),counts);
 const state=h.api.data.learningPipeline.lessons[second].writingLibrary;
 assert(Object.values(state.selectedByTarget).some(keys=>keys.length===1));
 await h.click('[data-library-action="return"]');
 const inline=h.document.querySelector('[data-library-inline-selected]');assert(inline&&!inline.hidden);assert.match(inline.innerHTML,/参考|已选/);
 const reloaded=await enter(h.stored);assert(reloaded.document.querySelector('[data-library-inline-selected]'));assert(!reloaded.document.querySelector('[data-library-dialog]').hasAttribute('open'));
});
test('first-book and preceding lesson references are directly available without creating mastery or requiring range setup',async()=>{
 const h=await enter(),records=JSON.stringify(h.api.data.records);let entries=[];const api=h.c.StudyWritingLibrary;
 h.c.StudyWritingLibrary={...api,forLesson:(lesson,context)=>{assert.equal(context.includeEarlierLessons,true);entries=api.forLesson(lesson,context);return entries;}};
 await open(h);assert(entries.some(row=>row.category==='phrase'&&row.sources.some(source=>source.book===1)));
 assert(entries.some(row=>row.category!=='phrase'&&row.sources.some(source=>source.book===1)));
 assert(entries.some(row=>row.sources.some(source=>source.id===first)));
 assert(entries.every(row=>row.sources.every(source=>source.book<2||source.book===2&&source.number<=2)));
 await h.click('[data-library-scope="1"]');assert.match(h.document.querySelector('[data-library-overview]').innerHTML,/第1册/);
 assert.equal(JSON.stringify(h.api.data.records),records);assert.equal(h.api.data.settings.learnedRange,undefined);
 assert(!h.document.querySelector('[data-library-range]'));
});

test('key points foreground grammar and source-backed cautions while usage stays secondary',async()=>{
 const h=await enter(),ui=h.api.learningPipeline;
 ui.options.getKeyPoints=()=>({grammar:[{title:'现在进行时',summary:'am/is/are + 动词-ing。',example:'She is reading.',details:'注意不要漏掉 be。',sourceLessonId:second}],usages:[{title:'get up',summary:'起床。',category:'usage'}],pitfalls:[{text:'注意不要漏掉 be。',sourceLessonId:second}],items:[]});
 await ui.goStage(5);assert.match(h.html(),/本课语法与易错点/);assert.match(h.html(),/易错提醒/);
 assert.match(h.document.querySelector('[data-pipeline-usage-details]').innerHTML,/get up/);
 assert(!h.document.querySelector('[data-pipeline-usage-details]').hasAttribute('open'));
 assert.equal(h.document.querySelector('.pipeline-key-points').querySelectorAll('.pipeline-point').length,1);
});
test('learned earlier lessons use isolated canonical source targets in the actual library callback',async()=>{
 const h=await harness({...options,loaded:{records:{[second]:{attempts:1}}}}),third=h.c.LESSONS.find(row=>row.book===2&&row.number===3);
 let entries=[],seen=[];const api=h.c.StudyWritingLibrary;
 h.c.StudyWritingLibrary={...api,forLesson:(lesson,context)=>{assert.equal(typeof context.getWritingTargets,'function');seen=context.getWritingTargets(h.c.LESSONS.find(row=>row.id===second)).words;entries=api.forLesson(lesson,context);return entries;}};
 await h.api.selectLesson(third.id);await h.api.learningPipeline.goStage(2);await open(h);
 assert(seen.some(row=>row.word==='ring'&&row.storageLabel==='rang'));
 assert(entries.some(row=>row.label==='ring'&&row.sources.some(source=>source.id===second)));
 assert(!entries.some(row=>['rang','repeated'].includes(row.label)&&row.sources.some(source=>source.id===second)));
});
