'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),api=require('../retell-support.js');
test('only source-bound full Chinese meanings, named people and current writing hints are shown',()=>{
 const lesson={id:'nce-b2-eef57c-l002',book:2,number:2,title:'第2课 · Breakfast or lunch?',paragraphs:[{en:'It was Sunday. It was my aunt Lucy.',zh:''},{en:'‘I am late,’ she said.',zh:'“我迟到了，”她说。'},{en:'A final paragraph without translation.',zh:''}]};
 const readingModel={rows:[{paragraphIndex:0,en:'It was Sunday.',zh:'那是星期天。',aligned:true,speaker:'旁白'},{paragraphIndex:0,en:'It was my aunt Lucy.',zh:'那是我的姨妈露西。',aligned:true,speaker:'旁白'}]};
 const writingTargets={words:[{word:'ring',meaning:'响铃'},{word:'missing',meaning:''}],phrases:[{phrase:'get up',meaning:'起床'}],priorWords:[{word:'old',meaning:'旧的'}],priorPhrases:[{phrase:'old phrase',meaning:'旧表达'}]};
 const before=JSON.stringify({lesson,readingModel,writingTargets}),result=api.forLesson(lesson,{writingTargets,readingModel});
 assert.deepEqual(result.sections.map(row=>row.meaning),['那是星期天。那是我的姨妈露西。','“我迟到了，”她说。','']);
 assert.deepEqual(result.characters.map(row=>row.name),['Lucy']);assert.equal(result.characters[0].role,'姨妈');
 assert.deepEqual(result.words,[{word:'ring',meaning:'响铃'}]);assert.deepEqual(result.usages,[{phrase:'get up',meaning:'起床'}]);
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
