(function (global) {
  'use strict';

  // A limited local rule checker: suggestions are not a complete grammar assessment.
  // Only the first 10,000 UTF-16 characters are checked; no text is sent online.
  const MAX_LENGTH=10000;
  const past={went:'go',saw:'see',ate:'eat',took:'take',had:'have',made:'make',wrote:'write',bought:'buy',brought:'bring',gave:'give',spoke:'speak',slept:'sleep',ran:'run',did:'do',drank:'drink',drove:'drive',came:'come',knew:'know',found:'find',thought:'think',heard:'hear'};
  const gerunds={go:'going',see:'seeing',meet:'meeting',hear:'hearing',visit:'visiting',work:'working',learn:'learning',receive:'receiving',get:'getting',read:'reading',watch:'watching',travel:'travelling',speak:'speaking',play:'playing',swim:'swimming',dance:'dancing',sing:'singing',cook:'cooking',do:'doing',run:'running',write:'writing',live:'living',study:'studying'};
  const ingToBase=Object.fromEntries(Object.entries(gerunds).map(([base,ing])=>[ing,base]));
  ingToBase.traveling='travel';
  const pastPattern=Object.keys(past).join('|');
  const basePattern=Object.keys(gerunds).concat(['eat','take','have','make','buy','bring','give','sleep','drink','drive','come','know','find','think','help','open','close','want','need','use','call','say','tell','try','start','stop','leave','arrive','be']).join('|');
  const ingPattern=Object.keys(ingToBase).join('|');
  const modalPattern='can|could|must|should|would|may|might|will|shall';
  const gap='[ \\t]+';
  const modalWithNegative='(?:'+modalPattern+'|can[\'’]t|cannot|(?:could|must|should|would|might)n[\'’]t|won[\'’]t|shan[\'’]t)(?:'+gap+'not)?';
  const rules=[];
  const add=(id,regex,replacement,message,confidence='high',guard)=>rules.push({id,regex,replacement,message,confidence,guard});
  const caseLike=(original,replacement)=>original===original.toUpperCase() && /[A-Z]/.test(original)?replacement.toUpperCase():/^[A-Z]/.test(original)?replacement[0].toUpperCase()+replacement.slice(1):replacement;
  const firstCase=(original,replacement)=>/^[A-Z]/.test(original)?replacement[0].toUpperCase()+replacement.slice(1):replacement;
  const apostrophe=text=>text.includes('’')?'’':"'";
  const following=(text,match)=>text.slice(match.index+match[0].length).replace(/^[ \t]+/,'');
  function quotationRanges(text){
    const ranges=[];
    let open=null;
    for(let index=0;index<text.length;index++){
      const char=text[index],previous=text[index-1]||'',next=text[index+1]||'';
      // Contraction apostrophes are part of words, not quotation boundaries.
      if((char==="'" || char==='’') && /[A-Za-z]/.test(previous) && /[A-Za-z]/.test(next))continue;
      if(open){
        if(char===open.close){ranges.push({start:open.start,end:index+1});open=null;}
      }else if(char==='"' || char==='“' || char==='‘' || (char==="'" && !/[A-Za-z0-9]/.test(previous) && /\S/.test(next))){
        open={start:index,close:char==='“'?'”':char==='‘'?'’':char};
      }
    }
    return ranges;
  }
  const isQuotation=(match,ranges)=>ranges.some(range=>match.index>range.start && match.index+match[0].length<range.end);
  const modalGuard=(match,text,quotations)=>{
    if(isQuotation(match,quotations))return false;
    // A capitalized surname can be a question subject: "Can Heard play?"
    if(/^[A-Z][a-z]+$/.test(match[2]||''))return false;
    const before=text.slice(Math.max(0,match.index-50),match.index);
    const previous=before.match(/([A-Za-z]+)[ \t]+$/)?.[1]?.toLowerCase();
    // "the will to live" and "a can opening tool" contain nouns, not modals.
    if(['a','an','the','this','that','my','your','his','her','our','their','strong','free'].includes(previous))return false;
    return true;
  };

  add('i-be',/\bI[ \t]+(?:is|are)\b/gi,()=> 'I am','主语 I 通常与 am 搭配。','high',(m,text,quotations)=>!isQuotation(m,quotations));
  add('singular-be',/\b(he|she|it)[ \t]+(?:am|are)\b/gi,m=>m[1]+' is','he / she / it 通常与 is 搭配。','high',(m,text,quotations)=>!isQuotation(m,quotations));
  add('singular-past-be',/(^|[.!?\n][ \t]*)(I|he|she|it)[ \t]+were(n['’]t)?\b/gi,m=>m[1]+m[2]+' was'+(m[3]||''),'若是一般过去时的普通陈述，I / he / she / it 通常用 was；虚拟语气等表达仍需结合原意复核。','medium',(m,text,quotations)=>!isQuotation(m,quotations));
  add('plural-be',/\b(they|we|you)[ \t]+(?:is|am)\b/gi,m=>m[1]+' are','they / we / you 通常与 are 搭配。','high',(m,text,quotations)=>!isQuotation(m,quotations));
  add('progressive-missing-be',/(^|[.!?\n][ \t]*)(I|he|she|it|we|you|they)[ \t]+(reading|watching|writing|learning|studying|cooking|swimming|running|playing|working|going|coming)[ \t]+(?=[A-Za-z])/gi,m=>m[1]+m[2]+' '+(/^i$/i.test(m[2])?'am':/^(he|she|it)$/i.test(m[2])?'is':'are')+' '+m[3]+' ','句首主语后直接接 -ing 形式，可能漏了 be；若表达现在进行时，可补 am / is / are。','medium',(m,text,quotations)=>!isQuotation(m,quotations)&&!text.slice(m.index+m[0].length).split(/[.!\n]/)[0].includes('?'));
  add('plural-past-be',/\b(they|we|you)[ \t]+was(n['’]t)?\b/gi,m=>m[1]+' were'+(m[2]||''),'一般过去时中，they / we / you 通常与 were 搭配；否定式用 weren’t。','high',(m,text,quotations)=>!isQuotation(m,quotations));
  add('singular-dont',/\b(he|she|it)[ \t]+don['’]t\b/gi,m=>m[1]+' doesn'+apostrophe(m[0])+'t','一般现在时中，he / she / it 的否定式通常用 doesn’t。');
  add('plural-doesnt',/\b(they|we|you)[ \t]+doesn['’]t\b/gi,m=>m[1]+' don'+apostrophe(m[0])+'t','一般现在时中，they / we / you 的否定式通常用 don’t。');
  add('did-base',new RegExp('\\b(did(?:n[\'’]t|'+gap+'not)?)'+gap+'('+pastPattern+')\\b','gi'),m=>m[1]+' '+past[m[2].toLowerCase()],'did / didn’t 后通常使用动词原形；若 saw 表示“锯”，请结合语境判断。','medium');
  add('modal-no-to',new RegExp('\\b('+modalPattern+')'+gap+'to'+gap+'('+basePattern+')\\b','gi'),m=>m[1]+' '+m[2],'情态动词后通常直接接动词原形，不加 to。','high',modalGuard);
  add('modal-past',new RegExp('\\b('+modalWithNegative+')'+gap+'('+Object.keys(past).filter(word=>word!=='saw').join('|')+')\\b','gi'),m=>m[1]+' '+past[m[2].toLowerCase()],'情态动词（包括 not / n’t 否定式）后通常使用动词原形，而非过去式。','high',modalGuard);
  add('modal-ing',new RegExp('\\b('+modalPattern+')'+gap+'('+ingPattern+')\\b','gi'),m=>m[1]+' '+ingToBase[m[2].toLowerCase()],'情态动词后通常使用动词原形；进行时需要 be + -ing。','medium',modalGuard);

  const anWords='hour|honest|honesty|honor|honour|honorable|honourable|heir|heirloom|apple|orange|egg|elephant|umbrella|idea|animal|office|engine|answer|error|uncle|aunt|island|airplane|airport|interview|invitation|interesting|important|easy|old|empty|excellent|American|English';
  const aWords='university|unicorn|uniform|union|unit|unique|user|useful|European|euro|one|once|book|car|house|hotel|school|student|teacher|doctor|friend|girl|boy|man|woman|dog|cat|young|year';
  add('article-an',new RegExp('\\b(a)'+gap+'('+anWords+')\\b','gi'),m=>firstCase(m[1],'an')+' '+m[2],'这个词通常以元音音素开头，冠词建议用 an。这里只检查已列明的常见词。');
  add('article-a',new RegExp('\\b(an)'+gap+'('+aWords+')\\b','gi'),m=>firstCase(m[1],'a')+' '+m[2],'这个词通常以辅音音素开头，冠词建议用 a；例如 a university。');
  add('many-people',/\bmuch[ \t]+people\b/gi,()=> 'many people','people 表示“人们”时为复数可数名词，通常用 many。');
  add('information-uncountable',/\bmany[ \t]+informations?\b/gi,()=> 'much information','information 通常为不可数名词，不加复数 -s，数量可用 much 或 a lot of。');
  add('advice-uncountable',/\bmany[ \t]+advices?\b/gi,()=> 'much advice','advice 通常为不可数名词，可用 much advice 或 pieces of advice。');
  add('furniture-uncountable',/\bmany[ \t]+furnitures?\b/gi,()=> 'much furniture','furniture 通常为不可数名词，不加复数 -s。');
  add('look-forward-gerund',new RegExp('\\b(look(?:s|ed|ing)?'+gap+'forward'+gap+'to)'+gap+'('+Object.keys(gerunds).filter(word=>!['work','travel','play'].includes(word)).join('|')+')\\b','gi'),m=>m[1]+' '+gerunds[m[2].toLowerCase()],'look forward to 中的 to 是介词，后面通常接名词或动词 -ing 形式。');
  add('interested-in',/\binterested[ \t]+on\b/gi,m=>m[0].replace(/on$/i,'in'),'表示“对……感兴趣”时，常用 interested in。','medium',(m,text)=>! /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|weekdays|weekends|occasion|and off|the following day|that day|this day|a personal level|a professional level)\b/i.test(following(text,m)));
  add('discuss-direct-object',/\b(discuss(?:es|ed|ing)?)[ \t]+about\b/gi,m=>m[1],'discuss 通常直接接讨论对象，不需要 about。','medium',(m,text)=>! /^(?:\d|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b|half\b|a dozen\b)/i.test(following(text,m)));
  add('married-to',/\bmarried[ \t]+with\b/gi,m=>m[0].replace(/with$/i,'to'),'表示“与某人结婚”时，常用 married to；请确认 with 后面确实是配偶。','medium',(m,text)=>! /^(?:children\b|kids\b|a child\b|a baby\b|(?:\d+|one|two|three|four|five|no|some|several|many)[ \t]+(?:child|children|kids)\b|great[ \t]+(?:pomp|ceremony)\b)/i.test(following(text,m)));
  add('enjoy-gerund',new RegExp('\\b(enjoy(?:s|ed|ing)?)'+gap+'to'+gap+'('+Object.keys(gerunds).join('|')+')\\b','gi'),m=>m[1]+' '+gerunds[m[2].toLowerCase()],'enjoy 后通常接名词或动词 -ing 形式，不接 to do。');
  add('really-like',/\bI[ \t]+very[ \t]+like\b/gi,()=> 'I really like','表达“我很喜欢”时，可用 I really like。');
  const thirdPerson={go:'goes',play:'plays',like:'likes',want:'wants',work:'works',study:'studies',live:'lives'};
  add('third-person-present',/\b(he|she|it)[ \t]+(go|play|like|want|work|study|live)\b/gi,m=>m[1]+' '+thirdPerson[m[2].toLowerCase()],'若表达一般现在时，he / she / it 后的这个动词通常需要第三人称单数形式。','medium',(m,text)=>{
    const left=text.slice(0,m.index), start=Math.max(left.lastIndexOf('.'),left.lastIndexOf('!'),left.lastIndexOf('?'),left.lastIndexOf(';'),left.lastIndexOf('\n'))+1;
    const prefix=text.slice(start,m.index), right=text.slice(m.index), ending=right.search(/[.!?;\n]/), sentence=prefix+right.slice(0,ending<0?right.length:ending);
    const previous=prefix.match(/([A-Za-z]+)[ \t]+$/)?.[1]?.toLowerCase();
    if(['do','does','did','can','could','may','might','must','should','will','would','shall','let','make','help'].includes(previous))return false;
    if(/\b(?:yesterday|last[ \t]+(?:night|week|month|year|time|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|(?:\d+|one|two|three|four|five|a few)[ \t]+(?:days?|weeks?|months?|years?|hours?)[ \t]+ago|in[ \t]+(?:19|20)\d{2})\b/i.test(sentence))return false;
    if(/\b(?:suggest|recommend|insist|demand|request|propose|require|ask|wish)(?:s|ed)?\b[^.!?;\n]{0,70}$/i.test(prefix))return false;
    if(/\b(?:important|necessary|essential|vital|imperative|crucial)[ \t]+that[ \t]*$/i.test(prefix))return false;
    return true;
  });

  function check(text) {
    const source=String(text ?? '').slice(0,MAX_LENGTH), candidates=[], quotations=quotationRanges(source);
    for(const rule of rules){
      rule.regex.lastIndex=0;
      let match;
      while((match=rule.regex.exec(source))!==null){
        // A quoted example may intentionally discuss an error; leave it for review.
        if(isQuotation(match,quotations))continue;
        if(rule.guard && !rule.guard(match,source,quotations))continue;
        const replacement=caseLike(match[0],rule.replacement(match));
        if(replacement===match[0])continue;
        candidates.push({id:rule.id+'-'+match.index+'-'+(match.index+match[0].length),start:match.index,end:match.index+match[0].length,original:match[0],replacement,message:rule.message,rule:rule.id,confidence:rule.confidence});
      }
    }
    candidates.sort((a,b)=>a.start-b.start || (b.end-b.start)-(a.end-a.start));
    const result=[];
    for(const issue of candidates)if(!result.some(existing=>issue.start<existing.end && issue.end>existing.start))result.push(issue);
    return result;
  }

  function valid(text,issue){return issue && Number.isInteger(issue.start) && Number.isInteger(issue.end) && issue.start>=0 && issue.end>issue.start && issue.end<=text.length && typeof issue.original==='string' && typeof issue.replacement==='string' && text.slice(issue.start,issue.end)===issue.original;}
  function apply(text,issue){text=String(text ?? '');return valid(text,issue)?text.slice(0,issue.start)+issue.replacement+text.slice(issue.end):text;}
  function applyAll(text,issues){
    text=String(text ?? '');
    const selected=[];
    for(const issue of (Array.isArray(issues)?issues:[]).filter(issue=>valid(text,issue)).sort((a,b)=>a.start-b.start || b.end-a.end)){
      if(!selected.some(other=>issue.start<other.end && issue.end>other.start))selected.push(issue);
    }
    for(const issue of selected.reverse())text=text.slice(0,issue.start)+issue.replacement+text.slice(issue.end);
    return text;
  }

  global.StudyGrammar={check,apply,applyAll,maxLength:MAX_LENGTH};
})(window);
