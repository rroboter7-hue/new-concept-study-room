'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Writing=require('../free-writing-practice.js');
const lesson={id:'correction',book:1,number:2,title:'Writing'};
function setup(options={}){const writes=[];const ui=new Writing({getLesson:()=>lesson,getTargets:()=>({words:[{word:'book'}]}),saveDraft:async(key,draft)=>{writes.push(structuredClone(draft));return true;},...options});const key=ui.targets()[0].key;return {ui,key,writes};}

test('correction entry marks real note content, ignores whitespace, and restores the empty state after clearing',()=>{
 const {ui,key}=setup(),row=ui.active.draft.targets[key];
 ui.editAnswer(key,0,'My original sentence.');assert.doesNotMatch(ui.correctionHTML(row,0),/has-notes|已填写/);
 ui.editCorrection(key,0,'notes','  \n ');assert.doesNotMatch(ui.correctionHTML(row,0),/has-notes|已填写/);
 for(const field of ['notes','reference','retry']){
  ui.editCorrection(key,0,field,'A real note.');assert.match(ui.correctionHTML(row,0),/has-notes/);assert.match(ui.correctionHTML(row,0),/订正记录 · 已填写/);
  ui.editCorrection(key,0,field,'');
 }
 assert.doesNotMatch(ui.correctionHTML(row,0),/has-notes|已填写/);assert.match(ui.correctionHTML(row,0),/订正记录（可选）/);
 ui.editCorrection(key,0,'notes','\n'.repeat(1300)+'A note after pasted blank lines.');assert.match(ui.correctionHTML(row,0),/订正记录 · 已填写/);
});

test('typing, reload and clearing update the note marker without replacing focused inputs or opening another row',async()=>{
 const {harness}=require('./support/app-harness.cjs'),options={realPipeline:true,pilot:false,realOutput:true};
 const h=await harness(options);await h.api.selectLesson(h.api.current.id);await h.api.learningPipeline.goStage(2);await h.flush();
 const field=h.document.querySelector('[data-free-correction="notes"][data-free-line="0"]'),answer=h.document.querySelector('[data-free-answer="0"]'),panel=h.document.querySelector('[data-free-correction-panel="0"]');
 assert(panel);panel.open=true;field.focus();await h.input(field,'Remember to use the past tense.');
 assert.equal(h.document.activeElement,field);assert.equal(h.document.querySelector('[data-free-answer="0"]'),answer);assert.equal(panel.open,true);
 assert.equal(panel.classList.contains('has-notes'),true);assert.equal(panel.querySelector('summary').textContent,'订正记录 · 已填写');
 assert.equal(h.document.querySelector('[data-free-correction-panel="1"]').classList.contains('has-notes'),false);
 await h.api.learningPipeline.flush();await h.flush();
 const reload=await harness({...options,loaded:h.stored});await reload.click('[data-shelf-continue]');await reload.flush();
 const restored=reload.document.querySelector('[data-free-correction-panel="0"]');assert.equal(restored.classList.contains('has-notes'),true);
 await reload.input('[data-free-correction="notes"][data-free-line="0"]','');assert.equal(restored.classList.contains('has-notes'),false);assert.equal(restored.querySelector('summary').textContent,'订正记录（可选）');
});

