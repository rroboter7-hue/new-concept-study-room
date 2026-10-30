/* Finite language feedback for original learner prose; no similarity grade. */
(function(root,factory){
  'use strict';const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyRetellReview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TYPES={grammar:'语法',tense:'时态与动词',collocation:'固定搭配',spelling:'拼写',capitalization:'大小写',punctuation:'标点',completeness:'句意完整性',review:'需复核'};
  const string=value=>typeof value==='string'?value:'';
  function sentences(value){
    const result=[];
    for(const paragraph of string(value).split(/\n+/)){
      let start=0;
      for(let i=0;i<paragraph.length;i++){
        if(!/[.!?。！？]/.test(paragraph[i]))continue;
        const left=paragraph.slice(start,i+1);
        if(paragraph[i]==='.'&&(/\d\.\d/.test(paragraph.slice(i-1,i+2))||/\b(?:Mr|Mrs|Ms|Dr|St|Prof|Sr|Jr|Capt|Rev|vs|etc)\.$/i.test(left)||/\b[A-Z]\.$/.test(left)||/\b(?:e\.g|i\.e)\.$/i.test(left)))continue;
        let end=i+1;while(end<paragraph.length&&/[.!?。！？”’"')\]]/.test(paragraph[end]))end++;
        if(end<paragraph.length&&!/\s/.test(paragraph[end]))continue;
        const rest=paragraph.slice(end).trimStart();
        if(end>i+1&&/^(?:(?:(?:he|she|they|I|we|you)|[\p{Lu}][\p{L}.]*(?:\s+[\p{Lu}][\p{L}.]*){0,5})(?:\s+[a-z]+ly)?\s+)?(?:said|asked|replied|answered|cried|shouted|whispered)\b/u.test(rest))continue;
        const part=paragraph.slice(start,end).trim();if(part)result.push(part);start=end;i=end-1;
      }
      const remaining=paragraph.slice(start).trim();if(remaining)result.push(remaining);
    }
    return result;
  }
  async function check(sourceText,{checkSentence,isCurrent=()=>true}={}){
    const rows=[];let incomplete=false;
    for(const sentence of sentences(sourceText)){
      if(!isCurrent())return null;
      let raw;
      try{if(typeof checkSentence!=='function')throw Error('Unavailable');raw=await checkSentence(sentence);if(!raw||!Array.isArray(raw.issues))throw Error('Invalid feedback');}
      catch(_){raw={issues:[],incomplete:true,notice:'本句本地检查未完成，请交由豆包核查。'};}
      if(!isCurrent())return null;
      const issues=raw.issues.filter(row=>row&&row.type!=='target').map(row=>({type:Object.hasOwn(TYPES,row.type)?row.type:'review',message:string(row.message||row.explanation),original:string(row.original),replacement:string(row.replacement||row.suggestion)})).filter(row=>row.message||row.replacement);
      incomplete ||= raw.incomplete===true;
      rows.push({sentence,issues,reference:string(raw.reference),incomplete:raw.incomplete===true,notice:string(raw.notice)});
    }
    const counts=new Map();for(const row of rows)for(const issue of row.issues)counts.set(issue.type,(counts.get(issue.type)||0)+1);
    return {sourceText:string(sourceText),rows,summary:[...counts].map(([type,count])=>({type,label:TYPES[type],count})),incomplete,rulesOnly:true,notice:'仅完成有限本地初查，未提示的语法与标点仍需复核；不同于原文的表达不直接判错。'};
  }
  return Object.freeze({sentences,check,TYPES});
});
