const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),core=require('../reading-layout.js'),scope={window:{}};vm.createContext(scope);
for(const file of ['book2-lessons.js','book2-translations.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8').split('(function(){')[0],scope);
const file=path.join(root,'book2-reading-alignment.js');if(fs.existsSync(file))vm.runInContext(fs.readFileSync(file,'utf8'),scope);
test('every one of the 96 real lessons has complete source-guarded sentence translations',()=>{
 const alignment=scope.window.BOOK2_READING_ALIGNMENT;assert.ok(alignment,'compiled reading alignment must exist');assert.equal(alignment.lessons.length,96);
 for(const source of scope.window.BOOK2_TEXTS){
  const original=scope.window.BOOK2_TRANSLATIONS.lessons.find(l=>l.number===source.number);
  const lesson={...source,id:original.lessonId};const m=core.model(lesson,alignment.lessons);
  assert.equal(m.fallbacks.length,0,'lesson '+source.number);assert.equal(m.hasAligned,true);
  assert.ok(m.rows.every(row=>row.aligned&&row.zh.trim()),'every English unit must have its own translation '+source.number);
  assert.equal(core.normalize(m.rows.map(r=>r.en).join(' ')),core.normalize(source.paragraphs.map(p=>p.en).join(' ')),'English must remain complete '+source.number);
  assert.deepEqual(m.rows.map(r=>r.index),m.rows.map((_,i)=>i));
 }
});
test('dialogue, thoughts, signs and notes are distinguished by actual context',()=>{
 const entries=scope.window.BOOK2_READING_ALIGNMENT?.lessons||[];
 const row=(n,fragment)=>entries.find(l=>l.number===n)?.paragraphs.flatMap(p=>p.rows).find(r=>r.en.includes(fragment));
 assert.equal(row(2,'What a day').kind,'thought');assert.equal(row(2,'It’s raining again').kind,'thought');
 assert.match(row(2,'What are you doing').speaker,/露西/);assert.equal(row(2,'But I\'m still having breakfast').speaker,'我');
 assert.equal(row(16,'note on my car').kind,'mixed');assert.equal(row(16,'This note is only a reminder').kind,'note');
 assert.equal(row(28,'No Parking').kind,'narration');assert.equal(row(76,'To end our special news bulletin').speaker,'电视播音员');
 assert.match(row(74,'Brinksley Meers, and my other name').speaker,/警长/);
});
test('speech audio and reading presentation share exactly the same sentence indexes',()=>{
 const browser={};browser.window=browser;vm.createContext(browser);
 for(const name of ['reading-layout.js','book2-reading-alignment.js','audio.js']){
  const p=path.join(root,name);assert.ok(fs.existsSync(p),name);vm.runInContext(fs.readFileSync(p,'utf8'),browser);
 }
 for(const source of scope.window.BOOK2_TEXTS){
  const lesson={...source,id:scope.window.BOOK2_TRANSLATIONS.lessons.find(l=>l.number===source.number).lessonId};
  const expected=browser.StudyReading.units(lesson).map(r=>r.en);
  assert.deepEqual(Array.from(browser.StudyAudio.splitSentences(lesson)),Array.from(expected),'audio/read alignment '+source.number);
 }
});
test('third and fourth book paragraphs keep all original English and never invent Chinese pairs',()=>{
 for(const book of [3,4]){
  const sourceScope={window:{}};vm.createContext(sourceScope);
  vm.runInContext(fs.readFileSync(path.join(root,'book'+book+'-lessons.js'),'utf8').split('(function(){')[0],sourceScope);
  for(const source of sourceScope.window['BOOK'+book+'_TEXTS']){
   const m=core.model({...source,id:'untranslated-'+book+'-'+source.number},[]);
   assert.ok(m.rows.every(r=>!r.zh&&!r.aligned));
   assert.equal(core.normalize(m.rows.map(r=>r.en).join(' ')),core.normalize(source.paragraphs.map(p=>p.en).join(' ')));
   assert.ok(m.rows.every(r=>/[A-Za-z]/.test(r.en)));
  }
 }
});
