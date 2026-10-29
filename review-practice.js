(function(global){
 'use strict';
 const KINDS={word:'单词拼写',phrase:'习惯用法',grammar:'语法要点'};
 class ReviewPractice{
  constructor(options){
   this.options=options;this.container=options.container;this.localDrafts={version:1,entries:{}};this.pendingDrafts=new Map();this.draftSaveFailed=false;this.active=null;this.revealed=false;this.input='';this.writing=false;this.feedback=null;this.kind='';this.lessonId='';this.cardIds=null;this.practiceDone=new Set();this.reviewCardIds=null;this.reviewTask=null;this.practiceSerial=0;this.attemptAssistance=new Map();this.batchSize=10;this.batchIds=null;this.batchDone=new Set();this.sessionDone=new Set();this.sessionEnded=false;this.batchNumber=1;
   this.container.addEventListener('click',e=>{const b=e.target.closest('[data-review-action]');if(b&&this.container.contains(b))return this.action(b.dataset.reviewAction,b);});
   this.container.addEventListener('input',e=>{if(e.target.dataset.reviewInput!==undefined){const hadFeedback=this.revealed;if(hadFeedback)this.markAssisted('edited-after-feedback');this.input=e.target.value;this.revealed=false;this.feedback=null;if(hadFeedback){const area=this.container.querySelector('[data-review-feedback]'),grading=this.container.querySelector('[data-review-grading]'),actions=this.container.querySelector('[data-review-answer-actions]');if(area)area.innerHTML='';if(grading)grading.innerHTML='';if(actions)actions.innerHTML=this.answerActionsHTML();}this.saveCurrentDraft();}});
   this.container.addEventListener('change',e=>{if(e.target.dataset.reviewFilter!==undefined){this.saveCurrentDraft();this.kind=e.target.value;this.resetBatch();this.render();}});
  }
  draftContext(){return this.cardIds?'practice':this.reviewTask?JSON.stringify(['task',this.reviewTask.taskId,this.reviewTask.day,this.reviewTask.roundKey]):this.reviewCardIds?'review':'daily';}
  currentDraftKey(){const c=this.active;return c?global.StudyReview.draftKey(this.draftContext(),c.id,c.progress.revision):'';}
  snapshotDrafts(){
   const R=global.StudyReview,cards=this.state()?.cards||{},raw=typeof this.options.getDrafts==='function'?this.options.getDrafts():this.localDrafts,base=R.sanitizeDrafts(raw,{cards});
   for(const [key,draft]of this.pendingDrafts){if(draft===null)delete base.entries[key];else if(draft.revision===(cards[draft.cardId]?.revision??null)&&(cards[draft.cardId]||draft.context==='practice'))base.entries[key]={...draft};}
   const rows=Object.entries(base.entries).sort((a,b)=>b[1].updatedAt-a[1].updatedAt).slice(0,100);return {version:1,entries:Object.fromEntries(rows)};
  }
  draftStatusHTML(){return this.draftSaveFailed?(this.draftTooLong?'草稿暂未保存：超过10000字。请先备份或缩短后重试。 ':'草稿暂未保存，已保留在当前页面，可备份或重试。 ')+'<button class="button subtle" data-review-action="retry-draft">重试保存草稿</button>':'';}
  updateDraftStatus(){const status=this.container.querySelector('[data-review-draft-status]');if(status)status.innerHTML=this.draftStatusHTML();}
  persistDrafts(){
   const snapshot=this.snapshotDrafts(),clean=global.StudyReview.sanitizeDrafts(snapshot,{cards:this.state()?.cards||{}});this.draftTooLong=Object.values(snapshot.entries).some(d=>d.input.length>10000);let saved=false;
   try{saved=Object.keys(snapshot.entries).length===Object.keys(clean.entries).length&&(!this.options.saveDrafts||this.options.saveDrafts(clean)===true);}catch{}
   if(saved){this.localDrafts=clean;this.pendingDrafts.clear();this.draftSaveFailed=false;}else {if(!this.draftSaveFailed)this.options.toast('复习草稿未能保存，输入仍保留；可备份或重试保存。');this.draftSaveFailed=true;}
   this.updateDraftStatus();return saved;
  }
  stageDraft(key,draft){this.pendingDrafts.delete(key);this.pendingDrafts.set(key,draft);while(this.pendingDrafts.size>100)this.pendingDrafts.delete(this.pendingDrafts.keys().next().value);}
  saveCurrentDraft(){
   const c=this.active,key=this.currentDraftKey();if(!c||!key)return true;
   if(!this.input&&!this.writing&&!this.revealed&&!this.isAssisted()&&!this.snapshotDrafts().entries[key])return true;
   this.stageDraft(key,{context:this.draftContext(),cardId:c.id,revision:c.progress.revision,input:this.input,writing:this.writing,revealed:this.revealed,checked:!!this.feedback,assisted:this.isAssisted(),updatedAt:Date.now()});return this.persistDrafts();
  }
  clearCurrentDraft(){const key=this.currentDraftKey();if(!key)return;this.stageDraft(key,null);this.persistDrafts();}
  restoreDraft(){
   const c=this.active,key=this.currentDraftKey(),draft=this.snapshotDrafts().entries[key];if(!c||!draft)return;
   this.input=draft.input;this.writing=c.kind==='phrase'&&draft.writing;this.revealed=draft.revealed;if(draft.assisted)this.attemptAssistance.set(this.attemptKey(c),true);
   if(draft.checked&&this.revealed){if(this.writing){const grammarAvailable=typeof global.StudyGrammar?.check==='function';this.feedback={writing:true,covered:global.StudyReview.hasPhrase(c,this.input),grammarAvailable,issues:grammarAvailable?global.StudyGrammar.check(this.input):[]};}else {this.feedback=global.StudyReview.checkAnswer(c,this.input);if(!this.feedback.correct)this.attemptAssistance.set(this.attemptKey(c),true);}}
  }
  attemptKey(c=this.active){return c?c.id+':'+c.progress.revision+':'+(this.cardIds?'practice-'+this.practiceSerial:'due'):'';}
  isAssisted(c=this.active){if(!c)return false;return this.attemptAssistance.has(this.attemptKey(c))||this.state().cards?.[c.id]?.assistance?.revision===c.progress.revision;}
  markAssisted(reason){const c=this.active;if(!c)return;this.attemptAssistance.set(this.attemptKey(c),true);if(this.cardIds||c.progress.dueAt>Date.now())return;const result=global.StudyReview.assist(this.state(),c.id,{revision:c.progress.revision,reason});if(!result.accepted||!result.changed)return;try{if(this.options.saveState(result.state)!==true)this.options.toast('提示使用状态未能保存，本轮仍按有提示练习处理。');}catch{this.options.toast('提示使用状态未能保存，本轮仍按有提示练习处理。');}}
  independentlyCorrect(){return this.revealed&&!this.writing&&this.feedback?.correct===true&&!this.isAssisted()&&!!this.input.trim();}
  cards(){const lessons=this.options.getLessons();if(this.lastLessons!==lessons){this.lastLessons=lessons;this.catalog=global.StudyReview.cardsForLessons(lessons);}return this.catalog;}
  reset(){this.active=null;this.revealed=false;this.input='';this.feedback=null;this.writing=false;}
  resetBatch(){this.batchIds=null;this.batchDone=new Set();this.sessionEnded=false;this.reset();}
  focusCard(){if(global.matchMedia?.('(max-width:760px)')?.matches)this.container.querySelector(this.active?'.review-question':'.review-empty')?.scrollIntoView?.({block:'start',behavior:'smooth'});}
  clearFilters({saveDraft=true}={}){if(saveDraft)this.saveCurrentDraft();this.kind='';this.lessonId='';this.cardIds=null;this.reviewCardIds=null;this.reviewTask=null;this.practiceDone=new Set();this.sessionDone=new Set();this.batchNumber=1;this.resetBatch();}
  reloadFromStorage(){this.pendingDrafts.clear();this.localDrafts={version:1,entries:{}};this.attemptAssistance.clear();this.draftSaveFailed=false;this.draftTooLong=false;this.practiceSerial=0;this.lastLessons=null;this.catalog=null;this.clearFilters({saveDraft:false});this.render();}
  startPractice(cardIds,{newRound=false}={}){
   this.clearFilters();this.practiceSerial++;const requested=new Set(Array.isArray(cardIds)?cardIds.filter(id=>typeof id==='string'):[]);
   this.cardIds=new Set(this.cards().filter(card=>requested.has(card.id)).map(card=>card.id));if(newRound){for(const [key,draft]of Object.entries(this.snapshotDrafts().entries))if(draft.context==='practice'&&this.cardIds.has(draft.cardId))this.stageDraft(key,null);this.persistDrafts();}return this.cardIds.size;
  }
  startDrill(cardIds){return this.startPractice(cardIds);}
  startReview(cardIds,task=null){
   this.clearFilters();const requested=new Set(Array.isArray(cardIds)?cardIds.filter(id=>typeof id==='string'):[]);
   if(task&&typeof task.id==='string'&&typeof task.roundKey==='string'&&typeof task.day==='string')this.reviewTask={taskId:task.id,roundKey:task.roundKey,day:task.day,cardRevisions:{...task.cardRevisions}};
   this.reviewCardIds=new Set(this.cards().filter(card=>requested.has(card.id)).map(card=>card.id));return this.reviewCardIds.size;
  }
  state(){return this.options.getState();}
  scopedCards(){const ids=this.cardIds||this.reviewCardIds;return ids?this.cards().filter(c=>ids.has(c.id)):this.cards();}
  availableDue(){return global.StudyReview.queue(this.state(),this.scopedCards(),{kind:this.kind,lessonId:this.lessonId}).filter(c=>!this.sessionDone.has(c.id)&&(!this.reviewTask||!Object.hasOwn(this.reviewTask.cardRevisions,c.id)||this.reviewTask.cardRevisions[c.id]===c.progress.revision));}
  due(){
   if(!this.cardIds){const available=this.availableDue();if(this.batchIds===null&&!this.sessionEnded)this.batchIds=new Set(available.slice(0,this.batchSize).map(c=>c.id));return this.sessionEnded?[]:available.filter(c=>this.batchIds?.has(c.id));}
   const state=global.StudyReview.sanitize(this.state());
   return this.scopedCards().filter(card=>!this.practiceDone.has(card.id)&&(!this.kind||card.kind===this.kind)&&(!this.lessonId||card.sourceLesson.id===this.lessonId)).map(card=>({...card,progress:{revision:null,...state.cards[card.id]}}));
  }
  render(){
   const E=this.options.escapeHTML,practice=this.cardIds!==null,stats=global.StudyReview.stats(this.state(),this.scopedCards()),due=this.due();
   if(!this.active||!due.some(c=>c.id===this.active.id&&c.progress.revision===this.active.progress.revision)){this.reset();this.active=due[0]||null;this.restoreDraft();}
   const card=this.active,current=this.options.getCurrentLesson();
   let body='';
   if(!card){
    const next=stats.nextDueAt?new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(stats.nextDueAt)):'';
    const finished=!practice&&this.batchIds?.size>0&&this.batchDone.size===this.batchIds.size,remaining=!practice?this.availableDue().length:0;
    const heading=this.reviewTask?(finished?'本组已完成':'本轮当前没有到期卡片'):practice?'本轮旧知练习已完成':this.sessionEnded?'本轮复习已结束':finished?'本组已完成':stats.enrolled?'当前没有到期项目':'从学过的一课开始';
    const note=this.reviewTask?'已处理的卡片会保留复习排期；忘记的内容仍需再复习。资料变更或尚未到期的卡片可暂缓，继续下一项。':practice?'已练习的内容可回到课文继续使用；每日复习仍按原定时间安排。':this.sessionDone.size?'本轮已处理 '+this.sessionDone.size+' 项。'+(remaining?'还有 '+remaining+' 项当前到期内容，可休息后继续下一组。':'忘记的内容保留原定复习时间，今天可以先到这里。'):stats.enrolled?(stats.todayRemaining?'今天还有稍后到期的项目，可届时再练。':'下一次复习'+(next?'：'+E(next):'会按学习情况安排')+'。'):'把已学课文加入复习后，系统会按到期时间安排单词、习惯用法和语法。';
    body='<div class="review-empty"><h3>'+heading+'</h3><p>'+note+'</p>'+(this.reviewTask?'<button class="button primary" data-review-action="continue-task">继续下一项</button>':!practice&&remaining?'<button class="button primary" data-review-action="next-batch">'+(this.sessionEnded?'继续复习':'下一组')+'（最多10项）</button>':!practice&&current&&!finished&&!this.sessionEnded?'<button class="button primary" data-review-action="enroll">把当前课加入每日复习</button>':'')+(!practice&&!this.reviewTask&&!this.sessionEnded&&this.sessionDone.size?'<button class="button subtle" data-review-action="end-session">结束本轮复习</button>':'')+'</div>';
   }else{
    const source=card.sourceLesson,hideTitle=card.kind==='word'&&(card.exampleSourceType==='lesson-title'||card.sourceType==='lesson-title')&&!this.revealed;
    const sourceTitleHTML=hideTitle?'<p class="small-note">标题将在作答后显示。</p>':'<p class="english">'+E(source.title)+'</p>';
    const input=card.kind==='grammar'?'<div class="review-choices">'+card.options.map((o,i)=>'<button class="quiz-option '+(this.input===o?'selected':'')+'" data-review-action="choice" data-review-option="'+i+'">'+E(o)+'</button>').join('')+'</div>':'<label class="review-input-label" for="daily-review-answer">'+(card.kind==='phrase'&&this.writing?'请用这个表达写一句英文':'请输入'+(card.kind==='word'?'英文单词':'英文表达'))+'</label><textarea id="daily-review-answer" class="review-answer" rows="'+(this.writing?4:2)+'" data-review-input spellcheck="false" autocomplete="off">'+E(this.input)+'</textarea>';
    body='<div class="review-workspace"><section class="review-question"><div class="review-card-meta"><strong>'+KINDS[card.kind]+'</strong><button class="resource-text-button" data-review-action="source" data-review-source="'+E(source.id)+'">学自第'+source.book+'册第'+source.number+'课</button></div>'+(card.kind==='phrase'?'<div class="quiz-toolbar"><button class="quiz-mode '+(!this.writing?'active':'')+'" data-review-action="recall" aria-pressed="'+!this.writing+'">短语回忆</button><button class="quiz-mode '+(this.writing?'active':'')+'" data-review-action="writing" aria-pressed="'+this.writing+'">用法造句</button></div>':'')+'<h3 class="review-prompt">'+E(card.kind==='phrase'&&this.writing?card.target:card.prompt)+'</h3>'+(card.kind==='word'?'<button class="button subtle" data-review-action="speak">听发音</button>':'')+input+'<div data-review-answer-actions>'+this.answerActionsHTML()+'</div><div data-review-feedback aria-live="polite">'+this.feedbackHTML()+'</div><div data-review-grading>'+this.gradingHTML()+'</div></section><aside class="review-support"><h3>本题来自</h3><p>第'+source.book+'册 · 第'+source.number+'课</p>'+sourceTitleHTML+'<h3>间隔复习节奏</h3><ol class="review-schedule">'+global.StudyReview.intervalDays.map(d=>'<li>'+d+' 天后</li>').join('')+'</ol><p class="small-note">'+(practice?'提前练习保留原定到期时间。':'这是可调整的建议间隔；忘记了会在10分钟后再练。')+'</p></aside></div>';
   }
   const counters=practice?'<span>本轮已看 <strong>'+this.practiceDone.size+'</strong> / '+this.cardIds.size+' 项</span>':'<span class="review-batch-counter">第 '+this.batchNumber+' 组 · 本次 '+(this.batchIds?.size||0)+' 项 · 本组已处理 <strong>'+this.batchDone.size+'</strong> / '+(this.batchIds?.size||0)+' 项</span><details class="review-backlog"><summary>其他待复习内容</summary><span>全部到期 '+stats.due+' 项，可分多次完成。</span></details>';
   this.container.innerHTML=(this.options.taskBarHTML?.()||'')+'<div data-review-draft-status aria-live="polite">'+this.draftStatusHTML()+'</div>'+'<div class="view-heading"><div><h2>'+(practice?'旧知随堂练习':'每日复习')+'</h2><p>'+(practice?'把前课知识再练一遍，保留原定复习安排。':'先回忆，再检查。完成本组就可以休息。')+'</p></div></div><div class="review-stats">'+counters+'<details class="review-options"><summary>'+(this.kind?KINDS[this.kind]+' · 备份':'筛选与备份')+'</summary><div class="review-options-content"><label>内容 <select data-review-filter aria-label="筛选复习类型"><option value="">全部</option>'+Object.entries(KINDS).map(([k,v])=>'<option value="'+k+'" '+(this.kind===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+(this.kind||this.lessonId||practice||this.reviewCardIds?'<button class="button subtle" data-review-action="all">查看全部到期内容</button>':'')+'<button class="button subtle" data-review-action="backup">备份复习进度</button></div></details>'+(!practice&&!this.reviewTask&&card?'<button class="button subtle" data-review-action="end-session">结束本轮复习</button>':'')+'</div>'+body+'<p class="small-note">已处理不代表已掌握。进度保存在当前浏览器，可用学习备份在其他设备恢复。</p>';
  }
  answerActionsHTML(){return this.revealed?'':'<div class="review-submit"><button class="button primary" data-review-action="check">提交并检查</button><button class="button subtle" data-review-action="reveal">需要帮助？看答案</button></div>';}
  gradingHTML(){
   if(!this.revealed)return '';
   if(this.cardIds)return '<div class="review-ratings"><button class="button" data-review-action="practice-again">再看一次</button><button class="button primary" data-review-action="practice-next">下一张</button></div><p class="small-note">随堂练习保留每日复习排期。</p>';
   const wrong=this.feedback?.correct===false,independent=this.independentlyCorrect();
   const note=wrong?'本次未答对，稍后再练。':independent?'独立答对了，请按记忆情况选择。':this.writing?'造句仅作练习；新一轮先独立答对，才能标记记住了。':'本轮仅记录订正；新一轮先独立答对，才能标记记住了。';
   return '<div class="review-ratings"><button class="button review-again" data-review-action="rate" data-review-rating="again">忘记了</button>'+(!wrong?'<button class="button review-hard" data-review-action="rate" data-review-rating="hard">有点模糊</button>':'')+(independent?'<button class="button primary" data-review-action="rate" data-review-rating="good">记住了</button>':'')+'</div><p class="small-note">'+note+'</p>';
  }
  updateGrading(){const grading=this.container.querySelector('[data-review-grading]');if(grading)grading.innerHTML=this.gradingHTML();}
  feedbackHTML(){
   if(!this.revealed||!this.active)return '';
   const E=this.options.escapeHTML,c=this.active,f=this.feedback;
   const grammar=f?.issues||[],sourceLabels=[...new Set([c.sourceLabel,c.exampleSourceLabel].filter(label=>typeof label==='string'&&label.trim()))];
   return '<section class="review-feedback"><h4>'+(f?.writing?'造句反馈':f?.correct===true?'回答正确':f?.correct===false?'再看一下答案':'参考答案')+'</h4><p class="english"><strong>'+E(c.target)+'</strong></p>'+(f?.writing?'<p>'+(f.covered?'已使用本题表达。':'还没有准确使用本题表达，可参考原句再改一遍。')+'</p><p>常见语法检查：'+(f.grammarAvailable===false?'语法检查暂不可用，请稍后再试。':grammar.length?'发现 '+grammar.length+' 处建议。':'暂未发现规则覆盖范围内的问题。')+'</p>'+grammar.map(x=>'<div class="review-grammar"><strong>'+E(x.original)+' → '+E(x.replacement)+'</strong><p>'+E(x.message)+'</p></div>').join('')+(grammar.length?'<button class="button subtle" data-review-action="apply">应用语法建议</button>':''):'')+(c.example?(sourceLabels.length?'<p class="small-note review-example-source">'+sourceLabels.map(E).join(' · ')+'</p>':'')+'<p class="review-example">'+(sourceLabels.length?'':'学习例句：')+this.options.wordHTML(c.example)+'</p>':'')+(c.explanation?'<p>'+E(c.explanation)+'</p>':'')+'</section>';
  }
  action(action,b){
   const R=global.StudyReview,c=this.active;
   if(action==='retry-draft'){this.persistDrafts();this.render();return;}
   if(action==='continue-task')return this.options.onContinueTask?.();
   if(action==='next-batch'&&!this.cardIds&&!this.reviewTask){this.batchNumber++;this.resetBatch();this.render();this.focusCard();return;}
   if(action==='end-session'&&!this.cardIds&&!this.reviewTask){this.sessionEnded=true;this.reset();this.render();this.focusCard();return;}
   if(action==='enroll'){this.options.enrollCurrent();this.clearFilters();this.render();return;}
   if(action==='all'){this.clearFilters();this.render();return;}
   if(action==='backup'){this.options.backup();return;}
   if(action==='source'){this.markAssisted('source-lesson');this.saveCurrentDraft();this.updateGrading();this.options.openLesson(b.dataset.reviewSource);return;}
   if(!c)return;
   if(action==='speak'){this.markAssisted('pronunciation-hint');this.saveCurrentDraft();this.updateGrading();this.options.speak(c.target);return;}
   if(action==='recall'||action==='writing'){if(action==='writing'||this.writing||this.revealed)this.markAssisted('writing-reference');this.writing=action==='writing';this.input='';this.revealed=false;this.feedback=null;this.saveCurrentDraft();this.render();return;}
   if(action==='choice'){if(this.revealed)this.markAssisted('edited-after-feedback');this.input=c.options[Number(b.dataset.reviewOption)]||'';this.revealed=false;this.feedback=null;this.saveCurrentDraft();this.render();return;}
   if(action==='reveal'){this.markAssisted('answer');this.revealed=true;this.feedback=null;this.saveCurrentDraft();this.render();return;}
   if(action==='check'){
    if(!this.input.trim()){this.options.toast('请先作答，再提交检查。');return;}
    if(c.kind==='phrase'&&this.writing){
     if((this.input.match(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g)||[]).length<5){this.options.toast('请写至少5个英文单词。');return;}
     const covered=R.hasPhrase(c,this.input);
     const grammarAvailable=typeof global.StudyGrammar?.check==='function';
     this.feedback={writing:true,covered,grammarAvailable,issues:grammarAvailable?global.StudyGrammar.check(this.input):[]};
    }else {this.feedback=R.checkAnswer(c,this.input);if(!this.feedback.correct)this.markAssisted('incorrect-feedback');}
    this.revealed=true;this.saveCurrentDraft();this.render();return;
   }
   if(action==='apply'&&this.feedback?.writing){this.markAssisted('correction');this.input=global.StudyGrammar?.applyAll(this.input,this.feedback.issues)||this.input;this.feedback=null;this.revealed=false;this.saveCurrentDraft();this.render();return;}
   if(this.cardIds&&this.revealed&&action==='practice-again'){this.markAssisted('repeat-after-feedback');this.input='';this.feedback=null;this.revealed=false;this.saveCurrentDraft();this.render();return;}
   if(this.cardIds&&this.revealed&&action==='practice-next'){this.clearCurrentDraft();this.practiceDone.add(c.id);this.reset();this.render();return;}
   if(this.cardIds&&this.revealed&&action==='rate'){
    if(b.dataset.reviewRating==='good'&&!this.independentlyCorrect()){this.options.toast('请先独立答对；仅查看答案或造句反馈不能标记为记住了。');return;}
    if(['again','hard','good'].includes(b.dataset.reviewRating)){this.clearCurrentDraft();this.practiceDone.add(c.id);this.reset();this.render();}return;
   }
   if(action==='rate'&&this.revealed&&!this.cardIds){
    let rating=b.dataset.reviewRating;
    if(rating==='good'&&!this.independentlyCorrect()){this.options.toast('本轮须独立答对才能标记记住了；看过答案、错误反馈或提示后，请选忘记了或有点模糊。');return;}
    if(this.feedback?.correct===false)rating='again';
    const evidence={correct:!this.writing&&this.feedback?.correct===true,assisted:this.isAssisted(),objective:!this.writing,kind:c.kind,answer:this.input};
    const result=R.rate(this.state(),c.id,rating,{revision:c.progress.revision,evidence});
    if(!result.accepted){this.options.toast('这项复习状态已变化，已刷新队列。');this.reset();this.render();return;}
    let saved;
    try{saved=this.options.saveState(result.state);}catch{this.options.toast('复习进度未能保存，请重试；当前项目仍保留。');return;}
    if(saved!==true){this.options.toast('复习进度未能保存，请重试；当前项目仍保留。');return;}
    try{this.options.onEvidence?.({type:'review',lessonId:c.sourceLesson.id,cardId:c.id,kind:c.kind,correct:evidence.correct,assisted:evidence.assisted,rating,answer:this.input,complete:true,at:result.state.cards[c.id].lastReviewedAt,...(this.reviewTask?{taskId:this.reviewTask.taskId,day:this.reviewTask.day,roundKey:this.reviewTask.roundKey,processed:true}:{})});}catch{}
    this.clearCurrentDraft();this.batchDone.add(c.id);this.sessionDone.add(c.id);this.options.onChange?.();this.reset();this.render();this.focusCard();return;
   }
  }
 }
 global.ReviewPractice=ReviewPractice;
})(window);
