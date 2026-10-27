'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),core=require('../lesson-recall-core.js');
const root=path.resolve(__dirname,'..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function loadLessons(){const c={document:{addEventListener(){}},URLSearchParams,location:{search:''}};c.window=c;vm.createContext(c);for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script defer src="([^"]+)"/g)){const f=m[1].split('?')[0];if(f==='app.js')break;vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});}return c.LESSONS;}
function compile(batch,lessons){
 if(batch.version!==1||!Number.isInteger(batch.book)||!Array.isArray(batch.lessons))throw Error('Invalid recall batch');
 if(batch.language!=='en'||batch.scope!=='grammar')throw Error('Expected English grammar recall batch');
 const english=value=>typeof value==='string'&&/[A-Za-z0-9]/.test(value)&&!/\p{Script=Han}/u.test(value);
 const exercises=new Set(['gap-fill','transformation','correction','word-order','form-choice']);
 const actual=lessons.filter(l=>l.book===batch.book),seen=new Set(),entries=[];
 for(const source of batch.lessons){
  if(seen.has(source.lessonId))throw Error('Duplicate '+source.lessonId);seen.add(source.lessonId);const lesson=actual.find(l=>l.id===source.lessonId);if(!lesson)throw Error('Unknown '+source.lessonId);
  if(source.bodySha256!==sha(lesson.paragraphs.map(p=>p.en).join('\n\n')))throw Error('Body changed '+source.lessonId);
  const questions=source.questions.map(q=>({...q,...(q.type==='short'?{answerLanguage:'en'}:{})}));
  const entry={...source,language:'en',scope:'grammar',questions,bodyFingerprint:core.fingerprint(lesson),revision:sha(JSON.stringify({body:source.bodySha256,questions,language:'en',scope:'grammar'}))};
  const valid=core.validateEntry(entry,lesson);if(!valid.ok)throw Error(source.lessonId+': '+valid.reason);
  if(entry.questions.length!==2||entry.questions.filter(q=>q.type==='choice').length!==1||entry.questions.filter(q=>q.type==='short').length!==1)throw Error('Expected choice and short '+source.lessonId);
  for(const q of entry.questions){
   if(!english(q.prompt)||q.options?.some(x=>!english(x))||q.answers?.some(x=>!english(x)))throw Error('Expected English exercise text and answers '+source.lessonId);
   if(q.focus!=='grammar'||!english(q.grammarPoint)||!exercises.has(q.exercise))throw Error('Missing grammar target or exercise type '+source.lessonId);
   if(q.type==='choice'&&q.wrongReasons.length!==q.options.length)throw Error('Missing wrong reasons '+source.lessonId);
   if(q.type==='short'){
    if(/non-defining|nonrestrictive/i.test(q.grammarPoint+' '+q.prompt)&&q.punctuation!=='commas')throw Error('Missing grammar comma checking '+source.lessonId);
    const format={apostrophes:true,commas:q.punctuation==='commas'};
    for(const mistake of q.commonMistakes||[])for(const answer of mistake.answers||[])if(q.answers.some(x=>core.normalize(x,format)===core.normalize(answer,format)))throw Error('Conflicting alias '+source.lessonId);
   }
  }
  entries.push(entry);
 }
 if(actual.some(l=>!seen.has(l.id)))throw Error('Incomplete recall coverage for book '+batch.book);
 entries.sort((a,b)=>a.number-b.number);return {version:1,book:batch.book,language:'en',scope:'grammar',lessons:entries};
}
function build(){const lessons=loadLessons(),catalogue={version:1,books:{}},out=path.join(root,'recall-data');fs.mkdirSync(out,{recursive:true});let questions=0;
 for(let book=1;book<=4;book++){const data=compile(JSON.parse(fs.readFileSync(path.join(__dirname,'lesson-recall-book'+book+'.json'),'utf8')),lessons),json=JSON.stringify(data),revision=sha(json).slice(0,16);fs.writeFileSync(path.join(out,'book'+book+'.json'),json+'\n');catalogue.books[book]={url:'recall-data/book'+book+'.json?build='+revision,lessonIds:data.lessons.map(l=>l.lessonId)};questions+=data.lessons.reduce((n,l)=>n+l.questions.length,0);}
 fs.writeFileSync(path.join(root,'lesson-recall-catalogue.js'),'window.STUDY_RECALL_CATALOGUE='+JSON.stringify(catalogue)+';\n');return {lessons:lessons.length,questions};}
module.exports={loadLessons,compile,build};if(require.main===module)console.log(JSON.stringify(build()));
