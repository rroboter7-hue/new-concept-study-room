'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./leo-coach-harness.cjs');
const lessonId='nce-b2-eef57c-l001';
const boot=loaded=>harness({pilot:false,realCoach:true,realReview:true,realOutput:true,loaded:loaded||{lastLesson:lessonId,records:{[lessonId]:{completed:true}}}});
const status=(h,t)=>h.c.StudyCoach.taskStatus(h.api.data.coach,t);
async function reviewClick(h,selector){const node=h.document.querySelector(selector);assert(node,'review control exists: '+selector);assert.equal(node.disabled,false);for(const fn of h.document.querySelector('#daily-review-view').listeners.click||[])await fn({target:node});await h.flush();}

test('ten blank revealed and forgotten daily cards are processed without claiming independent recall, then continue advances',async()=>{
 const h=await boot(),task=h.api.coach.plan.tasks.find(t=>t.type==='review');
 await h.api.coach.begin(task.id);
 for(const cardId of task.cardIds){
  assert.equal(h.api.dailyReview.active.id,cardId);
  await reviewClick(h,'[data-review-action="reveal"]');
  await reviewClick(h,'[data-review-rating="again"]');
  const card=h.api.data.review.cards[cardId];
  assert.equal(card.lastRating,'again');assert.equal(card.dueAt,h.now+600000);assert.equal(card.stage,0);
 }
 const result=status(h,task);
 assert.equal(result.done,true,'the ten genuine forgotten ratings finish processing the daily review step');
 assert.equal(result.completedCards,task.cardIds.length);assert.equal(result.independent,false);assert.equal(result.assisted,true);
 assert.match(result.label,/已处理.*需再复习/);
 assert(result.evidence.every(e=>e.answer===''&&e.correct===false&&e.assisted===true&&e.processed===true));
 assert.equal(h.api.dailyReview.active,null);
 await reviewClick(h,'[data-review-action="continue-task"]');
 assert.equal(h.api.coach.activeTask.type,'sentences');assert.equal(h.api.activeTab,'output');
 const restored=await boot(h.stored),saved=restored.api.coach.plan.tasks.find(t=>t.id===task.id);
 assert.equal(status(restored,saved).completedCards,task.cardIds.length);
 await restored.api.coach.action('continue');assert.equal(restored.api.coach.activeTask.type,'sentences');
});

test('a blank forgotten daily rating rolls back both schedules and processing evidence when storage is full',async()=>{
 const h=await boot(),task=h.api.coach.plan.tasks.find(t=>t.type==='review');await h.api.coach.begin(task.id);
 const cardId=h.api.dailyReview.active.id;await reviewClick(h,'[data-review-action="reveal"]');
 const beforeReview=JSON.stringify(h.api.data.review),beforeCoach=JSON.stringify(h.api.data.coach);
 h.setStorageWritable(false);await reviewClick(h,'[data-review-rating="again"]');
 assert.equal(JSON.stringify(h.api.data.review),beforeReview);assert.equal(JSON.stringify(h.api.data.coach),beforeCoach);assert.equal(h.api.dailyReview.active.id,cardId);
 h.setStorageWritable(true);await reviewClick(h,'[data-review-rating="again"]');
 assert.equal(status(h,task).completedCards,1);assert.equal(status(h,task).evidence[0].answer,'');
 assert.equal(h.api.data.review.cards[cardId].repetitions,1);
});

test('ordinary daily review cannot complete a planned daily round even when it rates one of the planned cards',async()=>{
 const h=await boot(),task=h.api.coach.plan.tasks.find(t=>t.type==='review');
 await h.click('[data-view="daily-review"]');
 const cardId=h.api.dailyReview.active.id;assert(task.cardIds.includes(cardId));
 h.api.dailyReview.input=h.api.dailyReview.active.target;h.api.dailyReview.action('check',{});h.api.dailyReview.action('rate',{dataset:{reviewRating:'good'}});
 assert.equal(h.api.data.review.cards[cardId].repetitions,1);
 assert.equal(status(h,task).completedCards,0,'unbound review must not silently supply daily task evidence');
});

test('a restored daily review whose cards are no longer due is deferred and continue opens the next task',async()=>{
 const first=await boot(),task=first.api.coach.plan.tasks.find(t=>t.type==='review'),loaded=first.stored;
 for(const id of task.cardIds)loaded.review.cards[id].dueAt=first.now+86400000;
 const h=await boot(loaded);await h.api.coach.action('continue');
 assert.equal(h.api.coach.activeTask.type,'sentences');assert.equal(status(h,task).done,false);assert.equal(status(h,task).deferred,true);
 assert.match(status(h,task).label,/暂缓/);assert.equal(status(h,task).completedCards,0);
 const restored=await boot(h.stored);assert.match(restored.document.querySelector('#learning-coach').innerHTML,/1 项暂缓/);await restored.api.coach.action('continue');assert.equal(restored.api.coach.activeTask.type,'sentences');
});

test('a changed review revision cannot provide evidence for the older planned card round',async()=>{
 const h=await boot(),task=h.api.coach.plan.tasks.find(t=>t.type==='review');
 for(const id of task.cardIds)h.api.data.review.cards[id].revision++;
 await h.api.coach.action('continue');
 assert.equal(h.api.coach.activeTask.type,'sentences');assert.equal(status(h,task).deferred,true);assert.equal(status(h,task).completedCards,0);
});

test('a deleted lesson in a restored daily plan is deferred without marking its output complete',async()=>{
 const first=await boot(),loaded=first.stored,plan=loaded.coach.plans[first.api.coach.plan.day];
 plan.tasks=plan.tasks.filter(t=>t.type!=='review');const task=plan.tasks[0];task.lessonId='removed-imported-lesson';
 const h=await boot(loaded);await h.api.coach.action('continue');
 assert.notEqual(h.api.coach.activeTask.id,task.id);assert.equal(status(h,task).deferred,true);assert.equal(status(h,task).done,false);
});

test('a rating from an older open daily round cannot complete the newly reset round',async()=>{
 const h=await boot(),oldTask=h.api.coach.plan.tasks.find(t=>t.type==='review');await h.api.coach.begin(oldTask.id);
 h.api.coach.ensure(true);const task=h.api.coach.plan.tasks.find(t=>t.type==='review');assert.notEqual(task.roundKey,oldTask.roundKey);
 const cardId=h.api.dailyReview.active.id;h.api.dailyReview.input=h.api.dailyReview.active.target;h.api.dailyReview.action('check',{});h.api.dailyReview.action('rate',{dataset:{reviewRating:'good'}});
 assert.equal(h.api.data.review.cards[cardId].repetitions,1);assert.equal(status(h,task).completedCards,0);
});
