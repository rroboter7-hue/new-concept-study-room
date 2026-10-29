/* Authored lesson grammar only. Every example is checked against the current passage. */
(function(root,factory){
 'use strict';
 const commonJS=typeof module==='object'&&module.exports;
 const books=commonJS?[
  require('./lesson-grammar-focus-book1.js'),
  require('./lesson-grammar-focus-book2.js'),
  require('./lesson-grammar-focus-book3.js'),
  require('./lesson-grammar-focus-book4.js')
 ]:[1,2,3,4].map(book=>(root.StudyGrammarFocusBooks||{})[book]);
 const api=factory(books);
 if(commonJS)module.exports=api;
 else root.StudyLessonGrammarFocus=api;
})(typeof window==='object'?window:globalThis,function(defaultCatalogs){
 'use strict';
 const fields=['title','summary','example','pitfall'];
 const template=/原句含有情态动词|备选\s*be\b|语法运用|本题保留原句/i;
 const unreadable=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/;
 const hasChinese=/[\u3400-\u9fff]/;

 function validate(entry,lesson){
  const errors=[];
  if(!entry||!Array.isArray(entry.points)||entry.points.length<1||entry.points.length>3){
   return {status:'needs-review',points:[],errors:['points 必须包含1–3个语法重点。']};
  }
  const paragraphs=Array.isArray(lesson.paragraphs)?lesson.paragraphs:[];
  const titles=new Set(),points=[];
  Array.from(entry.points).forEach((point,index)=>{
   const label='第'+(index+1)+'点';
   if(!point||typeof point!=='object'||Array.isArray(point)){
    errors.push(label+'必须包含 title、summary、example 和 pitfall。');
    return;
   }
   const copy={};
   for(const field of fields){
    const value=point[field];
    if(typeof value!=='string'||!value.trim()){
     errors.push(label+' '+field+' 必须为非空文字。');
     continue;
    }
    copy[field]=value;
    if(field==='title'){
     if(value.length>64)errors.push(label+' title 不能超过64字符。');
     const key=value.trim().normalize('NFKC').toLowerCase();
     if(titles.has(key))errors.push(label+' title 与本课其他重点重复。');
     titles.add(key);
    }else if(field==='summary'||field==='pitfall'){
     if(value.length>110)errors.push(label+' '+field+' 不能超过110字符。');
     // Linguistic accuracy and simplified-Chinese wording are editorial checks;
     // runtime catches missing Chinese, corrupt glyphs and unreadable controls.
     if(!hasChinese.test(value)||unreadable.test(value))errors.push(label+' '+field+' 必须包含可读中文说明。');
    }else{
     if(value.length<6||value.length>260)errors.push(label+' example 必须为6–260字符。');
     if(!/[A-Za-z]/.test(value))errors.push(label+' example 必须包含英文字符。');
     if(!paragraphs.some(p=>p&&typeof p.en==='string'&&p.en.includes(value))){
      errors.push(label+' example 必须逐字连续出现在本课单个英文段落中。');
     }
    }
    if(field!=='example'&&template.test(value))errors.push(label+' '+field+' 含有通用题库模板，需重新审校。');
   }
   points.push(copy);
  });
  return errors.length?{status:'needs-review',points:[],errors}:{status:'ready',points};
 }

 function create(catalogs){
  const entries=new Map();
  for(const catalog of Array.isArray(catalogs)?catalogs:[]){
   if(!catalog||typeof catalog!=='object'||Array.isArray(catalog))continue;
   for(const id of Object.keys(catalog))entries.set(id,catalog[id]);
  }
  return {
   forLesson(lesson){
    if(!lesson||typeof lesson.id!=='string'||!entries.has(lesson.id))return null;
    return validate(entries.get(lesson.id),lesson);
   },
   hasLesson(id){return entries.has(id);},
   lessonIds(){return Array.from(entries.keys());}
  };
 }
 return Object.assign(create(defaultCatalogs),{create});
});