test('merged notes and remote clearing refresh the marker in place',async()=>{
 const {harness}=require('./support/app-harness.cjs'),h=await harness({pilot:false});let remoteNote='An independently saved note.';
 const {ui,key}=setup({saveDraft:async(_key,input)=>{const draft=structuredClone(input);draft.targets[key].corrections[0].notes=remoteNote;return {ok:true,draft};}});
 const host=h.document.createElement('div');h.document.body.appendChild(host);ui.mount(host);
 const note=host.querySelector('[data-free-correction="notes"][data-free-line="0"]'),panel=host.querySelector('[data-free-correction-panel="0"]');note.focus();
 ui.editAnswer(key,0,'My original book.');assert.equal(await ui.flush(),true);
 assert.equal(panel.classList.contains('has-notes'),true);assert.equal(note.value,remoteNote);assert.equal(h.document.activeElement,note);
 remoteNote='';ui.editAnswer(key,1,'Another sentence.');assert.equal(await ui.flush(),true);
 assert.equal(panel.classList.contains('has-notes'),false);assert.equal(note.value,'');assert.equal(host.querySelector('[data-free-correction="notes"][data-free-line="0"]'),note);ui.unmount();
});
test('optional correction keeps original, survives save/reload and invalidates learner status on retry edits',async()=>{
 const {ui,key,writes}=setup();ui.editAnswer(key,0,'This are my book.');
 assert.equal(ui.editCorrection(key,0,'notes','Use is.'),true);ui.editCorrection(key,0,'reference','This is my book.');ui.editCorrection(key,0,'retry','This is my book.');
 assert.equal(ui.recordCorrection(key,0),true);assert.match(ui.render(),/学习者已记录订正/);
 assert.equal(await ui.flush(),true);const saved=writes.at(-1);const restored=setup({getDrafts:()=>({[Writing.draftKey(lesson.id)]:saved})});
 assert.equal(restored.ui.active.draft.targets[key].answers[0],'This are my book.');assert.equal(restored.ui.active.draft.targets[key].corrections[0].notes,'Use is.');
 ui.editCorrection(key,0,'retry','This is a book.');assert.equal(ui.active.draft.targets[key].corrections[0].recorded,false);
 ui.editAnswer(key,0,'These are my books.');assert.equal(ui.active.draft.targets[key].corrections[0].notes,'Use is.');
 assert.match(ui.render(),/订正记录/);assert.match(ui.render(),/今日已写/);assert.match(ui.render(),/不代表整句正确或掌握/);
});
test('correction sanitization preserves historical extra rows and treats imported completion as a boolean',()=>{
 const {ui,key}=setup(),value={version:1,lessonId:lesson.id,targets:{[key]:{answers:['Original.','','','','','Extra.'],corrections:[{notes:'n',reference:'r',retry:'Retry.',recorded:'yes'},null,null,null,null,{notes:'extra'}]}}};
 const clean=Writing.sanitizeDraft(value,lesson,ui.targets());assert.equal(clean.targets[key].corrections[0].recorded,false);assert.equal(clean.targets[key].corrections[5].notes,'extra');
 const old=Writing.sanitizeDraft({version:1,lessonId:lesson.id,targets:{[key]:{answers:['Old.']}}},lesson,ui.targets());assert.equal(old.targets[key].corrections[0].notes,'');
});
test('merge combines disjoint correction fields and answers but refuses competing correction edits',()=>{
 const {ui,key}=setup();ui.editAnswer(key,0,'Original.');ui.editCorrection(key,0,'notes','Original note');const base=structuredClone(ui.active.draft),local=structuredClone(base),remote=structuredClone(base);
 local.targets[key].corrections[0].notes='Local note';remote.targets[key].answers[1]='Remote answer.';remote.targets[key].corrections[0].reference='Remote reference.';
 const merged=Writing.mergeDraft(base,local,remote);assert.equal(merged.ok,true);assert.equal(merged.draft.targets[key].corrections[0].notes,'Local note');assert.equal(merged.draft.targets[key].corrections[0].reference,'Remote reference.');assert.equal(merged.draft.targets[key].answers[1],'Remote answer.');
 remote.targets[key].corrections[0].notes='Remote note';assert.equal(Writing.mergeDraft(base,local,remote).ok,false);
});
test('stale async checks cannot return after an answer is edited away and back',async()=>{
 let release;const {ui,key}=setup({checkSentence:()=>new Promise(resolve=>{release=resolve;})});ui.editAnswer(key,0,'A book.');const check=ui.check(key);ui.editAnswer(key,0,'Another book.');ui.editAnswer(key,0,'A book.');release({issues:[]});await check;assert.equal(ui.active.draft.targets[key].feedback[0],null);
});
test('live edits and backup restore keep correction fields and counters without replacing answer input',async()=>{
 const {harness}=require('./support/app-harness.cjs');const options={realPipeline:true,pilot:false,realOutput:true};const h=await harness(options);await h.api.selectLesson(h.api.current.id);await h.api.learningPipeline.goStage(2);await h.flush();
 const writing=h.api.learningPipeline.writing,key=writing.targets()[0].key,field=h.document.querySelector('[data-free-answer="0"]');
 await h.input('[data-free-answer="0"]','My original book.');
 await h.input('[data-free-correction="notes"][data-free-line="0"]','External note.');await h.input('[data-free-correction="reference"][data-free-line="0"]','My reference book.');await h.input('[data-free-correction="retry"][data-free-line="0"]','My revised book.');
 await h.click('[data-free-action="record-correction"][data-free-line="0"]');await writing.flush();
 assert.equal(h.document.querySelector('[data-free-answer="0"]'),field);assert.match(h.document.querySelector('[data-free-target-count]').textContent,/1\/5/);assert.match(h.document.querySelector('[data-free-line-status="0"]').textContent,/学习者已记录订正/);
 const backup=JSON.parse(JSON.stringify(h.api.backupData()));h.api.restoreBackup({format:'zhixin-backup-v1',data:backup},{mode:'replace'});await h.flush();
 const restored=await harness({...options,loaded:h.stored});assert.equal(restored.api.learningPipeline.writing,null);await restored.click('[data-shelf-continue]');await restored.flush();const row=restored.api.learningPipeline.writing.active.draft.targets[key];assert.equal(row.answers[0],'My original book.');assert.deepEqual(JSON.parse(JSON.stringify(row.corrections[0])),{notes:'External note.',reference:'My reference book.',retry:'My revised book.',recorded:true});
});
test('pending saves merge newer correction input and reflect independent remote notes in live fields',async()=>{
 let release,first=true;const {ui,key}=setup({saveDraft:async(_key,input)=>{const draft=structuredClone(input);if(first){first=false;await new Promise(resolve=>{release=resolve;});draft.targets[key].corrections[0].reference='Remote reference.';}return {ok:true,draft};}});
 ui.editAnswer(key,0,'Original book.');ui.editCorrection(key,0,'notes','First note.');const saving=ui.flush();ui.editCorrection(key,0,'notes','Newer local note.');ui.editCorrection(key,0,'retry','Revised book.');release();assert.equal(await saving,true);
 assert.deepEqual(ui.active.draft.targets[key].corrections[0],{notes:'Newer local note.',reference:'Remote reference.',retry:'Revised book.',recorded:false});
});
test('statuses identify local coverage honestly and escaped external text never becomes HTML',async()=>{
 const {ui,key}=setup({checkSentence:async()=>({issues:[]})});ui.editAnswer(key,0,'My book.');assert.equal(ui.lineStatus(ui.active.draft.targets[key],0),'草稿 · 未检查');await ui.check();assert.match(ui.lineStatus(ui.active.draft.targets[key],0),/已做本地检查.*仍需复核/);
 ui.editCorrection(key,0,'notes','<img src=x onerror=alert(1)>');assert.match(ui.render(),/&lt;img/);assert.doesNotMatch(ui.render(),/<img/);assert.equal(ui.recordCorrection(key,0),false);
 ui.active.draft.targets[key].feedback[0].issues.push({message:'Review'});assert.equal(ui.lineStatus(ui.active.draft.targets[key],0),'需复核');
});

