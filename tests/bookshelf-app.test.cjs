'use strict';
// Real app + real shelf/recall modules; geometry, audio and legacy panels are boundaries.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
function loadHarness(){
 const filename=path.join(__dirname,'support/app-harness.cjs');let source=fs.readFileSync(filename,'utf8');
 // Extend the existing boundary in memory. Production initialization and handlers stay intact.
 source=source.replace('removeAttribute(k){','hasAttribute(k){return this.getAttribute(k)!==null;}removeAttribute(k){');
 source=source.replace("const app=read('app.js'),tail=", "vm.runInContext(read('bookshelf-home.js'),c,{filename:'bookshelf-home.js'});vm.runInContext(read('sentence-revisit.js'),c,{filename:'sentence-revisit.js'});const app=read('app.js'),tail=");
 source=source.replace('get view(){return view}};', 'get view(){return view},get bookshelf(){return bookshelf},get sentenceRevisit(){return sentenceRevisit},showBookshelf,navigate,backupData};');
 source=source.replace('getAudio:async()=>null','getAudio:()=>new Promise(resolve=>{(document.audioResolves??=[]).push(resolve);})');
 const extension=new Module(filename,module);extension.filename=filename;extension.paths=module.paths;extension._compile(source,filename);return extension.exports.harness;
}
const harness=loadHarness();
const clickShelf=(h,selector)=>{const target=h.document.querySelector(selector);assert(target,'shelf target exists: '+selector);h.api.bookshelf.click({target});};

test('startup shows shelf immediately while local audio remains pending, and late audio cannot hide it',async()=>{
 const h=await harness({pilot:false});assert.equal(h.api.bookshelf.isVisible,true);assert.equal(h.document.body.classList.contains('bookshelf-visible'),true);assert(h.document.audioResolves.length>0);h.document.audioResolves[0]({type:'audio/test'});await Promise.resolve();await h.flush();assert.equal(h.api.bookshelf.isVisible,true);assert.equal(h.api.activeTab,'reading');assert.equal(h.api.data.records[h.api.current.id],undefined,'opening home does not mark a lesson read');
});
test('browse another book without navigating; choosing a lesson updates per-book continuation and preserves saved study data',async()=>{
 const h=await harness({pilot:false,loaded:{words:[{word:'theatre',meaning:'剧场'}],records:{historical:{read:true,lastReadAt:1}},custom:{kept:true}}}),home=h.api.bookshelf,start=h.api.current.id;
 clickShelf(h,'[data-shelf-book="3"]');assert.equal(h.api.current.id,start);assert.equal(home.drawerOpen,true);const next=h.c.LESSONS.find(l=>l.book===3&&l.number===2);assert(next);clickShelf(h,'[data-shelf-lesson="'+next.id+'"]');assert.equal(h.api.current.id,next.id);assert.equal(home.isVisible,false);assert.equal(home.overlay.hidden,true);assert.equal(h.api.data.shelf.lastByBook[3],next.id);assert.equal(h.stored.lastLesson,next.id);assert.equal(h.stored.words[0].word,'theatre');assert.equal(h.stored.records.historical.read,true);assert.equal(h.stored.custom.kept,true);
 h.api.showBookshelf();assert.equal(home.isVisible,true);clickShelf(h,'[data-shelf-book="3"]');assert.equal(home.resume(3).id,next.id);assert.match(home.overlay.querySelector('[data-shelf-resume-book]').innerHTML,/第2课/);
});
test('favorites persist through real storage and reload without altering learning evidence',async()=>{
 const h=await harness({pilot:false}),id=h.api.current.id,home=h.api.bookshelf,records=JSON.stringify(h.api.data.records);clickShelf(h,'[data-shelf-book="2"]');clickShelf(h,'[data-shelf-favorite="'+id+'"]');assert.equal(h.stored.shelf.favorites[id],true);assert.equal(JSON.stringify(h.api.data.records),records);const other=await harness({pilot:false,loaded:h.stored});assert.equal(other.api.bookshelf.favorites().includes(id),true);clickShelf(other,'[data-shelf-book="2"]');clickShelf(other,'[data-shelf-filter="favorites"]');assert.equal(other.api.bookshelf.favoritesOnly,true);assert.match(other.api.bookshelf.overlay.querySelector('.shelf-lesson-list').innerHTML,new RegExp(id));
});
test('home review action opens both real review flow and wrong-sentence section, and shelf return preserves it',async()=>{
 const h=await harness({pilot:false});clickShelf(h,'.shelf-review');assert.equal(h.api.view,'daily-review');assert.equal(h.api.bookshelf.isVisible,false);const panel=h.document.querySelector('#sentence-revisit-panel');assert.equal(panel.classList.contains('hidden'),false);assert.match(panel.innerHTML,/错句复习/);assert.match(panel.innerHTML,/还没有记录错句/);h.api.showBookshelf();assert.equal(h.api.bookshelf.isVisible,true);assert.equal(h.api.view,'daily-review');clickShelf(h,'.shelf-review');assert.equal(h.api.view,'daily-review');assert.equal(panel.classList.contains('hidden'),false);
});
test('confirmed sentence corrections and bookmarks are included in backup data',async()=>{
 const h=await harness({pilot:false}),lesson=h.api.current,api=h.c.StudySentenceRevisit,result=api.add(h.api.data.sentenceRevisit,{lessonId:lesson.id,lessonTitle:lesson.title,book:lesson.book,number:lesson.number,original:'He go home yesterday.',corrected:'He went home yesterday.',reason:'过去发生的动作用一般过去时。'},{now:h.now});assert.equal(result.ok,true);assert.equal(h.api.sentenceRevisit.options.saveState(result.state),true);h.api.bookshelf.options.onFavorite(lesson.id,true);const backup=h.api.backupData();assert.equal(backup.shelf.favorites[lesson.id],true);assert.equal(Object.values(backup.sentenceRevisit.entries)[0].corrected,'He went home yesterday.');assert.equal(Object.keys(h.api.data.records).length,0,'self-confirmed corrections do not award mastery');
});


test('notes link binds the chosen source sentence and returns focus to that exact reading row',async()=>{
 const h=await loadHarness()({pilot:false});const lesson=h.api.current,rows=h.c.StudyReading.units(lesson);
 h.api.setTab('usage',{sentenceIndex:2});
 assert.match(h.html(),/正在对照这句课文/);assert(h.html().includes(h.c.StudyCore.escapeHTML(rows[2].en)));
 await h.click('[data-return-reading]');
 assert.equal(h.api.activeTab,'reading');const pair=h.document.querySelector('#reader-content [data-sentence="2"]').closest('.reading-pair');
 assert(pair.classList.contains('source-anchor'));assert.equal(h.document.activeElement,pair);
});
test('note return is cleared when another lesson is selected',async()=>{
 const h=await loadHarness()({pilot:false});const old=h.c.StudyReading.units(h.api.current)[1].en;h.api.setTab('usage',{sentenceIndex:1});
 const next=h.c.LESSONS.find(l=>l.book===2&&l.number===2);h.api.selectLesson(next.id);h.api.setTab('usage');
 assert(!h.html().includes(h.c.StudyCore.escapeHTML(old)),'opening a new lesson must not retain the prior source sentence');
});
