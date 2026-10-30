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
  // This is a source-spelling aid, not a guess at who a person is.
  function nounHints(lesson,characters,targets){
    const source=list(lesson.paragraphs).map(row=>text(row?.en)).filter(Boolean);
    const knownPeople=new Set(characters.map(row=>row.name.toLocaleLowerCase('en')));
    const common=new Set('I We You He She It They The A An My Our Your His Her Their This That These Those There Here Then When While After Before If But And Or So As At In On With For From To By Of One Two Three Some Many Most All Last Next Soon Suddenly However Yes No What Why How Where Who Which Please Hello Well'.toLowerCase().split(' '));
    'do does did can could would should shall will must might am is are was were have has had dear certainly oh though because until unless once just very quite perhaps apparently instead despite even now yesterday today tomorrow naturally fortunately unfortunately during something someone everything everybody everyone nothing nobody both each neither either much little never always almost whenever whatever wherever indeed good thank thanks excuse sorry look listen wait stop come go young'.split(' ').forEach(word=>common.add(word));
    const properNames=[],seen=new Set();
    // Positive lexical/context evidence is required for isolated capitals.
    // Capitalization alone would turn "Sit", "Give" and "Women" into names.
    const namedForms=new Set(('London Paris England Britain France Germany Italy Greece Spain Portugal Europe America Australia China Japan Korea Russia Canada Africa Asia India Switzerland Austria Sweden Norway Denmark Finland Iceland Turkey Egypt California Portsmouth Rome Beijing Tokyo Berlin Moscow Sydney Melbourne Shanghai Atlantic Pacific Mediterranean Nile Thames Earth Mars Venus Jupiter Saturn Sunday Monday Tuesday Wednesday Thursday Friday Saturday January February March April May June July August September October November December English French German Italian Spanish Greek Dutch American British Chinese Japanese Korean Russian Austrian Danish Swedish Norwegian Icelandic Turkish').toLowerCase().split(' '));
    const vocabulary=[...list(targets?.words),...list(lesson.vocabulary)];
    function singleNameEvidence(name,paragraph){
      const key=name.toLowerCase();
      if(namedForms.has(key)||/s$/.test(key)&&namedForms.has(key.slice(0,-1))||/^(?:[A-Z]\.){2,}$/.test(name)||/^[A-Z]{2,}$/.test(name))return true;
      const rows=vocabulary.filter(row=>text(row?.word).toLowerCase()===key);
      if(rows.some(row=>row.isProperName===true||/proper/i.test(text(row.pos))||/^[\p{Lu}]/u.test(text(row.word))&&/人名|姓氏|地名|国名|州名|市|城市|本课船名|名称/.test(text(row.meaning))))return true;
      if(rows.some(row=>/^[a-z]/.test(text(row.word))))return false;
      const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      return new RegExp('(?:\\b(?:called|named|aunt|uncle|cousin|river|lake|Mount|in|at|from|to)\\s+'+escaped+'(?![\\p{L}\\p{M}])|(?<![\\p{L}\\p{M}])'+escaped+'\\s+(?:said|asked|replied|answered|exclaimed|cried|shouted|whispered)\\b)','u').test(paragraph);
    }
    const atom='(?:(?:[A-Z]\\.){1,}|(?:Mr|Mrs|Ms|Dr|St|Prof|Capt)\\.|[\\p{Lu}][\\p{L}\\p{M}\\d]*(?:[’\'\\-][\\p{L}\\p{M}\\d]+)*)';
    const pattern=new RegExp(atom+'(?:[ \\t]+(?:(?:of|the|de|van)[ \\t]+)?'+atom+')*','gu');
    function addName(name,paragraph){
      name=name.trim().replace(/[’']s$/,'');const key=name.toLocaleLowerCase('en');
      if(!name||name.length===1||common.has(key)||knownPeople.has(key)||seen.has(key))return;
      if(!/\s/.test(name)&&!singleNameEvidence(name,paragraph))return;
      if(characters.some(row=>{const parts=row.name.toLowerCase().replace(/[.]/g,'').split(/\s+/);return key.replace(/[.]/g,'').split(/\s+/).every(part=>parts.includes(part));}))return;
      seen.add(key);properNames.push({name,sourceText:paragraph});
    }
    for(const paragraph of source)for(const match of paragraph.matchAll(pattern)){
      const name=match[0],tokens=Array.from(name.matchAll(/\S+/g)),quotedTitle=/^The\s/.test(name)&&/[“‘"']$/.test(paragraph.slice(0,match.index).trimEnd());
      if(quotedTitle||/^(?:Mr|Mrs|Ms|Dr|St|Prof|Capt)\.\s+\S/.test(name)){addName(name,paragraph);continue;}
      let start=null,end=0;
      const finish=()=>{if(start!==null)addName(name.slice(start,end),paragraph);start=null;};
      tokens.forEach((token,index)=>{
        const value=token[0],key=value.toLowerCase(),base=key.split(/[’']/)[0],connector=/^(?:of|the|de|van)$/.test(value)&&start!==null;
        const modalMay=key==='may'&&tokens[index+1]&&/^(?:I|You|He|She|It|We|They)$/.test(tokens[index+1][0]);
        const stop=!connector&&(common.has(key)||common.has(base)||modalMay||/^(?:mr|mrs|ms|dr|prof|capt)$/.test(key));
        if(stop)finish();else{if(start===null)start=token.index;end=token.index+value.length;}
      });finish();
    }
    const nouns=[],seenNouns=new Set();
    for(const row of [...list(targets?.words),...list(lesson.vocabulary)]){
      const word=text(row?.word),key=word.toLowerCase();
      if(!word||seenNouns.has(key)||!/(?:^|[\s;/])(?:n\.|noun)(?:$|[\s;/])/.test(text(row.pos))||row.isPersonName===true)continue;
      const form=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      if(!source.some(line=>new RegExp('(?<![\\p{L}])'+form+'(?:s|es)?(?![\\p{L}])','iu').test(line)))continue;
      const meaning=text(row.meaning),ambiguous=/\b(?:v|vi|vt|adj|adv)\./.test(meaning);
      if(ambiguous&&!source.some(line=>new RegExp('\\b(?:a|an|the|his|her|my|our|their|this|that|its)\\s+(?:(?:own|little|small|large|famous|old|new|important|big|young|quiet)\\s+){0,3}'+form+'(?:s|es)?\\b','iu').test(line)))continue;
      if(properNames.some(row=>row.name.toLowerCase()===key)||characters.some(row=>row.name.toLowerCase()===key))continue;
      const brief=meaning.replace(/^\s*n\.\s*/,'').split(/\s+\b(?:v|vi|vt|adj|adv|a)\./)[0].split(/[,，;；\n]/)[0].trim();
      seenNouns.add(key);nouns.push({word,meaning:brief,sourceText:source.find(line=>new RegExp(form,'iu').test(line))});
    }
    return {properNames,nouns};
  }
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
    const words=list(options.writingTargets?.words).filter(row=>row?.prior!==true&&row?.isLessonNew!==false&&text(row.word)&&text(row.meaning)).map(row=>({word:text(row.word),meaning:text(row.meaning)}));
    const usages=list(options.writingTargets?.phrases).filter(row=>row?.prior!==true&&row?.isLessonNew!==false&&text(row.phrase)&&text(row.meaning||row.note)).map(row=>({phrase:text(row.phrase),meaning:text(row.meaning||row.note),...provenance(row)}));
    const missing=sections.some(row=>!row.meaning);
    return {sections,scenes,characters,participants,words,usages,...nounHints(lesson,characters,options.writingTargets),notice:missing?'部分段落暂无已核对的中文译文；请对照课文原文复述。':'以上提示均来自本课已有资料，请用自己的英文复述。'};
  }
  return Object.freeze({forLesson});
});
