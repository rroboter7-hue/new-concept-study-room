(function(global){
 'use strict';
 const KINDS={word:'单词拼写',phrase:'习惯用法',grammar:'语法要点'};
 class ReviewPractice{
  constructor(options){
   this.options=options;this.container=options.container;this.active=null;this.revealed=false;this.input='';this.writing=false;this.feedback=null;this.kind='';this.lessonId='';this.cardIds=null;
   this.container.addEventListener('click',e=>{const b=e.target.closest('[data-review-action]');if(b&&this.container.contains(b))this.action(b.dataset.reviewAction,b);});
   this.container.addEventListener('input',e=>{if(e.target.dataset.reviewInput!==undefined){this.input=e.target.value;this.revealed=false;this.feedback=null;const area=this.container.querySelector('[data-review-feedback]');if(area)area.innerHTML='';this.container.querySelectorAll('[data-review-rating]').forEach(b=>b.disabled=true);}});
   this.container.addEventListener('change',e=>{if(e.target.dataset.reviewFilter!==undefined){this.kind=e.target.value;this.reset();this.render();}});
  }
  cards(){const lessons=this.options.getLessons();if(this.lastLessons!==lessons){this.lastLessons=lessons;this.catalog=global.StudyReview.cardsForLessons(lessons);}return this.catalog;}
  reset(){this.active=null;this.revealed=false;this.input='';this.feedback=null;this.writing=false;}
  clearFilters(){this.kind='';this.lessonId='';this.cardIds=null;this.reset();}
  state(){return this.options.getState();}
  scopedCards(){return this.cardIds?this.cards().filter(c=>this.cardIds.has(c.id)):this.cards();}
  due(){return global.StudyReview.queue(this.state(),this.scopedCards(),{kind:this.kind,lessonId:this.lessonId});}
  render(){
   const E=this.options.escapeHTML,stats=global.StudyReview.stats(this.state(),this.scopedCards()),due=this.due();
   if(!this.active||!due.some(c=>c.id===this.active.id&&c.progress.revision===this.active.progress.revision)){this.reset();this.active=due[0]||null;}
   const card=this.active,current=this.options.getCurrentLesson();
   let body='';
   if(!card){
    const next=stats.nextDueAt?new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(stats.nextDueAt)):'';
    body='<div class="review-empty"><h3>'+(stats.enrolled?'当前没有到期项目':'从学过的一课开始')+'</h3><p>'+(stats.enrolled?(stats.todayRemaining?'今天还有稍后到期的项目，可届时再练。':'下一次复习'+(next?'：'+E(next):'会按学习情况安排')+'。'):'把已学课文加入复习后，系统会按到期时间安排单词、习惯用法和语法。')+'</p>'+(current?'<button class="button primary" data-review-action="enroll">把当前课加入每日复习</button>':'')+'</div>';
   }else{
    const source=card.sourceLesson;
    const input=card.kind==='grammar'?'<div class="review-choices">'+card.options.map((o,i)=>'<button class="quiz-option '+(this.input===o?'selected':'')+'" data-review-action="choice" data-review-option="'+i+'">'+E(o)+'</button>').join('')+'</div>':'<label class="review-input-label" for="daily-review-answer">'+(card.kind==='phrase'&&this.writing?'请用这个表达写一句英文':'请输入'+(card.kind==='word'?'英文单词':'英文表达'))+'</label><textarea id="daily-review-answer" class="review-answer" rows="'+(this.writing?4:2)+'" data-review-input spellcheck="false" autocomplete="off">'+E(this.input)+'</textarea>';
    body='<div class="review-workspace"><section class="review-question"><div class="review-card-meta"><strong>'+KINDS[card.kind]+'</strong><button class="resource-text-button" data-review-action="source" data-review-source="'+E(source.id)+'">学自第'+source.book+'册第'+source.number+'课</button></div>'+(card.kind==='phrase'?'<div class="quiz-toolbar"><button class="quiz-mode '+(!this.writing?'active':'')+'" data-review-action="recall">短语回忆</button><button class="quiz-mode '+(this.writing?'active':'')+'" data-review-action="writing">用法造句</button></div>':'')+'<h3 class="review-prompt">'+E(card.kind==='phrase'&&this.writing?card.target:card.prompt)+'</h3>'+(card.kind==='word'?'<button class="button subtle" data-review-action="speak">听发音</button>':'')+input+'<div class="review-submit"><button class="button primary" data-review-action="check">提交并检查</button><button class="button subtle" data-review-action="reveal">查看答案</button></div><div data-review-feedback aria-live="polite">'+this.feedbackHTML()+'</div><div class="review-ratings"><button class="button review-again" data-review-action="rate" data-review-rating="again" '+(!this.revealed?'disabled':'')+'>忘记了</button><button class="button review-hard" data-review-action="rate" data-review-rating="hard" '+(!this.revealed?'disabled':'')+'>有点模糊</button><button class="button primary" data-review-action="rate" data-review-rating="good" '+(!this.revealed?'disabled':'')+'>记住了</button></div><p class="small-note">按实际回忆情况反馈，调整下次复习时间。</p></section><aside class="review-support"><h3>本题来自</h3><p>第'+source.book+'册 · 第'+source.number+'课</p><p class="english">'+E(source.title)+'</p><h3>间隔复习节奏</h3><ol class="review-schedule">'+global.StudyReview.intervalDays.map(d=>'<li>'+d+' 天后</li>').join('')+'</ol><p class="small-note">这是可调整的建议间隔；答错会提前再练。</p></aside></div>';
   }
   this.container.innerHTML='<div class="view-heading"><div><h2>每日复习</h2><p>'+(this.cardIds?'正在练习本课复现的前课知识点。':'把学过的单词、习惯用法和语法，按到期时间再练一遍。')+'</p></div><button class="button subtle" data-review-action="backup">备份复习进度</button></div><div class="review-stats"><span>当前到期 <strong>'+stats.due+'</strong> 项</span><span>今天已练 <strong>'+stats.reviewedToday+'</strong> 项</span><label>内容 <select data-review-filter aria-label="筛选复习类型"><option value="">全部</option>'+Object.entries(KINDS).map(([k,v])=>'<option value="'+k+'" '+(this.kind===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+(this.kind||this.lessonId||this.cardIds?'<button class="button subtle" data-review-action="all">查看全部到期内容</button>':'')+'</div>'+body+'<p class="small-note">第一册和第二册的已学内容会一起进入队列。进度保存在当前浏览器，可用学习备份在其他设备恢复。</p>';
  }
  feedbackHTML(){
   if(!this.revealed||!this.active)return '';
   const E=this.options.escapeHTML,c=this.active,f=this.feedback;
   const grammar=f?.issues||[];
   return '<section class="review-feedback"><h4>'+(f?.writing?'造句反馈':f?.correct===true?'回答正确':f?.correct===false?'再看一下答案':'参考答案')+'</h4><p class="english"><strong>'+E(c.target)+'</strong></p>'+(f?.writing?'<p>'+(f.covered?'已使用本题表达。':'还没有准确使用本题表达，可参考原句再改一遍。')+'</p><p>常见语法检查：'+(f.grammarAvailable===false?'语法检查暂不可用，请稍后再试。':grammar.length?'发现 '+grammar.length+' 处建议。':'暂未发现规则覆盖范围内的问题。')+'</p>'+grammar.map(x=>'<div class="review-grammar"><strong>'+E(x.original)+' → '+E(x.replacement)+'</strong><p>'+E(x.message)+'</p></div>').join('')+(grammar.length?'<button class="button subtle" data-review-action="apply">应用语法建议</button>':''):'')+(c.example?'<p class="review-example">课内例句：'+this.options.wordHTML(c.example)+'</p>':'')+(c.explanation?'<p>'+E(c.explanation)+'</p>':'')+'</section>';
  }
  action(action,b){
   const R=global.StudyReview,c=this.active;
   if(action==='enroll'){this.options.enrollCurrent();this.clearFilters();this.render();return;}
   if(action==='all'){this.clearFilters();this.render();return;}
   if(action==='backup'){this.options.backup();return;}
   if(action==='source'){this.options.openLesson(b.dataset.reviewSource);return;}
   if(!c)return;
   if(action==='speak'){this.options.speak(c.target);return;}
   if(action==='recall'||action==='writing'){this.writing=action==='writing';this.input='';this.revealed=false;this.feedback=null;this.render();return;}
   if(action==='choice'){this.input=c.options[Number(b.dataset.reviewOption)]||'';this.revealed=false;this.feedback=null;this.render();return;}
   if(action==='reveal'){this.revealed=true;this.feedback=null;this.render();return;}
   if(action==='check'){
    if(!this.input.trim()){this.options.toast('请先作答，再提交检查。');return;}
    if(c.kind==='phrase'&&this.writing){
     if((this.input.match(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g)||[]).length<5){this.options.toast('请写至少5个英文单词。');return;}
     const covered=R.hasPhrase(c,this.input);
     const grammarAvailable=typeof global.StudyGrammar?.check==='function';
     this.feedback={writing:true,covered,grammarAvailable,issues:grammarAvailable?global.StudyGrammar.check(this.input):[]};
    }else this.feedback=R.checkAnswer(c,this.input);
    this.revealed=true;this.render();return;
   }
   if(action==='apply'&&this.feedback?.writing){this.input=global.StudyGrammar?.applyAll(this.input,this.feedback.issues)||this.input;this.feedback=null;this.revealed=false;this.render();return;}
   if(action==='rate'&&this.revealed){
    const result=R.rate(this.state(),c.id,b.dataset.reviewRating,{revision:c.progress.revision});
    if(!result.accepted){this.options.toast('这项复习状态已变化，已刷新队列。');this.reset();this.render();return;}
    let saved;
    try{saved=this.options.saveState(result.state);}catch{this.options.toast('复习进度未能保存，请重试；当前项目仍保留。');return;}
    if(!saved)return;
    this.options.onChange?.();this.reset();this.render();return;
   }
  }
 }
 global.ReviewPractice=ReviewPractice;
})(window);
