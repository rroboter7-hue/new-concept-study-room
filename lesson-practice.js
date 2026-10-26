/* One task at a time; formal attempts, drafts and corrections remain separate. */
(function(global){
 'use strict';
 const A=global.StudyPracticePacks,clone=x=>JSON.parse(JSON.stringify(x)),obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{},escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={vocabulary:'词汇与拼写',grammar:'语法应用',listening:'单词听写',comprehension:'课文理解',production:'句型改写'};
 class LessonPractice{
  constructor(options){this.options=options||{};this.registry=this.options.registry||A.registry;this.e=this.options.escapeHTML||escape;this.audioToken=0;this.audioStatus={};this.pendingDrafts=new Map();this.committedAttempts=new Set();this.listener=e=>{const b=e.target.closest?.('[data-pack-action]');if(!b||!b.closest('#unit-practice-content'))return;e.preventDefault();this.action(b);};this.input=e=>{if(!e.target.closest?.('#unit-practice-content')||!e.target.matches?.('[data-pack-input]'))return;this.answer(e.target.value,e.target.dataset.packFollowup);};document.addEventListener('click',this.listener);document.addEventListener('input',this.input);}
  pack(){return this.registry?.get(this.options.getLesson()?.id);}
  available(lesson=this.options.getLesson()){return !!this.registry?.has(lesson?.id);}
  state(){return obj(this.options.getState?.());}
  session(){const p=this.pack(),s=p?A.restore(this.state().sessions?.[p.lessonId],p):null;if(!s||s.stale)return s;return this.mergeDrafts(s);}
  mergeDrafts(session){const s=clone(session);for(const draft of this.pendingDrafts.values()){if(draft.lessonId!==s.lessonId||draft.revision!==s.revision||draft.attemptId!==s.attemptId)continue;const field=draft.followup?'followups':'answers';if(s[field]?.[draft.id]?.submittedAt!=null)continue;s[field]=s[field]||{};s[field][draft.id]={value:draft.value,submittedAt:null};}return s;}
  snapshot(){const next=clone(this.state());for(const [id,raw] of Object.entries(obj(next.sessions))){const p=this.registry?.get(id),s=p?A.restore(raw,p):null;if(s&&!s.stale)next.sessions[id]=this.mergeDrafts(s);}return next;}
  save(session,{archive=false}={}){
   const old=this.state(),p=this.pack();if(!p)return false;
   const next={...clone(old),version:1,sessions:{...obj(old.sessions),[p.lessonId]:clone(session)}};
   if(archive&&old.sessions?.[p.lessonId])next.archives=[...(Array.isArray(old.archives)?old.archives:[]),clone(old.sessions[p.lessonId])].slice(-20);
   if(A.result(session,p).complete&&session.mode!=='correction')next.lastFull={...obj(old.lastFull),[p.lessonId]:clone(session)};
   try{if(this.options.saveState?.(next)!==false)return true;}catch{}
   this.options.toast?.('本次进度未能保存，当前题目仍保留。请先备份学习数据。');return false;
  }
  start(options={}){
   const p=this.pack();if(!p)return false;if(options.mode==='retest'&&!this.options.canRetest?.(p.lessonId,p.revision)){this.options.toast?.('这组题尚未到复测时间，请先完成正式训练。');return false;}
   const s=A.start(p,options);if(!this.save(s,{archive:!!this.state().sessions?.[p.lessonId]}))return false;this.audioToken++;this.audioStatus={};this.refresh(true);return true;
  }
  answer(value,followupId){
   const p=this.pack(),s=this.session();if(!p||!s||s.stale||typeof value!=='string'||value.length>1000)return false;
   let next;if(followupId){if(!p.tasks.some(q=>q.id===followupId)||s.answers[followupId]?.submittedAt==null||s.followups[followupId]?.submittedAt!=null)return false;next=clone(s);next.followups[followupId]={value,submittedAt:null};}
   else next=A.draft(s,p,s.queue[s.cursor],value);
   const id=followupId||s.queue[s.cursor];this.pendingDrafts.set([p.lessonId,p.revision,s.attemptId,followupId?'followup':'main',id].join('|'),{lessonId:p.lessonId,revision:p.revision,attemptId:s.attemptId,id,followup:!!followupId,value});
   return this.save(next);
  }
  submitCurrent(value){
   const p=this.pack(),s=this.session();if(!p||!s||s.stale)return false;const q=p.tasks.find(q=>q.id===s.queue[s.cursor]);if(!q)return false;
   if(q.category==='listening'&&s.audioPlayed?.[q.id]==null){this.options.toast?.('请先听完本题单词录音，再提交听写。');return false;}
   const result=A.submit(s,p,q.id,value??s.answers[q.id]?.value);if(!result.accepted){if(result.feedback&&!result.feedback.valid)this.options.toast?.('请先完成本题。');return false;}
   if(!this.save(result.session))return false;this.refresh();return true;
  }
  choose(value,parent){if(parent)return this.followup(parent,value);return this.submitCurrent(value);}
  followup(parent,value){const p=this.pack(),s=this.session();if(!p||!s||s.stale)return false;const q=p.tasks.find(q=>q.id===parent)?.followup;if(q?.category==='listening'&&!s.audioPlayed?.[parent]){this.options.toast?.('请先听完本题音频。');return false;}const r=A.submitFollowup(s,p,parent,value??s.followups[parent]?.value);if(!r.accepted){if(r.feedback&&!r.feedback.valid)this.options.toast?.('请先完成这道订正题。');return false;}if(!this.save(r.session))return false;this.refresh();return true;}
  next(){const p=this.pack(),s=this.session();if(!p||!s||s.stale)return false;const next=A.advance(s,p);if(next.cursor===s.cursor)return false;if(!this.save(next))return false;if(A.result(next,p).complete)this.commitResult();this.refresh(true);return true;}
  previous(){const s=this.session();if(!s||s.stale||s.cursor<=0)return;const next=clone(s);next.cursor--;if(this.save(next))this.refresh(true);}
  retryWrong(){const p=this.pack(),s=this.session();if(!p||!s||s.stale)return false;const next=A.retryWrong(s,p);if(!next.queue.length)return false;if(!this.save(next,{archive:true}))return false;this.refresh(true);return true;}
  commitResult(){
   const p=this.pack(),s=this.session();if(!p||!s||s.stale||s.resultSaved)return false;const r=A.result(s,p);if(!r.complete||!r.full)return false;
   const accepted=this.committedAttempts.has(s.attemptId)||this.options.isAttemptSaved?.(p.lessonId,s.attemptId)===true;
   if(s.mode==='retest'&&!accepted&&!this.options.canRetest?.(p.lessonId,p.revision)){this.options.toast?.('复测条件已变化，本次不会计为复测通过。请重新安排完整复测。');return false;}
   const wrong=r.wrongTaskIds.map(id=>{const q=p.tasks.find(q=>q.id===id),f=A.grade(q,s.answers[id].value);return {taskId:q.id,conceptId:q.conceptId,question:q.prompt,answer:f.correctAnswer,explanation:q.rule,sourceType:'authored-practice-pack'};});
   const payload={attemptId:s.attemptId,lessonId:p.lessonId,revision:p.revision,mode:'unit-pack',isRetest:s.mode==='retest',score:r.percent,correct:r.correct,total:r.total,wrong,categories:r.categories};
   if(!accepted){try{if(this.options.saveResult?.(payload)===false){this.options.toast?.('结果尚未保存，可点击“保存本次结果”重试。');return false;}this.committedAttempts.add(s.attemptId);}catch{this.options.toast?.('结果尚未保存，请重试。');return false;}}
   return this.save({...s,resultSaved:true});
  }
  async playAudio(parent){
   const p=this.pack(),s=this.session();if(!p||!s||s.stale)return;const q=p.tasks.find(q=>q.id===(parent||s.queue[s.cursor]));if(!q?.word)return;
   const token=++this.audioToken,key=q.id;this.audioStatus[key]='正在播放单词…';this.updateAudioStatus(key);
   try{
    await this.options.speak(q.word);if(token!==this.audioToken||this.pack()?.lessonId!==p.lessonId)return;
    const active=this.session();if(!active||active.stale||active.attemptId!==s.attemptId)return;active.audioPlayed=active.audioPlayed||{};active.audioPlayed[key]=Date.now();if(!this.save(active))return;
    this.audioStatus[key]='✓ 播放完成，可以填写答案或再次收听。';
   }catch{if(token!==this.audioToken)return;this.audioStatus[key]='音频播放失败，请检查网络并再次点击播放。';}
   this.updateAudioStatus(key);
  }
  updateAudioStatus(key){const root=document.getElementById('unit-practice-content');root?.querySelectorAll?.('[data-pack-audio-status]').forEach(node=>{if(node.dataset.packAudioStatus===key)node.textContent=this.audioStatus[key]||'';});}
  english(value){return this.options.wordHTML?this.options.wordHTML(value):this.e(value);}
  controls(q,answer,{followup=false,parentId=q.id}={}){
   const e=this.e,submitted=answer?.submittedAt!=null,f=submitted?A.grade(q,answer.value):null,meta=followup?' data-pack-followup="'+e(parentId)+'"':'';
   if(q.type==='choice')return '<div class="pack-choices">'+q.options.map((o,i)=>'<button type="button" class="answer-option '+(submitted?(i===q.answer?'correct':i===answer.value?'incorrect':''):'')+'" data-pack-action="choose" data-pack-answer="'+i+'"'+meta+' '+(submitted?'disabled':'')+'><span>'+String.fromCharCode(65+i)+'</span>'+e(o)+(submitted?(i===q.answer?' · ✓ 正确':i===answer.value?' · ✕ 答错':''):'')+'</button>').join('')+'</div>';
   return '<label class="pack-input-label">'+(q.type==='transform'?'按指定句型填写完整句子':'填写英文单词')+'<'+(q.type==='transform'?'textarea rows="3"':'input type="text"')+' data-pack-input="true"'+meta+' aria-label="'+(followup?'订正答案':'本题答案')+'" maxlength="1000" autocomplete="off" autocapitalize="off" spellcheck="false" '+(submitted?'disabled':'')+(q.type==='transform'?'>'+e(answer?.value||'')+'</textarea>':' value="'+e(answer?.value||'')+'">')+'</label>'+(submitted?'':'<button type="button" class="button primary" data-pack-action="'+(followup?'submit-followup':'submit')+'"'+meta+'>'+ (followup?'提交订正':'提交本题')+'</button>');
  }
  feedback(q,answer,{withFollowup=true,parentId=q.id}={}){
   const e=this.e,f=A.grade(q,answer.value),s=this.session();
   let html='<section class="pack-feedback '+(f.correct?'is-correct':'is-incorrect')+'" aria-live="polite"><h4>'+(f.correct?'✓ 正确':'✕ 答错')+'</h4><p>你的答案：'+e(f.selectedAnswer)+'</p>'+(!f.correct?'<p><strong>✓ '+(q.type==='transform'?'指定句型参考答案':'正确答案')+'：</strong>'+e(f.correctAnswer)+'</p>':'')+'<p><strong>规则：</strong>'+e(f.rule)+'</p>'+(!f.correct?'<p><strong>原因：</strong>'+e(f.reason)+'</p>':'')+f.contrastExamples.map(x=>'<blockquote><p class="english">'+this.english(x.en)+'</p>'+(x.zh?'<p>'+e(x.zh)+'</p>':'')+'<small>'+e(x.sourceLabel)+'</small></blockquote>').join('');
   if(q.type==='transform')html+='<p class="small-note">这里校对题目指定的句型；其他说法需结合题意判断，不能据此认定整句都有语法错误。</p>';
   html+='<button class="button subtle" data-pack-action="knowledge" data-pack-task="'+e(parentId)+'">查看对应讲解</button></section>';
   if(!f.correct&&withFollowup&&q.followup){const child=q.followup,a=s?.followups?.[parentId];html+='<section class="pack-followup"><h4>换个情境，再试一题</h4><p class="small-note">订正练习，不计整组分数或XP。</p><p>'+e(child.prompt)+'</p>'+this.controls(child,a,{followup:true,parentId})+(a?.submittedAt!=null?this.feedback(child,a,{withFollowup:false,parentId}):'')+'</section>';}
   return html;
  }
  origins(q){
   const rows=this.options.getOrigins?.(this.options.getLesson()?.id,q)||[];if(!rows.length)return '';
   return '<aside class="pack-origin-note"><strong>前课词语线索</strong>'+rows.slice(0,3).map(origin=>'<button type="button" class="resource-text-button" data-pack-action="origin" data-pack-origin="'+this.e(origin.lessonId)+'">第'+Number(origin.book)+'册第'+Number(origin.number)+'课 · '+this.e(origin.label||origin.sourceLabel||'相关知识')+'</button>').join('')+'</aside>';
  }
  render(){
   const p=this.pack(),s=this.session(),e=this.e;if(!p)return '<div class="empty-state"><p>本课单元训练仍在复核，可先使用已有专项练习。</p></div>';
   const intro='<p class="pack-source-note">自编配套训练 · 听写为单词合成音频</p>';
   if(s?.stale)return intro+'<section class="empty-state"><h3>题库已更新</h3><p>旧草稿仍保留。开始新版时会存入历史备份，旧版本答案不会参与新版评分。</p><button class="button" data-pack-action="backup">导出学习备份</button><button class="button primary" data-pack-action="start">开始新版训练</button></section>';
   if(s&&!s.queue.length)return intro+'<section class="empty-state"><h3>本轮没有可继续的错题</h3><p>题目可能已更新，请返回整组结果或重新开始本课。</p><button class="button primary" data-pack-action="start">重新开始本课12题</button></section>';
   if(!s)return intro+'<section class="pack-intro"><h3>把这一课练扎实</h3><p>12项任务 · '+new Set(p.tasks.map(q=>q.conceptId)).size+'个知识点，约8–12分钟。每次只做一题，答错后先弄懂原因再继续。</p><div class="pack-category-summary">'+Object.entries(labels).map(([key,label])=>'<span>'+label+' '+({vocabulary:3,grammar:3,listening:2,comprehension:2,production:2}[key])+'</span>').join('')+'</div><button class="button primary" data-pack-action="start">开始本课12题</button><p class="small-note">阅读、练习与隔天复测分别记录。词义按本课已核对词表；句型改写按明确指定的要求校对。</p></section>';
   const r=A.result(s,p);if(r.complete)return intro+this.renderResult(s,p,r);
   const q=p.tasks.find(q=>q.id===s.queue[s.cursor]),answer=s.answers[q.id],submitted=answer?.submittedAt!=null;
   return intro+'<div class="pack-progress"><span>'+(s.mode==='correction'?'错题订正':s.mode==='retest'?'隔天复测':'单元训练')+' · '+(s.cursor+1)+' / '+s.queue.length+'</span><strong>'+e(labels[q.category])+'</strong></div><progress max="'+s.queue.length+'" value="'+r.answered+'" aria-label="本轮已完成题数"></progress><section class="pack-task"><h3 class="pack-task-title" tabindex="-1">'+e(q.prompt)+'</h3>'+this.origins(q)+(q.category==='listening'?'<button class="button subtle" data-pack-action="listen">▶ 播放单词（合成音频）</button><p class="small-note" data-pack-audio-status="'+e(q.id)+'" role="status">'+e(this.audioStatus[q.id]||(s.audioPlayed?.[q.id]?'已听过，可再次收听。':''))+'</p>':'')+this.controls(q,answer)+(submitted?this.feedback(q,answer):'')+'</section><div class="pack-task-actions">'+(s.cursor>0?'<button class="button subtle" data-pack-action="previous">上一题</button>':'')+'<button class="button subtle" data-pack-action="read">回看课文</button>'+(submitted?'<button class="button primary" data-pack-action="next">'+(s.cursor===s.queue.length-1?'查看本轮结果':'下一题')+'</button>':'')+'</div>';
  }
  renderResult(s,p,r){
   const e=this.e,wrong=new Set(r.wrongTaskIds),correction=s.mode==='correction';
   return '<section class="pack-result"><h3>'+(correction?'订正练习完成':s.mode==='retest'?'本次复测结果':'本轮训练完成')+'</h3><strong class="pack-result-score">'+r.correct+' / '+r.total+'</strong><p>'+(correction?'仅针对错题练习，不改变原整组分数、XP或掌握状态。':s.mode==='retest'?(r.correct===r.total?'本题组复测全部正确。':'仍有知识点需要订正，先看原因再安排下次复测。'):'这是本组任务的校对结果，完成训练不直接表示已掌握。')+'</p><div class="pack-category-summary">'+Object.entries(r.categories).filter(([,n])=>n.total).map(([kind,n])=>'<span>'+labels[kind]+' '+n.correct+'/'+n.total+'</span>').join('')+'</div><div class="pack-task-actions">'+(wrong.size?'<button class="button primary" data-pack-action="only-wrong">只练错题</button>':'')+(r.full&&!s.resultSaved?'<button class="button primary" data-pack-action="save-result">保存本次结果</button>':'')+'<button class="button subtle" data-pack-action="start">重做整组</button>'+(correction&&this.state().lastFull?.[p.lessonId]?'<button class="button subtle" data-pack-action="full-result">返回整组结果</button>':'')+'</div>'+p.tasks.filter(q=>wrong.has(q.id)).map(q=>'<details class="pack-wrong-detail"><summary>✕ '+e(labels[q.category])+' · '+e(q.prompt)+'</summary>'+this.feedback(q,s.answers[q.id])+'</details>').join('')+'</section>';
  }
  knowledgeHTML(lesson){
   const p=this.registry?.get(lesson?.id);if(!p)return '';const seen=new Set();
   return '<h3 class="section-title">单元训练知识点</h3>'+p.tasks.filter(q=>!q.word&&!seen.has(q.conceptId)&&seen.add(q.conceptId)).map(q=>'<section class="knowledge-card grammar-card" id="knowledge-'+this.e(q.conceptId)+'"><h3>'+this.e(labels[q.category])+'</h3><p>'+this.e(q.rule)+'</p><p class="english">'+this.english(q.sourceEvidence.quote)+'</p><small>本课原句 · 第'+(q.sourceEvidence.paragraphIndex+1)+'段</small>'+q.contrastExamples.map(x=>'<p class="english">'+this.english(x.en)+'</p><small>'+this.e(x.sourceLabel)+'</small>').join('')+'</section>').join('');
  }
  refresh(focus=false){const root=document.getElementById('unit-practice-content');if(!root)return;root.innerHTML=this.render();if(focus)global.requestAnimationFrame?.(()=>{const title=root.querySelector?.('.pack-task-title');title?.focus({preventScroll:true});title?.scrollIntoView({block:'nearest',behavior:'auto'});});}
  action(b){const d=b.dataset;switch(d.packAction){case'start':this.start();break;case'choose':this.choose(Number(d.packAnswer),d.packFollowup);break;case'submit':this.submitCurrent();break;case'submit-followup':this.followup(d.packFollowup);break;case'listen':this.playAudio();break;case'next':this.next();break;case'previous':this.previous();break;case'only-wrong':this.retryWrong();break;case'save-result':this.commitResult();this.refresh();break;case'knowledge':{const q=this.pack()?.tasks.find(q=>q.id===d.packTask);if(q)this.options.openKnowledge?.(q.sourceLessonId,q.conceptId);break;}case'read':this.options.readLesson?.();break;case'origin':this.options.openOrigin?.(d.packOrigin);break;case'backup':this.options.backup?.();break;case'full-result':{const old=this.state().lastFull?.[this.pack()?.lessonId];if(old&&this.save(old,{archive:true}))this.refresh(true);break;}}}
  reloadFromStorage(){this.pendingDrafts.clear();this.committedAttempts.clear();this.audioToken++;this.audioStatus={};}
  destroy(){document.removeEventListener('click',this.listener);document.removeEventListener('input',this.input);this.audioToken++;}
 }
 global.LessonPractice=LessonPractice;
})(window);
