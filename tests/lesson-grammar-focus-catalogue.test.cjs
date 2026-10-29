'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const Focus=require('../lesson-grammar-focus.js'),Points=require('../lesson-key-points.js');
test('all276 actual published lessons use specific authored grammar, exact passage evidence and concrete cautions',async()=>{
 const h=await harness({realPipeline:true,pilot:false,realOutput:true}),all=h.c.LESSONS.filter(row=>row.book>=1&&row.book<=4);
 assert.deepEqual([1,2,3,4].map(book=>all.filter(row=>row.book===book).length),[72,96,60,48]);
 assert.equal(Focus.lessonIds().length,276);const duplicateSummaries=new Map();
 for(const lesson of all){
  const before=JSON.stringify(lesson),verified=Focus.forLesson(lesson);assert.equal(verified?.status,'ready',lesson.id+': '+JSON.stringify(verified?.errors));
  const result=Points.forLesson(lesson,{reviewedGrammar:[{title:'通用补位',note:'不应填充。'}],questions:[{type:'grammar',graded:true,rule:'原句含有情态动词。'}]});
  assert.equal(result.grammar.length,verified.points.length,lesson.id+': no template filler');
  for(const point of result.grammar){
   assert.equal(point.curated,true,lesson.id);assert.equal(point.sourceLessonId,lesson.id);assert.equal(point.exampleSourceKind,'passage');assert(point.pitfall);
   assert(lesson.paragraphs.some(row=>row.en.includes(point.example)),lesson.id+': exact current passage');
   assert.doesNotMatch(point.title+' '+point.summary+' '+point.pitfall,/原句含有情态动词|语法运用|备选\s*be|本题保留原句/);
   duplicateSummaries.set(point.summary,(duplicateSummaries.get(point.summary)||0)+1);
  }
  assert.equal(result.pitfalls.length,verified.points.length,lesson.id);assert.match(result.notice,/自编|自行整理/);assert.equal(JSON.stringify(lesson),before);
  const browser=h.c.StudyLessonKeyPoints.forLesson(lesson);assert.equal(browser.grammar[0].summary,result.grammar[0].summary,lesson.id+': browser and Node agree');
 }
 assert(Math.max(...duplicateSummaries.values())<=2,'no copied summary across many lessons; recurring topics use their own context');
});
test('an official passage that no longer matches authored evidence is marked for review without generic filler',()=>{
 const result=Points.forLesson({id:'nce-b2-eef57c-l002',book:2,number:2,title:'Changed',paragraphs:[{en:'A changed body.'}],grammar:[{title:'Generic',note:'原句含有情态动词。'}],usage:[]});
 assert.equal(result.grammar.length,0);assert.equal(result.contentStatus,'needs-review');assert.match(result.notice,/重新核对|待核对/);
});
