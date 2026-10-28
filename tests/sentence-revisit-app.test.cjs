'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
// Reuse the real app harness while extending only its test module allowlist and
// test-only closure exports. No production initialization or handler is replaced.
const harnessFile=path.join(__dirname,'leo-coach-harness.cjs');
let harnessSource=fs.readFileSync(harnessFile,'utf8');
assert(harnessSource.includes("real.add('study-storage.js');"),'recognizable harness dependency boundary');
harnessSource=harnessSource.replace("real.add('study-storage.js');","real.add('sentence-revisit.js');real.add('study-storage.js');");
harnessSource=harnessSource.replace('window.__pilotApp={backupData,','window.__pilotApp={backupData,get sentenceRevisit(){return sentenceRevisit},');
const extension=new Module(harnessFile,module);extension.filename=harnessFile;extension.paths=Module._nodeModulePaths(__dirname);extension._compile(harnessSource,harnessFile);
const {harness}=extension.exports,DAY=86400000,copy=x=>JSON.parse(JSON.stringify(x));
async function capture(h,{original='He go home.',corrected='He goes home.',reason='第三人称单数。'}={}){
 h.api.sentenceRevisit.openCapture({original});
 await h.input('[data-sr-field="corrected"]',corrected);await h.input('[data-sr-field="reason"]',reason);await h.click('[data-sr-action="save"]');
}
test('real app saves a learner-confirmed correction into a separate slice without creating exercise mastery',async()=>{
 const h=await harness({pilot:false}),lesson=h.api.current,before=copy(h.api.data.records);assert(h.api.sentenceRevisit);
 await capture(h);const entries=Object.values(h.stored.sentenceRevisit.entries);assert.equal(entries.length,1);assert.equal(entries[0].lessonId,lesson.id);assert.equal(entries[0].dueAt,h.now+DAY);assert.equal(entries[0].corrected,'He goes home.');assert.deepEqual(copy(h.api.data.records),before);assert.equal(entries[0].mastered,undefined);
 const backup=h.api.backupData();assert.deepEqual(copy(backup.sentenceRevisit),copy(h.stored.sentenceRevisit));
});
test('app correction capture draft stays with its original lesson across course changes and fresh bootstrap',async()=>{
 const h=await harness({pilot:false}),first=h.api.current;h.api.sentenceRevisit.openCapture({original:'An unfinished sentence'});await h.input('[data-sr-field="corrected"]','An unfinished correction');
 const second=h.c.LESSONS.find(l=>l.book===2&&l.id!==first.id);await h.api.selectLesson(second.id);
 assert.equal(h.stored.sentenceRevisit.drafts[first.id].original,'An unfinished sentence');assert.equal(h.stored.sentenceRevisit.drafts[second.id],undefined);
 const reloaded=await harness({pilot:false,loaded:h.stored});await reloaded.api.selectLesson(first.id);reloaded.api.sentenceRevisit.openCapture();assert.equal(reloaded.document.querySelector('[data-sr-field="corrected"]').value,'An unfinished correction');
});
test('due sentence review lives in its own panel and hides the saved correction until recall reveal',async()=>{
 const h=await harness({pilot:false});await capture(h);h.setNow(h.now+DAY);await h.click('[data-view="daily-review"]');
 const panel=h.document.querySelector('#sentence-revisit-panel');assert.equal(panel.classList.contains('hidden'),false);assert.match(panel.innerHTML,/He go home\./);assert(!panel.innerHTML.includes('He goes home.'));assert.match(panel.innerHTML,/查看订正/);
 // The existing daily review can replace its own content without erasing the
 // separately mounted correction panel.
 h.api.dailyReview.render();assert.match(panel.innerHTML,/错句复习/);await h.click('[data-view="records"]');assert.equal(panel.classList.contains('hidden'),true);
});
test('backup replacement restores correction records and capture drafts, and old backups safely clear the new slice',async()=>{
 const h=await harness({pilot:false});await capture(h);const backup=h.api.backupData(),saved=copy(backup.sentenceRevisit);backup.sentenceRevisit.entries[Object.keys(saved.entries)[0]].corrected='He returns home.';
 h.api.restoreBackup({format:'zhixin-backup-v1',data:backup},{mode:'replace'});assert.equal(Object.values(h.api.data.sentenceRevisit.entries)[0].corrected,'He returns home.');
 const old=copy(backup);delete old.sentenceRevisit;h.api.restoreBackup({format:'zhixin-backup-v1',data:old},{mode:'replace'});assert.deepEqual(copy(h.api.data.sentenceRevisit),{version:1,entries:{},drafts:{}});
});
test('a storage failure keeps the capture open and does not invent a scheduled correction',async()=>{
 const h=await harness({pilot:false});h.api.sentenceRevisit.openCapture({original:'He go home.'});await h.input('[data-sr-field="corrected"]','He goes home.');h.setStorageWritable(false);await h.click('[data-sr-action="save"]');
 assert(h.api.sentenceRevisit.dialog);assert.equal(Object.keys(h.api.data.sentenceRevisit.entries).length,0);assert.match(h.document.querySelector('[data-sr-capture-status]').textContent,/暂未保存/);assert.equal(h.document.querySelector('[data-sr-field="corrected"]').value,'He goes home.');
});

test('oversized capture text is kept in its input and rejected by both draft-save and final save',async()=>{
 const h=await harness({pilot:false}),long='A'.repeat(2001);h.api.sentenceRevisit.openCapture({original:'He go home.'});await h.input('[data-sr-field="corrected"]',long);assert.equal(h.document.querySelector('[data-sr-field="corrected"]').value,long);assert.match(h.document.querySelector('[data-sr-capture-status]').textContent,/2000/);assert.equal(h.stored.sentenceRevisit.drafts[h.api.current.id],undefined);
 await h.click('[data-sr-action="save"]');assert(h.api.sentenceRevisit.dialog);assert.equal(h.document.querySelector('[data-sr-field="corrected"]').value,long);assert.match(h.document.querySelector('[data-sr-capture-status]').textContent,/2000/);assert.equal(Object.keys(h.stored.sentenceRevisit.entries).length,0);
});

test('oversized recall input is preserved with a clear error and cannot reveal or advance the review',async()=>{
 const h=await harness({pilot:false});await capture(h);h.setNow(h.now+DAY);await h.click('[data-view="daily-review"]');const id=Object.keys(h.stored.sentenceRevisit.entries)[0],long='R'.repeat(2001),before=copy(h.stored.sentenceRevisit.entries[id]);
 await h.input('[data-sr-field="recall"]',long);assert.equal(h.document.querySelector('[data-sr-field="recall"]').value,long);assert.match(h.document.querySelector('[data-sr-status]').textContent,/2000/);assert.deepEqual(copy(h.stored.sentenceRevisit.entries[id]),before);
 await h.click('[data-sr-action="reveal"]');assert.equal(h.document.querySelector('[data-sr-field="recall"]').value,long);assert.equal(h.api.sentenceRevisit.revealed.has(id),false);assert.match(h.document.querySelector('[data-sr-status]').textContent,/2000/);assert.deepEqual(copy(h.stored.sentenceRevisit.entries[id]),before);
});
