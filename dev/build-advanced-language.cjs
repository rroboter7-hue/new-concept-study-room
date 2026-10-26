const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const reading=require('../reading-layout.js'),root=path.resolve(__dirname,'..');

// Self-contained so the browser repeats the same source and evidence checks.
function validateEntry(entry,source,split){
 const fail=reason=>{throw new Error('Advanced language source mismatch: '+entry?.book+':'+entry?.number+' '+reason);};
 const chinese=value=>typeof value==='string'&&/[\u3400-\u9fff]/.test(value)&&!/^\s*(?:待翻译|待补充|TODO|TBD)\s*$/i.test(value);
 if(!entry||!source||![3,4].includes(entry.book)||source.id!==entry.lessonId||source.book!==entry.book||source.number!==entry.number||source.textbook?.title!==entry.title||source.textbook?.sourceSha256!==entry.sourceSha256||!/^[a-f0-9]{64}$/.test(entry.sourceSha256||''))fail('identity');
 if(!Array.isArray(entry.paragraphs)||!Array.isArray(source.paragraphs)||entry.paragraphs.length!==source.paragraphs.length)fail('paragraph count');
 for(let pi=0;pi<entry.paragraphs.length;pi++){
  const p=entry.paragraphs[pi],expected=split(source.paragraphs[pi].en);
  if(p.index!==pi||!Array.isArray(p.rows)||p.rows.length!==expected.length)fail('sentence count '+pi);
  for(let ri=0;ri<p.rows.length;ri++){
   const row=p.rows[ri];
   if(row.en!==expected[ri]||!chinese(row.zh)||!['narration','speech','thought','note','mixed'].includes(row.kind)||typeof row.speaker!=='string'||!row.speaker.trim())fail('sentence '+pi+':'+ri);
  }
 }
 if(!Array.isArray(entry.usage))fail('usage list');
 const seen=new Set();
 for(const u of entry.usage){
  const p=entry.paragraphs[u.sourceParagraphIndex],row=p?.rows?.[u.sourceSentenceIndex],key=String(u.phrase||'').toLowerCase().trim();
  if(!Number.isSafeInteger(u.sourceParagraphIndex)||!Number.isSafeInteger(u.sourceSentenceIndex)||!row||u.example!==row.en||u.exampleZh!==row.zh||typeof u.matchedForm!=='string'||!u.matchedForm.trim()||!u.example.includes(u.matchedForm)||key.split(/\s+/).length<2||seen.has(key)||!chinese(u.meaning)||!chinese(u.note)||u.sourceType!=='textbook-passage')fail('usage evidence '+key);
  seen.add(key);
 }
 return true;
}

function install(global,data,validate){
 const accepted=[],rejected=[],split=global.StudyReading.splitEnglish;
 for(const entry of data.lessons||[]){
  const lesson=(global.LESSONS||[]).find(l=>l.id===entry.lessonId);
  try{validate(entry,lesson,split);}catch{rejected.push({book:entry.book,number:entry.number,lessonId:entry.lessonId});continue;}
  for(const p of entry.paragraphs)lesson.paragraphs[p.index].zh=p.rows.map(r=>r.zh).join('');
  lesson.translation={label:data.label||'自编中文译文（非教材官方译文）',reviewStatus:data.reviewStatus||'self-reviewed',notes:entry.translationNotes||[]};
  lesson.textbook.translation=lesson.translation;
  const keys=new Set(entry.usage.map(u=>u.phrase.toLowerCase().trim()));
  const usage=entry.usage.map(u=>({...u,sourcePage:lesson.textbook.sourcePdfPage,sourceUrl:lesson.textbook.sourceUrl,sourceLabel:'教材正文中的表达 · 自编释义与用法说明',meaningSource:'本课语境释义（学习整理）'}));
  const original=lesson.sourceNoteUsage||lesson.usage||[];
  lesson.sourceNoteUsage=original;
  lesson.usage=[...usage,...original.filter(u=>u.needsContextReview!==true&&typeof u.meaning==='string'&&u.meaning.trim()&&!/未附(?:独立)?中文释义|未提供中文释义|暂无释义|待(?:补充|复核)|原笔记习惯表达/.test(u.meaning)&&!keys.has(String(u.phrase||'').toLowerCase().trim()))];
  accepted.push(entry);
 }
 global.BOOK34_READING_ALIGNMENT={version:1,label:data.label,lessons:accepted};
 global.BOOK34_LANGUAGE_STATUS={applied:accepted.length,rejected};
}

function browserSource(payload){
 return '/* Newly authored study translations and phrase notes; original English is unchanged. */\nwindow.BOOK34_LANGUAGE_SUPPORT='+JSON.stringify(payload)+';\n('+install.toString()+')(window,window.BOOK34_LANGUAGE_SUPPORT,'+validateEntry.toString()+');\n';
}
function loadSources(){
 const w={URL,URLSearchParams,TextEncoder,TextDecoder,document:{addEventListener(){},querySelector(){return null;}},addEventListener(){},location:{href:'http://localhost/',origin:'http://localhost',search:''}};w.window=w;vm.createContext(w);
 const scripts=Array.from(fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g),m=>m[1].split('?')[0]);
 const stop=scripts.indexOf('book34-language-support.js');if(stop<0)throw new Error('Advanced language bootstrap is not present in the live HTML');
 for(const file of scripts.slice(0,stop))vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),w,{filename:file});
 return w.LESSONS.filter(l=>[3,4].includes(l.book));
}
function buildPayload(){
 const sources=loadSources(),files=['reading-book3-01-30.json','reading-book3-31-60.json','reading-book4-01-48.json'];
 const lessons=files.flatMap(file=>JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8')).lessons),seen=new Set();
 const status={3:{lessons:0,sentences:0,expressions:0},4:{lessons:0,sentences:0,expressions:0}};
 for(const entry of lessons){
  if(seen.has(entry.lessonId))throw new Error('Duplicate advanced lesson '+entry.lessonId);seen.add(entry.lessonId);
  validateEntry(entry,sources.find(l=>l.id===entry.lessonId),reading.splitEnglish);
  if(entry.usage.length<4||entry.usage.length>6)throw new Error('Expected 4–6 expressions: '+entry.lessonId);
  const s=status[entry.book];s.lessons++;s.sentences+=entry.paragraphs.reduce((n,p)=>n+p.rows.length,0);s.expressions+=entry.usage.length;
 }
 if(lessons.length!==108||status[3].lessons!==60||status[4].lessons!==48||sources.some(l=>!seen.has(l.id)))throw new Error('Advanced language coverage incomplete');
 return {version:1,label:'自编中文译文（非教材官方译文）',reviewStatus:'self-reviewed',status,lessons:lessons.sort((a,b)=>a.book-b.book||a.number-b.number)};
}
module.exports={validateEntry:(entry,source)=>validateEntry(entry,source,reading.splitEnglish),browserSource,loadSources,buildPayload};
if(require.main===module){const payload=buildPayload();fs.writeFileSync(path.join(root,'book34-language-support.js'),browserSource(payload));console.log(JSON.stringify(payload.status));}
