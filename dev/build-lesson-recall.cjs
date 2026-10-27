'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),core=require('../lesson-recall-core.js');
const root=path.resolve(__dirname,'..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function loadLessons(){const c={document:{addEventListener(){}},URLSearchParams,location:{search:''}};c.window=c;vm.createContext(c);for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script defer src="([^"]+)"/g)){const f=m[1].split('?')[0];if(f==='app.js')break;vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});}return c.LESSONS;}
function compile(batch,lessons){
 if(batch.version!==1||!Number.isInteger(batch.book)||!Array.isArray(batch.lessons))throw Error('Invalid recall batch');const actual=lessons.filter(l=>l.book===batch.book),seen=new Set(),entries=[];
 for(const source of batch.lessons){
  if(seen.has(source.lessonId))throw Error('Duplicate '+source.lessonId);seen.add(source.lessonId);const lesson=actual.find(l=>l.id===source.lessonId);if(!lesson)throw Error('Unknown '+source.lessonId);
  if(source.bodySha256!==sha(lesson.paragraphs.map(p=>p.en).join('\n\n')))throw Error('Body changed '+source.lessonId);
  const entry={...source,bodyFingerprint:core.fingerprint(lesson),revision:sha(JSON.stringify({body:source.bodySha256,questions:source.questions}))};
  const valid=core.validateEntry(entry,lesson);if(!valid.ok)throw Error(source.lessonId+': '+valid.reason);
  if(entry.questions.length!==2||entry.questions.filter(q=>q.type==='choice').length!==1||entry.questions.filter(q=>q.type==='short').length!==1)throw Error('Expected choice and short '+source.lessonId);
  for(const q of entry.questions){if(q.type==='choice'&&q.wrongReasons.length!==q.options.length)throw Error('Missing wrong reasons '+source.lessonId);if(q.type==='short'){const formatted=q.answers.every(x=>/^[0-9\s.]+$/.test(x))||(/字母/.test(q.prompt)&&q.answers.every(x=>/^[A-Za-z\s.]+$/.test(x)))||(/请写英文/.test(q.prompt)&&q.answers.every(x=>/[A-Za-z]/.test(x)));if(!formatted&&(!q.answers.some(x=>/[\u3400-\u9fff]/.test(x))||!q.answers.some(x=>/[A-Za-z0-9]/.test(x))))throw Error('Missing bilingual aliases '+source.lessonId);for(const mistake of q.commonMistakes||[])for(const answer of mistake.answers||[])if(q.answers.some(x=>core.normalize(x)===core.normalize(answer)))throw Error('Conflicting alias '+source.lessonId);}}
  entries.push(entry);
 }
 if(actual.some(l=>!seen.has(l.id)))throw Error('Incomplete recall coverage for book '+batch.book);
 entries.sort((a,b)=>a.number-b.number);return {version:1,book:batch.book,lessons:entries};
}
function build(){const lessons=loadLessons(),catalogue={version:1,books:{}},out=path.join(root,'recall-data');fs.mkdirSync(out,{recursive:true});let questions=0;
 for(let book=1;book<=4;book++){const data=compile(JSON.parse(fs.readFileSync(path.join(__dirname,'lesson-recall-book'+book+'.json'),'utf8')),lessons),json=JSON.stringify(data),revision=sha(json).slice(0,16);fs.writeFileSync(path.join(out,'book'+book+'.json'),json+'\n');catalogue.books[book]={url:'recall-data/book'+book+'.json?build='+revision,lessonIds:data.lessons.map(l=>l.lessonId)};questions+=data.lessons.reduce((n,l)=>n+l.questions.length,0);}
 fs.writeFileSync(path.join(root,'lesson-recall-catalogue.js'),'window.STUDY_RECALL_CATALOGUE='+JSON.stringify(catalogue)+';\n');return {lessons:lessons.length,questions};}
module.exports={loadLessons,compile,build};if(require.main===module)console.log(JSON.stringify(build()));
