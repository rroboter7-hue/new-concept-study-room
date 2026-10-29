/* Offline authoring only: read checked-in curriculum, never browser storage. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {harness}=require('../tests/support/app-harness.cjs');
(async()=>{
 const h=await harness({realPipeline:true,pilot:false});const lessons=h.c.LESSONS,rows=[];
 for(const lesson of lessons){
  for(const row of lesson.vocabulary||[])if(row.word)rows.push({label:row.word,category:'word'});
  for(const row of lesson.usage||[])if(row.phrase)rows.push({label:row.phrase,category:'phrase'});
  // Include function words and inflected forms displayed by the reading view.
  for(const paragraph of lesson.paragraphs||[])for(const label of String(paragraph.en||'').match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)||[])rows.push({label,category:'word'});
 }
 for(const book of [1,2,3,4]){
  const lesson=lessons.filter(row=>row.book===book).sort((a,b)=>a.number-b.number).at(-1);
  if(lesson)rows.push(...h.c.StudyWritingLibrary.forLesson(lesson,{lessons,includeEarlierLessons:true}));
 }
 const out=path.resolve(__dirname,'../.cache/frequency-sources');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'targets.json'),JSON.stringify(rows));
 console.log('Curriculum frequency targets exported:',rows.length);
})();
