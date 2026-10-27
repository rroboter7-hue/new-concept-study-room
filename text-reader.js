(() => {
 'use strict';
 class TextStudyLibrary {
  constructor(options){this.options=options;this.doc=null;this.section=0;this.tab='text';this.sectionCache=new Map();this.pendingLoads=new Map();document.addEventListener('click',event=>{const b=event.target.closest('[data-text-action]');if(!b)return;options.beforeChange?.();switch(b.dataset.textAction){case'back':this.loadSeq=(this.loadSeq||0)+1;this.doc=null;options.onBack();break;case'section':this.section=Number(b.dataset.textSection)||0;this.render();break;case'tab':this.tab=b.dataset.textTab;this.render();break;}});document.addEventListener('change',event=>{if(event.target.classList.contains('text-section-select')){options.beforeChange?.();this.section=Number(event.target.value)||0;this.render();}});}
  rememberSections(id,sections){
   this.sectionCache.delete(id);this.sectionCache.set(id,sections);
   while(this.sectionCache.size>2){const oldest=[...this.sectionCache.keys()].find(key=>key!==this.doc?.id);this.sectionCache.delete(oldest);}
   return sections;
  }
  loadSections(descriptor){
   if(this.pendingLoads.has(descriptor.id))return this.pendingLoads.get(descriptor.id);
   // A repeated open shares its request; navigation invalidates rendering without
   // cancelling a request that another open is still waiting for.
   const request=(async()=>{
    const url=new URL(descriptor.dataUrl,location.href);
    if(!/^https?:$/.test(url.protocol)||url.origin!==location.origin)throw Error('Invalid source');
    const response=await fetch(url);if(!response.ok)throw Error('Unavailable');
    const loaded=await response.json();if(!Array.isArray(loaded.sections))throw Error('Invalid document');
    return this.rememberSections(descriptor.id,loaded.sections);
   })().finally(()=>this.pendingLoads.delete(descriptor.id));
   this.pendingLoads.set(descriptor.id,request);return request;
  }
  isCurrentLoad(seq,loading){
   if(seq!==this.loadSeq||this.options.isActive?.()===false)return false;
   // The app may replace the library panel while a fetch is pending, then return
   // to the catalog before it completes. That response must not reopen the book.
   return !loading||this.options.container.innerHTML.includes('data-text-loading="'+seq+'"');
  }
  async open(id,index=null){
   this.options.beforeChange?.();const descriptor=this.options.data.find(d=>d.id===id),seq=this.loadSeq=(this.loadSeq||0)+1;
   if(!descriptor){this.options.toast('这份资料的文字版尚在整理，请稍后重试。');return;}
   if(this.options.isActive?.()===false)return;
   this.doc=descriptor;this.tab='text';let sections=descriptor.sections,loading=false;
   if(descriptor.dataUrl&&!Array.isArray(sections)){
    if(this.sectionCache.has(descriptor.id))sections=this.rememberSections(descriptor.id,this.sectionCache.get(descriptor.id));
    else{
     loading=true;this.options.container.innerHTML='<div class="text-reader" data-text-loading="'+seq+'"><button class="button" data-text-action="back">返回教材资料</button><p>正在载入文字资料……</p></div>';
     try{sections=await this.loadSections(descriptor);}catch{
      if(!this.isCurrentLoad(seq,loading))return;
      this.options.container.innerHTML='<div class="text-reader"><button class="button" data-text-action="back">返回教材资料</button><p>文字资料暂时未能加载，请返回后重新打开。</p></div>';return;
     }
    }
   }
   if(!this.isCurrentLoad(seq,loading))return;
   this.doc=descriptor.sections===sections?descriptor:{...descriptor,sections};
   const first=sections?.findIndex(s=>(s.english||[]).length>0)??0;
   this.section=Number.isInteger(index)&&index>=0?index:Math.max(0,descriptor.defaultSectionIndex??first);this.render();
  }
  lesson(section){return{id:'note-'+this.doc.id+'-'+section.id,book:this.doc.book||1,title:section.title,subtitle:this.doc.title,source:'provided',paragraphs:(section.english||[]).slice(0,25).map(en=>({en,zh:''})),vocabulary:(section.vocabulary||[]).slice(0,12),keyPoints:section.keyPoints||[],grammar:section.grammar||[],usage:section.usage||[]};}
  knowledge(section){const e=this.options.escapeHTML;const points=section.keyPoints||[],grammar=section.grammar||[],usage=section.usage||[];return `<div class="knowledge-grid">${points.length?`<section class="knowledge-card"><h3>本节重点知识</h3>${points.map((p,i)=>`<p><strong>${i+1}.</strong> ${e(p)}</p>`).join('')}</section>`:''}${grammar.map(g=>`<section class="knowledge-card grammar-card"><h3>${e(g.title||'语法要点')}</h3><p>${e(g.note||'')}</p>${g.example?`<p class="english">${this.options.wordHTML(g.example)}</p>`:''}</section>`).join('')}${usage.map(u=>`<section class="knowledge-card"><h3>${e(u.phrase)}</h3><p>${e(u.meaning||'')}</p>${u.example?`<p class="english">${this.options.wordHTML(u.example)}</p>`:''}</section>`).join('')}${(section.vocabulary||[]).length?`<section class="knowledge-card"><h3>本节词汇线索</h3>${section.vocabulary.map(v=>`<p>${this.options.wordHTML(v.word)} ${e(v.phonetic||'')} ${e(v.meaning||'')}</p>`).join('')}</section>`:''}${!points.length&&!grammar.length&&!usage.length?'<div class="text-empty">本节没有识别到独立的语法或用法条目，可从“文字阅读”查看原笔记。</div>':''}</div><p class="text-source-note">要点来自本节原笔记的文字整理，原始内容可在文字阅读中逐行核对。</p>`;}
  render(){if(!this.doc)return;const e=this.options.escapeHTML,d=this.doc,sections=d.sections||[],section=sections[this.section]||sections[0],source=(window.STUDY_LIBRARY||[]).find(f=>f.id===d.id),archived=source&&window.StudySourceFiles?.isArchived?.(source.url);if(!section){this.options.container.innerHTML=`<div class="text-reader"><button class="button" data-text-action="back">返回教材资料</button><div class="text-empty">此文件没有可提取的文字层，可能是空白书写纸或扫描页。其他资料已转换为可练习的文字。</div>${source?archived?'<p class="text-source-note">原PDF已归档</p>':`<a class="button" href="${e(source.url)}" target="_blank" rel="noopener">查看原始文件</a>`:''}</div>`;return;}
   const lesson=this.lesson(section);this.options.onLessonSelected(lesson);this.options.output.setLesson(lesson);
   const text=(section.lines||[]).map(line=>{const english=/[A-Za-z]/.test(line)&&!/[\u3400-\u9fff]/.test(line);const heading=/^(?:\d{1,3}\s+)?(?:Words|Grammar|Story|Expressions|Practices|Lesson|Homework|Summary|Recap|Exercises|写作|语法|词汇|课后|习惯)/i.test(line)&&line.length<90;return `<p class="note-line ${english?'english':'chinese'} ${heading?'heading':''}">${this.options.wordHTML(line)}</p>`;}).join('');
   this.options.container.innerHTML=`<div class="text-reader"><div class="text-reader-header"><div><button class="button subtle" data-text-action="back">${this.options.icon('left')}返回教材资料</button><h2>${e(d.title)}</h2><p class="text-source-note">${d.ocrDraft?'英语扫描识别底稿 · '+sections.length+' 页 · 待逐课校对':'已转换为文字 · '+sections.length+' 个学习单元 · 保留原资料内容'}</p></div>${source?archived?'<p class="text-source-note">原PDF已归档</p>':`<a class="button subtle" href="${e(source.url)}" download="${e(d.title)}.pdf">${this.options.icon('download')}原 PDF</a>`:''}</div>${d.ocrDraft?'<p class="library-notice">英文扫描文字可能有识别错误，中文内容尚未转成文字。请对照原PDF核对后使用；主学习空间仅将已校对正文标为教材课文。</p>':''}<select class="text-section-select" aria-label="选择学习单元">${sections.map((s,i)=>`<option value="${i}" ${i===this.section?'selected':''}>${e(s.title)}</option>`).join('')}</select><div class="text-reader-layout"><aside class="text-section-list" aria-label="资料单元目录"><h3>学习单元</h3>${sections.map((s,i)=>`<button class="text-section-button ${i===this.section?'active':''}" data-text-action="section" data-text-section="${i}" aria-current="${i===this.section?'true':'false'}"><strong>${e(s.title)}</strong><small>原资料第 ${s.pageStart}–${s.pageEnd} 页</small></button>`).join('')}</aside><article class="text-reader-main"><h2 class="text-section-title">${e(section.title)}</h2><p class="text-source-note">原资料第 ${section.pageStart}–${section.pageEnd} 页 · ${(section.english||[]).length} 条可练习英文内容</p><div class="text-reader-tabs" role="tablist">${[['text','文字阅读'],['knowledge','知识要点'],['output','默写 · 拼写 · 复述']].map(([tab,label])=>`<button class="text-reader-tab ${this.tab===tab?'active':''}" data-text-action="tab" data-text-tab="${tab}" role="tab" aria-selected="${this.tab===tab}">${label}</button>`).join('')}</div>${this.tab==='text'?`<div class="text-native-content">${text||'<p>本节没有文字。</p>'}</div>`:this.tab==='knowledge'?this.knowledge(section):lesson.paragraphs.length?`<div id="output-content">${this.options.output.render()}</div>`:'<div class="text-empty">这一节没有完整英文句子可供默写或复述，请选择包含英文例句的单元。词汇与语法内容仍可在文字阅读中学习。</div>'}</article></div></div>`;
  }
 }
 window.TextStudyLibrary=TextStudyLibrary;
})();
