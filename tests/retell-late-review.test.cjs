'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{harness}=require('./support/app-harness.cjs');
test('late retell recheck updates feedback without replacing or blurring a correction input',async()=>{
 const h=await harness({realPipeline:true,pilot:false});await h.api.selectLesson(h.api.current.id);const ui=h.api.learningPipeline;
 await ui.goStage(4);await h.input('[data-pipeline-retell]','She were late.');await ui.checkRetell();
 let finish;ui.options.checkSentence=()=>new Promise(resolve=>finish=resolve);const pending=ui.checkRetell();
 const input=h.document.querySelector('[data-pipeline-retell-correction="retry"]');input.focus();await h.input(input,'She was late.');
 finish({issues:[]});await pending;
 assert(h.document.querySelector('[data-pipeline-retell-correction="retry"]')===input,'preserve the live input element');assert(h.document.activeElement===input,'preserve focus');assert.equal(input.value,'She was late.');
});
