'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
function loadHarness(){
 const filename=path.join(__dirname,'support/app-harness.cjs');let source=fs.readFileSync(filename,'utf8');
 source=source.replace("const app=read('app.js'),tail=", "c.StudyCourseCacheClient={configureUpdate(hooks){c.courseUpdateHooks=hooks;},subscribe(fn){fn({text:'课文与练习已缓存',canApply:false});return ()=>{};},refresh(){}};const app=read('app.js'),tail=");
 source=source.replace('get view(){return view}};', 'get view(){return view},get bookshelf(){return bookshelf}};');
 const extension=new Module(filename,module);extension.filename=filename;extension.paths=module.paths;extension._compile(source,filename);return extension.exports.harness;
}
const harness=loadHarness();
test('real app only authorizes update on shelf after draft flush and invalidates guard when lesson opens',async()=>{
 const h=await harness({realPipeline:true,pilot:false,realOutput:true}),hooks=h.c.courseUpdateHooks;
 assert.equal(hooks.canApply(),true);const guard=await hooks.prepare();assert.equal(typeof guard,'function');assert.equal(guard(),true);
 await h.api.selectLesson(h.api.current.id);assert.equal(hooks.canApply(),false);assert.equal(guard(),false);
 await h.api.learningPipeline.goStage(2);await h.input('[data-free-answer="0"]','Keep this sentence through a course update.');await h.api.showBookshelf();
 const id=h.api.current.id,before=JSON.stringify(h.stored.freeWriting);assert.equal(hooks.canApply(),true);const safe=await hooks.prepare();assert.equal(safe(),true);assert.equal(JSON.stringify(h.stored.freeWriting),before);
 await h.api.selectLesson(id);assert.equal(safe(),false);assert.equal(h.document.querySelector('[data-free-answer="0"]').value,'Keep this sentence through a course update.');
});
test('open shelf drawer and pending navigation cannot authorize cache reload',async()=>{
 const h=await harness({realPipeline:true,pilot:false,realOutput:true}),hooks=h.c.courseUpdateHooks;
 await h.click('[data-shelf-book="2"]');assert.equal(hooks.canApply(),false);assert.equal(await hooks.prepare(),false);
});
