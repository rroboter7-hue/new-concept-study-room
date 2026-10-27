'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),test=require('node:test'),assert=require('node:assert/strict');
const DIST=process.env.PILOT_APP_DIST?path.resolve(process.env.PILOT_APP_DIST):fs.existsSync(path.join(__dirname,'..','index.html'))?path.resolve(__dirname,'..'):path.join(__dirname,'new-concept','dist');
const FILE='book2-additional-context-fixes.js',ID16='nce-b2-eef57c-l016',ID17='nce-b2-eef57c-l017',sha=value=>crypto.createHash('sha256').update(value).digest('hex'),copy=value=>JSON.parse(JSON.stringify(value));
function load({correct=true,mutate,stop=false}={}){
 const c={document:{addEventListener(){}}};c.window=c;vm.createContext(c);const run=file=>vm.runInContext(fs.readFileSync(path.join(DIST,file),'utf8'),c,{filename:file});let injected=false,before;
 for(const match of fs.readFileSync(path.join(DIST,'index.html'),'utf8').matchAll(/<script\b[^>]*src="([^"]+)"/g)){
  const file=match[1].split(/[?#]/)[0];if(file==='app.js')break;if(file===FILE||file==='book2-reviewed-context-vocabulary.js')continue;run(file);
  if(file==='book2-vocabulary.js'){
   before=copy(c.LESSONS);mutate?.(c);if(correct&&fs.existsSync(path.join(DIST,FILE))){run(FILE);injected=true;}if(stop)break;
  }
 }
 return {c,run,before,injected,lesson:number=>c.LESSONS.find(l=>l.book===2&&l.number===number)};
}

test('actual index with the planned overlay location corrects L17 bright from the visually checked textbook vocabulary and passage',()=>{
 const h=load(),word=h.c.StudyKnowledge.bank.wordForLesson(ID17,'bright');assert.equal(word.meaning,'鲜艳的');assert.equal(h.injected,true);assert.equal(word.example,'In the play, she must appear in a bright red dress and long black stockings.');assert.match(word.sourceType,/user-textbook/);assert.equal(word.sourcePdfPage,79);
 const audit=word.contextCorrections.find(row=>row.id==='book2-additional-l017-bright');assert.equal(audit.originalItem.meaning,'明亮的');const sourcePath='resources/30f1219bd738cfbf.pdf',archived=h.c.StudySourceFiles?.archiveInfo(sourcePath);assert.equal(audit.sourceSha256,archived?archived.sha256:sha(fs.readFileSync(path.join(DIST,sourcePath))));if(archived)assert.equal(archived.sha256,'30f1219bd738cfbfea00e8bc8e1b51f752a3eb1d47c87090f0120ded0a203633');assert.equal(audit.sourcePageImageSha256,'7f2cc67d6680b1b6950b60f36ef491766796a320100f35fcf89c83485891a9ed');
 const legacy=h.lesson(17).quiz.find(q=>q.sourceWord==='bright'&&!q.direction);assert.equal(legacy.options[legacy.answer],'鲜艳的');assert(legacy.explanation.includes('鲜艳的'));
 const app=fs.readFileSync(path.join(DIST,'app.js'),'utf8'),start=app.indexOf('function dictionary('),end=app.indexOf('function wordHTML',start);assert(start>=0&&end>start);vm.runInContext('var data={words:[]};var lessons=window.LESSONS;var current=lessons.find(l=>l.id==="'+ID17+'");var view="study";'+app.slice(start,end),h.c);assert.equal(h.c.dictionary('bright').meaning,'鲜艳的');
 const game=Object.create(h.c.StudyGame.prototype);game.lessons=h.c.LESSONS;const pool=game.questionPool(h.lesson(17)),q=pool.find(q=>q.sourceWord==='bright'&&!q.direction);assert(q);assert.equal(q.options[q.answer],'鲜艳的');
});

test('L16 editorial punctuation correction binds source hashes and keeps every paragraph and aligned Chinese translation',()=>{
 const h=load(),l=h.lesson(16),p=l.paragraphs[0],t=h.c.BOOK2_TRANSLATIONS.lessons.find(row=>row.lessonId===ID16),a=h.c.BOOK2_READING_ALIGNMENT.lessons.find(row=>row.lessonId===ID16),audit=l.textbook.editorialCorrections?.find(row=>row.id==='book2-additional-l016-this-note');
 assert(p.en.includes('I found this note on my car'));assert(!p.en.includes('this. note'));assert(audit);assert.equal(audit.newBodySha256,sha(p.en));assert.equal(audit.oldBodySha256,sha(p.en.replace('this note','this. note')));assert.equal(audit.sourcePdfPage,75);assert.equal(audit.sourcePageImageSha256,'b17df5f4ebbda7e7edf6a425a326914aeedb6380c448fb2fde263faf4931a478');assert.equal(audit.isLiteralSourcePunctuation,false);assert.match(audit.reason,/行末.*点.*显式校订/);
 assert(l.textbook.sourceNotes.some(note=>note.includes('I found this. note')));assert(l.textbook.sourceNotes.some(note=>note.includes('显式校订')));assert.equal(t.paragraphs[0].enSha256,sha(p.en));assert.equal(t.paragraphs[0].zh,p.zh);assert.equal(a.paragraphs[0].rows[4].en,'During a holiday in Sweden, I found this note on my car: ‘Sir, we welcome you to our city.');
 const model=h.c.StudyReading.model(l);assert.equal(model.hasAligned,true);assert.equal(model.fallbacks.length,0);assert.equal(model.rows.length,9);assert(model.rows.every(row=>row.zh&&row.aligned));assert.deepEqual(Array.from(model.rows,row=>row.en),Array.from(a.paragraphs[0].rows,row=>row.en));
 const baseline=load({correct:false});assert.deepEqual(Array.from(l.paragraphs,p=>p.zh),Array.from(baseline.lesson(16).paragraphs,p=>p.zh));assert.deepEqual(Array.from(a.paragraphs[0].rows,row=>row.zh),Array.from(baseline.c.BOOK2_READING_ALIGNMENT.lessons.find(row=>row.lessonId===ID16).paragraphs[0].rows,row=>row.zh));assert.equal(p.en.match(/[A-Za-z]+/g).join(' '),baseline.lesson(16).paragraphs[0].en.match(/[A-Za-z]+/g).join(' '));assert.deepEqual(copy(h.c.PROVIDED_AUDIO_SOURCES[ID16]),copy(baseline.c.PROVIDED_AUDIO_SOURCES[ID16]));
});

test('the four exact expansion bindings are generated from the corrected model and all 96 ordinary quizzes still have twelve questions',()=>{
 const h=load(),bank=h.c.StudyKnowledge.bank,baseline=load({correct:false});assert.equal(baseline.c.StudyKnowledge.bank.audit.issues.length,22,'the existing pending context reviews are explicit baseline, not silently cleared');assert.deepEqual(copy(bank.audit.issues),copy(baseline.c.StudyKnowledge.bank.audit.issues),'no added or removed vocabulary review issues');assert.deepEqual(copy(bank.audit.issues.filter(issue=>[ID16,ID17].includes(issue.lessonId))),[]);assert.deepEqual(copy(bank.audit.expansionIssues),[]);assert.equal(h.c.BOOK2_TRANSLATION_STATUS.translatedLessons,96);for(const l of h.c.LESSONS.filter(l=>l.book===2)){assert(l.paragraphs.every(p=>p.zh.trim()),'all translated paragraphs '+l.id);assert.equal(bank.quizForLesson(l.id).length,12,l.id);}
 const ids=['nce-b2-eef57c-l016-expansion-current-word-1','nce-b2-eef57c-l016-expansion-current-word-2','nce-b2-eef57c-l017-expansion-earlier-word','nce-b2-eef57c-l029-expansion-earlier-grammar'];assert.deepEqual(copy(h.c.BOOK2_ADDITIONAL_CONTEXT_FIXES.expectedExpansionBindingIds),ids);assert.equal(h.c.BOOK2_ADDITIONAL_CONTEXT_FIXES.expansionBindingMode,'generated-from-editorially-corrected-model');for(const id of ids){const entries=h.c.BOOK2_LATER_QUESTION_EXPANSION.entries.filter(q=>q.id===id);assert.equal(entries.length,1);assert.equal(entries[0].sourceLessonId,ID16);assert.equal(entries[0].sourceEvidence.sourceParagraphIndex,0);assert.equal(entries[0].sourceEvidence.sourceText,h.lesson(16).paragraphs[0].en);assert.equal(entries[0].sourceEvidenceCorrections,undefined,'no claim of rewriting an old runtime question');}
});

test('the overlay preserves unrelated lesson data and is idempotent without duplicating provenance',()=>{
 const h=load({stop:true}),others=h.c.LESSONS.filter(l=>![ID16,ID17].includes(l.id));assert.deepEqual(copy(others),h.before.filter(l=>![ID16,ID17].includes(l.id)));const before=JSON.stringify(h.c.LESSONS),translation=JSON.stringify(h.c.BOOK2_TRANSLATIONS),align=JSON.stringify(h.c.BOOK2_READING_ALIGNMENT);h.run(FILE);assert.equal(JSON.stringify(h.c.LESSONS),before);assert.equal(JSON.stringify(h.c.BOOK2_TRANSLATIONS),translation);assert.equal(JSON.stringify(h.c.BOOK2_READING_ALIGNMENT),align);
 const installed=load(),snapshot=JSON.stringify(installed.c.LESSONS);installed.run(FILE);assert.equal(JSON.stringify(installed.c.LESSONS),snapshot,'repeat after canonical installation is also idempotent');
});

test('old-value drift, conflicting source metadata and translation or alignment drift fail closed for the affected correction',()=>{
 for(const mutate of [c=>c.LESSONS.find(l=>l.id===ID17).vocabulary.find(v=>v.word==='bright').meaning='已手工编辑',c=>c.LESSONS.find(l=>l.id===ID17).textbook.title='Different title',c=>c.LESSONS.find(l=>l.id===ID17).paragraphs[0].en+=' Changed.']){const h=load({stop:true,mutate}),word=h.lesson(17).vocabulary.find(v=>v.word==='bright');assert(!word.contextCorrections?.some(row=>row.id==='book2-additional-l017-bright'));assert.notEqual(word.meaning,'鲜艳的');}
 for(const mutate of [c=>c.BOOK2_TEXT_STATUS.sourceSha256='0'.repeat(64),c=>c.LESSONS.find(l=>l.id===ID16).paragraphs[0].en+=' Changed.',c=>c.BOOK2_TRANSLATIONS.lessons.find(l=>l.lessonId===ID16).paragraphs[0].enSha256='0'.repeat(64),c=>c.BOOK2_READING_ALIGNMENT.lessons.find(l=>l.lessonId===ID16).paragraphs[0].rows[4].en='Changed row.']){const h=load({stop:true,mutate});assert(h.lesson(16).paragraphs[0].en.includes('this. note'));assert(!h.lesson(16).textbook.editorialCorrections?.length);}
});
