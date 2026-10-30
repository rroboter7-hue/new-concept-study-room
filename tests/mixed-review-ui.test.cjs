'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./support/app-harness.cjs'),C=require('../mixed-review-core.js'),R=require('../sentence-revisit.js');
const UI=fs.existsSync(require.resolve('../core.js').replace(/core\.js$/,'mixed-review.js'))?require('../mixed-review.js'):null;
const lesson={id:'test-lesson',book:2,number:1,title:'Known lesson'},q={id:'q1',question:'She ___ every day.',options:['walk','walks'],answer:1,explanation:'第三人称单数用 walks。'};
async function setup(extra={}){const h=await harness({pilot:false}),host=h.document.createElement('section');h.document.body.appendChild(host);let state={},review={},sentences={},writable=true;
 const context={lessons:[lesson],pipeline:{lessons:{[lesson.id]:{mistakes:{q1:{question:q,wrongCount:2,lastAt:h.now}}}}},getQuestions:()=>[q],...extra,...extra.initialize?.(h)};review=context.review||review;sentences=context.sentences||sentences;
 assert.equal(typeof UI,'function');const ui=new UI({container:host,core:C,reviewEngine:h.c.StudyReview,sentenceEngine:R,getState:()=>state,getContext:()=>({...context,review,sentences}),saveState:(next,changes={})=>{if(!writable)return false;state=next;if(changes.review)review=changes.review;if(changes.sentences)sentences=changes.sentences;return true;},now:()=>h.now});ui.render();
 return {h,host,ui,get state(){return state;},get review(){return review;},get sentences(){return sentences;},setWritable:v=>writable=v,click:async action=>{const b=host.querySelector('[data-mix-action="'+action+'"]');assert(b,action);await h.click(b);},input:async value=>{await h.input(host.querySelector('[data-mix-input]'),value);}};
}
test('review opens on a compact overview, then one task, then a result without writing lesson scores',async()=>{
 const f=await setup();assert.match(f.host.innerHTML,/本次复习/);assert.equal(f.host.querySelector('[data-mix-input]'),null);
 await f.click('start');assert.match(f.host.innerHTML,/She ___ every day/);assert.equal(f.state.session.items.length,1);
 await f.h.click(f.host.querySelector('[data-mix-choice="1"]'));await f.click('check');assert.match(f.host.innerHTML,/回答正确/);await f.click('next');assert.match(f.host.innerHTML,/本组已完成/);assert.equal(f.state.session.results['mistake:test-lesson:q1'].status,'correct');assert.equal(f.h.api.data.records[lesson.id],undefined);
});
test('wrong-answer feedback is folded and immediate correction practice cannot change delayed retest history',async()=>{
 const f=await setup();await f.click('start');await f.h.click(f.host.querySelector('[data-mix-choice="0"]'));await f.click('check');assert.match(f.host.innerHTML,/再试一次|尚未答对/);assert(f.host.querySelector('details'));await f.click('next');const history=JSON.stringify(f.state.history);await f.click('retry');assert.equal(f.state.session.practice,true);await f.h.click(f.host.querySelector('[data-mix-choice="1"]'));await f.click('check');await f.click('next');assert.equal(JSON.stringify(f.state.history),history);
});
test('help stays assisted after edits, failed completion keeps the current task and input',async()=>{
 const f=await setup();await f.click('start');await f.click('help');await f.h.click(f.host.querySelector('[data-mix-choice="1"]'));await f.click('check');f.setWritable(false);await f.click('next');assert(f.host.querySelector('[data-mix-action="next"]'));assert.match(f.host.innerHTML,/未能保存/);assert.equal(Object.keys(f.state.session.results).length,0);f.setWritable(true);await f.click('next');assert.equal(f.state.session.results['mistake:test-lesson:q1'].status,'corrected');
});
test('pending answers survive overview and reload while a changed question is deferred explicitly',async()=>{
 const f=await setup();await f.click('start');await f.h.click(f.host.querySelector('[data-mix-choice="1"]'));await f.click('overview');assert.match(f.host.innerHTML,/继续本组/);await f.click('start');assert.equal(f.host.querySelector('[data-mix-choice="1"]').getAttribute('aria-pressed'),'true');f.ui.options.getContext=()=>({lessons:[lesson]});f.ui.render();assert.match(f.host.innerHTML,/资料已更新/);await f.click('defer');assert.match(f.host.innerHTML,/本组已完成/);
});
test('usage writing remains self checked and schedules tomorrow without advancing objective mastery',async()=>{
 const f=await setup({pipeline:{lessons:{}},initialize:h=>{const cards=h.c.StudyReview.cardsForLessons([{...lesson,usage:[{phrase:'get angry',meaning:'生气',example:'Please do not get angry.'}]}]);return {cards,review:h.c.StudyReview.enroll({},cards)};}});
 await f.click('start');const item=f.ui.active(),before=f.review.cards[item.card.id].stage;await f.click('writing');await f.input('Please do not get angry today.');await f.click('check');assert.match(f.host.innerHTML,/待自行核对/);await f.click('next');assert.equal(f.state.session.results[item.key].status,'self-checked');assert.equal(f.review.cards[item.card.id].stage,before);assert.equal(f.review.cards[item.card.id].lastEvidence.objective,false);
});
test('a missing required usage is visibly flagged and a source example is labelled as an example',async()=>{
 const f=await setup({pipeline:{lessons:{}},initialize:h=>{const cards=h.c.StudyReview.cardsForLessons([{...lesson,usage:[{phrase:'get angry',meaning:'生气',example:'Please do not get angry.'}]}]);return {cards,review:h.c.StudyReview.enroll({},cards)};}});
 await f.click('start');const item=f.ui.active();await f.click('writing');await f.input('I watch television in the evening.');await f.click('check');assert.match(f.host.querySelector('[data-mix-feedback]').innerHTML,/还没用到指定表达/);assert.match(f.host.querySelector('[data-mix-feedback]').innerHTML,/来源例句/);await f.click('next');assert.equal(f.state.session.results[item.key].status,'retry');assert.equal(f.review.cards[item.card.id].lastRating,'again');
});
test('confirmed correction recall uses its existing schedule and never produces an objective-correct mark',async()=>{
 const f=await setup({pipeline:{lessons:{}},initialize:h=>({sentences:R.add({},{lessonId:lesson.id,book:2,number:1,original:'He go home.',corrected:'He goes home.'},{id:'sr:confirmed',now:h.now-2*R.DAY}).state})});
 await f.click('start');await f.input('He goes home.');await f.click('check');assert.match(f.host.innerHTML,/自行核对/);await f.click('next');assert.equal(f.state.session.results['correction:sr:confirmed'].status,'self-checked');assert.equal(f.sentences.entries['sr:confirmed'].stage,1);assert.equal(f.sentences.entries['sr:confirmed'].dueAt,f.h.now+3*R.DAY);
});
test('retrying an old group never silently substitutes a new revision of the same question',async()=>{
 const f=await setup();await f.click('start');await f.h.click(f.host.querySelector('[data-mix-choice="0"]'));await f.click('check');await f.click('next');const saved=JSON.stringify(f.state.session),changed={...q,question:'Yesterday, she ___ home.',options:['walk','walked'],answer:1};
 f.ui.options.getContext=()=>({lessons:[lesson],pipeline:{lessons:{[lesson.id]:{mistakes:{q1:{question:changed,wrongCount:1}}}}},getQuestions:()=>[changed]});await f.click('retry');assert.equal(JSON.stringify(f.state.session),saved);
});
test('long authored question labels move to metadata while every question condition remains in the prompt',async()=>{
 const authored={...q,question:'【自编句型转换】保持情态动词不变，将 You can go. 改为疑问句。'};
 const f=await setup({pipeline:{lessons:{[lesson.id]:{mistakes:{q1:{question:authored,wrongCount:1}}}}},getQuestions:()=>[authored]});await f.click('start');assert.equal(f.host.querySelector('.mix-prompt').innerHTML,'保持情态动词不变，将 You can go. 改为疑问句。');assert.match(f.host.querySelector('.mix-task-type').innerHTML,/自编句型转换/);
});
test('the saved previous result can be reopened after reload without starting or grading another group',async()=>{
 const f=await setup();await f.click('start');await f.h.click(f.host.querySelector('[data-mix-choice="0"]'));await f.click('check');await f.click('next');const before=JSON.stringify(f.state);f.ui.reload();f.ui.render();await f.click('last-result');assert.match(f.host.innerHTML,/本组已完成/);assert.equal(JSON.stringify(f.state),before);
});
test('one completion uses the same timestamp for scheduling and retry binding when the clock advances',async()=>{
 const f=await setup({pipeline:{lessons:{}},initialize:h=>{const cards=h.c.StudyReview.cardsForLessons([{...lesson,usage:[{phrase:'get angry',meaning:'生气',example:'Please do not get angry.'}]}]);return {cards,review:h.c.StudyReview.enroll({},cards)};}});let tick=f.h.now;f.ui.options.now=()=>++tick;
 await f.click('start');const item=f.ui.active();await f.click('help');await f.input('get angry');await f.click('check');await f.click('next');assert.equal(f.review.cards[item.card.id].lastReviewedAt,f.state.session.results[item.key].at);await f.click('retry');assert.equal(f.state.session.items.length,1);assert.equal(f.state.session.practice,true);
});
test('a hint saved in the existing review engine permits corrected completion without independent mastery',async()=>{
 const f=await setup({pipeline:{lessons:{}},initialize:h=>{const cards=h.c.StudyReview.cardsForLessons([{...lesson,usage:[{phrase:'get angry',meaning:'生气',example:'Please do not get angry.'}]}]);let review=h.c.StudyReview.enroll({},cards);review=h.c.StudyReview.assist(review,cards[0].id,{revision:0,now:h.now}).state;return {cards,review};}});
 await f.click('start');const item=f.ui.active();await f.input('get angry');await f.click('check');await f.click('next');assert.match(f.host.innerHTML,/本组已完成/);assert.equal(f.state.session.results[item.key].status,'corrected');assert.equal(f.review.cards[item.card.id].lastRating,'hard');assert.equal(f.review.cards[item.card.id].lastEvidence.assisted,true);
});
test('a lesson title used as a word source is hidden before an answer and only revealed after feedback',async()=>{
 const f=await setup({pipeline:{lessons:{}},lessons:[{...lesson,title:'Where is Sally?'}],initialize:h=>{const cards=[{id:'review:sally',kind:'word',target:'Sally',prompt:'萨莉',sourceLesson:{...lesson,title:'Where is Sally?'},exampleSourceType:'lesson-title',conceptId:'word:sally'}];return {cards,review:h.c.StudyReview.enroll({},cards,{now:h.now})};}});
 await f.click('start');assert.doesNotMatch(f.host.querySelector('.mix-source').innerHTML,/Where is Sally/);await f.input('Sally');await f.click('check');assert.match(f.host.querySelector('.mix-source').innerHTML,/Where is Sally/);await f.click('next');assert.equal(f.state.session.results['card:review:sally'].status,'correct');
});

test('changed accepted phrase forms defer an existing draft and cannot enter immediate retry under new rules',async()=>{
 let cards;const f=await setup({pipeline:{lessons:{}},initialize:h=>{cards=h.c.StudyReview.cardsForLessons([{...lesson,usage:[{phrase:'get angry',meaning:'生气',example:'Please do not get angry.'}]}]);cards[0].variants=['become angry'];return {cards,review:h.c.StudyReview.enroll({},cards,{now:h.now})};}});
 await f.click('start');await f.click('help');await f.input('become angry');await f.click('check');assert.equal(f.ui.evaluation(f.ui.active(),C.draft(f.state,f.ui.active())).correct,true);
 const original=cards[0].variants;cards[0].variants=[];assert.equal(f.ui.active().stale,true);cards[0].variants=original;
 await f.click('next');assert.equal(f.ui.retryRows().length,1);cards[0].variants=[];assert.equal(f.ui.retryRows().length,0);
});
