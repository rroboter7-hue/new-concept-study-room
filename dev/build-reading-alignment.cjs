const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../reading-layout.js');
const root=path.resolve(__dirname,'..'),scope={window:{}};
vm.createContext(scope);
for(const file of ['book2-lessons.js','book2-translations.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8').split('(function(){')[0],scope);
const lessons=['01-32','33-64','65-96'].flatMap(range=>JSON.parse(fs.readFileSync(path.join(__dirname,'reading-book2-'+range+'.json'),'utf8')).lessons);
const seen=new Set();let sentenceCount=0;
for(const l of lessons){
 if(seen.has(l.number))throw Error('Duplicate lesson '+l.number);seen.add(l.number);
 const source=scope.window.BOOK2_TEXTS.find(s=>s.number===l.number),translation=scope.window.BOOK2_TRANSLATIONS.lessons.find(s=>s.number===l.number);
 if(!source||l.book!==2||l.title!==source.title||l.lessonId!==translation.lessonId||l.paragraphs.length!==source.paragraphs.length)throw Error('Wrong lesson identity '+l.number);
 for(let pi=0;pi<l.paragraphs.length;pi++){
  const p=l.paragraphs[pi],expected=core.splitEnglish(source.paragraphs[pi].en);
  if(p.index!==pi||p.rows.length!==expected.length)throw Error('Wrong paragraph shape '+l.number+':'+pi);
  for(let ri=0;ri<p.rows.length;ri++){
   const r=p.rows[ri];
   if(r.en!==expected[ri]||typeof r.zh!=='string'||!r.zh.trim()||!['narration','speech','thought','note','mixed'].includes(r.kind)||typeof r.speaker!=='string'||!r.speaker.trim())throw Error('Invalid alignment '+l.number+':'+pi+':'+ri);
   sentenceCount++;
  }
 }
}
if(seen.size!==96||Array.from({length:96},(_,i)=>i+1).some(n=>!seen.has(n)))throw Error('Book2 alignment incomplete');
const output={version:1,label:'逐句自编中文译文（非教材官方译文）',source:'book2-lessons.js / existing self-authored Chinese translations',reviewStatus:'self-reviewed-with-independent-cross-check',status:{book:2,lessons:96,sentences:sentenceCount},lessons:lessons.sort((a,b)=>a.number-b.number)};
fs.writeFileSync(path.join(root,'book2-reading-alignment.js'),'/* Sentence-aligned, self-authored Chinese. English and source paragraphs are unchanged. */\nwindow.BOOK2_READING_ALIGNMENT='+JSON.stringify(output)+';\n');
console.log(JSON.stringify(output.status));
