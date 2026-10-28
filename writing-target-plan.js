/* Source-aware writing targets; daily scheduling never changes these quotas. */
(function(root,factory){
  'use strict';
  const api=factory(root,typeof module==='object'&&module.exports?require('./person-name-targets.js'):root.StudyPersonNameTargets);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StudyWritingTargets=api;
})(typeof window!=='undefined'?window:globalThis,function(global,personAPI){
  'use strict';
  const normalize=value=>typeof value==='string'?value.normalize('NFKC').replace(/[‘’]/g,"'").trim().toLowerCase().replace(/\s+/g,' '):'';
  const list=value=>Array.isArray(value)?value:[];
  const before=(a,b)=>a&&b&&Number.isInteger(a.book)&&Number.isInteger(a.number)&&(a.book<b.book||a.book===b.book&&a.number<b.number);
  const identity=l=>({id:l.id,book:l.book,number:l.number,title:l.title});
  // Only these two reviewed surface forms need a lexical alias without an
  // authored sourceForms field. The canonical verb must still exist locally.
  const reviewedForms=Object.freeze({ring:['rang','rung'],repeat:['repeated']});
  const partOfSpeech=row=>/^v(?:\.|t\.|i\.)/i.test(row?.pos||'')?'verb':/^(?:n\.|noun)/i.test(row?.pos||'')?'noun':/^(?:a\.|adj\.)/i.test(row?.pos||'')?'adjective':/^(?:adv\.)/i.test(row?.pos||'')?'adverb':'';
  const compatible=(a,b)=>!partOfSpeech(a)||!partOfSpeech(b)||partOfSpeech(a)===partOfSpeech(b);
  function excluded(row,source){
    return row?.isPersonName===true||row?.isHonorific===true||row?.isPersonNameTarget===true||personAPI?.isPersonNameTarget?.(row,source)===true;
  }
  function occurs(value,label){
    const haystack=normalize(value),needle=normalize(label);
    if(!needle)return false;
    let start=haystack.indexOf(needle);
    while(start>=0){
      if(!/[a-z'-]/.test(haystack[start-1]||' ')&&!/[a-z'-]/.test(haystack[start+needle.length]||' '))return true;
      start=haystack.indexOf(needle,start+1);
    }
    return false;
  }
  function inLesson(lesson,label){return occurs(lesson.title,label)||list(lesson.paragraphs).some(row=>occurs(row?.en,label));}
  function forLesson(lesson,options={}){
    const result={words:[],phrases:[],priorWords:[],priorPhrases:[]};
    if(!lesson||typeof lesson.id!=='string'||!lesson.id)return result;
    const cache=new Map(),seen=new Set();
    function provided(name,source,fallback){
      try{return typeof options[name]==='function'?list(options[name](source)):list(fallback);}
      catch{return list(fallback);}
    }
    function rows(source){
      if(!cache.has(source)){
        const words=provided('getVocabulary',source,source.vocabulary),phrases=provided('getUsage',source,source.usage).filter(row=>row?.practiceEligible!==false&&(!global.PhrasePractice?.isGradedEligible||global.PhrasePractice.isGradedEligible(row,source))).map(row=>global.PhrasePractice?.practiceView?global.PhrasePractice.practiceView(row,source):row);
        const wordIndex=new Map();
        for(const row of words)if(row&&!excluded(row,source)){
          const key=normalize(row.word);if(!wordIndex.has(key))wordIndex.set(key,[]);wordIndex.get(key).push(row);
        }
        cache.set(source,{words,phrases,wordIndex,phraseIndex:new Map(phrases.map(row=>[normalize(row?.phrase),row]))});
      }
      return cache.get(source);
    }
    const earlier=list(options.lessons).filter(source=>before(source,lesson)).sort((a,b)=>a.book-b.book||a.number-b.number);
    const learnedValue=options.learnedLessonIds;
    const learned=new Set(learnedValue&&typeof learnedValue!=='string'&&typeof learnedValue[Symbol.iterator]==='function'?learnedValue:[]);
    const knownEarlier=earlier.filter(source=>source.book===lesson.book||learned.has(source.id));
    function canonical(row,source){
      const raw=normalize(row?.word);
      if(!raw||excluded(row,source)||/^n\./i.test(row.pos||''))return row;
      const candidates=rows(source).words.filter(candidate=>{
        const base=normalize(candidate?.word);
        if(!base||base===raw||candidate.meaningSource==='ECDICT'||candidate.needsContextReview===true||excluded(candidate,source)||!/^v(?:\.|t\.|i\.)/i.test(candidate.pos||''))return false;
        const explicit=[...list(candidate.sourceForms),...list(candidate.contextEvidence?.matchedForms)];
        return explicit.some(form=>normalize(form)===raw)||list(reviewedForms[base]).includes(raw)&&inLesson(source,raw);
      });
      const unique=new Map(candidates.map(candidate=>[normalize(candidate.word),candidate]));
      if(unique.size!==1)return row;
      const candidate=unique.values().next().value;
      return {...row,...candidate,word:candidate.word,storageLabel:row.storageLabel||row.word,sourceSentence:row.sourceSentence||candidate.sourceSentence,sourceForms:Array.from(new Set([...list(candidate.sourceForms),row.word]))};
    }
    function add(row,kind,source,prior,migrated=false){
      const label=typeof row?.[kind]==='string'?row[kind].trim():'',key=kind+':'+normalize(label);
      if(!label||!/[a-z]/i.test(label)||seen.has(key)||kind==='word'&&excluded(row,source))return;
      const field=prior?(kind==='word'?'priorWords':'priorPhrases'):(kind==='word'?'words':'phrases');
      if(prior&&!migrated&&result[field].length>=2)return;
      const target={...row,[kind]:label,source:identity(source),requiredCount:prior?(row.requiredCount===1?1:2):5,isLessonNew:!prior};
      if(migrated){target.storageSourceId=lesson.id;target.fromCurrentLesson=true;}
      result[field].push(target);seen.add(key);
    }
    const current=rows(lesson);
    const newWords=provided('getNewWords',lesson,current.words.filter(row=>row?.isLessonNew!==false));
    for(const raw of newWords){
      if(!raw||excluded(raw,lesson))continue;
      const row=canonical(raw,lesson),label=normalize(row?.word);
      const source=knownEarlier.find(old=>list(rows(old).wordIndex.get(label)).some(item=>compatible(item,row)));
      add(row,'word',source||lesson,!!source,!!source);
    }
    for(const row of current.phrases){
      const label=normalize(row?.phrase);
      const references=list(row?.contextEvidence?.relatedPriorLessons);
      const sources=knownEarlier.filter(old=>rows(old).phraseIndex.has(label));
      const source=sources.find(old=>references.some(reference=>reference.lessonId===old.id))||sources[0];
      // Keep the current note's example/provenance when the expression is a
      // review reference: the earlier source identifies knowledge history only.
      add(row,'phrase',source||lesson,!!source,!!source);
    }
    // Current lesson references always occupy the small prior batch first.
    for(const source of earlier.slice().reverse()){
      if(!learned.has(source.id))continue;
      for(const row of rows(source).words)add(canonical(row,source),'word',source,true);
      for(const row of rows(source).phrases)add(row,'phrase',source,true);
      if(result.priorWords.length===2&&result.priorPhrases.length===2)break;
    }
    return result;
  }
  return Object.freeze({forLesson});
});
