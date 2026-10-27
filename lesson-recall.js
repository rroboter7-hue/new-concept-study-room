(function(global){
 'use strict';
 class LessonRecall{
  constructor(options){
   this.options=options;this.core=global.StudyRecall;this.state=this.core.sanitize(options.getState?.());this.books=new Map();this.key='';this.entry=null;this.error='';this.loading=false;this.storageFailed=false;
   document.addEventListener('click',event=>{const b=event.target.closest?.('[data-recall-action],[data-recall-choice]');if(!b||!b.closest('#lesson-recall-content'))return;
    if(b.dataset.recallChoice!==undefined){this.change(b.dataset.recallQuestion,Number(b.dataset.recallChoice));this.redraw();document.querySelector('#lesson-recall-content [data-recall-question="'+b.dataset.recallQuestion+'"][data-recall-choice="'+b.dataset.recallChoice+'"]')?.focus?.({preventScroll:true});}
    else if(b.dataset.recallAction==='retry'&&!this.loading){this.load(this.options.getLesson(),true);this.redraw();}
    else if(b.dataset.recallAction==='submit'&&this.entry){const result=this.core.submit(this.state,this.entry);if(!result.accepted){this.options.toast?.('请先完成本课的选择题和简答题，再检查回答。');const missing=result.results.find(r=>r.status==='missing');document.getElementById('recall-question-'+missing?.questionId)?.scrollIntoView?.({block:'center'});return;}this.persist(result.state);this.redraw();document.querySelector('#lesson-recall-content .recall-result-summary')?.focus?.({preventScroll:true});}
   });
   document.addEventListener('input',event=>{const input=event.target;if(input.dataset?.recallInput===undefined||!input.closest?.('#lesson-recall-content'))return;this.change(input.dataset.recallInput,input.value,true);const root=document.querySelector('#lesson-recall-content');root?.querySelectorAll('.recall-feedback').forEach(n=>n.innerHTML='');const status=root?.querySelector('.recall-result-summary');if(status)status.textContent='答案已修改，请重新提交检查。';});
   global.addEventListener?.('pagehide',()=>this.flush());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.flush();});
  }
  snapshot(){return this.core.sanitize(this.state);}
  cancelSave(){clearTimeout(this.saveTimer);this.saveTimer=null;this.pendingSave=false;}
  reloadFromStorage(){this.cancelSave();this.state=this.core.sanitize(this.options.getState?.());this.redraw();}
  persist(state){this.cancelSave();this.state=state;try{this.storageFailed=this.options.saveState(state)!==true;}catch{this.storageFailed=true;}if(this.storageFailed)this.options.toast?.('本次回顾答案尚未保存到浏览器，请导出学习备份后重试。');}
  flush(){if(this.pendingSave)this.persist(this.state);return !this.storageFailed;}
  change(id,value,later=false){if(!this.entry)return;const next=this.core.update(this.state,this.entry,id,value);this.state=next;this.options.onDraft?.(next);if(later){clearTimeout(this.saveTimer);this.pendingSave=true;this.saveTimer=setTimeout(()=>this.flush(),250);}else this.persist(next);}
  descriptor(lesson){const d=global.STUDY_RECALL_CATALOGUE?.books?.[lesson?.book];return d?.lessonIds?.includes(lesson.id)?d:null;}
  load(lesson,retry=false){
   if(!lesson)return;const key=lesson.id+'|'+this.core.fingerprint(lesson);if(key===this.key&&!retry)return this.ready;
   if(key!==this.key)this.flush();this.key=key;this.entry=null;this.error='';this.loading=false;const descriptor=this.descriptor(lesson);if(!descriptor){this.ready=Promise.resolve();return this.ready;}
   this.loading=true;if(retry)this.books.delete(lesson.book);
   if(!this.books.has(lesson.book)){
    const request=(async()=>{const url=new URL(descriptor.url,global.location.href);if(url.origin!==new URL(global.location.href).origin||!/^.*\/recall-data\/book[1-4]\.json$/.test(url.pathname))throw Error('Invalid recall source');const controller=global.AbortController?new global.AbortController():null,timer=setTimeout(()=>controller?.abort(),12000);try{const response=await global.fetch(url.href,{signal:controller?.signal});if(!response.ok)throw Error('Unavailable recall data');const data=await response.json();if(data.version!==1||data.book!==lesson.book||data.language!=='en'||data.scope!=='grammar'||data.instructionLanguage!=='zh-CN'||!Array.isArray(data.lessons))throw Error('Invalid recall data');return data;}finally{clearTimeout(timer);}})();
    this.books.set(lesson.book,request);request.catch(()=>{if(this.books.get(lesson.book)===request)this.books.delete(lesson.book);});
   }
   this.ready=this.books.get(lesson.book).then(data=>{if(this.key!==key)return;const entry=data.lessons.find(e=>e.lessonId===lesson.id);if(!this.core.validateEntry(entry,lesson).ok)throw Error('Recall source changed');this.entry=entry;this.loading=false;this.redraw();}).catch(()=>{if(this.key!==key)return;this.loading=false;this.error='本课回顾题暂未加载成功，或题目与当前原文不一致。';this.redraw();});return this.ready;
  }
  redraw(){const root=document.querySelector('#lesson-recall-content'),lesson=this.options.getLesson();if(root&&root.dataset.recallLesson===lesson?.id)root.innerHTML=this.render(lesson);}
  render(lesson){
   this.load(lesson);const e=this.options.escapeHTML;
   if(this.loading)return '<p class="small-note" role="status">正在载入本课语法回顾题……</p>';
   if(this.error)return '<p class="small-note" role="status">'+e(this.error)+'</p><button class="button subtle" data-recall-action="retry">重新加载回顾题</button>';
   if(!this.entry)return '<p class="small-note">这篇课文尚未配置经核对的语法回顾题，可先查看知识讲解。</p>';
   const entry=this.entry,answers=this.core.answersFor(this.state,entry),submitted=this.state.lessons[entry.lessonId]?.revision===entry.revision&&this.state.lessons[entry.lessonId]?.submitted,results=submitted?entry.questions.map(q=>this.core.grade(q,answers[q.id])):[],confirmed=results.filter(r=>r.status==='correct').length,unmatched=results.filter(r=>r.status==='unmatched').length,englishRequired=results.filter(r=>r.status==='english-required').length;
   let html='<p class="small-note">回想本课语法，再完成下面的英文练习。题目要求用中文说明，答案请用英文填写。</p>';
   if(this.storageFailed)html+='<p role="status" class="recall-storage-warning">答案仅暂存在当前页面，尚未写入浏览器，请导出学习备份。</p>';
   if(submitted)html+='<p class="recall-result-summary" tabindex="-1" role="status">已确认 '+confirmed+' / '+entry.questions.length+' 题正确'+(unmatched?'；'+unmatched+' 题表述需核对':'')+(englishRequired?'；'+englishRequired+' 题请改用英文作答':'')+'。语法回顾结果单独记录，不代表整课掌握。</p>';
   html+=entry.questions.map((q,i)=>{
    const value=answers[q.id],result=results[i],field=q.type==='choice'?'<div class="recall-options" role="group" aria-label="第'+(i+1)+'题选项" lang="en">'+q.options.map((text,n)=>'<button type="button" class="recall-option '+(value===n?'selected':'')+'" data-recall-question="'+e(q.id)+'" data-recall-choice="'+n+'" aria-pressed="'+(value===n)+'"><span>'+String.fromCharCode(65+n)+'.</span> '+e(text)+'</button>').join('')+'</div>':'<label class="recall-short-label" for="recall-answer-'+e(q.id)+'">请用英文作答</label><textarea lang="en" id="recall-answer-'+e(q.id)+'" data-recall-input="'+e(q.id)+'" rows="2" maxlength="800" placeholder="请按要求填写英文单词或改写后的完整句子">'+e(value??'')+'</textarea>';
    const feedback=result?'<div class="recall-feedback '+result.status+'"><strong>'+({correct:'✓ 回答正确',incorrect:'✕ 需要修改',unmatched:'⚠ 表述需核对','english-required':'⚠ 请用英文作答'}[result.status]||'请补全答案')+'</strong><p>你的答案：'+e(q.type==='choice'?q.options[value]:value)+'</p><p>参考答案：'+e(result.expected||'')+'</p><p>'+e(result.explanation||'')+'</p>'+(['unmatched','english-required'].includes(result.status)?'<p>'+e(q.explanation)+'</p>':'')+'<details><summary>查看本课语法例句</summary><p class="english">'+(this.options.wordHTML||e)(q.evidence.quote)+'</p></details></div>':'';
    return '<section class="recall-question" id="recall-question-'+e(q.id)+'"><p class="small-note" lang="zh-CN">'+e(q.grammarPointZh||'语法练习')+'</p><h4 lang="zh-CN">'+String(i+1)+'. '+e(q.instructionZh||q.prompt)+'</h4>'+field+feedback+'</section>';
   }).join('');
   return html+'<div class="lesson-step-actions"><button class="button primary" data-recall-action="submit">检查本课语法</button></div><p class="small-note">按上面的中文要求完成英文练习，提交后查看语法解析。未识别的其他写法会提示你对照参考答案复核。</p>';
  }
 }
 global.LessonRecall=LessonRecall;
})(window);
