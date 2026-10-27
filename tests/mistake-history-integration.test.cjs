'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const first='nce-b2-eef57c-l001';
test('current unit-pack mistakes revisit their saved response and current answer rather than an unrelated legacy-bank warning',async()=>{
 const seed=await harness(),pack=seed.c.StudyPracticePacks.registry.get(first),q=pack.tasks[0];
 const correct=q.type==='choice'?q.options[q.answer]:q.expected[0];
 const loaded={records:{[first]:{attempts:1,lastAt:1793100000000,practicePack:{revision:pack.revision,correct:11,total:12},wrong:[{taskId:q.id,conceptId:q.conceptId,question:q.prompt,answer:correct,explanation:q.rule,selectedAnswer:'公共的',reason:'这里表示私人使用。',sourceType:'authored-practice-pack'}]}}};
 const h=await harness({loaded});await h.click('[data-view="records"]');await h.click('[data-review="'+first+'"]');
 const html=h.document.querySelector('#dialog-root').innerHTML;
 assert.ok(html.includes(correct),'the known current pack answer must be shown');
 assert.ok(html.includes('公共的'),'the saved learner answer must be shown');
 assert.ok(!html.includes('暂无已核对答案'));
 assert.ok(h.document.querySelector('[data-review-pack-lesson="'+first+'"]'),'a current task must offer source-specific re-practice');
 const previous=JSON.parse(JSON.stringify(h.api.data.records[first]));
 await h.click('[data-review-pack-lesson="'+first+'"]');
 assert.equal(h.api.unitPractice.session().mode,'correction');assert.deepEqual(Array.from(h.api.unitPractice.session().queue),[q.id]);
 assert.deepEqual(JSON.parse(JSON.stringify(h.api.data.records[first])),previous,'one-task correction must not replace the formal result');
});
test('a saved older pack answer is retained and labelled historical rather than replaced by current task content',async()=>{
 const seed=await harness(),pack=seed.c.StudyPracticePacks.registry.get(first),q=pack.tasks[0];
 const loaded={records:{[first]:{attempts:1,lastAt:1793100000000,practicePack:{revision:'old-revision',correct:11,total:12},wrong:[{taskId:q.id,revision:'old-revision',question:'旧版作答时的问题',answer:'旧版参考答案',selectedAnswer:'旧版我的答案',explanation:'旧版规则',sourceType:'authored-practice-pack'}]}}};
 const h=await harness({loaded});await h.click('[data-view="records"]');await h.click('[data-review="'+first+'"]');
 const html=h.document.querySelector('#dialog-root').innerHTML;
 assert.ok(html.includes('旧版参考答案'));assert.ok(html.includes('旧版我的答案'));
 assert.match(html,/作答时|历史/);assert.ok(!html.includes(q.prompt));
 assert.equal(h.document.querySelector('[data-review-pack-lesson="'+first+'"]'),null,'an old task must not masquerade as a current correction');
});
