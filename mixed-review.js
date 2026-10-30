/* One overview and one task at a time; existing engines own review evidence. */
(function(root,factory){'use strict';const UI=factory(root,typeof module==='object'&&module.exports?require('./mixed-review-core.js'):root.StudyMixedReview);if(typeof module==='object'&&module.exports)module.exports=UI;else root.MixedReview=UI;})(typeof window!=='undefined'?window:globalThis,function(root,Core){
 'use strict';
 const labels={mistake:'历史错题',phrase:'习惯用法',correction:'错句订正',recall:'已学回忆'},list=x=>Array.isArray(x)?x:[],escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 class MixedReview{
  constructor(options={}){this.options=options;this.container=options.container;this.C=options.core||Core;this.R=options.reviewEngine||root.StudyReview;this.S=options.sentenceEngine||root.StudySentenceRevisit;this.e=options.escapeHTML||escape;this.local=this.C.sanitize(options.getState?.());this.page='overview';this.mode='mixed';this.failed=false;
   this.container.addEventListener('click',event=>{const b=event.target.closest?.('[data-mix-action],[data-mix-choice]');if(b&&this.container.contains(b))this.action(b);});
   this.container.addEventListener('input',event=>{if(event.target.hasAttribute?.('data-mix-input'))this.input(event.target.value);});
  }
  now(){return this.options.now?.()??Date.now();}
  context(){return {...this.options.getContext?.(),now:this.now()};}
  catalog(all=false){return this.C.collect({...this.context(),includeFuture:all}).map(row=>{const last=this.local.history[row.key];return row.kind==='mistake'&&last?.revision===row.revision?{...row,previousAnswer:last.firstAnswer||last.answer||row.previousAnswer}:row;});}
  snapshot(){return this.C.sanitize(this.local);}
  reload(){this.local=this.C.sanitize(this.options.getState?.());this.page='overview';this.failed=false;}
  save(next,changes={},advance=false){let saved=false;try{saved=this.options.saveState?.(next,changes)===true;}catch{}this.failed=!saved;if(saved)this.local=this.C.sanitize(this.options.getState?.()||next);else if(!advance)this.local=next;return saved;}
  flush(){return this.save(this.local);}
  active(){return this.C.active(this.local,this.catalog(true));}
  pending(){return !!this.local.session&&this.local.session.items.some(row=>!this.local.session.results[row.key]);}
  noticeHTML(){return this.failed?'<p class="mix-save-error" role="alert">未能保存，输入仍保留在本页。<button type="button" data-mix-action="save">重试保存</button></p>':'';}
  chips(items){return Object.entries(labels).map(([kind,label])=>{const n=items.filter(row=>row.kind===kind).length;return n?'<span class="mix-count mix-count-'+kind+'">'+label+' <b>'+n+'</b></span>':'';}).join('');}
  overview(){
   const pending=this.pending(),rows=pending?this.local.session.items:this.C.plan(this.catalog(),{state:this.local,now:this.now(),mode:this.mode}),wrong=this.C.plan(this.catalog(),{state:this.local,now:this.now(),mode:'mistakes'}).length,e=this.e;
   return '<header class="mix-heading"><p class="mix-eyebrow">温故 · 知新</p><h1>本次复习</h1><p>从上次卡住的地方，再向前一步。</p></header><section class="mix-overview-card"><div class="mix-overview-top"><div><span>'+(pending?'接着上次的这一组':this.mode==='mistakes'?'先解决做错的题':'为你安排的一小组')+'</span><h2>'+rows.length+' <small>项'+(pending?' · 已完成 '+Object.keys(this.local.session.results).length:'')+'</small></h2></div><span class="mix-overview-mark" aria-hidden="true">'+(pending?'继续':'今日')+'</span></div><div class="mix-counts">'+this.chips(rows)+'</div><p class="mix-overview-note">'+(rows.length?'先独立回忆，答完再看解析。最多10项，完成就可以休息。':'今天暂时没有到期内容。学过的课文、错题和确认过的订正会在这里安排。')+'</p>'+(rows.length?'<button type="button" class="button primary mix-start" data-mix-action="start">'+(pending?'继续本组':'开始本次复习')+'<span aria-hidden="true"> →</span></button>':'<button type="button" class="button primary mix-start" data-mix-action="learn">回到学习</button>')+'</section>'+(!pending?'<div class="mix-scope" role="group" aria-label="复习内容"><button type="button" data-mix-action="mixed" aria-pressed="'+(this.mode==='mixed')+'">混合复习</button><button type="button" data-mix-action="mistakes" aria-pressed="'+(this.mode==='mistakes')+'">只练错题'+(wrong?' · '+wrong:'')+'</button></div>':'')+'<details class="mix-about"><summary>复习记录与说明</summary>'+(this.local.session&&!pending?'<button type="button" class="mix-text-link" data-mix-action="last-result">查看上组结果</button>':'')+'<p>反复做错的题优先，再穿插习惯用法和自己确认过的错句；内容不足时补充到期旧知，同一知识点不重复计数。</p><p>自主造句和自行核对只记录练习。订正后另安排回顾，不改变原课成绩。</p></details>';
  }
  evaluation(item,d){
   if(item.kind==='correction')return {writing:true,reference:item.entry.corrected,reason:item.entry.reason||'',title:'对照已保存的订正'};
   if(d.mode==='writing'&&item.kind==='phrase'){const covered=this.R.hasPhrase(item.card,d.input),issues=root.StudyGrammar?.check?.(d.input)||[];return {writing:true,covered,reference:item.card.example||'',reason:covered?'已使用本题表达；句子是否自然、语法是否正确仍需核对。':'还没有准确使用本题表达，请对照搭配修改。',issues,title:covered?'用法练习 · 待自行核对':'还没用到指定表达'};}
   if(item.kind==='mistake')return {correct:d.input===item.q.options[item.q.answer],reference:item.q.options[item.q.answer],reason:item.explanation||'',title:d.input===item.q.options[item.q.answer]?'回答正确':'尚未答对，再试一次'};
   const feedback=this.R.checkAnswer(item.card,d.input);return {...feedback,reference:item.card.target,reason:item.card.explanation||'',title:feedback.correct?'回答正确':'尚未答对，再试一次'};
  }
  feedbackHTML(item,d){if(!d.checked&&!d.revealed)return '';const e=this.e,f=this.evaluation(item,d);return '<section class="mix-feedback '+(f.correct===false||f.covered===false?'mix-feedback-retry':'')+'" aria-live="polite"><strong>'+e(d.checked?f.title:'先看提示，再尝试一次')+'</strong>'+(f.reference?'<small>'+(f.writing?(item.kind==='correction'?'已保存的订正':'来源例句'):'参考答案')+'</small><p lang="en">'+e(f.reference)+'</p>':'')+(item.kind==='mistake'&&item.previousAnswer?'<small>上次作答：'+e(item.previousAnswer)+'</small>':'')+'<details><summary>'+(item.kind==='correction'?'订正原因':'解析与例句')+'</summary>'+(f.reason?'<p>'+e(f.reason)+'</p>':'')+(item.card?.example&&item.card.example!==f.reference?'<p lang="en">'+e(item.card.example)+'</p>':'')+list(f.issues).map(issue=>'<p>'+e(issue.message||'请核对这一处表达。')+'</p>').join('')+'</details>'+(f.writing?'<small>自行核对属于练习，不代表系统已判定整句正确。</small>':'')+'</section>';}
  isAssisted(item,d){return !!(d.assisted||item.card?.progress.assistance?.revision===item.card?.progress.revision&&item.card?.progress.assistance);}
  actionsHTML(item,d){
   if(!d.checked)return '<button type="button" class="button primary mix-next" data-mix-action="check">'+(item.kind==='correction'?'写好了，对照订正':'提交并检查')+'</button>'+(item.kind!=='correction'?'<button type="button" class="mix-help" data-mix-action="help">需要帮助</button>':'');
   const f=this.evaluation(item,d);if(f.writing&&f.covered===false)return '<button type="button" class="button primary mix-next" data-mix-action="next">稍后再练，下一项</button>';if(f.writing)return '<button type="button" class="button primary mix-next" data-mix-action="next">已自行核对，继续</button><button type="button" class="mix-help" data-mix-action="again">仍需复习</button>';
   return '<button type="button" class="button primary mix-next" data-mix-action="next">'+(f.correct?(this.isAssisted(item,d)?'订正后继续':'答对了，下一项'):'稍后再练，下一项')+'</button>';
  }
  task(){
   const item=this.active(),e=this.e,s=this.local.session;if(!item)return this.summary();const done=Object.keys(s.results).length;
   const header='<header class="mix-task-heading"><button type="button" class="mix-back" data-mix-action="overview">‹ 复习概览</button><span>'+(s.practice?'即时订正':'本组进度')+' '+(done+1)+' / '+s.items.length+'</span></header><progress class="mix-progress" aria-label="本组完成进度" max="'+s.items.length+'" value="'+done+'"></progress>';
   if(item.stale)return header+'<section class="mix-task-card"><span class="mix-task-type">已暂缓</span><h2>这项资料已更新</h2><p>原来的输入仍保留，不使用新答案评判旧题。</p><button type="button" class="button primary" data-mix-action="defer">继续下一项</button></section>';
   const d=this.C.draft(this.local,item),writing=d.mode==='writing'&&item.kind==='phrase',choices=item.kind==='mistake'?item.q.options:item.card?.kind==='grammar'?item.card.options:null;
   let prompt=item.kind==='correction'?item.entry.original:writing?'用 '+item.card.target+' 写一句自己的英文':item.kind==='mistake'?item.title:item.card.prompt;
   const authored=item.kind==='mistake'?/^【自编([^】]{1,20})】\s*/.exec(prompt):null,type=labels[item.kind]+(authored?' · 自编'+authored[1]:'');if(authored)prompt=prompt.slice(authored[0].length);
   const input=choices?'<div class="mix-choices">'+choices.map((option,i)=>'<button type="button" class="mix-option" data-mix-choice="'+i+'" aria-pressed="'+(d.input===option)+'"><span aria-hidden="true">'+String.fromCharCode(65+i)+'</span>'+e(option)+'</button>').join('')+'</div>':'<label class="mix-input-label">'+(item.kind==='correction'?'凭记忆写出订正句':writing?'你的句子':item.kind==='phrase'?'回忆英文表达':'回忆英文单词')+'<textarea rows="'+(writing||item.kind==='correction'?3:2)+'" maxlength="'+(item.kind==='correction'?2000:10000)+'" data-mix-input lang="en" spellcheck="false" autocomplete="off" placeholder="'+(writing?'把这个表达用到自己的生活中…':'先试着回忆，再查看提示…')+'">'+e(d.input)+'</textarea></label>';
   return header+(s.practice?'<p class="mix-practice-note">即时订正不改变原定复测时间。</p>':'')+'<section class="mix-task-card"><div class="mix-card-top"><span class="mix-task-type mix-count-'+item.kind+'">'+e(type)+'</span><span>'+e(item.sourceLabel)+'</span></div>'+(item.kind==='phrase'?'<div class="mix-phrase-mode" role="group" aria-label="用法练习方式"><button type="button" data-mix-action="recall" aria-pressed="'+!writing+'">回忆表达</button><button type="button" data-mix-action="writing" aria-pressed="'+writing+'">用法造句</button></div>':'')+'<h2 class="mix-prompt"'+(item.kind==='correction'||item.kind==='mistake'&&!/[\u3400-\u9fff]/.test(prompt)?' lang="en"':'')+'>'+e(prompt)+'</h2>'+input+'<div data-mix-feedback>'+this.feedbackHTML(item,d)+'</div><div class="mix-task-actions" data-mix-actions>'+this.actionsHTML(item,d)+'</div><p class="mix-input-status" data-mix-input-status role="status"></p></section><details class="mix-source"><summary>来源与学习记录</summary><p>'+e(item.sourceLabel)+((d.checked||d.revealed)&&item.sourceLesson.title?' · '+e(item.sourceLesson.title):'')+'</p><button type="button" class="mix-text-link" data-mix-action="source">回看这课</button></details>';
  }
  summary(){const s=this.local.session,e=this.e,rows=s?.items||[],results=s?.results||{},retry=rows.filter(row=>['retry','corrected','self-checked'].includes(results[row.key]?.status)),correct=rows.filter(row=>results[row.key]?.status==='correct').length;
   return '<header class="mix-heading"><p class="mix-eyebrow">今天又向前一步</p><h1>本组已完成</h1><p>把需要巩固的地方，留给下一次回顾。</p></header><section class="mix-summary-card"><div class="mix-result-count"><strong>'+correct+'</strong><span>项独立答对</span><strong>'+retry.length+'</strong><span>项继续巩固</span></div>'+(retry.length?'<details class="mix-result-list"><summary>查看本组待巩固（'+retry.length+'项）</summary>'+retry.map(row=>'<p><span class="mix-result-dot" aria-hidden="true"></span><span class="mix-result-title" title="'+e(row.sourceLabel+' · '+row.title)+'">'+e(row.title.replace(/^【自编[^】]+】\s*/,''))+'</span><small>'+({retry:'待复习',corrected:'本轮已订正','self-checked':'已自行核对'}[results[row.key].status])+'</small></p>').join('')+'</details>':'<p>这一组可以先告一段落，后续按排期再回顾。</p>')+(retry.length?'<button type="button" class="button primary mix-start" data-mix-action="retry">只练本组待巩固</button>':'')+'<button type="button" class="'+(retry.length?'mix-help':'button primary mix-start')+'" data-mix-action="overview">返回复习概览</button><p class="mix-overview-note">'+(rows.some(row=>results[row.key]?.status==='deferred')?'资料有变的项目已暂缓，原稿保留。':'订正和自行核对不记为客观掌握。')+'</p></section>';
  }
  render(){this.container.innerHTML='<div class="mixed-review">'+this.noticeHTML()+(this.page==='overview'?this.overview():this.task())+'</div>';}
  updateNotice(){const node=this.container.querySelector('[data-mix-input-status]');if(node)node.textContent=this.failed?'草稿暂未保存，请先保留本页或重试。':'草稿已保存';}
  input(value){const item=this.active();if(!item||item.stale)return;const old=this.C.draft(this.local,item),next=this.C.saveDraft(this.local,item,{input:value,checked:false,revealed:false,assisted:old.checked||old.revealed||old.assisted},{now:this.now()});if(!next){this.options.toast?.('输入过长，请先复制并缩短文字。');return;}this.save(next);const area=this.container.querySelector('[data-mix-feedback]'),actions=this.container.querySelector('[data-mix-actions]');if(area)area.innerHTML='';if(actions)actions.innerHTML=this.actionsHTML(item,this.C.draft(this.local,item));this.updateNotice();}
  assist(item,next){if(!item.card||this.local.session?.practice)return this.save(next);const result=this.R.assist(this.context().review,item.card.id,{revision:item.card.progress.revision,reason:'mixed-review-hint'});return this.save(next,result.accepted?{review:result.state}:{});}
  finish(item,statusOverride){
   const d=this.C.draft(this.local,item),f=item.stale?{}:this.evaluation(item,d),practice=this.local.session?.practice,assisted=this.isAssisted(item,d),now=this.now();
   let status=statusOverride||(f.writing?(f.covered===false?'retry':'self-checked'):f.correct?assisted||practice?'corrected':'correct':'retry');
   const result=this.C.complete(this.local,item,{status,answer:d.input,independent:f.correct===true&&!assisted&&!practice},{now});if(!result.accepted){this.options.toast?.('请先尝试作答，再检查或自行核对。');return;}
   const changes={};if(!practice&&item.card){const rated=this.R.rate(this.context().review,item.card.id,status==='correct'?'good':status==='retry'?'again':'hard',{now,revision:item.card.progress.revision,evidence:{correct:f.correct===true,assisted,objective:!f.writing,kind:item.card.kind,answer:d.input}});if(!rated.accepted){this.options.toast?.('这项复习已变化，请返回概览重新安排。');return;}changes.review=rated.state;}
   if(!practice&&item.kind==='correction'){const rated=this.S.rate(this.context().sentences,item.entry.id,status==='retry'?'again':'remembered',d.input,{now,revealed:d.checked});if(!rated.ok){this.options.toast?.(rated.error);return;}changes.sentences=rated.state;}
   if(this.save(result.state,changes,true)){this.page='task';this.render();this.container.querySelector('.mix-task-heading,.mix-heading')?.scrollIntoView?.({block:'start'});}else this.render();
  }
  retryRows(){
   const session=this.local.session;if(!session)return [];
   return this.catalog(true).filter(row=>{const ref=session.items.find(ref=>ref.key===row.key),result=ref&&session.results[ref.key];if(!ref||!['retry','corrected','self-checked'].includes(result?.status))return false;if(row.revision===ref.revision)return true;
    // A scheduling revision written by this group may change. A changed
    // question, meaning or confirmed correction must not be substituted.
    try{const old=JSON.parse(ref.revision),current=JSON.parse(row.revision);if(!Array.isArray(old)||!Array.isArray(current)||JSON.stringify(old.slice(0,4))!==JSON.stringify(current.slice(0,4)))return false;
     if(row.card)return row.card.progress.lastReviewedAt===result.at&&current[4]===old[4]+1;
     if(row.entry)return row.entry.lastRatedAt===result.at;
    }catch{}return false;
   }).slice(0,10);
  }
  action(button){
   const action=button.dataset.mixAction,item=this.active();
   if(button.dataset.mixChoice!==undefined&&item&&!item.stale){const choices=item.q?.options||item.card?.options||[],d=this.C.draft(this.local,item);this.input(choices[Number(button.dataset.mixChoice)]||'');if(d.checked)this.assist(item,this.local);this.render();return;}
   if(action==='save'){this.flush();this.render();return;}
   if(action==='last-result'&&this.local.session){this.page='task';this.render();return;}
   if(action==='overview'){if(!this.flush()){this.render();return;}this.page='overview';this.render();return;}
   if(action==='mixed'||action==='mistakes'){this.mode=action;this.render();return;}
   if(action==='learn'){this.options.onLearn?.();return;}
   if(action==='source'&&item&&!item.stale){const next=this.C.saveDraft(this.local,item,{assisted:true},{now:this.now()});if(this.assist(item,next))this.options.onSource?.(item.sourceLesson.id);return;}
   if(action==='start'){
    if(this.pending()){this.page='task';this.render();return;}
    const rows=this.C.plan(this.catalog(),{state:this.local,now:this.now(),mode:this.mode});if(!rows.length){this.render();return;}if(this.save(this.C.begin(this.local,rows,{now:this.now(),mode:this.mode}),{},true)){this.page='task';this.render();}else this.render();return;
   }
   if(action==='retry'){const rows=this.retryRows();if(!rows.length){this.options.toast?.('这组资料已更新，请从概览重新安排。');return;}let next=this.C.begin(this.local,rows,{now:this.now(),practice:true});for(const row of rows)next=this.C.saveDraft(next,row,{assisted:true},{now:this.now()});if(this.save(next,{},true)){this.page='task';this.render();}else this.render();return;}
   if(!item)return;if(action==='defer'){this.finish(item,'deferred');return;}if(item.stale)return;
   const d=this.C.draft(this.local,item);
   if(action==='recall'||action==='writing'){if(d.mode===action)return;if(action==='writing'&&item.kind!=='phrase')return;const next=this.C.saveDraft(this.local,item,{mode:action,input:'',checked:false,revealed:false,assisted:d.assisted||d.checked||action==='writing'},{now:this.now()});this.assist(item,next);this.render();return;}
   if(action==='help'){this.assist(item,this.C.saveDraft(this.local,item,{revealed:true,assisted:true},{now:this.now()}));this.render();return;}
   if(action==='check'){if(!d.input.trim()){this.options.toast?.('先尝试写下答案，再检查。');return;}if(item.kind==='phrase'&&d.mode==='writing'&&(d.input.match(/[A-Za-z]+/g)||[]).length<5){this.options.toast?.('请写一句至少5个英文单词的句子。');return;}const f=this.evaluation(item,d),next=this.C.saveDraft(this.local,item,{checked:true,firstAnswer:d.firstAnswer||d.input,assisted:d.assisted||f.correct===false},{now:this.now()});if(f.correct===false)this.assist(item,next);else this.save(next);this.render();return;}
   if((action==='next'||action==='again')&&d.checked)this.finish(item,action==='again'?'retry':undefined);
  }
 }
 return MixedReview;
});
