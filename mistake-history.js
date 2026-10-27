/* Resolve current and saved historical questions without silently changing versions. */
(function(root,factory){
 'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyMistakeHistory=api;
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{},text=(v,max=4000)=>typeof v==='string'?v.trim().slice(0,max):'';
 const answerFor=q=>q?.type==='choice'&&Array.isArray(q.options)&&Number.isInteger(q.answer)?text(q.options[q.answer]):Array.isArray(q?.expected)?text(q.expected[0]):'';
 function resolve(lessonId,mistake,options={}){
  const w=obj(mistake),pack=options.pack,revision=text(w.revision||options.revision,300),question=text(w.question),savedAnswer=text(w.answer),selected=text(w.selectedAnswer),taskId=text(w.taskId,500);
  const base={question,answer:savedAnswer,selectedAnswer:selected,rule:text(w.explanation),reason:text(w.reason),taskId,revision,examples:[],canRetry:false};
  if(taskId||w.sourceType==='authored-practice-pack'){
   const task=pack?.lessonId===lessonId&&Array.isArray(pack.tasks)?pack.tasks.find(q=>q.id===taskId):null;
   // Older backups lack a revision: use current data only when both the saved
   // literal question and answer still identify that exact task content.
   const current=task&&(revision?revision===pack.revision:question===text(task.prompt)&&savedAnswer===answerFor(task));
   if(!current)return {...base,status:savedAnswer?'saved-pack':'unavailable',sourceLabel:savedAnswer?'作答时保存的参考答案（题库已更新或版本未确认）':'该历史题未保留可核对的参考答案'};
   let learnerAnswer=selected;
   const session=obj(options.session),item=obj(obj(session.answers)[taskId]);
   if(!learnerAnswer&&session.revision===pack.revision&&item.submittedAt!=null){
    learnerAnswer=task.type==='choice'&&Number.isInteger(item.value)?text(task.options?.[item.value]):text(item.value);
   }
   return {...base,status:'current-pack',question:text(task.prompt),answer:answerFor(task),selectedAnswer:learnerAnswer,rule:text(task.rule),reason:text(w.reason),examples:(Array.isArray(task.contrastExamples)?task.contrastExamples:[]).map(e=>({en:text(e.en),zh:text(e.zh),sourceLabel:text(e.sourceLabel||'自编对比例句')})),revision:pack.revision,canRetry:true,sourceLabel:'当前单元训练题'};
  }
  const bank=options.bank;
  const q=bank?.hasLesson?.(lessonId)?bank.questionsForLesson(lessonId).find(q=>q.question===question):null;
  if(q&&Array.isArray(q.options)&&Number.isInteger(q.answer)&&text(q.options[q.answer]))return {...base,status:'current-bank',question:text(q.question),answer:text(q.options[q.answer]),rule:text(q.explanation),conceptId:text(q.conceptId,1000),sourceLabel:'当前已核对练习'};
  return {...base,status:savedAnswer?'saved-legacy':'unavailable',sourceLabel:savedAnswer?'作答时保存的参考答案（未与当前题库重新匹配）':'该历史题未保留可核对的参考答案'};
 }
 return Object.freeze({resolve});
});
