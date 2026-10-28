/* Local source-constrained grammar choices. Never fetches or changes source data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyPipelineQuestions=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const list=value=>Array.isArray(value)?value:[],text=value=>typeof value==='string'?value.trim():'',copy=value=>JSON.parse(JSON.stringify(value));
 const normal=value=>text(value).normalize('NFKC').replace(/\s+/g,' ').toLowerCase();
 const reading=/reading|comprehension|main[-_ ]?idea|阅读理解|课文理解|课文细节|细节理解|理解题|文意匹配/i;
 const grammar=/动词|时态|助动|情态|主语|宾语|谓语|表语|定语|从句|介词|不定式|分词|动名词|单数|复数|原形|第三人称|比较级|最高级|冠词|代词|否定|疑问|语序|祈使|倒装|被动|条件句|主谓|完成时|过去时|现在时|将来时/i;
 const FORMS={
  be:['is','was','been','being'],have:['has','had','had','having'],do:['does','did','done','doing'],go:['goes','went','gone','going'],come:['comes','came','come','coming'],
  see:['sees','saw','seen','seeing'],say:['says','said','said','saying'],make:['makes','made','made','making'],take:['takes','took','taken','taking'],give:['gives','gave','given','giving'],
  get:['gets','got','got','getting'],find:['finds','found','found','finding'],know:['knows','knew','known','knowing'],think:['thinks','thought','thought','thinking'],bring:['brings','brought','brought','bringing'],
  buy:['buys','bought','bought','buying'],sell:['sells','sold','sold','selling'],write:['writes','wrote','written','writing'],read:['reads','read','read','reading'],speak:['speaks','spoke','spoken','speaking'],
  eat:['eats','ate','eaten','eating'],drink:['drinks','drank','drunk','drinking'],run:['runs','ran','run','running'],sit:['sits','sat','sat','sitting'],stand:['stands','stood','stood','standing'],
  sleep:['sleeps','slept','slept','sleeping'],leave:['leaves','left','left','leaving'],feel:['feels','felt','felt','feeling'],keep:['keeps','kept','kept','keeping'],tell:['tells','told','told','telling'],
  hear:['hears','heard','heard','hearing'],meet:['meets','met','met','meeting'],build:['builds','built','built','building'],send:['sends','sent','sent','sending'],hold:['holds','held','held','holding'],
  put:['puts','put','put','putting'],cut:['cuts','cut','cut','cutting'],let:['lets','let','let','letting'],set:['sets','set','set','setting'],begin:['begins','began','begun','beginning'],
  drive:['drives','drove','driven','driving'],fly:['flies','flew','flown','flying'],swim:['swims','swam','swum','swimming'],sing:['sings','sang','sung','singing'],fall:['falls','fell','fallen','falling'],
  lose:['loses','lost','lost','losing'],choose:['chooses','chose','chosen','choosing'],become:['becomes','became','become','becoming'],break:['breaks','broke','broken','breaking'],understand:['understands','understood','understood','understanding'],shut:['shuts','shut','shut','shutting'],sweep:['sweeps','swept','swept','sweeping']
 };
 for(const base of ['work','walk','talk','look','listen','wait','play','watch','learn','open','close','clean','cook','repair','ask','help','call','turn','need','want','visit','live','move','arrive','love','hope','use','refuse','decide','save','serve','believe','receive','explain','happen','appear','seem','reach','return','remember','follow','offer','show','start','stop','travel','study','carry','try','cry','laugh','point','empty','fill','dust','wash']){
  const third=/[^aeiou]y$/.test(base)?base.slice(0,-1)+'ies':/(?:s|sh|ch|x|o)$/.test(base)?base+'es':base+'s';
  const past=/e$/.test(base)?base+'d':/[^aeiou]y$/.test(base)?base.slice(0,-1)+'ied':base==='stop'?'stopped':base==='travel'?'travelled':base+'ed';
  const ing=/e$/.test(base)&&!/ee$/.test(base)?base.slice(0,-1)+'ing':base==='stop'?'stopping':base==='travel'?'travelling':base+'ing';
  FORMS[base]=[third,past,past,ing];
 }
 const NOUNS={man:'men',woman:'women',child:'children',person:'people',tooth:'teeth',foot:'feet',mouse:'mice',knife:'knives',wife:'wives',policeman:'policemen'};
 for(const noun of 'book pen pencil bag handbag umbrella ticket coat shirt skirt dress blouse suit hat cap shoe sock car bus bike train ship plane boat room house door window table chair cup glass plate dish bottle box fork spoon cigarette newspaper magazine letter stamp postcard picture photograph watch clock key bed bedroom kitchen garden school shop restaurant hotel office bank street road bridge park city town village country farm field tree flower animal dog cat bird boy girl friend teacher student doctor nurse driver worker salesman engineer mechanic farmer actor writer reader archaeologist tool stone bone fossil legend story language generation thing day week month year hour minute question answer problem word name father mother brother sister son daughter grandfather grandmother parent husband family baby'.split(' '))NOUNS[noun]=/[^aeiou]y$/.test(noun)?noun.slice(0,-1)+'ies':/(?:s|sh|ch|x)$/.test(noun)?noun+'es':noun+'s';
 NOUNS.salesman='salesmen';
 const SUBJECTS={i:['me','my','mine'],you:['your','yours','yourself'],he:['him','his','himself'],she:['her','hers','herself'],it:['its','itself',"it's"],we:['us','our','ours'],they:['them','their','theirs']};
 const POSSESSIVES={my:['I','me','mine'],your:['you','yours','yourself'],his:['he','him','himself'],her:['she','hers','herself'],its:['it','itself',"it's"],our:['we','us','ours'],their:['they','them','theirs']};
 const FIXED=[
  [/\bbelong(?:s|ed|ing)?\s+(to)\b/gi,'to',['of','at','for'],'belong to 表示所属关系。'],
  [/\bconsist(?:s|ed|ing)?\s+(of)\b/gi,'of',['to','at','for'],'consist of 是“由……组成”的搭配。'],
  [/\bdepend(?:s|ed|ing)?\s+(on)\b/gi,'on',['to','of','at'],'本句使用 depend on，表示依靠或取决于。'],
  [/\binsist(?:s|ed|ing)?\s+(on)\b/gi,'on',['to','of','at'],'本句使用 insist on，表示坚持。'],
  [/\b(?:take|takes|took|taken|taking)\s+part\s+(in)\b/gi,'in',['to','of','at'],'take part in 后接参加的活动。'],
  [/\blook(?:s|ed|ing)?\s+forward\s+(to)\b/gi,'to',['of','at','for'],'look forward to 是“期待”的固定搭配，这里的 to 是介词。'],
  [/\bin\s+spite\s+(of)\b/gi,'of',['to','at','for'],'in spite of 是“尽管”的固定搭配。'],
  [/\binstead\s+(of)\b/gi,'of',['to','at','for'],'instead of 是“代替，而不是”的搭配。'],
  [/\bin\s+front\s+(of)\b/gi,'of',['to','at','for'],'in front of 表示“在……前面”。'],
  [/\bbecause\s+(of)\b/gi,'of',['to','at','for'],'because of 后接名词性成分，表示原因。'],
  [/\bin\s+addition\s+(to)\b/gi,'to',['of','at','for'],'in addition to 是“除……之外还”的搭配。'],
  [/\baccording\s+(to)\b/gi,'to',['of','at','for'],'according to 是“根据”的搭配。'],
  [/\bregardless\s+(of)\b/gi,'of',['to','at','for'],'regardless of 是“不管，不顾”的搭配。'],
  [/\b(?:capable|incapable)\s+(of)\b/gi,'of',['to','at','for'],'capable/incapable of 后接名词或动名词，表示有/无能力做某事。'],
  [/\b(?:get|gets|got|getting)\s+rid\s+(of)\b/gi,'of',['to','at','for'],'get rid of 是“摆脱，除去”的搭配。'],
  [/\bmake\s+use\s+(of)\b/gi,'of',['to','at','for'],'make use of 是“利用”的搭配。'],
  [/\bin\s+search\s+(of)\b/gi,'of',['to','at','for'],'in search of 是“寻找”的搭配。'],
  [/\bin\s+terms\s+(of)\b/gi,'of',['to','at','for'],'in terms of 是“就……而言”的搭配。'],
  [/\bin\s+common\s+(with)\b/gi,'with',['to','of','for'],'in common with 表示“与……相同”。'],
  [/\bon\s+behalf\s+(of)\b/gi,'of',['to','at','for'],'on behalf of 是“代表”的搭配。']
 ];
 function hash(value){let result=2166136261;for(let i=0;i<value.length;i++)result=Math.imul(result^value.charCodeAt(i),16777619);return (result>>>0).toString(16);}
 function fingerprint(lesson){const body=list(lesson.paragraphs).map(p=>p.en||'').join('\n\n');return body.length+':'+hash(body);}
 function local(row,lesson){return row&&typeof row==='object'&&!row.isReview&&row.pipeline?.origin!=='review'&&[row.lessonId,row.sourceLessonId,row.pipeline?.sourceLessonId].every(id=>!id||id===lesson.id);}
 function valid(row){return Array.isArray(row?.options)&&row.options.length>=2&&row.options.every(value=>typeof value==='string'&&value.trim())&&new Set(row.options.map(normal)).size===row.options.length&&Number.isInteger(row.answer)&&row.answer>=0&&row.answer<row.options.length;}
 function forLesson(lesson,options={}){
  if(!lesson||typeof lesson.id!=='string')return [];
  const result=[],ids=new Set(),questions=new Set(),generated=[],generatedKeys=new Set(),sources=[],sourceKeys=new Set();
  function retain(raw){
   if(!local(raw,lesson)||raw.type!=='grammar'||raw.graded!==true||!valid(raw)||!text(raw.question||raw.prompt)||reading.test([raw.category,raw.focus,raw.conceptId,raw.question,raw.rule].join(' '))||raw.focus!=='grammar'&&!grammar.test(raw.rule||raw.explanation||''))return;
   const row=copy(raw);row.id=text(raw.id)||'pipeline-existing:'+lesson.id+':'+hash(JSON.stringify([raw.question,raw.options,raw.answer]));
   row.sourceLessonId=lesson.id;row.conceptId=text(raw.conceptId)||'pipeline:'+lesson.id+':grammar:'+hash(row.id);row.category='grammar';
   const key=normal(row.question||row.prompt);if(ids.has(row.id)||questions.has(key))return;ids.add(row.id);questions.add(key);result.push(row);
  }
  const bank=options.bank,registered=typeof bank?.hasLesson==='function'&&bank.hasLesson(lesson.id);
  const existing=registered&&typeof bank.questionsForLesson==='function'?bank.questionsForLesson(lesson.id):list(lesson.quiz);
  for(const row of list(existing))retain(row);
  let units=options.readingUnits;
  units=Array.isArray(units)?units:units?[units]:[];
  // Accept an already loaded book object, a single entry, or entry arrays.
  if(units.length===1&&Array.isArray(units[0]?.lessons))units=units[0].lessons;
  for(const entry of units){
   if(entry?.lessonId!==lesson.id||entry.bodyFingerprint&&entry.bodyFingerprint!==fingerprint(lesson))continue;
   for(const raw of list(entry.questions)){
    const evidence=raw.evidence;if(raw.type!=='choice'||raw.focus!=='grammar'||!valid(raw)||!Number.isInteger(evidence?.paragraphIndex)||!text(evidence.quote)||!lesson.paragraphs?.[evidence.paragraphIndex]?.en?.includes(evidence.quote))continue;
    const row={...copy(raw),id:'pipeline-recall:'+lesson.id+':'+raw.id,originalQuestionId:raw.id,type:'grammar',graded:true,sourceLessonId:lesson.id,
     question:raw.instructionZh||raw.prompt,rule:raw.explanation,sourceType:'existing-lesson-recall-grammar',sourceLabel:'本课已有语法回顾题 · 自编配套练习'};
    retain(row);
   }
  }
  if(result.length>=10)return result;
  function source(value,kind,index=null){
   value=text(value);if(!value||!/[A-Za-z]/.test(value))return;
   const rows=value.match(/[^.!?\n]+(?:[.!?]+["”’']?|$)/g)||[value];
   for(let sentence of rows){sentence=sentence.trim();if(!sentence||sourceKeys.has(sentence))continue;sourceKeys.add(sentence);sources.push({text:sentence,kind,index});}
  }
  list(lesson.paragraphs).forEach((row,index)=>source(row.en,'textbook-passage',index));
  for(const row of [...list(lesson.grammar),...list(lesson.usage),...list(lesson.vocabulary)]){
   if(!local(row,lesson)||row.practiceEligible===false||row.needsContextReview===true)continue;
   source(row.example,'lesson-notes');for(const value of list(row.supportingExamples))source(value,'lesson-notes');
  }
  for(const row of list(lesson.quiz)){
   const original=text(row.explanation).match(/^原句：([\s\S]+?)\s+巩固/);if(original)source(original[1],'lesson-notes');
  }
  function make(source,index,answer,wrong,concept,instruction,rule){
   const expected=source.text.slice(index,index+answer.length);if(normal(expected)!==normal(answer))return;
   const alternatives=[answer,...wrong.map(value=>/^[A-Z]/.test(answer)?value[0].toUpperCase()+value.slice(1):value)].filter((value,index,rows)=>rows.findIndex(item=>normal(item)===normal(value))===index);if(alternatives.length<3)return;
   const cloze=source.text.slice(0,index)+'___'+source.text.slice(index+answer.length),key=normal(cloze)+'|'+normal(answer);if(generatedKeys.has(key))return;generatedKeys.add(key);
   const id='pipeline-source:'+lesson.id+':'+hash(concept+'|'+key),slot=parseInt(hash(id),16)%alternatives.length;
   const choices=alternatives.slice(1);choices.splice(slot,0,alternatives[0]);
   const label=source.kind==='textbook-passage'?'本课教材正文':'本课已有学习笔记例句';
   generated.push({id,type:'grammar',graded:true,category:'grammar',sourceLessonId:lesson.id,lessonId:lesson.id,conceptId:'pipeline:'+lesson.id+':grammar:'+hash(concept+'|'+key),grammarConceptId:concept,
    question:'【自编语法练习】根据本课原句，'+instruction+'：\n'+cloze,options:choices,answer:slot,rule,
    explanation:'原句：'+source.text+'\n依据：'+rule+'\n来源：'+label+'；本题为自编练习，非教材原题。',
    sourceType:'self-authored-source-bound-grammar',sourceLabel:'本课原句约束 · 自编语法练习（非教材原题）',
    sourceEvidence:{sourceText:source.text,sourceParagraphIndex:source.index,sourceType:source.kind,sourceLessonId:lesson.id}});
  }
  function formChoices(base){return [base,...FORMS[base]].filter((value,index,rows)=>rows.indexOf(value)===index);}
  for(const source of sources){
   const sentence=source.text;
   for(const pattern of [/\b(I|you|we|they|he|she|it|this|that)\s+(am|is|are|was|were)\b/gi,/\b(am|is|are|was|were)\s+(I|you|we|they|he|she|it|this|that)\b/gi]){
    const reverse=pattern.source.startsWith('\\b(am');
    for(const match of sentence.matchAll(pattern)){
     const pronoun=normal(match[reverse?2:1]),answer=match[reverse?1:2],verb=normal(answer),past=['was','were'].includes(verb);
     if(past&&/\bif\b|\bwish\b|as\s+(?:if|though)/i.test(sentence))continue;
     const expected=past?['you','we','they'].includes(pronoun)?'were':'was':pronoun==='i'?'am':['you','we','they'].includes(pronoun)?'are':'is';if(verb!==expected)continue;
     const offset=reverse?match.index:match.index+match[0].lastIndexOf(answer);
     const alternatives=past?['was','were','being','been']:['am','is','are','be'];
     make(source,offset,answer,alternatives.filter(value=>value!==verb),'be-agreement','保留原句'+(past?'过去时':'现在时')+'，选择与主语一致的 be 形式',pronoun+' 作主语；本题保留原句'+(past?'过去':'现在')+'形式，应使用 '+verb+'。');
    }
   }
   for(const match of sentence.matchAll(/\b(am|is|are|was|were)\b/gi)){
    const answer=match[1];if(/\b(?:was|were)\b/i.test(answer)&&/\bif\b|\bwish\b|as\s+(?:if|though)/i.test(sentence))continue;
    make(source,match.index,answer,['be','being','been'],'finite-be-form','保留原句中的 be 谓语形式，不改变原句时态','这条原句使用 '+answer+'；备选 be、being、been 分别是原形、现在分词和过去分词，不能直接替代这里的谓语形式。');
   }
   for(const match of sentence.matchAll(/\b(I|you|he|she|it|we|they)\s+(?:am|is|are|was|were)\b/gi)){
    const pronoun=normal(match[1]);make(source,match.index,match[1],SUBJECTS[pronoun],'subject-pronoun','选择在本句中作主语的人称代词主格形式',match[1]+' 在这条原句中作主语；本题选择人称代词主格，不用物主代词、反身代词或相应宾格形式。');
   }
   for(const pattern of [/\b(this)\s+(?:is|was)\b/gi,/\b(?:is|was)\s+(this)\b/gi])for(const match of sentence.matchAll(pattern)){
    make(source,match.index+match[0].indexOf(match[1]),match[1],['these','those','they'],'singular-demonstrative','保留原句的单数指示代词，与 is/was 搭配','this 是单数指示代词；这里的 is/was 与单数主语搭配。these、those、they 均为复数形式。');
   }
   for(const match of sentence.matchAll(/\b(my|your|his|her|its|our|their)\s+([A-Za-z]+)\b/gi)){
    const next=normal(match[2]),prefix=sentence.slice(0,match.index);
    if(!NOUNS[next]&&!Object.values(NOUNS).includes(next))continue;
    if(prefix.trim()&&!/\b(?:am|is|are|was|were|this|that|these|those|with|in|on|at|from|to|of|under|over|for|about|beside|behind|before|after)\s+$/i.test(prefix))continue;
    const pronoun=normal(match[1]);make(source,match.index,match[1],POSSESSIVES[pronoun],'possessive-determiner','选择放在这个名词前的形容词性物主代词',match[1]+' 在本句中放在名词 '+match[2]+' 前表示所属；这里需要形容词性物主代词，不能直接换成相应主格、宾格、反身或名词性物主代词形式。');
   }
   const imperative=sentence.match(/^(?:Please\s+)?(Open|Close|Shut|Give|Take|Come|Go|Look|Listen|Read|Write|Put|Make|Turn|Show|Say|Tell|Keep|Stand|Sit|Wait|Point|Empty|Fill|Dust|Sweep|Wash)\b\s+(?!is\b|are\b|was\b|were\b)([\s\S]+)/i);
   if(imperative&&!sentence.endsWith('?')){
    const base=normal(imperative[1]);if(FORMS[base])make(source,sentence.indexOf(imperative[1]),imperative[1],formChoices(base).filter(value=>value!==base),'imperative-base-form','保留这条原句的祈使句形式','本句用动词原形 '+base+' 开始祈使结构，不能换成第三人称单数、过去式或 -ing 形式。');
   }
   for(const match of sentence.matchAll(/\b[A-Za-z]+\b/g)){
    const value=normal(match[0]);if(/[’']/.test(sentence[match.index+match[0].length]||''))continue;
    const base=Object.keys(NOUNS).find(base=>NOUNS[base]===value),singular=NOUNS[value]&&/\b(?:a|an|one|this|that)\s+$/i.test(sentence.slice(0,match.index))?value:null;
    if(!base&&!singular)continue;
    if(base){
     const prefix=sentence.slice(0,match.index),suffix=sentence.slice(match.index+match[0].length);
     const nounContext=/\b(?:the|these|those|my|your|his|her|its|our|their|some|any|many|few|several|all|both|no|other|two|three|four|five|six|seven|eight|nine|ten|\d+|of|with|in|on|at|for|from|under|over|behind|before|after|among|between)\s+$/i.test(prefix)||!prefix.trim()&&/^\s+(?:are|were|have|had|can|could|will|would|may|might|must|should)\b/i.test(suffix);
     if(!nounContext)continue;
    }
    const noun=base||singular,plural=!!base;
    make(source,match.index,match[0],[plural?noun:NOUNS[noun],noun+"'s"],'noun-number','选择原句中的普通名词'+(plural?'复数':'单数')+'形式（不用所有格）','本句使用名词'+(plural?'复数 ':'单数 ')+value+'；'+(plural?noun+' 是单数形式。':NOUNS[noun]+' 是复数形式。')+noun+"'s 是单数所有格形式。");
   }
   for(const match of sentence.matchAll(/\b(can|could|may|might|must|shall|should|will|would)\s+(?:(?:not|never|ever|always|also|just|still|only|really|even)\s+){0,3}([A-Za-z]+)\b/gi)){
    const base=normal(match[2]);if(!FORMS[base])continue;
    make(source,match.index+match[0].lastIndexOf(match[2]),match[2],formChoices(base).filter(value=>value!==base),'modal-base-form','保留情态动词后的动词原形',match[1]+' 是本句中的情态动词，其后直接接动词原形 '+base+'。');
   }
   for(const match of sentence.matchAll(/\b(?:do|does|did)\s+(?:(?:not|never|ever|really|always|just|I|you|we|they|he|she|it)\s+){0,3}([A-Za-z]+)\b/gi)){
    const base=normal(match[1]);if(!FORMS[base])continue;
    make(source,match.index+match[0].lastIndexOf(match[1]),match[1],formChoices(base).filter(value=>value!==base),'auxiliary-base-form','选择助动词 do/does/did 后的动词原形','本句已有 do/does/did，后面的实义动词用原形 '+base+'。');
   }
   for(const match of sentence.matchAll(/\b(has|have|had)\s+(?:(?:not|never|ever|already|just|also|always|once)\s+){0,3}([A-Za-z]+)\b/gi)){
    const word=normal(match[2]),base=Object.keys(FORMS).find(base=>FORMS[base][2]===word);if(!base)continue;
    make(source,match.index+match[0].lastIndexOf(match[2]),match[2],formChoices(base).filter(value=>value!==word),'perfect-participle','保留原句的完成结构，选择过去分词','本句使用 '+match[1]+' + 过去分词；'+base+' 在这条原句中的过去分词是 '+word+'。');
   }
   for(const match of sentence.matchAll(/\b(?:am|is|are|was|were)\s+(?:(?:not|still|always|just|already|also|now)\s+){0,3}([A-Za-z]+)\b/gi)){
    const word=normal(match[1]),base=Object.keys(FORMS).find(base=>FORMS[base][3]===word);if(!base||['be','have','know','think','feel','love','want','need','believe','understand'].includes(base))continue;
    make(source,match.index+match[0].lastIndexOf(match[1]),match[1],formChoices(base).filter(value=>value!==word),'be-ing-form','保留原句中 be + 动词 -ing 的形式','这条原句在 be 后使用 '+word+'；本题要求保留这一 -ing 结构。');
   }
   for(const match of sentence.matchAll(/\b(?:want(?:s|ed)?|need(?:s|ed)?|hop(?:e|es|ed)|tr(?:y|ies|ied)|decid(?:e|es|ed)|learn(?:s|ed)?|seem(?:s|ed)?|appear(?:s|ed)?|refus(?:e|es|ed)|able|unable|in order|so as)\s+to\s+([A-Za-z]+)\b/gi)){
    const base=normal(match[1]);if(!FORMS[base])continue;
    make(source,match.index+match[0].lastIndexOf(match[1]),match[1],formChoices(base).filter(value=>value!==base),'to-infinitive','选择这条原句中不定式 to 后的动词原形','本句的这个 to 引导不定式，后面用动词原形 '+base+'。');
   }
   for(const [pattern,answer,wrong,rule] of FIXED){
    pattern.lastIndex=0;
    for(const match of sentence.matchAll(pattern))make(source,match.index+match[0].lastIndexOf(match[1]),match[1],wrong,'fixed-preposition','按本句所学固定搭配选择介词',rule);
   }
  }
  // Rotate through distinct grammar forms before taking further source clauses.
  const groups=new Map();for(const row of generated){if(!groups.has(row.grammarConceptId))groups.set(row.grammarConceptId,[]);groups.get(row.grammarConceptId).push(row);}
  for(let index=0;result.length<10&&[...groups.values()].some(rows=>index<rows.length);index++)for(const rows of groups.values()){
   if(result.length>=10)break;const row=rows[index];if(!row||ids.has(row.id)||questions.has(normal(row.question)))continue;ids.add(row.id);questions.add(normal(row.question));result.push(row);
  }
  return result;
 }
 return Object.freeze({forLesson});
});
