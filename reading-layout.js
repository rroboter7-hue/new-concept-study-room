/* Source-preserving reading units; translations are used only after exact alignment. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.StudyReading=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const normalized=text=>String(text||'').replace(/\s+/g,' ').trim();
 function splitEnglish(value){
  const text=String(value||''),result=[];let start=0;
  const append=end=>{const part=text.slice(start,end).trim();if(part)result.push(part);start=end;};
  for(let i=0;i<text.length;i++){
   if(!/[.!?]/.test(text[i]))continue;
   if(text[i]==='.'){
    if(/\d/.test(text[i-1]||'')&&/\d/.test(text[i+1]||''))continue;
    const before=text.slice(start,i),after=text.slice(i+1);
    if(/\b(?:Mr|Mrs|Ms|Dr|Prof|St|Sr|Jr|Capt|Gen|Lt|Col|Mt|vs|etc|e\.g|i\.e)$/i.test(before))continue;
    if(/\bNo$/i.test(before)&&/^\s+(?:[IVXLCDM]+|\d+)\b/.test(after))continue;
    if(/\b(?:[ap]\.m|m\.p\.h)$/i.test(before)&&/^\s*[,;:—–-]/.test(after))continue;
    if(/[A-Za-z]/.test(text[i+1]||''))continue;
    const newSentence=/^\s+(?:If|The|A|An|He|She|It|Its|His|Her|Their|They|We|I|However|When|But|There|This|That|Many|Some|After|Before|By|During|For|Since|On|At|In|Although|As)\b/.test(after);
    if(/(?:\b[A-Z]\.)+[A-Z]$/.test(before)&&!newSentence||/\b[A-Z]$/.test(before)&&/^\s+(?:[A-Z]\.|[A-Z][a-z])/.test(after)&&!newSentence)continue;
    if(/\b[ap]\.m$/i.test(before)&&/^\s+[a-z]/.test(after))continue;
    if(/^\s+[a-z]/.test(after))continue;
   }
   let end=i+1;
   while(/[.!?]/.test(text[end]||'')&&end<text.length)end++;
   // Include closing quotation marks and brackets, but never consume an opening quote after whitespace.
   while(end<text.length&&/["'”’\])]/.test(text[end]))end++;
   const closed=/["'”’]$/.test(text.slice(i,end)),tail=text.slice(end);
   const reports='said|say|says|asked|asks|thought|thinks|replied|replies|shouted|cried|answered|added|repeated|exclaimed|explained|whispered|remarked|called';
   const attribution=new RegExp('^\\s+(?:(?:(?:I|he|she|we|they|you)|(?:(?:the|my|our)\\s+)?[A-Za-z][A-Za-z’\'-]*(?:\\s+[A-Za-z][A-Za-z’\'-]*){0,3})\\s+(?:'+reports+')\\b|(?:'+reports+')\\s+(?:the|my|our|his|her|their|he|she|I|[A-Z][a-z])\\b)','i');
   if(closed&&attribution.test(tail)){i=end-1;continue;}
   append(end);i=end-1;
  }
  append(text.length);
  // Isolated OCR punctuation belongs to its source sentence, not an empty reading row.
  return result.reduce((out,part)=>{if(!/[A-Za-z0-9]/.test(part)&&out.length)out[out.length-1]+=' '+part;else out.push(part);return out;},[]);
 }
 const kinds=new Set(['narration','speech','thought','note','mixed']);
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function paragraphsFor(lesson){
  let source=lesson?.paragraphs||[];
  if(!Array.isArray(source))source=source.en||source;
  if(!Array.isArray(source))source=[source];
  return source.map(p=>typeof p==='string'?{en:p,zh:''}:p||{});
 }
 function model(lesson,alignments=[...(root.BOOK2_READING_ALIGNMENT?.lessons||[]),...(root.BOOK34_READING_ALIGNMENT?.lessons||[])]){
  const rows=[],groups=[],fallbacks=[];
  const entry=(Array.isArray(alignments)?alignments:[]).find(e=>e.lessonId===lesson?.id&&e.book===lesson?.book&&e.number===lesson?.number);
  let hasAligned=false;
  paragraphsFor(lesson).forEach((p,paragraphIndex)=>{
   const source=splitEnglish(p.en),candidate=entry?.paragraphs?.find(p=>p.index===paragraphIndex)?.rows;
   const usable=Array.isArray(candidate)&&candidate.length===source.length&&candidate.every((row,i)=>normalized(row.en)===normalized(source[i])&&typeof row.zh==='string'&&row.zh.trim()&&kinds.has(row.kind)&&typeof row.speaker==='string'&&row.speaker.trim());
   if(usable)hasAligned=true;
   source.forEach((en,i)=>{
    const item=usable?candidate[i]:null;
    const row={index:rows.length,paragraphIndex,en,zh:item?.zh||(!candidate&&source.length===1?String(p.zh||''):''),kind:item?.kind||(p.speaker?'speech':'unlabelled'),speaker:item?.speaker||(typeof p.speaker==='string'?p.speaker:''),aligned:Boolean(usable),breakBefore:item?.breakBefore===true};
    rows.push(row);
    let group=groups[groups.length-1];
    if(!group||group.paragraphIndex!==paragraphIndex||group.kind!==row.kind||group.speaker!==row.speaker||row.breakBefore||group.rows.length>=(row.kind==='narration'||row.kind==='unlabelled'?3:4)){
     group={paragraphIndex,kind:row.kind,speaker:row.speaker,rows:[]};groups.push(group);
    }
    group.rows.push(row);
   });
   if(!usable&&(source.length>1||candidate)&&p.zh)fallbacks.push({paragraphIndex,zh:String(p.zh),reason:candidate?'source-drift':'not-aligned'});
  });
  return {rows,groups,fallbacks,hasAligned};
 }
 function units(lesson,alignments){return model(lesson,alignments).rows;}
 function render(lesson,options={}){
  const m=model(lesson,options.alignments),show=options.showTranslation!==false,e=options.escapeHTML||escape,wordHTML=options.wordHTML||e;
  if(!m.rows.length)return '';
  const missing=show&&!m.rows.some(row=>row.zh)&&!m.fallbacks.length?'<p class="translation-missing reading-notice">本课暂无译文。以下按原文句子和段落展示。</p>':'';
  const body=m.groups.map((g,gi)=>{
   const heading=g.speaker||'第 '+(g.paragraphIndex+1)+' 段 · 原文';
   const label=({narration:'旁白',speech:'人物对白',thought:'心里话',note:'文字内容',mixed:'叙述与引语'}[g.kind]||'原文');
   const content='<section class="reading-block reading-'+g.kind+'" aria-label="'+e(label+'：'+heading)+'"><div class="reading-turn"><strong>'+e(heading)+'</strong>'+(g.kind!=='narration'&&g.kind!=='unlabelled'?'<small>'+e(label)+'</small>':'')+'</div>'+g.rows.map(row=>'<div class="reading-pair"><p class="english"><span class="sentence" data-sentence="'+row.index+'">'+wordHTML(row.en)+'</span></p>'+(show&&row.zh?'<p class="translation reading-translation">'+e(row.zh)+'</p>':'')+'</div>').join('')+'</section>';
   const last=gi===m.groups.length-1||m.groups[gi+1].paragraphIndex!==g.paragraphIndex;
   const fallback=show&&last?m.fallbacks.find(f=>f.paragraphIndex===g.paragraphIndex):null;
   return content+(fallback?'<aside class="reading-paragraph-translation"><strong>本段参考译文（尚未逐句对应）</strong><p>'+e(fallback.zh)+'</p></aside>':'');
  }).join('');
  return '<div class="reading-layout">'+missing+body+'</div>';
 }
 return {splitEnglish,normalize:normalized,model,units,render};
});
