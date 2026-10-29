'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const options={realPipeline:true,pilot:false,realOutput:true};
test('four-entry navigation exposes unified library and profile without changing learning evidence',async()=>{
 const h=await harness(options),records=JSON.stringify(h.api.data.records);
 assert(h.document.querySelector('[data-main-entry="words"]'));
 await h.click('[data-main-entry="words"]');assert.equal(h.api.view,'words');
 assert.match(h.document.querySelector('#words-view').innerHTML,/词库|习惯用法|收藏/);
 assert(h.document.querySelector('[data-directory-query]'));
 await h.input('[data-directory-query]','get');
 await h.click('[data-main-entry="records"]');assert.equal(h.api.view,'records');
 for(const label of ['我的','备份','阅读设置','课程缓存'])assert(h.document.querySelector('#records-view').innerHTML.includes(label),label);
 await h.click('[data-main-entry="words"]');assert.equal(h.document.querySelector('[data-directory-query]').value,'get');
 assert.equal(JSON.stringify(h.api.data.records),records);
});
test('leaving writing through a main entry preserves drafts and failed storage keeps the editor',async()=>{
 const h=await harness(options);await h.api.selectLesson(h.api.current.id);await h.api.learningPipeline.goStage(2);await h.flush();
 await h.input('[data-free-answer="0"]','Keep this original sentence.');
 h.setStorageWritable(false);await h.click('[data-main-entry="words"]');assert.equal(h.api.view,'study');assert(h.document.querySelector('[data-free-answer="0"]'));
 h.setStorageWritable(true);await h.click('[data-main-entry="words"]');assert.equal(h.api.view,'words');
 await h.click('[data-main-entry="study"]');await h.click('[data-shelf-continue]');assert.equal(h.document.querySelector('[data-free-answer="0"]').value,'Keep this original sentence.');
});
