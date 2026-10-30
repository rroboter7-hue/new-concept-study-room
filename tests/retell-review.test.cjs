'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let Review;try{Review=require('../retell-review.js');}catch{}
test('retelling sentence boundaries preserve full names, initials, decimals and dialogue attribution',()=>{
 assert(Review,'retelling review module must exist');
 const text='Mr. J. Brown visited St. Paul’s Cathedral. He paid 2.5 pounds. “Why?” Lucy asked. He smiled!';
 assert.deepEqual(Review.sentences(text),['Mr. J. Brown visited St. Paul’s Cathedral.','He paid 2.5 pounds.','“Why?” Lucy asked.','He smiled!']);
});
test('paraphrased content gets language feedback without source similarity or lexical requirements',async()=>{
 assert(Review);const calls=[];
 const result=await Review.check('I enjoyed a quiet breakfast. she were late',{checkSentence:async value=>{calls.push(value);return {issues:value.startsWith('she')?[{type:'tense',original:'were',replacement:'was',message:'she 用 was。'},{type:'punctuation',message:'补句末标点。'}]:[]};}});
 assert.equal(calls.length,2);assert.equal(result.rows.length,2);
 assert.deepEqual(result.summary.map(row=>[row.type,row.count]),[['tense',1],['punctuation',1]]);
 assert(!('score' in result));assert(!('correct' in result));assert.match(result.notice,/本地|复核/);
});
test('an unavailable or incomplete checker cannot produce a successful full-language verdict',async()=>{
 assert(Review);const result=await Review.check('A different way to tell this story.',{checkSentence:async()=>{throw Error('offline');}});
 assert.equal(result.incomplete,true);assert.equal(result.rows[0].issues.length,0);assert.match(result.rows[0].notice,/未完成/);
 const unknown=await Review.check('Another wording.',{checkSentence:async()=>({issues:[],incomplete:true})});assert.equal(unknown.incomplete,true);
});
test('correct quoted questions with a reporting clause do not turn the final full stop into a question mark',async()=>{
 const Feedback=require('../sentence-feedback.js');
 for(const source of ['“Can you help?” he asked.','“Are you hungry?” Lucy asked.','“Are you hungry?” Captain Charles Alison quietly asked.','“Can you help?” he quietly asked.','“Can you help?” asked Lucy.']){
  const report=await Review.check(source,{checkSentence:sentence=>Feedback.check(sentence,{grammarCheck:()=>[]})});
  assert.equal(report.rows.flatMap(row=>row.issues).filter(issue=>issue.type==='punctuation').length,0,source);
  assert.equal(report.rows.flatMap(row=>row.issues).filter(issue=>issue.type==='capitalization').length,0,source);
 }
});
