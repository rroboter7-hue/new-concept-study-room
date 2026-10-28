'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const first='nce-b2-eef57c-l001',second='nce-b2-eef57c-l002';
const options={realPipeline:true,realOutput:true,pilot:false};
async function enter(loaded={}){const h=await harness({...options,loaded:{lastLesson:second,...loaded}});await h.api.selectLesson(second);await h.api.learningPipeline.goStage(2);return h;}
async function open(h){const detail=h.document.querySelector('[data-library-disclosure]');assert(detail);detail.open=true;await h.document.dispatch('toggle',detail);await h.flush();return detail;}
test('classified library opens lazily, selects references and leaves five-sentence answers and quotas intact',async()=>{
 const h=await enter({records:{[first]:{attempts:1}}}),ui=h.api.learningPipeline;
 const field=h.document.querySelector('[data-free-answer="0"]');await h.input(field,'My existing sentence is safe.');const before=JSON.stringify(ui.writing.ensure().draft.targets),counts=ui.writing.targets().map(row=>row.requiredCount);
 await open(h);assert(h.document.querySelector('[data-library-category]'));const card=h.document.querySelector('[data-library-key]');assert(card);
 await h.click(card);assert.equal(h.document.querySelector('[data-free-answer="0"]'),field);
 assert.equal(field.value,'My existing sentence is safe.');assert.equal(JSON.stringify(ui.writing.ensure().draft.targets),before);
 assert.deepEqual(ui.writing.targets().map(row=>row.requiredCount),counts);
 const state=h.api.data.learningPipeline.lessons[second].writingLibrary;
 assert(Object.values(state.selectedByTarget).some(keys=>keys.length===1));
 const reloaded=await enter(h.stored);assert(reloaded.document.querySelector('[data-library-selected]').innerHTML.includes('这组可融合'));
});
test('explicit earlier-book learning range expands the bank without creating lesson mastery',async()=>{
 const h=await enter();await open(h);const records=JSON.stringify(h.api.data.records),range=h.document.querySelector('[data-library-range="1"]');assert(range);
 range.value='3';await h.document.dispatch('change',range);await h.flush();
 assert.equal(h.api.data.settings.learnedRange.books[1],3);assert.equal(JSON.stringify(h.api.data.records),records);
 const book=h.document.querySelector('[data-library-book]');book.value='1';await h.document.dispatch('change',book);await h.flush();
 assert.match(h.document.querySelector('[data-library-results]').innerHTML,/第1册/);
 assert.equal(h.api.backupData().settings.learnedRange.books[1],3);
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
