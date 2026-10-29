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
    const scenes=[],verifiedRows=[];
    sections.forEach(section=>{
      const aligned=rows.filter(row=>row?.paragraphIndex===section.index);
      const groups=list(options.readingModel?.groups).filter(group=>group?.paragraphIndex===section.index);
      const grouped=groups.flatMap(group=>list(group.rows));
      const verified=aligned.length>0&&aligned.every(row=>row.aligned===true&&text(row.en)&&text(row.zh))&&aligned.map(row=>text(row.en)).join(' ').replace(/\s+/g,' ')===text(paragraphs[section.index]?.en).replace(/\s+/g,' ')&&grouped.length===aligned.length&&grouped.every((row,index)=>row===aligned[index]);
      if(!verified){scenes.push({...section,paragraphIndex:section.index,kind:'paragraph'});return;}
      verifiedRows.push(...aligned);
      groups.forEach(group=>scenes.push({index:scenes.length,paragraphIndex:section.index,kind:group.kind||'narration',speaker:text(group.speaker),meaning:list(group.rows).map(row=>text(row.zh)).join('')}));
    });
    // First-person narration is a role in the story, never a vocabulary target.
    // Quoted first-person speech alone cannot establish a narrator.
    const narrator=verifiedRows.find(row=>row.kind==='narration'&&/\bI\b/.test(row.en)&&!/[‘“"]/.test(row.en));
    const participants=narrator?[{name:'I',role:'叙述者（我）',sourceText:text(narrator.en)},...characters]:characters.slice();
    function provenance(row){
      const passage=['lesson-passage','textbook-passage'].includes(row.sourceType)&&list(paragraphs).some(paragraph=>list(row.sourceForms).some(form=>text(form)&&text(paragraph.en).includes(text(form)))||text(row.phrase)&&text(paragraph.en).includes(text(row.phrase)));
      const prior=list(row.contextEvidence?.relatedPriorLessons).some(item=>text(item.lessonId)&&item.lessonId!==lesson.id);
      const notes=['lesson-notes','edited-lesson-notes'].includes(row.sourceType);
      const sourceKind=passage?'passage':prior?'prior-revision':notes?'lesson-extension':'lesson-material';
      return {sourceKind,sourceKindLabel:passage?'本课正文表达':prior?'本课笔记 · 旧知复习线索':notes?'本课笔记扩展（非正文）':'本课已有资料（来源未细分）'};
    }
    const words=list(options.writingTargets?.words).filter(row=>row?.prior!==true&&row?.isLessonNew!==false&&text(row.word)&&text(row.meaning)).slice(0,8).map(row=>({word:text(row.word),meaning:text(row.meaning)}));
    const usages=list(options.writingTargets?.phrases).filter(row=>row?.prior!==true&&row?.isLessonNew!==false&&text(row.phrase)&&text(row.meaning||row.note)).slice(0,6).map(row=>({phrase:text(row.phrase),meaning:text(row.meaning||row.note),...provenance(row)}));
    const missing=sections.some(row=>!row.meaning);
    return {sections,scenes,characters,participants,words,usages,notice:missing?'部分段落暂无已核对的中文译文；请对照课文原文复述。':'以上提示均来自本课已有资料，请用自己的英文复述。'};
  }
  return Object.freeze({forLesson});
});
