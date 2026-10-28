/* Read-only adapters: source namespaces and intentional repeated sentences stay intact. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./batch-sentence-core.js'):root.StudySentenceBatch);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyLessonSentenceExport=api;
})(typeof window!=='undefined'?window:globalThis,function(Batch){
  'use strict';
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const own=(value,key)=>Object.getOwnPropertyDescriptor(object(value),key)?.value;
  const entries=value=>Object.entries(object(value));
  const kinds=['affirmative','negative','yesno','wh','combined'];
  const kindLabels={affirmative:'陈述句',negative:'否定句',yesno:'一般疑问句',wh:'特殊疑问句',combined:'综合句',dictation:'听写',retell:'复述'};
  function displayTarget(row){
    if(typeof row?.targetLabel==='string'&&row.targetLabel.trim())return row.targetLabel.trim();
    let value=typeof row?.target==='string'?row.target:'';
    if(!value)return '';
    try{value=decodeURIComponent(value);}catch(_){return value;}
    const match=value.match(/^(?:word|phrase):[^:]+:(.+)$/);
    if(!match)return value;
    try{return decodeURIComponent(match[1]);}catch(_){return match[1];}
  }
  function identity(key){
    const parts=key.split(':');let lesson,target,mode;
    if(parts.length===3&&parts[0]==='v1')[,lesson,target]=parts;
    else if(parts.length===4&&(parts[0]==='v2'&&parts[1]==='flexible'||parts[0]==='v3'&&['four','phrase'].includes(parts[1]))){[,mode,lesson,target]=parts;}
    else if(parts.length===6&&parts[0]==='round'&&parts[1]==='v1'&&['transform','flexible','four','phrase'].includes(parts[5]))[, ,lesson,target]=parts;
    else return null;
    try{return {lessonId:decodeURIComponent(lesson),targetKey:decodeURIComponent(target)};}catch(_){return null;}
  }
  function collect(options={}){
    const lessonId=options.lessonId,rows=[];
    if(typeof lessonId!=='string'||!lessonId)return rows;
    function add(answer,source,key,index,extra={}){
      if(typeof answer!=='string'||!answer.trim())return;
      rows.push({...extra,lessonId,answer,source,sourceId:JSON.stringify([source,key,index])});
    }
    for(const [key,draft]of entries(options.freeWriting))if(own(draft,'lessonId')===lessonId){
      for(const [target,row]of entries(own(draft,'targets')))if(Array.isArray(own(row,'answers')))row.answers.forEach((answer,index)=>add(answer,'freeWriting',key+':'+target,index,{target,index,feedback:row.feedback?.[index]?.sentence===answer?row.feedback[index]:null}));
    }
    const bundles=Array.isArray(options.sentencePractice)?options.sentencePractice:entries(options.sentencePractice).map(([sourceKey,draft])=>({...identity(sourceKey),sourceKey,answers:own(draft,'answers')}));
    for(const bundle of bundles)if(bundle?.lessonId===lessonId)for(const kind of kinds)add(own(bundle.answers,kind),'sentencePractice',bundle.sourceKey,kind,{kind,target:bundle.targetKey});
    // A raw batch has no embedded lesson binding. Only its exact storage key
    // establishes one; an imported-text workspace is never assigned implicitly.
    const batch=own(options.sentenceBatches,lessonId);
    if(batch&&Batch?.parse){
      const parsed=Batch.parse(own(batch,'rawText'),own(batch,'mode'));
      for(const row of parsed.rows||[])add(row.text,'sentenceBatches',lessonId,row.id,{kind:row.kind,target:row.context?.target});
    }
    const modes=own(own(own(options.outputDrafts,'lessons'),lessonId),'modes');
    for(const [index,answer]of entries(own(own(modes,'write'),'answers')))add(answer,'outputDrafts',lessonId+':write',index,{kind:'dictation'});
    add(own(own(modes,'retell'),'answer'),'outputDrafts',lessonId+':retell',0,{kind:'retell'});
    return rows;
  }
  function prompt(lesson={},rows=[]){
    const lines=['请豆包人工复核以下本课学习草稿。','课程：第 '+(lesson.book??'')+' 册第 '+(lesson.number??'')+' 课 '+(lesson.title||'')+'（'+(lesson.id||'')+'）',
      '请逐条保留原句，检查拼写、大小写、标点、时态、语法、搭配、句意与自然度；如给出目标表达，也检查是否恰当使用。',
      '指出具体问题、简短理由与最小修改；正确的句子请说明，无充分依据时标明不确定。不要替换学习者意图或凭空添加情境。',
      '这些草稿和有限本地初检未构成完整批改，不计入成绩；重复句可能属于不同练习，请逐条保留。',''];
    const sourceLabels={freeWriting:'自主造句',sentencePractice:'旧版分组造句',sentenceBatches:'旧版批量句子'},outputKinds={dictation:'旧版听写稿',retell:'旧版复述稿'};
    rows.forEach((row,index)=>lines.push((index+1)+'. ['+(row.source==='outputDrafts'?outputKinds[row.kind]||'旧版输出草稿':sourceLabels[row.source]||'学习草稿')+(row.kind&&row.source!=='outputDrafts'?' · '+(kindLabels[row.kind]||'练习句子'):'')+(displayTarget(row)?' · 目标 '+displayTarget(row):'')+']\n'+row.answer));
    if(!rows.length)lines.push('本课暂无已写草稿。');
    return lines.join('\n\n');
  }
  return Object.freeze({collect,prompt});
});
