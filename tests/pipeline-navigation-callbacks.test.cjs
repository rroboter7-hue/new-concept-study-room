'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
async function enterWriting(){
 const h=await harness({realPipeline:true,pilot:false,realOutput:true});await h.api.selectLesson(h.api.current.id);await h.flush();
 await h.api.learningPipeline.goStage(2);await h.flush();return h;
}
const exits=[{method:'shelf',callback:'onShelf'},{method:'selectNextLesson',callback:'onSelectLesson'},{method:'finish',callback:'onShelf'}];

for(const {method,callback} of exits)test(method+' keeps the original input live until navigation succeeds and returns a rejected navigation',async()=>{
 const h=await enterWriting(),ui=h.api.learningPipeline,input=h.document.querySelector('[data-free-answer="0"]');assert(input);
 const writing=ui.writing,entry=writing.active,key=entry.draft.activeTargetKey;
 let release,started;const called=new Promise(resolve=>{started=resolve;});
 ui.options[callback]=()=>{started();return new Promise(resolve=>{release=resolve;});};
 const navigation=ui[method]();await called;
 await h.input(input,'Written while navigation is still pending.');
 assert.equal(entry.draft.targets[key].answers[0],'Written while navigation is still pending.');
 release(false);assert.equal(await navigation,false);
 assert.equal(h.document.querySelector('[data-free-answer="0"]'),input);
 await h.input(input,'Written after navigation was cancelled.');
 assert.equal(entry.draft.targets[key].answers[0],'Written after navigation was cancelled.');
 assert.equal(h.stored.freeWriting[entry.key].targets[key].answers[0],'Written after navigation was cancelled.');
});

test('the real shelf route save failure leaves the original writing listeners usable before a successful retry',async()=>{
 const h=await enterWriting(),ui=h.api.learningPipeline,input=h.document.querySelector('[data-free-answer="0"]');assert(input);
 const entry=ui.writing.active,key=entry.draft.activeTargetKey,onShelf=ui.options.onShelf;
 await h.input(input,'Saved before trying the bookshelf.');
 ui.options.onShelf=()=>{h.setStorageWritable(false);return onShelf();};
 assert.equal(await ui.shelf(),false);assert.equal(h.api.data.appRoute.view,'study');
 assert.equal(h.document.querySelector('[data-free-answer="0"]'),input);
 h.setStorageWritable(true);await h.input(input,'This edit after the failed route must be saved.');
 assert.equal(h.stored.freeWriting[entry.key].targets[key].answers[0],'This edit after the failed route must be saved.');
 ui.options.onShelf=onShelf;assert.equal(await ui.shelf(),true);
 assert.equal(h.api.data.appRoute.view,'shelf');assert.equal(h.document.body.classList.contains('bookshelf-visible'),true);
});

test('legacy navigation callbacks that return no value still succeed',async()=>{
 const h=await enterWriting(),ui=h.api.learningPipeline;
 ui.options.onShelf=()=>{};ui.options.onSelectLesson=()=>{};
 assert.equal(await ui.shelf(),true);assert.equal(await ui.selectNextLesson(),true);assert.equal(await ui.finish(),true);
});
