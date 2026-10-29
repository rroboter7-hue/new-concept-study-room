'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('knowledge distractor lookup scales without re-normalizing every word pair and preserves shared-word senses',()=>{
 const c={};c.window=c;vm.createContext(c);
 vm.runInContext('window.normalizationCalls=0;const originalNormalize=String.prototype.normalize;String.prototype.normalize=function(...args){window.normalizationCalls++;return originalNormalize.apply(this,args);};',c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../study-knowledge.js'),'utf8'),c);
 const lessons=Array.from({length:120},(_,i)=>({id:'lesson-'+i,book:2,number:i+1,title:'Lesson '+i,vocabulary:[{word:i<2?(i?' ＳＡＭＥ ':'same'):'word-'+i,meaning:'词义'+i}],quiz:[]}));
 const bank=c.StudyKnowledge.create(lessons);
 assert(c.normalizationCalls<120*100,'normalization work should grow with the word count rather than its square; got '+c.normalizationCalls);
 const question=bank.questionsForLesson('lesson-0')[0];
 assert.equal(question.options[question.answer],'词义0');
 assert.equal(question.options.includes('词义1'),false,'another normalized sense of the same word cannot become a distractor');
 assert.equal(question.options.length,4);
});
