'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./leo-coach-harness.cjs');
const lessonId='nce-b2-eef57c-l001';
const boot=loaded=>harness({pilot:false,realCoach:true,realReview:true,realOutput:true,loaded:loaded||{lastLesson:lessonId,records:{[lessonId]:{completed:true}}}});
async function reviewClick(h,action,value){
 const node=h.document.all().find(n=>n.dataset.reviewAction===action&&(value===undefined||n.dataset.reviewOption===String(value)||n.dataset.reviewRating===value));assert(node,'real review control '+action);assert.equal(node.disabled,false);
 for(const fn of h.document.querySelector('#daily-review-view').listeners.click||[])await fn({target:node});await h.flush();
}
async function answerCorrectly(h){const c=h.api.dailyReview.active;assert(c);if(c.kind==='grammar')await reviewClick(h,'choice',c.options.indexOf(c.target));else {const node=h.document.querySelector('[data-review-input]');assert(node);node.value=c.target;for(const fn of h.document.querySelector('#daily-review-view').listeners.input||[])await fn({target:node});await h.flush();}await reviewClick(h,'check');return c;}
test('the real app keeps an ungraded answer and checked feedback on a view detour and refresh',async()=>{
 const h=await boot();await h.click('[data-view="daily-review"]');const c=await answerCorrectly(h),ui=h.api.dailyReview;assert.equal(ui.feedback.correct,true);assert.equal(h.api.data.review.cards[c.id].repetitions,0);
 await h.click('[data-view="words"]');await h.click('[data-view="daily-review"]');assert.equal(ui.active.id,c.id);assert.equal(ui.input,c.target);assert.equal(ui.feedback.correct,true);assert.equal(ui.revealed,true);
 const reloaded=await boot(h.stored);await reloaded.click('[data-view="daily-review"]');assert.equal(reloaded.api.dailyReview.active.id,c.id);assert.equal(reloaded.api.dailyReview.input,c.target);assert.equal(reloaded.api.dailyReview.feedback.correct,true);assert.equal(reloaded.api.data.review.cards[c.id].repetitions,0);
 await reviewClick(reloaded,'rate','good');assert.equal(reloaded.api.data.review.cards[c.id].repetitions,1);assert.equal(Object.keys(reloaded.stored.reviewDrafts.entries).length,0);
});
test('a failed real draft write remains in the app backup and can be retried without grading',async()=>{
 const h=await boot();await h.click('[data-view="daily-review"]');h.setStorageWritable(false);const c=await answerCorrectly(h);assert.equal(h.api.dailyReview.input,c.target);assert.equal(h.api.data.review.cards[c.id].repetitions,0);
 const backup=h.api.backupData(),draft=Object.values(backup.reviewDrafts.entries).find(d=>d.cardId===c.id);assert(draft,'backup includes the unsaved in-memory answer');assert.equal(draft.input,c.target);assert.equal(draft.checked,true);assert.equal(draft.revealed,true);
 assert.match(h.document.querySelector('#daily-review-view').innerHTML,/重试保存草稿/);h.setStorageWritable(true);await reviewClick(h,'retry-draft');assert.equal(Object.values(h.stored.reviewDrafts.entries)[0].input,c.target);assert.equal(h.api.data.review.cards[c.id].repetitions,0);
});
test('real answer exposure remains assisted after app refresh and cannot earn a remembered rating',async()=>{
 const h=await boot();await h.click('[data-view="daily-review"]');const id=h.api.dailyReview.active.id;await reviewClick(h,'reveal');const loaded=h.stored;
 const reloaded=await boot(loaded);await reloaded.click('[data-view="daily-review"]');assert.equal(reloaded.api.dailyReview.active.id,id);assert.equal(reloaded.api.dailyReview.revealed,true);await answerCorrectly(reloaded);assert.equal(reloaded.api.dailyReview.independentlyCorrect(),false);reloaded.api.dailyReview.action('rate',{dataset:{reviewRating:'good'}});assert.equal(reloaded.api.data.review.cards[id].repetitions,0);assert.equal(reloaded.api.data.review.cards[id].stage,0);
});
test('replacing a backup restores its checked answer without replaying the old active answer',async()=>{
 const h=await boot();await h.click('[data-view="daily-review"]');const c=await answerCorrectly(h),saved=h.api.backupData(),changed=(c.options.indexOf(c.target)+1)%c.options.length;
 await reviewClick(h,'choice',changed);assert.notEqual(h.api.dailyReview.input,c.target);h.api.restoreBackup({format:'zhixin-backup-v1',data:saved},{mode:'replace'});await h.api.selectLesson(h.api.current.id);await h.click('[data-view="daily-review"]');
 assert.equal(h.api.dailyReview.input,c.target);assert.equal(h.api.dailyReview.feedback.correct,true);assert.equal(h.api.dailyReview.revealed,true);assert.equal(Object.values(h.api.data.reviewDrafts.entries)[0].input,c.target);assert.equal(h.api.data.review.cards[c.id].repetitions,0);
});
test('replacing with an older backup without review drafts clears active and cached answers',async()=>{
 const h=await boot();await h.click('[data-view="daily-review"]');const c=await answerCorrectly(h),older=h.api.backupData();delete older.reviewDrafts;
 h.api.restoreBackup({format:'zhixin-backup-v1',data:older},{mode:'replace'});await h.api.selectLesson(h.api.current.id);await h.click('[data-view="daily-review"]');
 assert.equal(h.api.dailyReview.active.id,c.id);assert.equal(h.api.dailyReview.input,'');assert.equal(h.api.dailyReview.feedback,null);assert.equal(Object.keys(h.api.backupData().reviewDrafts.entries).length,0);assert.equal(h.api.data.review.cards[c.id].repetitions,0);
});
test('merging an older backup retains a pending local draft without rating it',async()=>{
 const h=await boot();await h.click('[data-view="daily-review"]');const c=await answerCorrectly(h),older=h.api.backupData();delete older.reviewDrafts;
 h.api.restoreBackup({format:'zhixin-backup-v1',data:older},{mode:'merge'});await h.api.selectLesson(h.api.current.id);await h.click('[data-view="daily-review"]');
 assert.equal(h.api.dailyReview.input,c.target);assert.equal(h.api.dailyReview.feedback.correct,true);assert.equal(h.api.data.review.cards[c.id].repetitions,0);
});