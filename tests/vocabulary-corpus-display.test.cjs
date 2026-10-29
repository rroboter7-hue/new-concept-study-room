'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const corrections=require('../sentence-wordbank-data.js'),dictionary=require('../dictionary-context.js'),library=require('../writing-word-library.js');
const options={realPipeline:true,pilot:false,realOutput:true};

test('Pardon? shares its reviewed interjection meaning across dictionary and reference sources',async()=>{
 const h=await harness(options),lesson=h.c.LESSONS.find(l=>l.book===1&&l.number===1),original=JSON.stringify(lesson);
 const source=lesson.vocabulary.find(row=>row.word==='pardon');
 const row=corrections.vocabularyForLesson(lesson,[source])[0];
 assert.equal(row.pos,'int.');assert.equal(row.meaning,'请再说一遍');assert.equal(row.example,'Pardon?');
 const resolved=dictionary.resolve('pardon',{lesson});assert.equal(resolved.pos,row.pos);assert.equal(resolved.meaning,row.meaning);assert.equal(resolved.meaningKind,'lesson');
 const entries=library.forLesson(lesson,{lessons:[lesson],getVocabulary:()=>[source],targets:{words:[{...source,source:{id:lesson.id,book:1,number:1}}]}}).filter(row=>row.label==='pardon');
 assert.equal(entries.length,1);assert.equal(entries[0].pos,'int.');assert.equal(entries[0].meaning,'请再说一遍');assert.equal(JSON.stringify(lesson),original);
 await h.api.selectLesson(lesson.id);await h.api.learningPipeline.goStage(2);await h.flush();
 const target=h.api.learningPipeline.writing.targets().find(row=>row.label==='pardon');
 assert(target);assert.equal(target.pos,'int.');assert.equal(target.meaning,'请再说一遍');
});

test('reviewed Pardon? is bound to its unchanged lesson body and source; saved senses stay intact',async()=>{
 const h=await harness(options),lesson=h.c.LESSONS.find(l=>l.book===1&&l.number===1),source=lesson.vocabulary.find(row=>row.word==='pardon');
 for(const changed of [{...lesson,id:'imported-copy'},{...lesson,source:'imported'},{...lesson,title:'Another lesson'},{...lesson,book:2},{...lesson,paragraphs:lesson.paragraphs.map((p,i)=>i===3?{...p,en:'He asked for a pardon.'}:p)},{...lesson,textbook:{...lesson.textbook,bodySha256:'changed'}}]){
  assert.equal(corrections.vocabularyForLesson(changed,[source])[0],source);assert.equal(corrections.contextForLesson(changed,'pardon'),null);
 }
 const own={word:'pardon',pos:'v.',meaning:'宽恕（个人笔记）'};
 assert.equal(corrections.vocabularyForLesson(lesson,[own])[0],own);
 assert.equal(corrections.contextForLesson(lesson,'garden'),null);
 for(const flags of [{meaningSource:'unavailable'},{contextMeaningStale:true},{needsContextReview:true}]){
  const quarantined={...source,...flags};assert.equal(corrections.vocabularyForLesson(lesson,[quarantined])[0],quarantined);
  assert(!library.forLesson(lesson,{lessons:[lesson],getVocabulary:()=>[quarantined]}).some(row=>row.label==='pardon'));
 }
});

test('directory shows corpus frequency apart from bookmark without changing learning evidence',async()=>{
 const h=await harness(options);h.api.selectLesson(h.c.LESSONS.find(l=>l.book===1&&l.number===1).id);await h.click('[data-main-entry="words"]');
 const card=h.document.querySelectorAll('.entry-word-card').find(card=>card.querySelector('h3')?.innerHTML==='pardon');assert(card);
 assert.equal(card.querySelector('.entry-pos').innerHTML,'int.');assert.match(card.innerHTML,/请再说一遍/);
 assert.equal(card.querySelector('[data-frequency-score]')?.getAttribute('data-frequency-score'),'1.8');assert.match(card.querySelector('.entry-word-frequency').innerHTML,/语料/);
 const save=card.querySelector('[data-directory-save]');assert.match(save.innerHTML,/M6 3h12v18l-6-4-6 4/);
 const records=JSON.stringify(h.api.data.records);await h.click(save);assert.equal(JSON.stringify(h.api.data.records),records);
 assert.equal(h.api.data.words.find(row=>row.word==='pardon').mastered,false);
});

test('unmeasured saved words stay unmeasured with their personal definition and note',async()=>{
 const words=[{word:'qwertyword',meaning:'我的释义',note:'个人笔记',mastered:false}],h=await harness({...options,loaded:{words}});
 await h.click('[data-main-entry="words"]');await h.click('[data-directory-scope="favorites"]');
 const card=h.document.querySelectorAll('.entry-word-card').find(card=>card.querySelector('h3')?.innerHTML==='qwertyword');
 assert(card);assert.match(card.querySelector('.entry-word-frequency').innerHTML,/待统计/);assert(!card.querySelector('[data-frequency-score]'));
 assert.match(card.innerHTML,/我的释义/);assert.match(card.innerHTML,/个人笔记/);assert.deepEqual(JSON.parse(JSON.stringify(h.api.data.words)),words);
});
