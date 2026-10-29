'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const options={realPipeline:true,pilot:false,realOutput:true};
test('four-entry navigation exposes unified library and profile without changing learning evidence',async()=>{
 const h=await harness(options),records=JSON.stringify(h.api.data.records);
 assert(h.document.querySelector('[data-main-entry="words"]'));
 await h.click('[data-main-entry="words"]');assert.equal(h.api.view,'words');
 assert.match(h.document.querySelector('#words-view').innerHTML,/词库|习惯用法|收藏/);
 assert.equal(h.document.querySelector('[data-directory-query]'),null,'the global directory has no search field');
 const category=h.document.querySelector('[data-directory-filter="category"]');category.value='verb';await h.document.dispatch('change',category);await h.flush();
 await h.click('[data-main-entry="records"]');assert.equal(h.api.view,'records');
 for(const label of ['我的','备份','阅读设置','课程缓存'])assert(h.document.querySelector('#records-view').innerHTML.includes(label),label);
 await h.click('[data-main-entry="words"]');assert(h.document.querySelector('[data-directory-filter="category"]').querySelector('[value="verb"][selected]'));
 assert.equal(JSON.stringify(h.api.data.records),records);
});
test('leaving writing through a main entry preserves drafts and failed storage keeps the editor',async()=>{
 const h=await harness(options);await h.api.selectLesson(h.api.current.id);await h.api.learningPipeline.goStage(2);await h.flush();
 await h.input('[data-free-answer="0"]','Keep this original sentence.');
 h.setStorageWritable(false);await h.click('[data-main-entry="words"]');assert.equal(h.api.view,'study');assert(h.document.querySelector('[data-free-answer="0"]'));
 h.setStorageWritable(true);await h.click('[data-main-entry="words"]');assert.equal(h.api.view,'words');
 await h.click('[data-main-entry="study"]');assert.match(h.document.querySelector('[data-shelf-resume-progress]').textContent,/自由造句/);await h.click('[data-shelf-continue]');assert.equal(h.document.querySelector('[data-free-answer="0"]').value,'Keep this original sentence.');
});
test('normal review tab returns retain filters and the same pending session, including a study detour',async()=>{
 const h=await harness(options),review=h.api.dailyReview;let clears=0;review.clearFilters=()=>{clears++;};
 await h.click('[data-main-entry="daily-review"]');review.kind='phrase';review.input='My pending recall.';
 await h.click('[data-main-entry="records"]');await h.click('[data-main-entry="daily-review"]');
 assert.equal(clears,0);assert.equal(review.kind,'phrase');assert.equal(review.input,'My pending recall.');
 await h.click('[data-main-entry="study"]');await h.click('[data-shelf-continue]');await h.click('[data-main-entry="daily-review"]');assert.equal(clears,0);
});
test('entry scroll position returns without changing learning records',async()=>{
 const h=await harness(options);h.c.scrollTo=options=>{h.c.scrollY=options.top;};await h.click('[data-main-entry="words"]');h.c.scrollY=460;
 await h.click('[data-main-entry="records"]');await h.click('[data-main-entry="words"]');assert.equal(h.c.scrollY,460);
 h.c.scrollY=720;await h.click('[data-main-entry="study"]');await h.click('[data-main-entry="words"]');assert.equal(h.c.scrollY,720);
});
test('continuing the same study stage restores its position without applying it to a different lesson',async()=>{
 const h=await harness(options);h.c.scrollTo=options=>{h.c.scrollY=options.top;};await h.click('[data-shelf-continue]');h.c.scrollY=640;
 await h.click('[data-main-entry="words"]');await h.click('[data-main-entry="study"]');await h.click('[data-shelf-continue]');assert.equal(h.c.scrollY,640);
 const other=h.c.LESSONS.find(row=>row.book===2&&row.id!==h.api.current.id);h.c.scrollY=170;await h.api.selectLesson(other.id,{preserveReview:true});await h.flush();assert.notEqual(h.c.scrollY,640);
});
