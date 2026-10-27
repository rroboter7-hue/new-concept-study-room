const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./leo-coach-harness.cjs');
function clickFont(h,action){const root=h.document.querySelector('#reading-font-tools'),target=root.querySelector('[data-reading-font="'+action+'"]');assert(target&&!target.disabled);for(const listener of root.listeners.click||[])listener({target});}

test('lesson font controls persist the selected size across lesson changes and a fresh app bootstrap',async()=>{
 const h=await harness({pilot:false,realFont:true});
 clickFont(h,'increase');clickFont(h,'increase');
 assert.equal(h.stored.settings.readingFontPercent,120);
 assert.equal(h.document.documentElement.style.getPropertyValue('--reading-font-scale'),'1.2');
 await h.api.selectLesson(h.c.LESSONS.find(lesson=>lesson.book===4&&lesson.number===1).id);
 assert.equal(h.api.data.settings.readingFontPercent,120);
 const reloaded=await harness({pilot:false,realFont:true,loaded:h.stored});
 assert.equal(reloaded.document.documentElement.style.getPropertyValue('--reading-font-scale'),'1.2');
 clickFont(reloaded,'reset');assert.equal(reloaded.stored.settings.readingFontPercent,100);
 assert.equal(reloaded.document.documentElement.style.getPropertyValue('--reading-font-scale'),'1');
});

test('font changes report a temporary size on storage failure and restoring a backup applies its saved size',async()=>{
 const h=await harness({pilot:false,realFont:true,loaded:{settings:{readingFontPercent:120}}});
 h.setStorageWritable(false);clickFont(h,'increase');
 assert.equal(h.api.data.settings.readingFontPercent,120);
 assert.equal(h.document.documentElement.style.getPropertyValue('--reading-font-scale'),'1.3');
 assert.match(h.document.querySelector('[data-reading-font="status"]').textContent,/未保存/);
 h.setStorageWritable(true);const backup=h.api.backupData();backup.settings={...backup.settings,readingFontPercent:90};
 h.api.restoreBackup({format:'zhixin-backup-v1',data:backup},{mode:'replace'});
 assert.equal(h.document.documentElement.style.getPropertyValue('--reading-font-scale'),'0.9');
 assert.equal(h.stored.settings.readingFontPercent,90);
});
