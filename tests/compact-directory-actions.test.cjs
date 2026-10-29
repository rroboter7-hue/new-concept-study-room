'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const options={realPipeline:true,pilot:false,realOutput:true};

test('compact word actions identify their word, speak it and preserve evidence when saved',async()=>{
 const h=await harness(options);await h.click('[data-main-entry="words"]');
 const first=h.document.querySelector('[data-directory-save]'),key=first.dataset.directorySave;
 const speak=h.document.querySelector('.entry-word-card [data-speak]'),word=speak.dataset.speak;
 assert.equal(first.getAttribute('aria-label'),'收藏 '+word);
 const records=JSON.stringify(h.api.data.records);
 await h.click(speak);assert.equal(h.audio.spoken.at(-1),word);
 await h.click(first);
 const saved=h.document.querySelectorAll('[data-directory-save]').find(button=>button.dataset.directorySave===key);
 assert.equal(saved.getAttribute('aria-pressed'),'true');assert.equal(saved.getAttribute('aria-label'),'取消收藏 '+word);
 assert.equal(h.api.data.words.find(row=>row.word===word).mastered,false);
 assert.equal(JSON.stringify(h.api.data.records),records);
 await h.click(saved);assert(!h.api.data.words.some(row=>row.word===word));
});

test('compact favorites keep full notes and meanings while a failed save remains visibly unsaved',async()=>{
 const h=await harness({...options,loaded:{words:[{word:'handbag',meaning:'手提包',note:'My complete note.',mastered:false}]}});
 await h.click('[data-main-entry="words"]');
 const saved=h.document.querySelectorAll('[data-directory-save]').find(button=>button.getAttribute('aria-label')==='取消收藏 handbag');assert(saved);
 assert.match(h.document.querySelector('.entry-saved-details').innerHTML,/My complete note\.|手提包/);
 const target=h.document.querySelectorAll('[data-directory-save]').find(button=>button.getAttribute('aria-pressed')==='false');
 h.setStorageWritable(false);await h.click(target);
 assert.equal(target.getAttribute('aria-pressed'),'false');assert.equal(h.api.data.words.length,1);
});
