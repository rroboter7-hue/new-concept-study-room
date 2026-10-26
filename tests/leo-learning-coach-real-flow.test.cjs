'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./leo-coach-harness.cjs');
test('real sentence inputs submit once through app callback into the bound daily task',async()=>{
 const h=await harness({pilot:false,realCoach:true,realOutput:true}),task=h.api.coach.plan.tasks.find(t=>t.type==='sentences');await h.api.coach.begin(task.id);
 const answers=['This is a private meeting with our friends.','We had a private conversation yesterday evening.','My sister wants a private room near the sea.','Where can we have a private discussion today?','I keep my private letters in that old desk.'];
 for(let i=0;i<5;i++){await h.click('[data-sentence-step="'+i+'"]');await h.input('.sentence-textarea',answers[i]);}
 await h.click('[data-sentence-action="check"]');const status=h.c.StudyCoach.taskStatus(h.api.data.coach,task);assert(status.done);assert.equal(status.assisted,false);assert.equal(status.evidence.length,1);assert.equal(status.evidence[0].lessonId,h.api.current.id);assert(h.stored.coach.events.length);assert.equal(h.api.data.records[task.lessonId]?.attempts,undefined);
});
test('real retell form records assisted output independently of formal quiz marks',async()=>{
 const h=await harness({pilot:false,realCoach:true,realOutput:true}),task=h.api.coach.plan.tasks.find(t=>t.type==='retell');await h.api.coach.begin(task.id);await h.click('[data-output-action="original"]');await h.click('[data-output-action="original"]');await h.input('[data-output-input="answer"]','A man went to the theatre but two people talked loudly behind him.');await h.click('[data-output-action="submit"]');const status=h.c.StudyCoach.taskStatus(h.api.data.coach,task);assert(status.done);assert(status.assisted);assert.equal(h.api.data.records[task.lessonId].output.assisted,true);assert.equal(h.api.data.records[task.lessonId].attempts,undefined);
});
test('all three daily review callbacks bind to the active round without requiring controller roundKey',async()=>{
 const h=await harness({pilot:false,realCoach:true});const cards=h.c.StudyReview.cardsForLessons([h.api.current]);h.api.coach.options.getDueCards=()=>cards;h.api.coach.ensure(true);const task=h.api.coach.plan.tasks.find(t=>t.type==='review');assert(task);
 for(const cardId of task.cardIds)assert(h.api.coach.acceptEvidence({type:'review',cardId,lessonId:h.api.current.id,answer:'a recalled answer',correct:true,assisted:false,rating:'good',complete:true}));
 const status=h.c.StudyCoach.taskStatus(h.api.data.coach,task);assert(status.done);assert.equal(status.completedCards,3);assert.equal(status.assisted,false);
});
test('review scheduling and daily evidence are saved atomically; a full store rolls both back',async()=>{
 const h=await harness({pilot:false,realCoach:true}),cards=h.c.StudyReview.cardsForLessons([h.api.current]);h.api.coach.options.getDueCards=()=>cards;h.api.coach.ensure(true);const task=h.api.coach.plan.tasks.find(t=>t.type==='review');h.api.data.review=h.c.StudyReview.enroll(h.api.data.review,cards);const card=cards.find(c=>c.id===task.cardIds[0]),record=h.api.data.review.cards[card.id],rated=h.c.StudyReview.rate(h.api.data.review,card.id,'good',{revision:record.revision,evidence:{correct:true,assisted:false,objective:true,kind:card.kind,answer:card.target}});assert(rated.accepted);
 const beforeReview=JSON.stringify(h.api.data.review),beforeCoach=JSON.stringify(h.api.data.coach);h.setStorageWritable(false);assert.equal(h.api.saveReviewState(rated.state),false);assert.equal(JSON.stringify(h.api.data.review),beforeReview);assert.equal(JSON.stringify(h.api.data.coach),beforeCoach);h.setStorageWritable(true);assert(h.api.saveReviewState(rated.state));assert.equal(h.c.StudyCoach.taskStatus(h.api.data.coach,task).completedCards,1);
});
test('daily review uses formal startReview and three real controller ratings complete the small task',async()=>{
 const id='nce-b2-eef57c-l001',h=await harness({pilot:false,realCoach:true,realReview:true,loaded:{lastLesson:id,records:{[id]:{completed:true}}}}),task=h.api.coach.plan.tasks.find(t=>t.type==='review');assert(task);await h.api.coach.begin(task.id);assert.equal(h.api.view,'daily-review');const review=h.api.dailyReview;
 for(let i=0;i<task.cardIds.length;i++){assert(review.active);assert(task.cardIds.includes(review.active.id));review.input=review.active.target;review.action('check',{});review.action('rate',{dataset:{reviewRating:'good'}});}
 const status=h.c.StudyCoach.taskStatus(h.api.data.coach,task);assert(status.done);assert.equal(status.completedCards,3);assert.equal(status.assisted,false);
});
test('ordinary retell outside a daily round does not report a false task-save failure',async()=>{
 const h=await harness({pilot:false,realCoach:true,realOutput:true});h.api.output.mode='retell';h.api.setTab('output');await h.input('[data-output-input="answer"]','A man went to the theatre and heard two people talking.');await h.click('[data-output-action="submit"]');assert.equal(h.api.output.pendingEvidence.failed,false);assert(!h.html().includes('重试保存任务状态'));const task=h.api.coach.plan.tasks.find(t=>t.type==='retell');assert(!h.c.StudyCoach.taskStatus(h.api.data.coach,task).done);
});
