'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
function loadHarness(){
 const filename=path.join(__dirname,'support/app-harness.cjs');
 const source=fs.readFileSync(filename,'utf8').replace('get view(){return view}};', 'get view(){return view},get bookshelf(){return bookshelf}};');
 const extension=new Module(filename,module);extension.filename=filename;extension.paths=module.paths;extension._compile(source,filename);return extension.exports.harness;
}
const harness=loadHarness(),options={realPipeline:true,pilot:false,realOutput:true};
const visible=h=>h.document.body.classList.contains('bookshelf-visible');
const nextLesson=h=>h.c.LESSONS.find(lesson=>lesson.book===2&&lesson.number===2);
async function savedWriting(){
 const h=await harness(options);await h.api.selectLesson(h.api.current.id);await h.api.learningPipeline.goStage(2);await h.flush();
 await h.input('[data-free-answer="0"]','Continue this saved writing task.');await h.api.showBookshelf();await h.flush();return h;
}

test('a failed lesson selection keeps the real bookshelf drawer open and a successful retry commits the lesson',async()=>{
 const h=await harness(options),home=h.api.bookshelf,original=h.api.current.id,next=nextLesson(h);
 await h.click('[data-shelf-book="2"]');h.setStorageWritable(false);
 await h.click('[data-shelf-lesson="'+next.id+'"]');
 assert.equal(visible(h),true);assert.equal(home.drawerOpen,true);assert.equal(home.overlay.hidden,false);assert.equal(home.overlay.inert,false);
 assert.equal(h.api.current.id,original);assert.equal(h.api.data.appRoute.view,'shelf');assert.equal(h.audio.lessonChanges.at(-1),original);
 h.setStorageWritable(true);await h.click('[data-shelf-lesson="'+next.id+'"]');
 assert.equal(visible(h),false);assert.equal(home.overlay.hidden,true);assert.equal(h.api.current.id,next.id);
 assert.equal(h.stored.appRoute.lessonId,next.id);assert.equal(h.audio.lessonChanges.at(-1),next.id);
});

test('a failed records navigation keeps the real bookshelf available for retry',async()=>{
 const h=await harness(options);h.setStorageWritable(false);await h.click('[data-shelf-view="records"]');
 assert.equal(visible(h),true);assert.equal(h.api.data.appRoute.view,'shelf');
 h.setStorageWritable(true);await h.click('[data-shelf-view="records"]');
 assert.equal(visible(h),false);assert.equal(h.api.view,'records');assert.equal(h.stored.appRoute.view,'records');
});

test('a failed continue action preserves both the bookshelf and saved writing stage',async()=>{
 const h=await savedWriting(),id=h.api.current.id;h.setStorageWritable(false);await h.click('[data-shelf-continue]');
 assert.equal(visible(h),true);assert.equal(h.api.data.appRoute.view,'shelf');
 assert.equal(h.api.learningPipeline.record().stage,2);assert.equal(h.stored.learningPipeline.lessons[id].stage,2);
});

test('continue resumes stage two and its saved answer through the real bookshelf callback',async()=>{
 const h=await savedWriting(),id=h.api.current.id;await h.click('[data-shelf-continue]');
 assert.equal(visible(h),false);assert.equal(h.api.data.appRoute.view,'study');
 assert.equal(h.api.learningPipeline.record().stage,2);assert.equal(h.stored.learningPipeline.lessons[id].stage,2);
 assert.equal(h.document.querySelector('[data-free-answer="0"]').value,'Continue this saved writing task.');
});

test('pending lesson navigation ignores repeated navigation and favorite clicks until the committed result arrives',async()=>{
 const h=await harness(options),home=h.api.bookshelf,next=nextLesson(h);await h.click('[data-shelf-book="2"]');
 const choose=home.options.onLesson;let calls=0,release,started;
 const called=new Promise(resolve=>{started=resolve;}),ready=new Promise(resolve=>{release=resolve;});
 home.options.onLesson=id=>{calls++;started();return ready.then(()=>choose(id));};
 const target=h.document.querySelector('[data-shelf-lesson="'+next.id+'"]'),favorite=h.document.querySelector('[data-shelf-favorite="'+next.id+'"]');
 const opening=h.document.click(target);await called;
 await h.document.click(target);await h.document.click(favorite);
 assert.equal(calls,1);assert.equal(visible(h),true);assert.equal(home.drawerOpen,true);assert.equal(h.api.data.shelf.favorites[next.id],undefined);
 release();await opening;await h.flush();
 assert.equal(h.api.current.id,next.id);assert.equal(visible(h),false);assert.equal(h.api.data.shelf.favorites[next.id],undefined);
});

test('a thrown lesson callback preserves the drawer and does not block a later successful retry',async()=>{
 const h=await harness(options),home=h.api.bookshelf,next=nextLesson(h);await h.click('[data-shelf-book="2"]');
 const choose=home.options.onLesson;home.options.onLesson=()=>{throw new Error('Navigation failed');};
 await h.click('[data-shelf-lesson="'+next.id+'"]');
 assert.equal(visible(h),true);assert.equal(home.drawerOpen,true);assert.equal(home.overlay.inert,false);
 home.options.onLesson=async()=>{throw new Error('Asynchronous navigation failed');};
 await h.click('[data-shelf-lesson="'+next.id+'"]');
 assert.equal(visible(h),true);assert.equal(home.drawerOpen,true);assert.equal(home.overlay.inert,false);
 home.options.onLesson=choose;await h.click('[data-shelf-lesson="'+next.id+'"]');assert.equal(h.api.current.id,next.id);assert.equal(visible(h),false);
});

test('synchronous legacy callbacks returning no value still close the shelf after being called',async()=>{
 const h=await harness(options),home=h.api.bookshelf;let sawVisible=false;
 home.options.onContinue=()=>{sawVisible=home.isVisible;};
 home.click({target:h.document.querySelector('[data-shelf-continue]')});
 assert.equal(sawVisible,true);assert.equal(home.isVisible,false);
});
