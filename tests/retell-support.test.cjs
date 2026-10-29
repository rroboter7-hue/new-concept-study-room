'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),api=require('../retell-support.js');
test('only source-bound full Chinese meanings, named people and current writing hints are shown',()=>{
 const lesson={id:'nce-b2-eef57c-l002',book:2,number:2,title:'第2课 · Breakfast or lunch?',paragraphs:[{en:'It was Sunday. It was my aunt Lucy.',zh:''},{en:'‘I am late,’ she said.',zh:'“我迟到了，”她说。'},{en:'A final paragraph without translation.',zh:''}]};
 const readingModel={rows:[{paragraphIndex:0,en:'It was Sunday.',zh:'那是星期天。',aligned:true,speaker:'旁白'},{paragraphIndex:0,en:'It was my aunt Lucy.',zh:'那是我的姨妈露西。',aligned:true,speaker:'旁白'}]};
 const writingTargets={words:[{word:'ring',meaning:'响铃'},{word:'missing',meaning:''}],phrases:[{phrase:'get up',meaning:'起床'}],priorWords:[{word:'old',meaning:'旧的'}],priorPhrases:[{phrase:'old phrase',meaning:'旧表达'}]};
 const before=JSON.stringify({lesson,readingModel,writingTargets}),result=api.forLesson(lesson,{writingTargets,readingModel});
 assert.deepEqual(result.sections.map(row=>row.meaning),['那是星期天。那是我的姨妈露西。','“我迟到了，”她说。','']);
 assert.deepEqual(result.characters.map(row=>row.name),['Lucy']);assert.equal(result.characters[0].role,'姨妈');
 assert.deepEqual(result.words,[{word:'ring',meaning:'响铃'}]);assert.deepEqual(result.usages.map(({phrase,meaning})=>({phrase,meaning})),[{phrase:'get up',meaning:'起床'}]);
 assert.match(result.notice,/暂无|缺失|未提供/);assert.equal(JSON.stringify({lesson,readingModel,writingTargets}),before);
});
test('long Chinese meanings remain complete and mismatched alignment cannot create a translation',()=>{
 const meaning='中文长段落。'.repeat(150);
 const result=api.forLesson({id:'x',paragraphs:[{en:'Hello.',zh:meaning},{en:'World.',zh:''}]},{readingModel:{rows:[{paragraphIndex:1,en:'Another sentence.',zh:'错误译文',aligned:true}]}});
 assert.equal(result.sections[0].meaning,meaning);assert.equal(result.sections[1].meaning,'');assert.deepEqual(result.characters,[]);
});
test('a source-aligned dialogue speaker may label its section without treating narration as a character',()=>{
 const lesson={id:'dialogue',paragraphs:[{en:'“Hello,” she said.',zh:''},{en:'The narrator watched.',zh:''}]};
 const readingModel={rows:[{paragraphIndex:0,en:'“Hello,” she said.',zh:'“你好，”她说。',aligned:true,kind:'speech',speaker:'露西姨妈'},{paragraphIndex:1,en:'The narrator watched.',zh:'叙述者看着。',aligned:true,kind:'narration',speaker:'旁白'}]};
 const result=api.forLesson(lesson,{readingModel});
 assert.equal(result.sections[0].speaker,'露西姨妈');assert.equal(result.sections[1].speaker,undefined);
 assert.deepEqual(result.characters,[]);
});
test('scene support follows verified reading groups and exposes narrator without changing legacy paragraph or name APIs',()=>{
 const lesson={id:'x',paragraphs:[{en:'I got up. The telephone rang. “Hello,” Lucy said.',zh:'原有完整译文。'}]};
 const rows=[{paragraphIndex:0,en:'I got up.',zh:'我起床了。',aligned:true,kind:'narration',speaker:'旁白'}, {paragraphIndex:0,en:'The telephone rang.',zh:'电话响了。',aligned:true,kind:'narration',speaker:'旁白'}, {paragraphIndex:0,en:'“Hello,” Lucy said.',zh:'“你好，”露西说。',aligned:true,kind:'speech',speaker:'露西'}];
 const groups=[{paragraphIndex:0,kind:'narration',speaker:'旁白',rows:rows.slice(0,2)},{paragraphIndex:0,kind:'speech',speaker:'露西',rows:rows.slice(2)}];
 const result=api.forLesson(lesson,{readingModel:{rows,groups}});
 assert.equal(result.sections[0].meaning,'原有完整译文。');
 assert.deepEqual(result.scenes.map(row=>row.meaning),['我起床了。电话响了。','“你好，”露西说。']);
 assert.equal(result.scenes[1].speaker,'露西');
 assert.equal(result.participants[0].name,'I');assert.equal(result.participants[0].role,'叙述者（我）');
 assert.equal(result.participants[0].sourceText,'I got up.');assert.deepEqual(result.characters,[]);
 const drift=api.forLesson({...lesson,paragraphs:[{en:'Changed.',zh:'变更后原译文。'}]},{readingModel:{rows,groups}});
 assert.deepEqual(drift.scenes.map(row=>row.meaning),['变更后原译文。']);assert.deepEqual(drift.participants,[]);
});
test('retell usage labels distinguish passage, notes extension and documented prior revision',()=>{
 const lesson={id:'x',paragraphs:[{en:'I get up early.',zh:'我早起。'}]},phrases=[
 {phrase:'get up',meaning:'起床',sourceType:'lesson-passage',sourceForms:['get up']},
 {phrase:'next weekend',meaning:'下周末',sourceType:'lesson-notes'},
 {phrase:'old phrase',meaning:'旧表达',sourceType:'lesson-notes',contextEvidence:{relatedPriorLessons:[{lessonId:'old',confidence:'expression-history-inference'}]}}
 ];
 const result=api.forLesson(lesson,{writingTargets:{phrases}});
 assert.deepEqual(result.usages.map(row=>row.sourceKind),['passage','lesson-extension','prior-revision']);
 assert(result.usages.every(row=>row.sourceKindLabel));
 assert.equal(result.usages[2].sourceKindLabel,'本课笔记 · 旧知复习线索');
});
