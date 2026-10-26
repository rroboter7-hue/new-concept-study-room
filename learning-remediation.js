(function(global){
 'use strict';
 const text=x=>typeof x==='string'?x.trim():'';
 const norm=x=>text(x).normalize('NFKC').replace(/[‘’]/g,"'").replace(/\s+/g,' ').toLowerCase();
 const list=x=>Array.isArray(x)?x:[];
 const clone=x=>JSON.parse(JSON.stringify(x));
 const wordCache=new WeakMap();
 const pilotPassageForms={
  '2|ring':{meaning:'铃响；打电话',forms:['rang']},'2|repeat':{meaning:'重复',forms:['repeated']},
  '3|postcard':{meaning:'明信片',forms:['postcards']},'3|museum':{meaning:'博物馆',forms:['museums']},
  '4|receive':{meaning:'收到',forms:['received']},'5|cover':{meaning:'行过（一段距离）',forms:['covered']},'5|request':{meaning:'请求；需求',forms:['requests']},
  '6|call':{meaning:'短暂拜访；登门',forms:['calls']},'7|detective':{meaning:'侦探',forms:['detectives']},'7|expect':{meaning:'等待；期待',forms:['expecting']},
  '8|path':{meaning:'小路',forms:['paths']},'9|shout':{meaning:'大声叫喊',forms:['shouted']},'9|refuse':{meaning:'拒绝',forms:['refused']},
  '10|damage':{meaning:'损坏',forms:['damaged']},'10|key':{meaning:'（乐器的）琴键',forms:['keys']},'10|string':{meaning:'（乐器的）弦',forms:['strings']},'10|shock':{meaning:'使震惊',forms:['shocked']},'10|allow':{meaning:'允许',forms:['allowed']}
 };
 const anchorMeanings={theatre:/剧场|戏院|剧院/,seat:/座位/,pigeon:/鸽/,sand:/沙/,cheese:/奶酪/,engineer:/工程师/,bridge:/桥/,diamond:/钻石/,museum:/博物馆/,clock:/钟/,beer:/啤酒/,island:/岛/};
 const synonymSets=[['big','large','huge','enormous','great'],['little','small','tiny'],['pretty','beautiful','lovely'],['angry','furious'],['sofa','couch'],['theatre','theater','playhouse'],['answer','reply'],['begin','start'],['end','finish'],['glad','happy','pleased'],['ill','sick'],['road','street'],['car','automobile']];
 function meaningsOverlap(a,b){
  const left=norm(a).replace(/[的地得；;，,、\s（）()]/g,''),right=norm(b).replace(/[的地得；;，,、\s（）()]/g,'');
  if(!left||!right)return true;
  if(left.includes(right)||right.includes(left))return true;
  const chars=new Set(left.match(/[\u3400-\u9fff]/g)||[]);
  return (right.match(/[\u3400-\u9fff]/g)||[]).some(c=>chars.has(c));
 }
 const lexicalSynonyms=(a,b)=>synonymSets.some(group=>group.includes(norm(a))&&group.includes(norm(b)));
 function allWords(bank,lesson){
  if(wordCache.has(bank))return wordCache.get(bank);
  const seen=new Set(),words=[];
  for(const entry of list(bank.audit?.vocabularyEntries)){
   if(entry.status!=='confirmed'||!entry.conceptId||seen.has(entry.conceptId))continue;
   const record=bank.get(entry.conceptId);if(record?.kind!=='word')continue;seen.add(record.id);words.push(record);
  }
  if(!words.length)for(const word of list(bank.vocabularyForLesson?.(lesson?.id))){const record=bank.get(word.conceptId);if(record&&!seen.has(record.id)){seen.add(record.id);words.push(record);}}
  wordCache.set(bank,words);return words;
 }
 function sentences(paragraph){
  const result=[];let start=0;
  for(let i=0;i<paragraph.length;i++){
   if(!/[.!?]/.test(paragraph[i]))continue;
   const before=paragraph.slice(start,i+1);
   if(paragraph[i]==='.'&&(/\b(?:Mr|Mrs|Ms|Dr|St|[A-Z])\.$/.test(before)||/\d/.test(paragraph[i-1]||'')&&/\d/.test(paragraph[i+1]||'')))continue;
   let end=i+1;while(/[’”"']/.test(paragraph[end]||' ')&&end<paragraph.length)end++;
   const value=paragraph.slice(start,end).trim();if(value)result.push(value);start=end;i=end-1;
  }
  const tail=paragraph.slice(start).trim();if(tail)result.push(tail);return result;
 }
 function examplesForWord(record,lesson){
  if(!lesson||lesson.id!==record.lessonId)return [];
  const reviewed=pilotPassageForms[lesson.number+'|'+norm(record.word)],forms=[record.word,...(reviewed&&norm(reviewed.meaning)===norm(record.meaning)?reviewed.forms:[])];
  const escaped=forms.map(form=>norm(form).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ +/g,'\\s+')).join('|');
  const match=new RegExp('(^|[^a-z])('+escaped+')(?=$|[^a-z])','i'),examples=[];
  for(const p of list(lesson.paragraphs))for(const sentence of sentences(text(p.en))){
   if(!match.test(norm(sentence))||examples.some(x=>x.en===sentence))continue;
   examples.push({en:sentence,sourceType:'lesson-passage',sourceLabel:'本课课文原句',sourceLessonId:lesson.id,sourcePdfPage:lesson.textbook?.sourcePdfPage,headword:record.word,matchedForm:match.exec(norm(sentence))[2]});if(examples.length===2)return examples;
  }
  if(examples.length)return examples;
  const authored=list(global.PILOT_GRAMMAR_FOLLOWUPS?.wordExamples).find(x=>x.conceptId===record.id&&norm(x.meaning)===norm(record.meaning));
  return authored?clone(authored.examples):[];
 }
 function labelledExamples(examples,lesson){
  return list(examples).map(value=>{
   const en=text(typeof value==='string'?value:value?.en);if(!en)return null;
   const original=list(lesson?.paragraphs).some(p=>text(p.en).includes(en));
   return {en,...(typeof value==='object'&&value.zh?{zh:value.zh}:{}),sourceType:original?'lesson-passage':'self-authored-example',sourceLabel:original?'本课课文原句':'自编对比例句（非课文原句）'};
  }).filter(Boolean);
 }
 function reverseQuestion(record,q,words,lesson){
  const chosen=[],used=new Set([norm(record.word)]),meanings=[record.meaning];
  for(const other of words){
   const key=norm(other.word),anchor=Object.prototype.hasOwnProperty.call(anchorMeanings,key)?anchorMeanings[key]:null;
   if(!anchor||!anchor.test(other.meaning)||used.has(key)||lexicalSynonyms(record.word,other.word)||meanings.some(m=>meaningsOverlap(m,other.meaning)))continue;
   used.add(key);chosen.push(other);meanings.push(other.meaning);if(chosen.length===3)break;
  }
  if(chosen.length!==3)return null;
  const answer=Array.from(record.id).reduce((n,c)=>(n+c.charCodeAt(0))%4,0),options=chosen.slice();options.splice(answer,0,record);
  const parentId=text(q.id)||text(q.parentId)||record.id+':recognition',wrongReasons={};
  for(const other of chosen)wrongReasons[other.word]=other.word+' 在当前词表中表示“'+other.meaning+'”，不对应目标词义“'+record.meaning+'”。';
  return {id:'remediation:'+record.id+':reverse',parentId,parentIds:[parentId],conceptId:record.id,knowledgeId:record.id,sourceLessonId:record.lessonId,type:'vocabulary',direction:'meaning-to-word',question:'【自编订正练习】在本课已确认词义中，哪个英文词对应“'+record.meaning+'”？',options:options.map(x=>x.word),optionConceptIds:options.map(x=>x.id),answer,rule:'本课词表确认：'+record.word+'＝'+record.meaning+'。',wrongReasons,contrastExamples:examplesForWord(record,lesson),sourceType:'self-authored-remediation-practice',sourceLabel:'自编订正练习 · 按当前课内词义（非教材原配练习）',graded:false,countsTowardProgress:false};
 }
 function missing(q,reason){return {conceptId:text(q?.conceptId),rule:'',reason,contrastExamples:[],followUp:null,followUpMessage:'暂无已确认的同知识点新题。',isCorrect:false,correctAnswer:''};}
 function describe(q,chosenIndex,{bank=global.StudyKnowledge?.bank,lesson}={}){
  if(!q||!bank||typeof bank.get!=='function')return missing(q,'未找到这道题所需的已确认知识库。');
  const id=text(q.conceptId)||text(q.knowledgeId),record=bank.get(id);
  if(!record)return missing(q,'未找到这个知识点的已确认记录，暂不生成补救题。');
  if(lesson&&lesson.id!==record.lessonId)return missing(q,'未找到与本课一致的已确认知识点。');
  const options=list(q.options),selected=Number.isInteger(chosenIndex)?text(options[chosenIndex]):'',validChoice=!!selected;
  if(record.kind==='word'){
   const words=allWords(bank,lesson),reverse=q.direction==='meaning-to-word',correctAnswer=reverse?record.word:record.meaning,isCorrect=validChoice&&norm(selected)===norm(correctAnswer);
   let reason='';
   if(!validChoice)reason='尚未选择有效选项。'+record.word+' 的本课词义是“'+record.meaning+'”。';
   else if(isCorrect)reason='这次选择正确。'+record.word+' 的本课词义是“'+record.meaning+'”。';
   else if(reverse){
    const selectedRecord=bank.get(list(q.optionConceptIds)[chosenIndex])||words.find(x=>norm(x.word)===norm(selected));
    reason='你选择了“'+selected+'”。'+(selectedRecord?selectedRecord.word+' 在当前词表中表示“'+selectedRecord.meaning+'”，':'当前词表未确认它对应这个目标词义，')+'本题要找的是“'+record.meaning+'”，对应 '+record.word+'。';
   }else{
    const matches=words.filter(x=>norm(x.meaning)===norm(selected)&&norm(x.word)!==norm(record.word));
    reason='你选择的“'+selected+'”'+(matches.length?'是当前词表中 '+Array.from(new Set(matches.map(x=>x.word))).slice(0,3).join(' / ')+' 的词义，':'不是这个词当前已确认的课内释义，')+'不能套用于 '+record.word+'；'+record.word+' 在本课表示“'+record.meaning+'”。';
   }
   const contrastExamples=examplesForWord(record,lesson),followUp=reverse?null:reverseQuestion(record,q,words,lesson);
   return {conceptId:record.id,rule:'本课词表确认：'+record.word+'＝'+record.meaning+'。',reason,contrastExamples,contrastMessage:contrastExamples.length?'':'本课暂无可验证的课文原句例证。',followUp,followUpMessage:followUp?'':reverse?'这道反向补救题已展示，暂无另一道已确认的同知识点新题。':'暂无能保证四个选项含义有别的同知识点新题。',isCorrect,correctAnswer,selectedOption:selected};
  }
  if(record.kind!=='grammar')return missing(q,'未找到可使用的已确认词义或语法记录。');
  const pilot=list(global.PILOT_GRAMMAR_FOLLOWUPS?.entries),approvedFollowUp=pilot.find(x=>x.id===q.id&&x.conceptId===record.id&&x.question===q.question),current=list(bank.questionsForLesson(record.lessonId)).find(x=>x.type==='grammar'&&x.conceptId===record.id&&x.question===q.question&&JSON.stringify(x.options)===JSON.stringify(q.options)),reviewed=approvedFollowUp||current;
  if(!reviewed)return missing(q,'未找到这道语法题的已确认题干与选项，暂不沿用旧解析。');
  const correctAnswer=reviewed.options[reviewed.answer],isCorrect=validChoice&&norm(selected)===norm(correctAnswer),rule=text(reviewed.rule),reason=!validChoice?'尚未选择有效选项。':isCorrect?'这次选择符合该规则。':text(reviewed.wrongReasons?.[selected])||'该选项不符合本题已限定的结构。'+rule,followUp=pilot.find(x=>x.conceptId===record.id&&x.id!==q.id);
  return {conceptId:record.id,rule,reason,contrastExamples:labelledExamples(reviewed.contrastExamples,lesson),followUp:followUp?clone(followUp):null,followUpMessage:followUp?'':approvedFollowUp?'这道补救题已展示，暂无另一道已审核的同知识点新题。':'这个语法知识点暂无已审核的新题（新语境补救练习）。',isCorrect,correctAnswer,selectedOption:selected};
 }
 global.StudyRemediation={version:'1.0.0',describe,meaningsOverlap};
})(window);
