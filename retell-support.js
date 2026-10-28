/* Source-bound Chinese retelling aids; never creates model answers or copy text. */
(function(root,factory){
  'use strict';
  const api=factory(typeof module==='object'&&module.exports?require('./person-name-targets.js'):root.StudyPersonNameTargets);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StudyRetellSupport=api;
})(typeof window!=='undefined'?window:globalThis,function(People){
  'use strict';
  const list=value=>Array.isArray(value)?value:[];
  const text=value=>typeof value==='string'?value.trim():'';
  function forLesson(lesson,options={}){
    lesson=lesson&&typeof lesson==='object'?lesson:{};
    const paragraphs=list(lesson.paragraphs);
    const rows=list(options.readingModel?.rows);
    const sections=paragraphs.map((paragraph,index)=>{
      const english=text(paragraph?.en),direct=text(paragraph?.zh);
      const aligned=rows.filter(row=>row?.paragraphIndex===index&&row.aligned===true&&text(row.zh)&&text(row.en));
      const englishJoined=aligned.map(row=>text(row.en)).join(' ').replace(/\s+/g,' ');
      const sourceMatched=!!english&&englishJoined===english.replace(/\s+/g,' ');
      const modelMeaning=sourceMatched?aligned.map(row=>text(row.zh)).join(''):'';
      const speakers=new Set(aligned.filter(row=>row.kind==='speech').map(row=>text(row.speaker)).filter(Boolean));
      const speaker=sourceMatched&&aligned.length&&aligned.every(row=>row.kind==='speech')&&speakers.size===1?[...speakers][0]:'';
      return speaker&&speaker!=='旁白'?{index,meaning:direct||modelMeaning,speaker}:{index,meaning:direct||modelMeaning};
    });
    const characters=list(People?.namesForLesson?.(lesson)).map(row=>({name:row.name,role:row.role||'',sourceText:row.sourceText||''}));
    const words=list(options.writingTargets?.words).filter(row=>row?.prior!==true&&row?.isLessonNew!==false&&text(row.word)&&text(row.meaning)).slice(0,8).map(row=>({word:text(row.word),meaning:text(row.meaning)}));
    const usages=list(options.writingTargets?.phrases).filter(row=>row?.prior!==true&&row?.isLessonNew!==false&&text(row.phrase)&&text(row.meaning||row.note)).slice(0,6).map(row=>({phrase:text(row.phrase),meaning:text(row.meaning||row.note)}));
    const missing=sections.some(row=>!row.meaning);
    return {sections,characters,words,usages,notice:missing?'部分段落暂无已核对的中文译文；请对照课文原文复述。':'以上提示均来自本课已有资料，请用自己的英文复述。'};
  }
  return Object.freeze({forLesson});
});
