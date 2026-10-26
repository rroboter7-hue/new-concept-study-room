(function(global){
 'use strict';
 const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const template='原句：You look at the book.\n否定句：You do not look at the book.\n一般疑问句：Do you look at the book?\n特殊疑问句：Why do you look at the book?\n旧知综合句：My sister and I look at the book after dinner.';
 class SentenceBatchPractice{
  constructor(options={}){
   this.options=options;this.escape=options.escapeHTML||escapeText;this.entries=new Map();this.active=null;this.lessonId=null;
   this.timer=null;this.workTimer=null;this.generation=0;this.results=[];this.checking=false;this.progress='';this.fallback='';this.visibleResults=50;this.promptChunks=[];this.promptIndex=0;
   document.addEventListener('input',e=>this.handleInput(e));document.addEventListener('change',e=>this.handleChange(e));document.addEventListener('click',e=>this.handleClick(e));
  }
  core(){return global.StudySentenceBatch;}
  root(){return document.querySelector('#sentence-batch-content');}
  inside(target){return Boolean(target?.closest?.('#sentence-batch-content'));}
  ensure(){
   const lesson=this.options.getLesson?.();const id=String(lesson?.id||'');
   if(this.lessonId!==id){this.flush();this.cancelCheck(false);this.results=[];this.progress='';this.fallback='';this.promptChunks=[];this.promptIndex=0;this.lessonId=id;this.active=null;}
   if(!id)return null;
   if(!this.entries.has(id)){const saved=this.options.getDrafts?.()?.[id];this.entries.set(id,{draft:this.core().sanitizeDraft(saved),dirty:false,state:saved?'saved':'new'});}
   this.active=this.entries.get(id);return lesson;
  }
  changed(){
   this.cancelCheck(false);this.results=[];this.progress='输入已改变，请重新检查。';this.fallback='';this.promptChunks=[];this.promptIndex=0;this.visibleResults=50;this.active.dirty=true;this.active.state='pending';
   if(this.timer!==null)global.clearTimeout(this.timer);this.timer=global.setTimeout(()=>{this.timer=null;this.flush();},450);this.update();
  }
  flush(){
   if(this.timer!==null)global.clearTimeout(this.timer);this.timer=null;let success=true;
   for(const [key,entry] of this.entries){if(!entry.dirty)continue;let saved=false;try{saved=this.options.saveDraft?.(key,this.core().sanitizeDraft(entry.draft))===true;}catch{}
    entry.state=saved?'saved':'failed';entry.dirty=!saved;if(!saved)success=false;
   }this.updateSave();return success;
  }
  reloadFromStorage(){this.cancelCheck(false);if(this.timer!==null)global.clearTimeout(this.timer);this.timer=null;this.entries.clear();this.active=null;this.lessonId=null;this.results=[];this.progress='';this.fallback='';this.promptChunks=[];this.promptIndex=0;}
  saveText(){if([...this.entries.values()].some(e=>e.state==='failed'))return '未保存：浏览器空间不足或无法保存。文字仍在当前页面，请复制备份后重试。';return this.active?.dirty?'等待保存草稿…':this.active?.state==='saved'?'草稿已保存到当前浏览器，学习备份也包含这些文字。':'每课独立保存草稿；输入后自动保存。';}
  updateSave(){const node=this.root()?.querySelector('[data-batch-save]');if(node)node.textContent=this.saveText();}
  handleInput(event){const t=event.target;if(!this.inside(t)||!this.active)return;if(t.dataset.batchInput==='notes'){this.active.draft.notes=String(t.value??'');this.active.dirty=true;this.active.state='pending';if(this.timer!==null)global.clearTimeout(this.timer);this.timer=global.setTimeout(()=>{this.timer=null;this.flush();},450);this.updateSave();return;}if(t.dataset.batchInput!=='raw')return;this.active.draft.rawText=String(t.value??'');this.changed();}
  handleChange(event){const t=event.target;if(!this.inside(t)||t.dataset.batchMode!=='mode'||!this.active)return;this.active.draft.mode=t.value==='conversion'?'conversion':'free';this.changed();this.redraw();}
  async handleClick(event){const target=event.target?.closest?.('[data-batch-action]');if(!target||!this.inside(event.target))return;event.preventDefault?.();
   switch(target.dataset.batchAction){case'check':this.startCheck();break;case'cancel':this.cancelCheck();break;case'copy':await this.copy();break;case'save':this.flush();break;case'more':this.visibleResults+=50;this.update();break;
    case'prompt-next':case'prompt-previous':this.promptIndex=Math.max(0,Math.min(this.promptChunks.length-1,this.promptIndex+(target.dataset.batchAction==='prompt-next'?1:-1)));this.fallback='';this.progress='已切换待复制段，请点击复制。';this.update();break;
    case'export':this.flush();this.options.downloadText?.('造句草稿-'+this.lessonId+'.txt',this.active.draft.rawText+'\n\n豆包批改笔记（用户粘贴，未自动核验）：\n'+(this.active.draft.notes||''));break;
    case'template':this.active.draft.rawText+=(this.active.draft.rawText.trim()?'\n\n':'')+template;this.active.draft.mode='conversion';this.changed();this.redraw();break;
    case'guided':{const draft=this.options.getGuidedDraft?.();const labels=['原句','否定句','一般疑问句','特殊疑问句','旧知综合句'],kinds=['affirmative','negative','yesno','wh','combined'];const lines=kinds.map((k,i)=>draft?.answers?.[k]?.trim()?labels[i]+'：'+draft.answers[k]:'').filter(Boolean);const text=lines.join('\n')||this.options.getGuidedText?.()||'';if(!text){this.options.toast?.('当前五句草稿还没有内容。');return;}this.active.draft.rawText+=(this.active.draft.rawText.trim()?'\n\n':'')+text;this.active.draft.mode='conversion';this.changed();this.redraw();break;}
   }
  }
  cancelCheck(announce=true){this.generation++;if(this.workTimer!==null)global.clearTimeout(this.workTimer);this.workTimer=null;const was=this.checking;this.checking=false;if(announce&&was){this.progress=`已停止，保留已检查的 ${this.results.length} 句。`;this.update();}}
  startCheck(){
   this.ensure();if(!this.active)return;this.cancelCheck(false);const parsed=this.core().parse(this.active.draft.rawText,this.active.draft.mode);this.results=[];this.visibleResults=50;this.fallback='';
   if(!parsed.rows.length){this.progress='请先输入要检查的句子。';this.update();return;}
   this.flush();this.checking=true;const generation=this.generation,entry=this.active;let index=0;
   const step=()=>{if(generation!==this.generation||entry!==this.active)return;
    const stop=Math.min(index+25,parsed.rows.length);for(;index<stop;index++){const row=parsed.rows[index];let feedback;try{feedback=this.core().checkRow(row,{grammarCheck:this.options.grammarCheck,grammarMaxLength:this.options.grammarMaxLength});}catch{feedback={status:'review',issues:[],notes:['这一句的本地检查未完成，请人工复核。']};}this.results.push({row,...feedback});}
    this.progress=index===parsed.rows.length?`基础检查完成：${index} 句。未发现已覆盖问题不代表正确，句意和转换关系请继续复核。`:`正在检查 ${index} / ${parsed.rows.length} 句…`;
    if(index===parsed.rows.length)this.checking=false;this.update();if(this.checking)this.workTimer=global.setTimeout(step,0);else this.workTimer=null;
   };step();
  }
  async copy(){
   const lesson=this.ensure();if(!this.active)return;const entry=this.active,parsed=this.core().parse(entry.draft.rawText,entry.draft.mode);
   if(!parsed.rows.length){this.progress='请先输入句子，再复制给豆包。';this.update();return;}
   const options={lesson:lesson?{id:lesson.id,book:lesson.book,number:lesson.number,title:lesson.title}:null};
   if(!this.promptChunks.length){this.promptChunks=this.core().promptParts?this.core().promptParts(parsed,options):[{text:this.core().buildPrompt(parsed,options),rowIds:parsed.rows.map(r=>r.id)}];this.promptIndex=0;}
   const prompt=this.promptChunks[this.promptIndex].text,generation=this.generation,partIndex=this.promptIndex;this.flush();
   try{if(this.options.copyText)await this.options.copyText(prompt);else{if(!global.navigator?.clipboard?.writeText)throw Error('Clipboard unavailable');await global.navigator.clipboard.writeText(prompt);}if(entry!==this.active||generation!==this.generation||partIndex!==this.promptIndex)return;this.fallback='';this.progress=`已复制第 ${this.promptIndex+1} / ${this.promptChunks.length} 段及批改要求。打开豆包后自行粘贴发送。`;}
   catch{if(entry!==this.active||generation!==this.generation||partIndex!==this.promptIndex)return;this.fallback=prompt;this.progress='自动复制未成功，展开下方文本框手动复制本段完整内容。';}
   this.update();const node=this.root()?.querySelector('[data-batch-copy-text]');if(this.fallback&&node){node.focus?.();node.select?.();}
  }
  summary(){if(!this.active)return '';const parsed=this.core().parse(this.active.draft.rawText,this.active.draft.mode);return `共 ${parsed.rows.length} 句${parsed.groups?.length?' · '+parsed.groups.length+' 组转换':''} · 不限制句子条数`;}
  feedbackHTML(){
   const e=this.escape,parsed=this.active?this.core().parse(this.active.draft.rawText,this.active.draft.mode):{warnings:[]};
   const warnings=(parsed.warnings||[]).map(w=>`<li>${e(w.message||w)}</li>`).join('');
   return `${this.promptChunks.length>1?`<p class="small-note">待复制：第 ${this.promptIndex+1} / ${this.promptChunks.length} 段；每段保留对应原句。</p><div class="batch-actions"><button type="button" class="button" data-batch-action="prompt-previous"${this.promptIndex===0?' disabled':''}>上一段</button><button type="button" class="button" data-batch-action="prompt-next"${this.promptIndex===this.promptChunks.length-1?' disabled':''}>下一段</button></div>`:''}<p role="status" aria-live="polite">${e(this.progress||'填写后点击检查。本地反馈不会计入分数或掌握度。')}</p>${warnings?'<ul class="batch-warnings">'+warnings+'</ul>':''}${this.results.slice(0,this.visibleResults).map(result=>`<article class="batch-result" data-status="${result.status==='needs-work'?'needs-work':'review'}"><h4>第 ${Number(result.row.index)+1} 句 · ${result.status==='needs-work'?'请核对提醒':'仍需复核'}</h4><p lang="en">${e(result.row.text)}</p>${result.issues?.length?'<ul>'+result.issues.map(issue=>'<li>'+e(issue.message||issue)+'</li>').join('')+'</ul>':''}${(result.notes||[]).map(note=>'<p class="small-note">'+e(note)+'</p>').join('')}</article>`).join('')}${this.results.length>this.visibleResults?'<button type="button" class="button" data-batch-action="more">再显示50条反馈</button>':''}${this.fallback?`<label class="sentence-field">手动复制完整批改内容<textarea rows="8" readonly data-batch-copy-text>${e(this.fallback)}</textarea></label>`:''}`;
  }
  update(){const root=this.root();if(!root)return;const count=root.querySelector('[data-batch-count]');if(count)count.textContent=this.summary();const feedback=root.querySelector('[data-batch-feedback]');if(feedback)feedback.innerHTML=this.feedbackHTML();const stop=root.querySelector('[data-batch-action="cancel"]');if(stop)stop.disabled=!this.checking;this.updateSave();}
  redraw(){const root=this.root();if(root)root.innerHTML=this.bodyHTML();}
  bodyHTML(){const e=this.escape,draft=this.active?.draft||{mode:'free',rawText:''};return `<div class="sentence-header"><h3>多句一起检查</h3><p>一次粘贴多句，先做本地基础检查，再复制到豆包手动批改。这里不会自动发送文字。</p></div><label class="sentence-field">输入方式<select data-batch-mode="mode"><option value="free"${draft.mode==='free'?' selected':''}>自由造句：每行一句</option><option value="conversion"${draft.mode==='conversion'?' selected':''}>四句型转换：按标签分组</option></select></label><p id="batch-hint" class="small-note">${draft.mode==='free'?'每个非空行作为一句，不要求句子之间属于同一组。':'每组写“原句：”“否定句：”“一般疑问句：”“特殊疑问句：”，可加“旧知综合句：”；空行分组。请保留原句，便于核对转换关系。'}</p><label class="sentence-field">批量英文句子<textarea class="batch-textarea" rows="9" lang="en" spellcheck="true" data-batch-input="raw" aria-describedby="batch-hint" placeholder="${e(draft.mode==='conversion'?template:'I read a book every day.\nDoes she have a private room?')}">${e(draft.rawText)}</textarea></label><p class="small-note" data-batch-count>${e(this.summary())}</p><div class="batch-actions"><button type="button" class="button primary" data-batch-action="check">检查全部句子</button><button type="button" class="button" data-batch-action="cancel"${this.checking?'':' disabled'}>停止检查</button><button type="button" class="button" data-batch-action="copy">复制给豆包批改</button><a class="button" href="https://www.doubao.com/chat/" target="_blank" rel="noopener noreferrer">打开豆包（自行粘贴）</a>${this.options.getGuidedDraft||this.options.getGuidedText?'<button type="button" class="button subtle" data-batch-action="guided">加入当前五句草稿</button>':''}<button type="button" class="button subtle" data-batch-action="template">追加格式示例</button><button type="button" class="button subtle" data-batch-action="save">保存草稿</button>${this.options.downloadText?'<button type="button" class="button subtle" data-batch-action="export">导出草稿与笔记</button>':''}</div><p class="small-note" data-batch-save role="status">${e(this.saveText())}</p><p class="small-note">本地规则无法完整判断语法、自然度及四句型的对应关系。豆包批改也可能有误；免费额度和单次输入长度以豆包账号显示为准，较长内容可在豆包分批粘贴。</p><section data-batch-feedback class="batch-feedback">${this.feedbackHTML()}</section><details><summary>保存豆包批改笔记</summary><p class="small-note">可把豆包结果粘贴到这里保存。笔记未经网站自动核验，不计分。</p><label class="sentence-field">豆包批改笔记<textarea rows="5" data-batch-input="notes">${e(draft.notes||'')}</textarea></label></details><details><summary>查看四句型输入格式</summary><pre class="batch-example">${e(template)}</pre><p class="small-note">自编教学示例。不要把示例当作自己的练习答案。</p></details>`;}
  render(){this.ensure();return `<section id="sentence-batch-content" aria-label="批量造句检查">${this.active?this.bodyHTML():'<p>请先选择一课。</p>'}</section>`;}
 }
 global.SentenceBatchPractice=SentenceBatchPractice;
})(typeof window!=='undefined'?window:globalThis);