test('remote answer and fusion ABA saves invalidate pending checks while keeping live editors and correction notes',async(t)=>{
 const {harness}=require('./support/app-harness.cjs');
 for(const changed of ['answer','fusion'])await t.test(changed,async()=>{
  const h=await harness({pilot:false});let release,remoteChange=null;
  const {ui,key}=setup({getTargets:()=>({words:[{word:'book'}],phrases:[{phrase:'on time'}]}),checkSentence:()=>new Promise(resolve=>{release=resolve;}),saveDraft:async(_key,input)=>{
   const draft=structuredClone(input),row=draft.targets[key];
   if(remoteChange)remoteChange(row);return {ok:true,draft};
  }});
  const phraseKey=ui.targets().find(target=>target.kind==='phrase').key;
  const host=h.document.createElement('div');h.document.body.appendChild(host);ui.mount(host);
  ui.editAnswer(key,0,'My book.');ui.editCorrection(key,0,'notes','Keep this note.');await ui.flush();
  const checking=ui.check(key),field=host.querySelector('[data-free-answer="0"]'),noteField=host.querySelector('[data-free-correction="notes"][data-free-line="0"]');
  remoteChange=row=>{if(changed==='answer')row.answers[0]='Another book.';else row.fusion[0]=[phraseKey];};
  await h.document.input(noteField,'Keep the newer note.');assert.equal(await ui.flush(),true);
  assert.equal(host.querySelector('[data-free-answer="0"]'),field);assert.equal(host.querySelector('[data-free-correction="notes"][data-free-line="0"]'),noteField);
  assert.equal(field.value,changed==='answer'?'Another book.':'My book.');assert.equal(noteField.value,'Keep the newer note.');
  remoteChange=row=>{if(changed==='answer')row.answers[0]='My book.';else row.fusion[0]=[];};
  await h.document.input(noteField,'Keep the final note.');assert.equal(await ui.flush(),true);
  assert.equal(host.querySelector('[data-free-answer="0"]'),field);assert.equal(host.querySelector('[data-free-correction="notes"][data-free-line="0"]'),noteField);
  release({issues:[]});await checking;
  const row=ui.active.draft.targets[key];assert.equal(row.feedback[0],null,'old result must not certify the restored original selection');assert.equal(row.answers[0],'My book.');assert.deepEqual(row.fusion[0],[]);assert.equal(row.corrections[0].notes,'Keep the final note.');ui.unmount();
 });
});
