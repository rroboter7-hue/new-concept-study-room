/* Optional reference library: never inserts answers or creates writing goals. */
(function(root,factory){
 'use strict';const UI=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=UI;else root.WritingWordLibrary=UI;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const list=x=>Array.isArray(x)?x:[],plain=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
 const clone=x=>JSON.parse(JSON.stringify(x)),text=x=>typeof x==='string'?x:'';
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const categories={verb:'动词',noun:'名词',adjective:'形容词',adverb:'副词',phrase:'习惯用法',word:'其他词'};
 const ordered=['verb','noun','adjective','adverb','phrase','word'];
 const posLabels={noun:'n.',verb:'v.',adjective:'adj.',adverb:'adv.',phrase:'短语'};
 class WritingWordLibrary{
  constructor(options={}){this.options=options;this.e=options.escapeHTML||escape;this.bindings=[];this.contexts=new Map();this.generation=0;}
  cleanState(raw){
   raw=plain(raw);const selections={};
   for(const [key,values] of Object.entries(plain(raw.selectedByTarget)).slice(-300))if(/^(word|phrase):/.test(key)&&key.length<=600)selections[key]=[...new Set(list(values).filter(x=>typeof x==='string'&&x.length<=600))].slice(0,4);
   return {version:1,open:raw.open===true,manual:raw.manual===true,book:/^[1-4]$/.test(String(raw.book))?String(raw.book):raw.book==='history'||raw.book==='current'?raw.book:'',category:Object.hasOwn(categories,raw.category)?raw.category:'',query:text(raw.query).slice(0,100),rotation:Number.isSafeInteger(raw.rotation)&&raw.rotation>=0?raw.rotation:0,page:Number.isSafeInteger(raw.page)&&raw.page>=0?raw.page:0,selectedByTarget:selections};
  }
  mount(container,context){
   this.detach();if(!container||!context?.lesson||!context?.target)return;
   this.container=container;this.lesson=context.lesson;this.target=context.target;this.generation++;
   let current=this.contexts.get(this.lesson.id);
   if(!current){current=this.cleanState(this.options.getState?.(this.lesson));this.contexts.set(this.lesson.id,current);}
   this.state=current;this.entries=null;this.error='';this.draw();if(this.migrated&&!this.state.open){this.migrated=false;void this.save();}
   const on=(name,fn,target=container)=>{target.addEventListener(name,fn);this.bindings.push(()=>target.removeEventListener(name,fn));};
   const dialog=container.querySelector('[data-library-dialog]');
   on('click',event=>{void this.click(event);});
   on('input',event=>{if(event.target?.hasAttribute?.('data-library-query')){this.state.query=event.target.value.slice(0,100);this.state.page=0;this.drawResults();void this.save();}});
   on('cancel',event=>{event.preventDefault?.();this.closeDialog(true);},dialog);
   on('close',()=>{if(this.state.open)this.closeDialog(true);},dialog);
   if(this.state.open)this.openDialog(false);
  }
  detach(){
   this.bindings.forEach(fn=>fn());this.bindings=[];
   const dialog=this.container?.querySelector('[data-library-dialog]');
   if(dialog?.open&&typeof dialog.close==='function')try{dialog.close();}catch(_){}
   dialog?.removeAttribute?.('open');this.container=null;this.generation++;
  }
  reloadFromStorage(){this.detach();this.contexts.clear();}
  bank(){
   if(!this.entries){
    this.entries=list(this.options.getEntries?.(this.lesson));
    const aliases=new Map(),ambiguous=new Set();
    for(const row of this.entries)for(const alias of [row.key,...list(row.aliases)])if(typeof alias==='string'){
     if(aliases.has(alias)&&aliases.get(alias)!==row.key)ambiguous.add(alias);else aliases.set(alias,row.key);
    }
    for(const key of ambiguous)aliases.delete(key);
    for(const [target,values] of Object.entries(this.state.selectedByTarget)){
     const updated=[...new Set(list(values).map(key=>aliases.get(key)||key))].slice(0,4);
     if(JSON.stringify(values)!==JSON.stringify(updated)){this.state.selectedByTarget[target]=updated;this.migrated=true;}
    }
   }
   return this.entries;
  }
  selected(){const bank=this.bank(),keys=list(this.state.selectedByTarget[this.target.key]);return bank.filter(row=>keys.includes(row.key));}
  pos(row){return '<span class="writing-library-pos">'+this.e(posLabels[row.category]||text(row.pos).trim()||'词性未标注')+'</span>';}
  async save(){
   const lesson=this.lesson,state=clone(this.state),generation=this.generation,revision=this.saveRevision=(this.saveRevision||0)+1;
   try{if(typeof this.options.saveState==='function'&&await this.options.saveState(lesson,state)===false)throw Error('Save failed');if(generation===this.generation&&revision===this.saveRevision){this.error='';this.updateError();}return true;}
   catch(_){if(generation===this.generation&&revision===this.saveRevision){this.error='参考选择暂未保存，请稍后重试；造句内容仍由原编辑器保存。';this.updateError();}return false;}
  }
  updateError(){const node=this.container?.querySelector('[data-library-error]');if(node){node.textContent=this.error;node.hidden=!this.error;}}  setNotice(message){const node=this.container?.querySelector('[data-library-notice]');if(node){node.textContent=message;node.hidden=!message;}}
  draw(){
   if(!this.container)return;
   this.container.innerHTML='<div class="writing-library"><button type="button" class="writing-library-entry" data-library-action="open" aria-haspopup="dialog">选词库 <span>查看已学词语和用法 ›</span></button><div class="writing-library-inline-selected" data-library-inline-selected hidden></div><dialog class="writing-library-dialog" data-library-dialog aria-label="选词库"><div class="writing-library-shell"><header class="writing-library-header"><button type="button" data-library-action="return" class="writing-library-back">‹ 返回造句</button><h2>选词库</h2><span aria-hidden="true"></span></header><div class="writing-library-top"><label class="writing-library-search"><span class="sr-only">搜索英文或中文</span><input type="search" data-library-query aria-label="搜索英文或中文" placeholder="搜索英文或中文" value="'+this.e(this.state.query)+'"></label><div class="writing-library-scopes" aria-label="词语来源"></div></div><div class="writing-library-scroll"><div class="writing-library-target">当前造句目标： <strong lang="en">'+this.e(this.target.label||'')+'</strong></div><div data-library-stage></div></div><footer class="writing-library-footer"><div data-library-selected></div><button type="button" class="writing-library-done" data-library-action="return">选好了，回去造句</button><small>只作参考，不增加任务 · <a href="frequency-data-notice.html" target="_blank" rel="noopener">频率说明</a></small><p class="writing-library-notice" data-library-notice role="status" hidden></p><p class="writing-library-error" data-library-error role="status" hidden></p></footer></div></dialog></div>';
   this.drawScopes();if(this.state.open)this.drawResults();if(this.state.open||list(this.state.selectedByTarget[this.target.key]).length)this.drawSelected();this.updateError();
  }
  openDialog(persist=true){
   const dialog=this.container?.querySelector('[data-library-dialog]');if(!dialog)return;
   this.returnFocus=this.container.querySelector('[data-library-action="open"]');
   if(!dialog.open&&typeof dialog.showModal==='function')try{dialog.showModal();}catch(_){dialog.setAttribute('open','');}
   else dialog.setAttribute('open','');
   this.state.open=true;this.bank();this.drawResults();this.drawSelected();this.container.querySelector('[data-library-action="return"]')?.focus?.({preventScroll:true});
   if(persist||this.migrated){this.migrated=false;void this.save();}
  }
  closeDialog(persist=true){
   const dialog=this.container?.querySelector('[data-library-dialog]');if(!dialog)return;
   this.state.open=false;
   if(dialog.open&&typeof dialog.close==='function')try{dialog.close();}catch(_){}
   dialog.removeAttribute('open');
   this.returnFocus?.focus?.({preventScroll:true});
   if(persist||this.migrated){this.migrated=false;void this.save();}
  }
  sources(row){return list(row.sources?.length?row.sources:[row.source]).filter(source=>source&&Number.isInteger(source.book)&&Number.isInteger(source.number)&&(
   source.id===this.lesson.id||source.book<this.lesson.book||source.book===this.lesson.book&&source.number<this.lesson.number));}
  scopedSources(row){
   const sources=this.sources(row),book=this.state.book;
   if(book==='current')return sources.filter(source=>source.id===this.lesson.id);
   if(book==='history')return sources.filter(source=>source.book===this.lesson.book&&source.number<this.lesson.number);
   if(/^[1-4]$/.test(book))return sources.filter(source=>source.book===Number(book));
   return sources;
  }
  filtered(category=''){
   const api=this.options.library||root.StudyWritingLibrary;
   return list(api?.filter?.(this.bank(),{category,query:this.state.query})).filter(row=>this.scopedSources(row).length);
  }
  drawScopes(){
   const host=this.container?.querySelector('.writing-library-scopes');if(!host)return;
   const books=[...new Set(list(this.options.getLessons?.()).filter(row=>row.book<this.lesson.book).map(row=>row.book))].sort((a,b)=>a-b);
   const scopes=[['','全部'],...books.map(book=>[String(book),'第'+['','一','二','三','四'][book]+'册']),['history','第'+['','一','二','三','四'][this.lesson.book]+'册前课'],['current','本课']];
   host.innerHTML=scopes.map(([value,label])=>'<button type="button" data-library-scope="'+(value||'all')+'" aria-pressed="'+(this.state.book===value)+'">'+this.e(label)+'</button>').join('');
  }
  frequencyLabel(row){const rating=(this.options.frequency||root.StudyFrequencyReference)?.lookup?.(row.label,row.category==='phrase'?'phrase':'word');return rating?'，'+(rating.stars?'频率参考 '+rating.stars+'/3':'频率待统计'):'';}
  annotation(row){return '<span class="writing-library-annotation">'+this.pos(row)+this.frequency(row)+'</span>';}
  frequency(row){return (this.options.frequency||root.StudyFrequencyReference)?.badge?.(row.label,row.category==='phrase'?'phrase':'word')||'';}
  card(row){
   const e=this.e,chosen=list(this.state.selectedByTarget[this.target.key]).includes(row.key);
   const source=this.scopedSources(row)[0]||row.source;
   const location=source?.id===this.lesson.id?'本课':'第'+source?.book+'册 · 第'+source?.number+'课';
   return '<button type="button" class="writing-library-card" data-library-key="'+e(row.key)+'" aria-pressed="'+chosen+'" title="'+e(row.label+' · '+row.meaning)+'" aria-label="'+e(row.label+'，'+row.meaning)+e(this.frequencyLabel(row))+'"><strong class="writing-library-label" lang="en">'+e(row.label)+'</strong><span>'+e(row.meaning)+'</span><small class="writing-library-card-meta"><span>'+e(location)+'</span>'+this.frequency(row)+'</small></button>';
  }
  drawResults(){
   const host=this.container?.querySelector('[data-library-stage]');if(!host)return;
   const e=this.e,api=this.options.library||root.StudyWritingLibrary,query=this.state.query.trim(),category=this.state.category;
   if(query||category){
    const rows=this.filtered(query?'':category),size=20,pages=Math.max(1,Math.ceil(rows.length/size));this.state.page=Math.min(this.state.page,pages-1);
    host.innerHTML='<div class="writing-library-list-head"><button type="button" data-library-action="overview">‹ 全部分类</button><strong>'+(query?'搜索结果':e(categories[category]||'全部词语'))+' · '+rows.length+'</strong></div><div data-library-results>'+(rows.length?'<div class="writing-library-result-grid">'+rows.slice(this.state.page*size,(this.state.page+1)*size).map(row=>this.card(row)).join('')+'</div>':'<p class="writing-library-empty">这个范围暂无词条，可换来源或搜索词。</p>')+(pages>1?'<nav class="writing-library-pages" aria-label="词库分页"><button type="button" data-library-action="previous"'+(!this.state.page?' disabled':'')+'>上一页</button><span>'+(this.state.page+1)+' / '+pages+'</span><button type="button" data-library-action="next"'+(this.state.page>=pages-1?' disabled':'')+'>下一页</button></nav>':'')+'</div>';
    return;
   }
   const available=this.filtered(),recommend=list(api?.recommend?.(available,{target:this.target,count:2,rotation:this.state.rotation}));
   const recommendation=recommend.length?'<div class="writing-library-recommend"><strong>推荐搭配</strong><div class="writing-library-recommend-items">'+recommend.map(row=>'<button type="button" data-library-key="'+e(row.key)+'" aria-pressed="'+list(this.state.selectedByTarget[this.target.key]).includes(row.key)+'" title="'+e(row.label+' · '+row.meaning)+'"><b class="writing-library-label" lang="en">'+e(row.label)+'</b>'+this.annotation(row)+'<span class="writing-library-recommend-meaning">'+e(row.meaning)+'</span></button>').join('')+'</div><button type="button" data-library-action="rotate">⟳ 换一组</button></div>':'';
   const sections=ordered.map(name=>{const rows=available.filter(row=>row.category===name);if(!rows.length)return '';return '<section class="writing-library-section writing-library-section-'+name+'" data-library-section="'+name+'"><div class="writing-library-section-head"><h3>'+e(categories[name])+'</h3><button type="button" data-library-more="'+name+'">更多 ›</button></div><div class="writing-library-preview">'+rows.slice(0,4).map(row=>this.card(row)).join('')+'</div></section>';}).join('');
   host.innerHTML='<div data-library-overview>'+recommendation+'<div class="writing-library-overview-grid">'+(sections||'<p class="writing-library-empty">这个范围暂无词条，可换来源查看。</p>')+'</div></div>';
  }
  drawSelected(){
   const host=this.container?.querySelector('[data-library-selected]');if(!host)return;
   const rows=this.selected();host.innerHTML=rows.length?'<div class="writing-library-selected">'+rows.map(row=>'<button type="button" data-library-key="'+this.e(row.key)+'" title="'+this.e(row.label)+'" aria-label="移除 '+this.e(row.label)+this.e('，'+(posLabels[row.category]||text(row.pos).trim()||'词性未标注'))+this.e(this.frequencyLabel(row))+'"><span class="writing-library-label" lang="en">'+this.e(row.label)+'</span>'+this.annotation(row)+' ×</button>').join('')+'</div>':'<p class="writing-library-selected-empty">可选最多 4 个参考词</p>';
   const inline=this.container?.querySelector('[data-library-inline-selected]');
   if(inline){inline.innerHTML=rows.length?'<small>已选参考</small><div>'+rows.map(row=>'<span title="'+this.e(row.label+' · '+row.meaning)+'"><strong class="writing-library-label" lang="en">'+this.e(row.label)+'</strong>'+this.annotation(row)+'<span>'+this.e(row.meaning)+'</span></span>').join('')+'</div>':'';if(rows.length)inline.removeAttribute('hidden');else inline.setAttribute('hidden','');}
  }
  async click(event){
   const button=event.target?.closest?.('[data-library-key],[data-library-action],[data-library-scope],[data-library-more]');
   if(!button||!this.container?.contains(button)||button.disabled)return;
   const key=button.dataset.libraryKey;
   if(key){
    const selected=list(this.state.selectedByTarget[this.target.key]).slice(),at=selected.indexOf(key);
    if(at<0&&!this.bank().some(row=>row.key===key&&this.scopedSources(row).length))return;
    if(at>=0)selected.splice(at,1);else if(selected.length<4)selected.push(key);else{this.setNotice('先移除一个参考词，再选择新的。');this.options.toast?.('先移除一个参考词，再选择新的。');return;}this.setNotice('');
    this.state.selectedByTarget[this.target.key]=selected;this.drawResults();this.drawSelected();
    this.container.querySelector('[data-library-key="'+this.e(key)+'"]')?.focus?.({preventScroll:true});
    await this.save();return;
   }
   if(button.hasAttribute('data-library-scope')){this.state.book=button.dataset.libraryScope==='all'?'':button.dataset.libraryScope;this.state.page=0;this.drawScopes();this.drawResults();await this.save();return;}
   if(button.hasAttribute('data-library-more')){this.state.category=button.dataset.libraryMore;this.state.page=0;this.drawResults();this.container.querySelector('[data-library-action="overview"]')?.focus?.({preventScroll:true});await this.save();return;}
   const action=button.dataset.libraryAction;
   if(action==='open'){this.openDialog();return;}
   if(action==='return'){this.closeDialog();return;}
   if(action==='overview'){this.state.category='';this.state.query='';this.state.page=0;const field=this.container.querySelector('[data-library-query]');if(field)field.value='';this.drawResults();await this.save();return;}
   if(action==='rotate'){this.state.rotation++;this.drawResults();await this.save();return;}
   if(action==='previous'||action==='next'){this.state.page=Math.max(0,this.state.page+(action==='next'?1:-1));this.drawResults();await this.save();}
  }
 }
 return WritingWordLibrary;
});
