'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),test=require('node:test'),assert=require('node:assert/strict');
const ROOT=process.env.PILOT_APP_DIST?path.resolve(process.env.PILOT_APP_DIST):fs.existsSync(path.join(__dirname,'..','index.html'))?path.resolve(__dirname,'..'):path.resolve(__dirname,'..');
const fixture=[path.join(__dirname,'fixtures/reviewed30-before-sourcefix-baseline.json'),path.join(__dirname,'reviewed30-before-sourcefix-baseline.json')].find(fs.existsSync),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),hash=x=>sha(JSON.stringify(x??null)),plain=x=>JSON.parse(JSON.stringify(x));
const bytes=fs.readFileSync(fixture);assert.equal(sha(bytes),'d18598d25044de61cef9ee1c9baf582d4773a40be0b851e9c79bedf99e4e9607');const old=JSON.parse(bytes);
const files=[...fs.readFileSync(path.join(ROOT,'index.html'),'utf8').matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>m[1].split(/[?#]/)[0]);
function load(){const c={document:{addEventListener(){},getElementById(){return null;}},setTimeout(){},clearTimeout(){},URLSearchParams,location:{search:''}};c.window=c;vm.createContext(c);for(const f of files){if(f==='app.js')break;vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),c,{filename:f});}return c;}
const c=load(),lesson=n=>c.LESSONS.find(l=>l.book===2&&l.number===n),A=c.StudyPracticePacks;
test('sourcefix actual wiring loads both approved usage providers and the four lexical repairs before the shared answer bank',()=>{
 for(const f of ['book2-reviewed-usage-21-25.js','book2-reviewed-usage-26-30.js'])assert(files.indexOf(f)>=0&&files.indexOf(f)<files.indexOf('reviewed-usage-registry.js'));
 const lexical=files.indexOf('book2-lexical-source-corrections-32-34.js');assert(lexical>=0&&lexical<files.indexOf('book2-practice-packs.js')&&lexical<files.indexOf('knowledge-bootstrap.js'));
 assert.equal(c.BOOK2_LEXICAL_SOURCE_CORRECTIONS_32_34_STATUS.rows.filter(r=>r.status==='applied').length,4);
 for(let n=21;n<=30;n++)assert(c.StudyReviewedUsage.statusForLesson(lesson(n)).bound,'L'+n);
});
test('sourcefix retains all thirty published packs and synthetic completion records exactly',()=>{
 assert.equal(old.packs.length,30);assert(A.registry.lessonIds().length>=30);for(const p of old.packs){const current=A.registry.get(p.lessonId);assert.equal(hash(current),p.runtimeSha256);assert.equal(current.revision,p.revision);const session=A.restore(plain(p.completeAttempt),current);assert(!session.stale);assert.equal(A.result(session,current).percent,100);assert.equal(session.attemptId,p.completeAttempt.attemptId);for(const key of ['answers','audioPlayed','startedAt','completeAt','resultSaved'])assert.deepEqual(plain(session[key]),plain(p.completeAttempt[key]));}
 assert.equal(hash(c.BOOK2_QUESTION_EXPANSION),old.pilotExpansionSha256);assert.equal(hash(c.BOOK2_LATER_QUESTION_EXPANSION),old.laterExpansionSha256);assert.equal(c.StudyKnowledge.bank.audit.expansionQuestions.length,877);assert.equal(hash(c.StudyKnowledge.bank.audit.expansionQuestions),old.expansionAuditSha256);
 assert.equal(hash(c.STUDY_WORD_AUDIO),old.globalAudioSha256);assert.equal(hash(c.STUDY_CONTEXT_WORD_AUDIO),old.contextAudioSha256);
});
test('sourcefix keeps276 readings and original grammar, audits exactly four changed words and corrects exactly two wrong word answers',()=>{
 assert.equal(c.LESSONS.length,276);const allowedWords=new Set(old.originalVocabulary.map(x=>x.lessonId)),changedAnswers=[];
 for(const row of old.readings){const l=c.LESSONS.find(l=>l.id===row.id);assert.equal(l.title,row.title);for(const [key,digest]of [['paragraphs','paragraphsSha256'],['translation','translationSha256'],['lines','linesSha256'],['grammar','grammarSha256']])assert.equal(hash(l[key]),row[digest],l.id+' '+key);if(!allowedWords.has(l.id))assert.equal(hash(l.vocabulary),row.vocabularySha256,l.id+' vocabulary');assert.equal((l.quiz||[]).length,row.quizzes.length);for(const q of row.quizzes)if(hash(l.quiz[q.index])!==q.sha256){assert.equal(l.quiz[q.index].conceptId,q.conceptId);changedAnswers.push(q.conceptId);}}
 assert.deepEqual(changedAnswers,['knowledge:nce-b2-eef57c-l033:word:light','knowledge:nce-b2-eef57c-l034:word:most']);
 const expected={once:['adv.','曾经；从前'],light:['n.','灯光；光'],station:['n.','警察局'],most:['adv.','非常；极其']};
 for(const row of old.originalVocabulary){const l=c.LESSONS.find(l=>l.id===row.lessonId),v=l.vocabulary.find(v=>v.word===row.word),canonical=c.StudyKnowledge.bank.wordForLesson(l.id,v.word);assert.deepEqual([canonical.pos,canonical.meaning],expected[v.word]);assert.equal(canonical.conceptId,row.canonical.conceptId);assert.deepEqual(plain(v.lexicalSourceCorrectionAudit.originalCanonicalRecord),row.canonical);assert(l.paragraphs.some(p=>p.en.includes(canonical.example)));}
 for(const [n,w,meaning,bad]of [[33,'light','灯光；光','轻的；光'],[34,'most','非常；极其','大多数；最']]){const q=lesson(n).quiz.find(q=>q.conceptId==='knowledge:'+lesson(n).id+':word:'+w);assert.equal(q.options[q.answer],meaning);assert.equal(q.options.filter(x=>x===meaning).length,1);assert(!q.options.includes(bad));assert(!q.explanation.includes(bad));}
});
test('sourcefix preserves all26 complete usage examples and exposes16 source grammar notes plus6 ungraded patterns',()=>{
 let examples=0,active=0,grammar=0,patterns=0;for(const row of old.originalUsageExamples){const l=c.LESSONS.find(l=>l.id===row.lessonId);active+=l.usage.length;for(const example of row.examples){assert(l.usage.some(p=>p.example===example||(p.additionalExamples||[]).some(x=>x.example===example)));examples++;}grammar+=c.StudyReviewedUsage.grammarNotesFor(l).length;patterns+=c.StudyReviewedUsage.patternNotesFor(l).length;}
 assert.equal(examples,26);assert.equal(active,26);assert.equal(grammar,16);assert.equal(patterns,6);
 assert(!lesson(27).usage.some(p=>p.phrase==='As soon as they put out the fire, they'));const effect=lesson(28).usage.find(p=>p.phrase==='have no effect');assert.equal(effect.meaning,'没有效果；不起作用');assert.equal(effect.example,'This doesn’t have any effect.');assert(!c.StudyReview.cardsForLessons([lesson(27)]).some(p=>p.target==='As soon as they put out the fire, they'));
 const sight=c.StudyReviewedUsage.patternNotesFor(lesson(30)).find(p=>p.phrase==='in sight');assert.match(sight.note,/had all run away/);assert.equal(c.PhrasePractice.isGradedEligible(sight,lesson(30)),false);
});
