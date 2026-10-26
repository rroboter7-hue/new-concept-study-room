/* Read, practice, review and delayed retest are separate learning evidence. */
(function(global){
 'use strict';
 const DAY=86400000,SHANGHAI=8*3600000;
 const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const time=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<8640000000000000?value:null;
 const nowOf=value=>time(value)??Date.now();
 const day=value=>Math.floor((value+SHANGHAI)/DAY);
 const count=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?Math.floor(value):0;
 const copyWrong=value=>Array.isArray(value)?value.map(row=>typeof row==='object'&&row?{...row}:row):[];
 function progress(record){
  const source=object(object(record).learningProgress);
  return {...source,version:1,readAt:time(source.readAt),firstPracticedAt:time(source.firstPracticedAt),lastPracticedAt:time(source.lastPracticedAt),retestDueAt:time(source.retestDueAt),retestPassedAt:time(source.retestPassedAt),lastRetestAt:time(source.lastRetestAt)};
 }
 function passed(p,now){return p.retestVerified===true&&p.firstPracticedAt!==null&&p.retestPassedAt!==null&&p.retestPassedAt<=now&&p.retestPassedAt>=p.firstPracticedAt+DAY&&day(p.retestPassedAt)>day(p.firstPracticedAt);}
 function describe(record,options={}){
  const source=object(record),p=progress(source),now=nowOf(options.now),read=source.completed===true||p.readAt!==null;
  const practiced=count(source.attempts)>0||p.firstPracticedAt!==null,retestPassed=passed(p,now),dueCount=count(options.dueCount);
  const canRetest=practiced&&!retestPassed&&p.firstPracticedAt!==null&&p.retestDueAt!==null&&now>=p.retestDueAt&&now>=p.firstPracticedAt+DAY&&day(now)>day(p.firstPracticedAt);
  const due=dueCount>0||canRetest,labels=[];
  if(read)labels.push('读过');if(practiced)labels.push('练过');if(due)labels.push('待复习');if(retestPassed)labels.push('复测通过');
  return {read,practiced,due,retestPassed,canRetest,dueCount,labels,status:due?'due':retestPassed?'retest-passed':practiced?'practiced':read?'read':'new',summary:labels.join(' · ')||'未开始',readAt:p.readAt,practicedAt:p.lastPracticedAt,retestDueAt:p.retestDueAt,retestPassedAt:retestPassed?p.retestPassedAt:null};
 }
 function markRead(record,value,at){
  const source=object(record),now=nowOf(at),p=progress(source),read=value===true;
  p.readAt=read?(p.readAt??now):null;
  return {...source,completed:read,lastAt:now,learningProgress:p};
 }
 function recordPractice(record,options={}){
  const source=object(record),score=options.score;
  if(options.graded===false||options.countsTowardProgress===false||/^(?:remediation|follow-?up|correction)$/i.test(String(options.mode||''))||typeof score!=='number'||!Number.isFinite(score)||score<0||score>100)return {...source};
  const now=nowOf(options.now),p=progress(source),wasPassed=passed(p,now),answersKnown=Array.isArray(options.wrong),wrong=copyWrong(answersKnown?options.wrong:source.wrong),perfect=score===100&&answersKnown&&wrong.length===0;
  p.firstPracticedAt=p.firstPracticedAt??now;
  const eligible=!wasPassed&&p.retestDueAt!==null&&now>=p.retestDueAt&&now>=p.firstPracticedAt+DAY&&day(now)>day(p.firstPracticedAt);
  p.lastPracticedAt=now;
  if(p.retestDueAt===null&&!wasPassed)p.retestDueAt=p.firstPracticedAt+DAY;
  if(options.isRetest===true&&eligible){
   p.lastRetestAt=now;
   if(perfect){p.retestPassedAt=now;p.retestVerified=true;p.retestDueAt=null;}
   else {p.retestPassedAt=null;p.retestVerified=false;p.retestDueAt=now+DAY;}
  }else {
   if(!wasPassed)p.retestDueAt=now+DAY;
   if(score<100||answersKnown&&wrong.length>0){
    p.retestPassedAt=null;p.retestVerified=false;p.retestDueAt=now+DAY;
   }
  }
  return {...source,lastAt:now,attempts:count(source.attempts)+1,best:Math.max(typeof source.best==='number'&&Number.isFinite(source.best)?Math.min(100,Math.max(0,source.best)):0,score),lastScore:score,wrong,mode:typeof options.mode==='string'?options.mode:'mixed',learningProgress:p};
 }
 global.StudyLearningProgress=Object.freeze({describe,markRead,recordPractice});
})(typeof window==='object'?window:globalThis);
