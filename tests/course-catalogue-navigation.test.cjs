'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {harness}=require('./leo-coach-harness.cjs');
const book2='nce-b2-eef57c-l020';
async function setup(){
 const h=await harness({pilot:false,realOutput:true,loaded:{lastLesson:book2,shelf:{lastByBook:{2:book2,3:'nce-b3-fa4874-l010'},favorites:{}}}});
 h.api.setTab('output');await h.input('[data-output-input="answer"]','My retelling draft stays on this page.');
 return h;
}
test('browsing another catalogue preserves the current lesson, editor node, draft and per-book continuation',async()=>{
 const h=await setup(),input=h.document.querySelector('[data-output-input="answer"]'),stored=JSON.stringify(h.stored),shelf=JSON.stringify(h.api.data.shelf),audio=h.audio.lessonChanges.length;
 h.api.mobileShell.options.selectBook(3);await h.flush();
 assert.equal(h.api.current.id,book2);assert.equal(h.api.activeTab,'output');assert.equal(h.api.mobileShell.options.getSelectedBook(),3);
 assert(h.api.filteredLessons().length>0);assert(h.api.filteredLessons().every(l=>l.book===3));
 assert.equal(h.document.querySelector('[data-output-input="answer"]'),input);assert.equal(input.value,'My retelling draft stays on this page.');
 assert.equal(JSON.stringify(h.api.data.shelf),shelf);assert.equal(JSON.stringify(h.stored),stored);assert.equal(h.audio.lessonChanges.length,audio);
});
test('cancelling a different-book catalogue restores the old catalogue without disturbing a live retelling',async()=>{
 const h=await setup(),input=h.document.querySelector('[data-output-input="answer"]'),shelf=JSON.stringify(h.api.data.shelf);
 h.api.mobileShell.options.selectBook(3);h.api.mobileShell.options.onCoursesClose(2);await h.flush();
 assert.equal(h.api.mobileShell.options.getSelectedBook(),2);assert(h.api.filteredLessons().every(l=>l.book===2));assert.equal(h.api.current.id,book2);
 assert.equal(h.document.querySelector('[data-output-input="answer"]'),input);assert.equal(JSON.stringify(h.api.data.shelf),shelf);
});
test('only choosing a specific lesson writes that book continuation and preserves the earlier book position',async()=>{
 const h=await setup(),drafts=JSON.stringify(h.api.data.outputDrafts),oldBook3=h.api.data.shelf.lastByBook[3];
 h.api.mobileShell.options.selectBook(3);assert.equal(h.api.data.shelf.lastByBook[3],oldBook3);
 const next=h.api.filteredLessons().find(l=>l.number===2);assert(next);
 const scope={document:h.document};scope.window=scope;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../mobile-learning-shell.js'),'utf8'),scope);
 const deferred=[],ui=Object.create(scope.MobileLearningShell.prototype);Object.assign(ui,{enabled:true,mobile:true,destroyed:false,drawerOpen:true,catalogueBookBefore:2,overlay:{hidden:false},body:h.document.body,header:{querySelector:()=>({setAttribute(){}})},inertBefore:new Map(),options:h.api.mobileShell.options,defer:fn=>deferred.push(fn)});
 const row=h.document.querySelector('[data-lesson="'+next.id+'"]');assert(row);ui.captureLesson({target:row});
 assert.equal(ui.drawerOpen,false);assert.equal(ui.overlay.hidden,true);assert.equal(h.api.mobileShell.options.getSelectedBook(),3,'a committed selection must not briefly restore the old catalogue');
 await h.click(row);deferred.forEach(fn=>fn());
 assert.equal(h.api.current.id,next.id);assert.equal(h.api.mobileShell.options.getSelectedBook(),3);assert.equal(h.api.data.shelf.lastByBook[3],next.id);assert.equal(h.api.data.shelf.lastByBook[2],book2);
 assert.equal(JSON.stringify(h.api.data.outputDrafts),drafts);assert.equal(h.stored.lastLesson,next.id);
});
