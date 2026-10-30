/* Finite, offline suggestions. No text transmission, DOM, grades or automatic edits. */
(function(root,factory){
  'use strict';
  const api=factory(root,typeof module==='object'&&module.exports?require('./sentence-core.js'):null);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StudySentenceFeedback=api;
})(typeof window!=='undefined'?window:globalThis,function(global,defaultSentences){
  'use strict';
  const MAX_LENGTH=10000;
  const TYPO=Object.freeze({teh:'the',recieve:'receive',recieved:'received',recieving:'receiving',freind:'friend',freinds:'friends',becuase:'because',becasue:'because',definately:'definitely',seperate:'separate',seperately:'separately',tommorow:'tomorrow',yestarday:'yesterday',thier:'their',beleive:'believe',beleived:'believed'});
  // These are protection examples, not an English dictionary. Unknown words
  // never become definite errors merely because this finite list omits them.
  const PROTECTED=new Set(('a an the i you he she it we they me my your his her our their am is are was were be been being do does did done have has had can could will would should may might must shall not no yes this that these those there here where when why how who what which and but or if because although while then than to of in on at by for from with as into over under through about without before after out up down look looks looked looking go goes went going come comes came coming get gets got getting make makes made making take takes took taking give gives gave giving read reads reading write writes wrote writing buy buys bought buying bring brings brought bringing think thinks thought thinking see sees saw seeing hear hears heard hearing eat eats ate eating sleep sleeps slept sleeping work works worked working play plays played playing study studies studied studying like likes liked liking want wants wanted wanting need needs needed needing live lives lived living walk walks walked walking cook cooks cooked cooking book books pen pens coat coats coast coasts toast toasts train trains trail trails trial trials angel angels angle angles quiet quite united untied causal casual sacred scared compliant complaint abroad aboard three tree trees free form forms room rooms word words world worlds good bad old new long short day days today yesterday tomorrow time times past present future person people name names father mother friend friends home house school station library music story stories dessert desserts desert deserts stop stops spot spots tops post pots top pot dog dogs god gods cat cats act acts left felt listen silent plain plane price prize piece peace page pages line lines spell spelling true sure use useful nice best boy girl man woman child children dinner car cars card cards cart carts art part parts park parks back bake beak break born burnt burn burns also only very much many more most some any all each both other another one two first last before after never ever often always sometimes still once again now just please thanks thank sorry happy sad great small large right wrong same different own whole late later little few several enough every next week month year morning evening night').split(/\s+/));
  const string=value=>typeof value==='string'?value:'';
  const words=value=>string(value).match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)||[];
  function quotedRanges(text){
    const ranges=[];let open=null;
    for(let index=0;index<text.length;index++){
      const char=text[index];
      if((char==="'"||char==='’')&&/[A-Za-z]/.test(text[index-1]||'')&&/[A-Za-z]/.test(text[index+1]||''))continue;
      if(open){if(char===open.close){ranges.push({start:open.start,end:index+1});open=null;}}
      else if(char==='"'||char==='“'||char==='‘'||char==="'")open={start:index,close:char==='“'?'”':char==='‘'?'’':char};
    }
    return ranges;
  }
  const inQuote=(index,ranges)=>ranges.some(range=>index>range.start&&index<range.end-1);
  function category(rule){
    if(/^(?:i-be|singular-be|singular-past-be|plural-be|plural-past-be|singular-dont|plural-doesnt|did-base|modal-|progressive-|third-person-)/.test(rule))return 'tense';
    if(/(?:look-forward|interested-in|discuss-direct|married-to|enjoy-gerund|really-like)/.test(rule))return 'collocation';
    return 'grammar';
  }
  function targetTokens(options){
    const items=[options.target].concat(Array.isArray(options.fusionTargets)?options.fusionTargets:[]);
    return new Set(items.flatMap(item=>words(typeof item==='string'?item:item?.label||item?.word||item?.phrase)).map(word=>word.toLowerCase()).filter(word=>word.length>=4));
  }
  function targetLabel(target){return typeof target==='string'?target:target?.label||target?.word||target?.phrase||target?.target||'';}
  function hasTarget(source,target,options){
    const label=targetLabel(target),sentenceAPI=options.sentenceAPI||global.StudySentences||defaultSentences;
    const phrase=target?.kind==='phrase'||typeof target?.phrase==='string';
    const reviewAPI=options.reviewAPI||global.StudyReview;
    if(phrase&&typeof reviewAPI?.hasPhrase==='function'&&reviewAPI.hasPhrase({kind:'phrase',target:label,matchedForm:target.matchedForm,variants:target.variants},source))return true;
    const variants=[label,target?.matchedForm,...(Array.isArray(target?.variants)?target.variants:[])].filter(value=>typeof value==='string'&&value.trim());
    if(typeof sentenceAPI?.matchesExpression==='function')return variants.some(value=>sentenceAPI.matchesExpression(source,value));
    const normalized=' '+source.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}'-]+/gu,' ').trim()+' ';
    return variants.some(value=>normalized.includes(' '+value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}'-]+/gu,' ').trim()+' '));
  }
  function pastTimeIssue(source){
    // This is a review cue for one simple clause, not a rule that every past
    // time phrase forces every verb in a sentence into the past.
    const terminal=source.trim().replace(/[.!?]\s*$/,''),signal=/\byesterday\b(?!['’])|\blast\s+(?:night|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s+(?:day|week|month|year|hour|minute)s?\s+ago\b/i.exec(terminal);
    if(!signal)return null;
    const before=terminal.slice(0,signal.index),after=terminal.slice(signal.index+signal[0].length);
    let clause;
    if(!after.trim()){
      if(/\b(?:from|of|about|since|until|before|after|for|by|on|at|in)\s*$/i.test(before))return null;
      clause=before.trim();
    }else if(!before.trim())clause=after.replace(/^\s*,?\s*/,'').trim();
    else return null;
    if(/[,;:.!?\n"“”]|\b(?:and|or|but|that|who|which|when|while|because|if|although|though|unless|until|since|where|what|whether|said|says|say|told|reports?|reported)\b/i.test(clause))return null;
    if((clause.match(/\b(?:I|you|we|they|he|she|it)\b/gi)||[]).length!==1)return null;
    const match=/^(?:I|you|we|they|he|she|it)\s+(?:(?:usually|often|always|sometimes|never)\s+)?(have|has|go|goes)\b/i.exec(clause);
    if(!match)return null;
    const remainder=clause.slice(match[0].length);
    if(/\b(?:had|been|done|seen|gone|written|taken|made|sent|received|published|found|bought|called|dated|[a-z]+ed)\b/i.test(remainder))return null;
    const verb=match[1],past=/^(?:have|has)$/i.test(verb)?'had':'went',start=source.indexOf(clause)+match[0].lastIndexOf(verb);
    return {type:'tense',rule:'closed-past-present-form',start,end:start+verb.length,original:verb,replacement:past,confidence:'medium',
      message:'“'+signal[0]+'”通常指已结束的过去。若这句话描述当时发生的事情，请核对 '+verb+' 是否应改用过去式 '+past+'；叙事现在时等特殊表达需按原意复核。'};
  }
  function knownTokens(options){
    const known=new Set(PROTECTED);
    const supplied=options.knownWords instanceof Set?Array.from(options.knownWords):Array.isArray(options.knownWords)?options.knownWords:[];
    for(const item of supplied.concat(options.lesson?.vocabulary||[]))for(const word of words(typeof item==='string'?item:item?.word||item?.label))known.add(word.toLowerCase());
    return known;
  }
  function suspectedTypo(entered,target){
    if(entered===target)return false;
    // Never use unrestricted edit distance: it confuses ordinary pairs such
    // as desert/dessert, cook/book and toast/coast with spelling mistakes.
    if(entered.length===target.length&&target.length>=5){
      for(let index=0;index<entered.length-1;index++)if(entered[index]!==entered[index+1]&&entered.slice(0,index)+entered[index+1]+entered[index]+entered.slice(index+2)===target)return true;
    }
    return /([a-z])\1\1/.test(entered)&&entered.replace(/([a-z])\1{2,}/g,'$1$1')===target;
  }
  function correctionReference(source,issues){
    const selected=[];
    for(const issue of issues.filter(issue=>issue.confidence==='high'&&Number.isInteger(issue.start)&&Number.isInteger(issue.end)&&issue.start>=0&&issue.end>=issue.start&&issue.end<=source.length&&source.slice(issue.start,issue.end)===issue.original&&typeof issue.replacement==='string').sort((a,b)=>a.start-b.start||b.end-a.end)){
      if(!selected.some(other=>issue.start<other.end&&issue.end>other.start||issue.start===other.start&&issue.end===other.end))selected.push(issue);
    }
    if(!selected.length)return undefined;
    let reference=source;
    for(const issue of selected.sort((a,b)=>b.start-a.start))reference=reference.slice(0,issue.start)+issue.replacement+reference.slice(issue.end);
    return reference===source?undefined:reference;
  }
  function check(text,options={}){
    const source=string(text),tooLong=source.length>MAX_LENGTH;
    let checked=tooLong?source.slice(0,MAX_LENGTH):source;
    if(tooLong){const boundary=checked.search(/\S+$/);if(boundary>MAX_LENGTH-200)checked=checked.slice(0,boundary);}
    const issues=[],reviewNeeded=['本地规则不能确认全部拼写、语境时态、固定搭配、句意及自然度；未发现提示也仍需复核。'];
    let incomplete=tooLong;
    const add=issue=>{
      const item={type:issue.type||'grammar',message:string(issue.message),original:string(issue.original),replacement:string(issue.replacement),confidence:issue.confidence==='high'?'high':'medium'};
      if(Number.isInteger(issue.start)&&Number.isInteger(issue.end)){item.start=issue.start;item.end=issue.end;}
      if(string(issue.rule))item.rule=issue.rule;
      if(!issues.some(previous=>previous.type===item.type&&previous.start===item.start&&previous.end===item.end&&previous.original===item.original&&previous.replacement===item.replacement))issues.push(item);
      if(item.confidence!=='high')reviewNeeded.push(item.message+' 此项依赖语境或属于疑似问题，请复核后决定是否修改。');
    };
    const grammarCheck=typeof options.grammarCheck==='function'?options.grammarCheck:global.StudyGrammar?.check;
    if(typeof grammarCheck==='function'){
      try{
        const grammar=grammarCheck(checked);
        if(!Array.isArray(grammar))throw Error('Invalid finite-rule output');
        for(const issue of grammar.slice(0,100)){
          if(!issue||typeof issue!=='object')continue;
          // StudyGrammar's pronoun-I agreement rule also sees mathematical i.
          // Keep the surrounding symbolic context outside that finite rule.
          if(/^i\b/i.test(string(issue.original))&&Number.isInteger(issue.start)&&/\b(?:variable|letter|symbol|index|lowercase|named|called)\s*$/i.test(checked.slice(Math.max(0,issue.start-40),issue.start)))continue;
          add({...issue,type:category(string(issue.rule)),message:string(issue.message)||'请核对这处局部语法形式。'});
        }
      }catch(_){incomplete=true;reviewNeeded.push('本地语法规则暂不可用，语法部分检查未完成；以下其他建议仍可参考。');}
    }else{incomplete=true;reviewNeeded.push('本地语法规则尚未接入，语法部分检查未完成。');}

    const quotes=quotedRanges(checked),first=/[A-Za-z]+(?:['’-][A-Za-z]+)*/.exec(checked);
    if(!tooLong){
      const targetRows=[{target:options.target,fusion:false}].concat((Array.isArray(options.fusionTargets)?options.fusionTargets:[]).map(target=>({target,fusion:true})));
      const seenTargets=new Set();
      for(const row of targetRows){
        const label=targetLabel(row.target);if(!label||seenTargets.has(label))continue;seenTargets.add(label);
        if(!hasTarget(checked,row.target,options))add({type:'target',confidence:'medium',message:'尚未识别到'+(row.fusion?'所选融合用法':'本轮目标')+'“'+label+'”或已支持的词形、短语变体；请核对是否确实用到了这个表达。复杂变化仍需复核。'});
      }
      const timeIssue=pastTimeIssue(checked);if(timeIssue)add(timeIssue);
    }
    if(first&&/^[a-z]+$/.test(first[0])&&!inQuote(first.index,quotes))add({type:'capitalization',start:first.index,end:first.index+1,original:first[0][0],replacement:first[0][0].toUpperCase(),message:'句首字母通常应大写；此处给出局部修改参考。',confidence:'high'});
    for(const match of checked.matchAll(/\bi\b/g)){
      if(inQuote(match.index,quotes)||/\b(?:variable|letter|symbol|index|lowercase|named|called)\s*$/i.test(checked.slice(Math.max(0,match.index-40),match.index)))continue;
      add({type:'capitalization',start:match.index,end:match.index+1,original:'i',replacement:'I',message:'作人称代词时，独立的 i 应写为 I；若它是变量或符号，请保留原意。',confidence:'high'});
    }
    const known=knownTokens(options),targets=targetTokens(options);
    for(const match of checked.matchAll(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)){
      const entered=match[0];
      if(entered!==entered.toLowerCase()||known.has(entered)||inQuote(match.index,quotes))continue;
      if(TYPO[entered])add({type:'spelling',start:match.index,end:match.index+entered.length,original:entered,replacement:TYPO[entered],message:'检测到常见明确误拼，请核对修改参考。',confidence:'high'});
      else{
        const candidates=Array.from(targets).filter(target=>suspectedTypo(entered,target));
        if(candidates.length===1)add({type:'spelling',start:match.index,end:match.index+entered.length,original:entered,replacement:candidates[0],message:'此词疑似与本轮目标或所选搭配中的 '+candidates[0]+' 发生字母交换或重复；它也可能是新词或专名，请复核。',confidence:'medium'});
      }
    }
    for(const match of checked.matchAll(/[，。？！；：]/g))add({type:'punctuation',start:match.index,end:match.index+1,original:match[0],replacement:{'，':',','。':'.','？':'?','！':'!','；':';','：':':'}[match[0]],message:'英文句中出现中文标点，请核对是否需要改为对应英文标点。',confidence:'medium'});
    if(!tooLong&&source.trim()){
      const trimmed=source.trimEnd(),end=trimmed.length;
      const clearQuestion=/^[\s"'“‘]*(?:(?:am)\s+I\b|(?:is|was)\s+(?:he|she|it|this|that|there|the|a|an|my|your)\b|(?:are|were)\s+(?:you|we|they|these|those|there|the|my|your)\b|(?:do|does|did|have|has|had|can|could|will|would|should|must|may|might)\s+(?:I|you|he|she|it|we|they)\b|(?:where|when|why|how|what|which)\s+(?:am|is|are|was|were|do|does|did|can|could|will|would|should|have|has|had)\b)/i.test(source);
      if(!/[.!?。？！]["'’”)]*$/.test(trimmed)){
        add({type:'punctuation',start:end,end,original:'',replacement:clearQuestion?'?':'.',message:clearQuestion?'这段表达采用明显的疑问语序，若是在提问，请补问号。':'当前末尾没有明确句末标点；若是陈述句可补句号，其他语气请按原意选择。',confidence:clearQuestion?'medium':'high'});
      }else if(clearQuestion&&/\.["'’”)]*$/.test(trimmed)){
        const start=trimmed.lastIndexOf('.');
        add({type:'punctuation',start,end:start+1,original:'.',replacement:'?',message:'这段表达采用明显的疑问语序；若是在提问，句末应使用问号。',confidence:'medium'});
      }
    }
    if(tooLong)reviewNeeded.push('超出检查范围：仅检查前 '+checked.length+' 个字符，其余 '+(source.length-checked.length)+' 个字符尚未完成检查；请分段检查。');
    issues.sort((a,b)=>(a.start??Infinity)-(b.start??Infinity)||(b.end??0)-(a.end??0));
    const reference=tooLong?undefined:correctionReference(source,issues);
    return {issues,reviewNeeded:Array.from(new Set(reviewNeeded)),...(reference?{reference}:{}),notice:(tooLong?'仅检查前 '+checked.length+' / '+source.length+' 个字符，其余未完成。':'已运行有限本地规则。')+' 建议需结合原意复核；修改参考仅拼接已定位的高置信局部修正，不是教材范句或完整审校结论。',incomplete,checkedLength:checked.length,sourceLength:source.length,rulesOnly:true};
  }
  return Object.freeze({check,maxLength:MAX_LENGTH});
});
