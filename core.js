(() => {
  'use strict';
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = (value,max=2000) => typeof value === 'string' ? value.trim().slice(0,max) : '';
  function normalizeLesson(raw,index=0) {
    if (!raw || typeof raw !== 'object' || !Number.isInteger(Number(raw.book)) || Number(raw.book)<1 || Number(raw.book)>4) throw new Error(`第 ${index+1} 课的册号必须为 1–4。`);
    const title=clean(raw.title,150);
    const paragraphs=Array.isArray(raw.paragraphs)?raw.paragraphs.map(p=>typeof p==='string'?{en:clean(p,10000),zh:''}:{en:clean(p?.en,10000),zh:clean(p?.zh,10000)}).filter(p=>p.en):[];
    if(!title || !paragraphs.length)throw new Error(`第 ${index+1} 课缺少标题或英文课文。`);
    if(paragraphs.length>100)throw new Error('每课最多支持 100 段。');
    const vocabulary=(Array.isArray(raw.vocabulary)?raw.vocabulary:[]).slice(0,100).filter(v=>v&&clean(v.word,80)).map(v=>({word:clean(v.word,80),phonetic:clean(v.phonetic,100),pos:clean(v.pos,30),meaning:clean(v.meaning,300),example:clean(v.example,600)}));
    const usage=(Array.isArray(raw.usage)?raw.usage:[]).slice(0,50).filter(u=>u&&clean(u.phrase,100)).map(u=>({phrase:clean(u.phrase,100),meaning:clean(u.meaning,300),note:clean(u.note,1000),example:clean(u.example,600)}));
    const quiz=(Array.isArray(raw.quiz)?raw.quiz:[]).slice(0,100).filter(q=>q&&clean(q.question)&&Array.isArray(q.options)&&q.options.length>=2&&q.options.length<=6&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length).map(q=>({type:q.type==='vocabulary'?'vocabulary':'grammar',question:clean(q.question),options:q.options.map(o=>clean(o,400)),answer:q.answer,explanation:clean(q.explanation,1200)}));
    return {id:'import-'+crypto.randomUUID(),book:Number(raw.book),number:Number(raw.number)||index+1,title,subtitle:clean(raw.subtitle,150),topic:clean(raw.topic,100)||'自有课文',source:'imported',minutes:Math.max(1,Math.ceil(paragraphs.map(p=>p.en).join(' ').split(/\s+/).length/100)),paragraphs,vocabulary,usage,quiz};
  }
  function parseLessonJSON(text){
    let data;try{data=JSON.parse(text);}catch{throw new Error('JSON 格式不正确，请检查文件。');}
    const rows=Array.isArray(data)?data:(Array.isArray(data?.lessons)?data.lessons:[data]);
    if(!rows.length || rows.length>400)throw new Error('请导入 1–400 篇课文。');
    return rows.map(normalizeLesson);
  }
  function fromText(text,meta){
    const paragraphs=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.replace(/^(?:\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+\s*/g,'').trim()).filter(x=>x&&!/^\[(ar|ti|al|by|offset):/i.test(x)).map(en=>({en,zh:''}));
    return normalizeLesson({...meta,paragraphs});
  }
  const normalizeAnswer = text => String(text??'').trim().toLowerCase().replace(/[.!?,;:"“”'’]+$/g,'').replace(/\s+/g,' ');
  function scoreQuiz(questions,answers){const correct=questions.reduce((n,q,i)=>n+(Object.hasOwn(answers,i)&&answers[i]===q.answer?1:0),0);return {correct,total:questions.length,percent:questions.length?Math.round(correct/questions.length*100):0};}
  window.StudyCore={escapeHTML,parseLessonJSON,fromText,normalizeAnswer,scoreQuiz};
})();
