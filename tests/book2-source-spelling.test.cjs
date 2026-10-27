'use strict';
// Portable release contract: only deployed files are read. No work-only
// baselines, reports, generators, PDF files, or test-support imports.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),test=require('node:test');
const DIST=process.env.PILOT_APP_DIST?path.resolve(process.env.PILOT_APP_DIST):fs.existsSync(path.join(__dirname,'..','index.html'))?path.resolve(__dirname,'..'):path.join(__dirname,'new-concept/dist');
const FIX='book2-source-spelling-fixes.js',sha=x=>crypto.createHash('sha256').update(x).digest('hex'),plain=x=>JSON.parse(JSON.stringify(x));
const original='‘We musn’t buy things we don’t need,’ I remarked suddenly. I regretted saying it almost at once.',corrected='‘We mustn’t buy things we don’t need,’ I remarked suddenly. I regretted saying it almost at once.';
function load({skipFix=false,stopAtVocabulary=false,mutate}={}){
 const c={document:{addEventListener(){}},setTimeout(){},clearTimeout(){}};c.window=c;vm.createContext(c);let sawFix=false;
 for(const m of fs.readFileSync(path.join(DIST,'index.html'),'utf8').matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)){
  const f=m[1].split(/[?#]/)[0];if(f==='app.js')break;if(f===FIX){sawFix=true;if(skipFix)continue;}
  vm.runInContext(fs.readFileSync(path.join(DIST,f),'utf8'),c,{filename:f});
  if(f==='book2-vocabulary.js'){if(mutate)mutate(c);if(stopAtVocabulary)return c;}
 }
 if(!skipFix)assert(sawFix,'deployed index must load the explicit spelling correction');return c;
}
const lesson=c=>c.LESSONS.find(l=>l.id==='nce-b2-eef57c-l041');
function changedFields(c){const l=lesson(c);return plain({paragraphs:l.paragraphs,sourceNotes:l.textbook.sourceNotes,translation:l.translation,globalTranslation:c.BOOK2_TRANSLATIONS.lessons.find(t=>t.number===41),alignment:c.BOOK2_READING_ALIGNMENT.lessons.find(t=>t.number===41),remark:l.vocabulary.find(v=>v.word==='remark'),editorialCorrections:l.editorialCorrections||[]});}
const before=load({skipFix:true}),after=load();
test('published correction changes exactly one word in 276 passages while all Chinese, thirty packs and 877 expansion bindings survive',()=>{
 assert.equal(before.LESSONS.length,276);assert.equal(after.LESSONS.length,276);assert.equal(lesson(before).paragraphs[3].en,original);
 let changes=0;for(const b of before.LESSONS){const a=after.LESSONS.find(l=>l.id===b.id);assert(a);assert.deepEqual(plain(a.paragraphs.map(p=>p.zh)),plain(b.paragraphs.map(p=>p.zh)),b.id);assert.equal(a.paragraphs.length,b.paragraphs.length);for(let i=0;i<b.paragraphs.length;i++){const want=b.id==='nce-b2-eef57c-l041'&&i===3?corrected:b.paragraphs[i].en;assert.equal(a.paragraphs[i].en,want,b.id+' paragraph '+i);if(a.paragraphs[i].en!==b.paragraphs[i].en)changes++;}}
 assert.equal(changes,1);assert.deepEqual(plain(after.BOOK2_VOCABULARY),plain(before.BOOK2_VOCABULARY));
 assert.deepEqual(plain(after.BOOK2_TRANSLATIONS.lessons.map(t=>t.paragraphs.map(p=>p.zh))),plain(before.BOOK2_TRANSLATIONS.lessons.map(t=>t.paragraphs.map(p=>p.zh))));
 assert.deepEqual(plain(after.BOOK2_READING_ALIGNMENT.lessons.map(t=>t.paragraphs.map(p=>p.rows.map(r=>r.zh)))),plain(before.BOOK2_READING_ALIGNMENT.lessons.map(t=>t.paragraphs.map(p=>p.rows.map(r=>r.zh)))));
 const oldPacks=before.StudyPracticePacks.registry,newPacks=after.StudyPracticePacks.registry;assert.equal(oldPacks.lessonIds().length,30);assert.deepEqual(plain(newPacks.lessonIds()),plain(oldPacks.lessonIds()));for(const id of oldPacks.lessonIds())assert.deepEqual(plain(newPacks.get(id)),plain(oldPacks.get(id)),id);
 assert.equal(after.StudyKnowledge.bank.audit.expansionQuestions.length,877);assert.deepEqual(plain(after.StudyKnowledge.bank.audit.expansionQuestions),plain(before.StudyKnowledge.bank.audit.expansionQuestions));assert.deepEqual(plain(after.StudyKnowledge.bank.audit.expansionIssues),[]);
});
test('published L41 aligned sentence, translation binding and canonical remark use corrected spelling with complete original provenance',()=>{
 const l=lesson(after),t=after.BOOK2_TRANSLATIONS.lessons.find(t=>t.number===41),a=after.BOOK2_READING_ALIGNMENT.lessons.find(t=>t.number===41),e=l.editorialCorrections?.[0];
 assert.strictEqual(l.paragraphs,l.textbook.paragraphs);assert.strictEqual(l.editorialCorrections,l.textbook.editorialCorrections);assert.equal(l.paragraphs[3].en,corrected);assert.equal(t.paragraphs[3].enSha256,sha(corrected));assert.equal(a.paragraphs[3].rows[0].en,'‘We mustn’t buy things we don’t need,’ I remarked suddenly.');assert.equal(after.StudyKnowledge.bank.wordForLesson(l.id,'remark').example,a.paragraphs[3].rows[0].en);
 assert.equal(e.sourcePdfSha256,'30f1219bd738cfbfea00e8bc8e1b51f752a3eb1d47c87090f0120ded0a203633');assert.equal(e.sourcePdfPage,189);assert.equal(e.originalSpelling,'musn’t');assert.equal(e.correctedSpelling,'mustn’t');assert.match(e.evidenceSha256,/^[a-f0-9]{64}$/);assert.equal(e.visualEvidence.length,2);assert(e.visualEvidence.every(v=>/^[a-f0-9]{64}$/.test(v.sha256)));
 assert.deepEqual(plain(e.originalFields),changedFields(load({skipFix:true,stopAtVocabulary:true})));
 assert(l.textbook.sourceNotes.some(n=>/校订|校正/.test(n)));assert(l.translation.notes.some(n=>/校订|校正/.test(n)));assert(!l.translation.notes.some(n=>/未修改英文/.test(n)));assert.deepEqual(plain(t.translationNotes),plain(l.translation.notes));
 assert.doesNotMatch(fs.readFileSync(path.join(DIST,FIX),'utf8'),/[A-Z]:[\\/]|work\/|base64,/);
});
test('deployed recall Book2 cache validates the corrected L41 body and catalogue hash without changing a question at runtime',()=>{
 const book=JSON.parse(fs.readFileSync(path.join(DIST,'recall-data/book2.json'),'utf8')),row=book.lessons.find(x=>x.number===41),l=lesson(after);assert.equal(row.bodySha256,sha(l.paragraphs.map(p=>p.en).join('\n\n')));assert.equal(row.bodyFingerprint,after.StudyRecall.fingerprint(l));assert.equal(row.revision,sha(JSON.stringify({body:row.bodySha256,questions:row.questions.map(({instructionZh,grammarPointZh,...assessment})=>assessment),language:row.language,scope:row.scope})));assert.equal(after.StudyRecall.validateEntry(row,l).ok,true);assert.equal(row.questions.length,2);
 assert.equal(after.STUDY_RECALL_CATALOGUE.books['2'].url,'recall-data/book2.json?build='+sha(JSON.stringify(book)).slice(0,16));
 assert(!after.LESSONS.filter(l=>l.book===2).some(l=>l.paragraphs.some(p=>/musn[’']t/.test(p.en))));assert.deepEqual(plain(after.STUDY_WORD_AUDIO),plain(before.STUDY_WORD_AUDIO));for(const word of ["mustn't",'mustn’t']){assert.match(after.STUDY_WORD_AUDIO[word],/mustn[’']t\.wav$/);assert(fs.existsSync(path.join(DIST,after.STUDY_WORD_AUDIO[word])));}
});
test('source or linked-data drift fails closed and applying the correct state twice is idempotent',()=>{
 const code=fs.readFileSync(path.join(DIST,FIX),'utf8'),apply=c=>vm.runInContext(code,c,{filename:FIX}),snapshot=c=>JSON.stringify({lessons:c.LESSONS,texts:c.BOOK2_TEXTS,translation:c.BOOK2_TRANSLATIONS,alignment:c.BOOK2_READING_ALIGNMENT,archive:c.BOOK2_VOCABULARY});
 const cases=[c=>c.BOOK2_TEXT_STATUS.sourceSha256='0'.repeat(64),c=>lesson(c).textbook.sourcePdfPage=190,c=>lesson(c).textbook.title+=' drift',c=>{const l=c.LESSONS.find(l=>l.book===2&&l.number===40);l.textbook={...l.textbook};},c=>lesson(c).textbook.paragraphs=plain(lesson(c).paragraphs),c=>lesson(c).paragraphs[0].en+=' drift',c=>c.BOOK2_TRANSLATIONS.lessons.find(t=>t.number===41).paragraphs[3].enSha256='0'.repeat(64),c=>c.BOOK2_READING_ALIGNMENT.lessons.find(t=>t.number===41).paragraphs[3].rows[1].en+=' drift',c=>lesson(c).vocabulary.find(v=>v.word==='remark').example+=' drift',c=>lesson(c).textbook.bodySha256='0'.repeat(64),c=>lesson(c).translation.notes=null,c=>c.BOOK2_TRANSLATIONS.lessons.find(t=>t.number===41).paragraphs[3]=null,c=>lesson(c).vocabulary=[null]];
 for(const mutate of cases){const c=load({skipFix:true,stopAtVocabulary:true,mutate}),saved=snapshot(c);assert.doesNotThrow(()=>apply(c));assert.equal(snapshot(c),saved);assert.equal(lesson(c).paragraphs[3].en,original);}
 const c=load({skipFix:true,stopAtVocabulary:true});apply(c);assert.equal(lesson(c).paragraphs[3].en,corrected);const saved=snapshot(c);apply(c);assert.equal(snapshot(c),saved);assert.equal(c.BOOK2_SOURCE_SPELLING_FIX_STATUS.rows[0].status,'already-current');
});
