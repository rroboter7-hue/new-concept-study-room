const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),builder=require('../dev/build-advanced-language.cjs'),sources=builder.loadSources();
const compiled=path.join(root,'book34-language-support.js');
function live(){
 assert.ok(fs.existsSync(compiled),'full Book 3/4 support is compiled');const w={LESSONS:structuredClone(sources),document:{addEventListener(){}}};w.window=w;vm.createContext(w);
 for(const name of ['reading-layout.js','book34-language-support.js','audio.js','phrase-practice.js','recurrence.js','review-engine.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),w,{filename:name});
 return w;
}
test('all 108 advanced passages have complete sentence translations and reproducible build output',()=>{
 const w=live(),payload=builder.buildPayload();assert.equal(w.BOOK34_LANGUAGE_STATUS.applied,108);assert.equal(w.BOOK34_LANGUAGE_STATUS.rejected.length,0);
 assert.equal(payload.status[3].lessons,60);assert.equal(payload.status[4].lessons,48);assert.equal(fs.readFileSync(compiled,'utf8'),builder.browserSource(payload));
 for(const source of sources){
  const lesson=w.LESSONS.find(l=>l.id===source.id),m=w.StudyReading.model(lesson),audio=w.StudyAudio.splitSentences(lesson);
  assert.equal(m.hasAligned,true,source.id);assert.equal(m.fallbacks.length,0);assert.ok(m.rows.every(r=>r.zh.trim()&&r.aligned),source.id);
  assert.equal(w.StudyReading.normalize(m.rows.map(r=>r.en).join(' ')),w.StudyReading.normalize(source.paragraphs.map(p=>p.en).join(' ')),source.id);
  assert.deepEqual(Array.from(audio),Array.from(m.rows,r=>r.en),source.id+' audio indexes');
  const hidden=w.StudyReading.render(lesson,{showTranslation:false});assert.doesNotMatch(hidden,/class="translation reading-translation"/);assert.equal((hidden.match(/data-sentence=/g)||[]).length,m.rows.length);
 }
});
test('every new expression yields a source-matched cloze and remains available in daily review',()=>{
 const w=live(),cards=w.StudyReview.cardsForLessons(w.LESSONS);
 for(const entry of w.BOOK34_LANGUAGE_SUPPORT.lessons){
  const lesson=w.LESSONS.find(l=>l.id===entry.lessonId),practice=new w.PhrasePractice({getLesson:()=>lesson,escapeHTML:x=>String(x),wordHTML:x=>String(x)});
  for(const u of entry.usage){
   const item=practice.fillQuestions().find(p=>p.phrase===u.phrase);assert.ok(item,'cloze included '+entry.lessonId+' '+u.phrase);assert.equal(item.answer,u.matchedForm);assert.equal(w.PhrasePractice.gradeFill(u.matchedForm,item.answer),true);
   assert.ok(cards.some(c=>c.sourceLesson.id===entry.lessonId&&c.kind==='phrase'&&c.target===u.phrase),'review '+u.phrase);
  }
 }
});
test('advanced expressions enter the same earlier-lesson recurrence index',()=>{
 const w=live(),origin=w.LESSONS.find(l=>l.book===3&&l.number===1),p=origin.usage.find(u=>u.sourceType==='textbook-passage');
 const later={id:'later',book:4,number:999,paragraphs:[{en:p.example}],usage:[],vocabulary:[],grammar:[]};
 const rows=w.StudyRecurrence.build([origin,later]).forLesson('later',{studiedIds:[origin.id],limit:100});
 assert.ok(rows.some(r=>r.kind==='usage'&&r.label===p.phrase&&r.origins.some(o=>o.lessonId===origin.id&&o.studied)));
});
test('the real HTML script order applies all advanced lessons to their existing audio-linked IDs',()=>{
 const w={URL,URLSearchParams,TextEncoder,TextDecoder,document:{addEventListener(){},querySelector(){return null;}},addEventListener(){},location:{href:'http://localhost/',origin:'http://localhost',search:''}};w.window=w;vm.createContext(w);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)){
  const name=match[1].split('?')[0];if(name==='app.js')break;vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),w,{filename:name});
 }
 assert.equal(w.BOOK34_LANGUAGE_STATUS.applied,108);assert.equal(w.BOOK34_LANGUAGE_STATUS.rejected.length,0);
 for(const lesson of w.LESSONS.filter(l=>[3,4].includes(l.book))){assert.ok(w.StudyReading.units(lesson).every(r=>r.aligned&&r.zh),lesson.id);assert.ok(w.STUDY_LESSON_AUDIO[lesson.id],lesson.id+' retains audio');}
 const entry=w.BOOK34_LANGUAGE_SUPPORT.lessons.find(l=>l.book===3&&l.number===2),rows=entry.paragraphs.flatMap(p=>p.rows);
 const question=rows.find(r=>r.en.includes('Whatever are you doing'));
 assert.equal(question.kind,'speech');assert.match(question.speaker,/牧师/);assert.equal(rows.find(r=>r.en.includes("That's the trouble")).kind,'speech');
});
