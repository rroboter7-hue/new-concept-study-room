'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const options={realPipeline:true,pilot:false,realOutput:true};

test('bookshelf and records explain device-local storage and expose backup and restore',async()=>{
 const h=await harness(options);
 assert.match(h.document.querySelector('.shelf-page').innerHTML,/学习记录保存在本设备/);
 await h.api.navigate('records');await h.flush();
 assert(h.document.body.classList.contains('learning-tools-active'));
 assert.match(h.document.querySelector('#records-view').innerHTML,/不会自动同步/);
 assert(h.document.querySelector('#export-backup'));
 assert(h.document.querySelector('#open-backup-restore'));
});

test('dedicated restore opens a file picker then preview without changing saved work',async()=>{
 const h=await harness(options);await h.api.navigate('records');await h.flush();
 const before=JSON.stringify(h.stored);
 await h.click('#open-backup-restore');await h.flush();
 const field=h.document.querySelector('#restore-backup-file');assert(field);
 field.files=[{text:async()=>JSON.stringify({format:'zhixin-backup-v1',data:{words:[],records:{},imported:[],settings:{}}})}];
 await h.click('#preview-restore-backup');await h.flush();
 assert(h.document.querySelector('#backup-apply'));
 assert.equal(JSON.stringify(h.stored),before);
});

test('invalid restore files stay in the dialog without modifying saved records',async()=>{
 const h=await harness(options);await h.api.navigate('records');await h.flush();const before=JSON.stringify(h.stored);
 await h.click('#open-backup-restore');
 h.document.querySelector('#restore-backup-file').files=[{text:async()=>'{bad json'}];
 await h.click('#preview-restore-backup');
 assert.match(h.document.querySelector('#restore-backup-error').textContent,/不是有效/);
 assert.equal(JSON.stringify(h.stored),before);
});

test('closing restore during file reading prevents a late preview from reopening',async()=>{
 const h=await harness(options);await h.api.navigate('records');await h.flush();await h.click('#open-backup-restore');
 let finish;h.document.querySelector('#restore-backup-file').files=[{text:()=>new Promise(resolve=>{finish=resolve;})}];
 const pending=h.click('#preview-restore-backup');await Promise.resolve();await h.click('#close-dialog');
 finish(JSON.stringify({format:'zhixin-backup-v1',data:{words:[],records:{},imported:[],settings:{}}}));await pending;
 assert.equal(h.document.querySelector('#backup-apply'),null);
});
