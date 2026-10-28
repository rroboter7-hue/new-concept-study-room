/* Optional reference library: never inserts answers or creates writing goals. */
(function(root,factory){
 'use strict';const UI=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=UI;else root.WritingWordLibrary=UI;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const list=x=>Array.isArray(x)?x:[],plain=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
 const clone=x=>JSON.parse(JSON.stringify(x)),text=x=>typeof x==='string'?x:'';
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const categories={verb:'动词',adjective:'形容词',noun:'名词',adverb:'副词',phrase:'习惯用法',word:'其他词'};
 class WritingWordLibrary{
  constructor(options={}){this.options=options;this.e=options.escapeHTML||escape;this.bindings=[];this.contexts=new Map();this.generation=0;}
  cleanState(raw){
   raw=plain(raw);const selections={};
   for(const [key,values] of Object.entries(plain(raw.selectedByTarget)).slice(-300))if(/^(word|phrase):/.test(key)&&key.length<=600)selections[key]=[...new Set(list(values).filter(x=>typeof x==='string'&&x.length<=600))].slice(0,4);
   return {version:1,open:raw.open===true,manual:raw.manual===true,book:/^[1-4]$/.test(String(raw.book))?String(raw.book):'',category:Object.hasOwn(categories,raw.category)?raw.category:'',query:text(raw.query).slice(0,100),rotation:Number.isSafeInteger(raw.rotation)&&raw.rotation>=0?raw.rotation:0,page:Number.isSafeInteger(raw.page)&&raw.page>=0?raw.page:0,selectedByTarget:selections};
  }
  mount(container,context){
   this.detach();if(!container||!context?.lesson||!context?.target)return;
   this.container=container;this.lesson=context.lesson;this.target=context.target;this.generation++;
   let current=this.contexts.get(this.lesson.id);
   if(!current){current=this.cleanState(this.options.getState?.(this.lesson));this.contexts.set(this.lesson.id,current);}
   this.state=current;this.entries=null;this.error='';this.draw();
   const on=(name,fn,capture=false)=>{container.addEventListener(name,fn,capture);this.bindings.push(()=>container.removeEventListener(name,fn,capture));};
   on('click',event=>{void this.click(event);});on('change',event=>{void this.change(event);});
   on('input',event=>{if(event.target?.hasAttribute?.('data-library-query')){this.state.query=event.target.value.slice(0,100);this.state.page=0;this.drawResults();void this.save();}});
   on('toggle',event=>{if(event.target?.hasAttribute?.('data-library-disclosure')){this.state.open=event.target.open===true;if(this.state.open)this.drawBody();void this.save();}},true);
  }
  detach(){this.bindings.forEach(fn=>fn());this.bindings=[];this.container=null;this.generation++;}
  reloadFromStorage(){this.detach();this.contexts.clear();}
  bank(){if(!this.entries)this.entries=list(this.options.getEntries?.(this.lesson));return this.entries;}
  selected(){const keys=list(this.state.selectedByTarget[this.target.key]);return this.bank().filter(row=>keys.includes(row.key));}
  async save(){
   const lesson=this.lesson,state=clone(this.state),generation=this.generation,revision=this.saveRevision=(this.saveRevision||0)+1;
   try{if(typeof this.options.saveState==='function'&&await this.options.saveState(lesson,state)===false)throw Error('Save failed');if(generation===this.generation&&revision===this.saveRevision){this.error='';this.updateError();}return true;}
   catch(_){if(generation===this.generation&&revision===this.saveRevision){this.error='参考选择暂未保存，请稍后重试；造句内容仍由原编辑器保存。';this.updateError();}return false;}
  }
  updateError(){const node=this.container?.querySelector('[data-library-error]');if(node){node.textContent=this.error;node.hidden=!this.error;}}
  draw(){
   if(!this.container)return;const e=this.e;
   this.container.innerHTML='<details class="writing-library" data-library-disclosure'+(this.state.open?' open':'')+'><summary>造句词库 · 推荐搭配</summary><div data-library-body></div></details><p class="writing-library-error" data-library-error role="status" hidden></p>';
   if(this.state.open)this.drawBody();
   this.updateError();
  }
  drawBody(){
   const body=this.container?.querySelector('[data-library-body]');if(!body)return;
   const e=this.e,books=[...new Set([this.lesson.book,...list(this.options.getLessons?.()).filter(source=>Number.isInteger(source.book)&&source.book<this.lesson.book).map(source=>source.book)])].sort();
   if(this.state.book&&!books.includes(Number(this.state.book)))this.state.book='';
   body.innerHTML='<p class="writing-library-note">先选想融合的词；最多4个，仅作参考，不增加造句任务。</p><details class="writing-library-browse"'+(this.state.manual||this.state.book||this.state.category||this.state.query?' open':'')+'><summary>按册数、词性选词</summary><div class="writing-library-filters"><label>来源<select data-library-book aria-label="词库册数"><option value="">全部已学与本课</option>'+books.map(book=>'<option value="'+book+'"'+(this.state.book===String(book)?' selected':'')+'>第'+book+'册</option>').join('')+'</select></label><label>分类<select data-library-category aria-label="词库分类"><option value="">全部词类</option>'+Object.entries(categories).map(([key,label])=>'<option value="'+key+'"'+(this.state.category===key?' selected':'')+'>'+label+'</option>').join('')+'</select></label></div><label class="writing-library-search">查找词语<input type="search" data-library-query aria-label="查找词语" value="'+e(this.state.query)+'" placeholder="英文或中文"></label></details><div class="writing-library-toolbar"><strong data-library-result-label>推荐搭配</strong><div class="writing-library-mode-actions"><button type="button" data-library-action="rotate">换一组</button><button type="button" data-library-action="manual">手动选词</button></div></div><div data-library-results></div><div data-library-selected></div>'+this.rangeHTML();
   this.drawResults();this.drawSelected();
  }
  filtered(){const api=this.options.library||root.StudyWritingLibrary;return list(api?.filter?.(this.bank(),{book:this.state.book,category:this.state.category,query:this.state.query}));}
  drawResults(){
   const host=this.container?.querySelector('[data-library-results]');if(!host)return;
   const e=this.e,api=this.options.library||root.StudyWritingLibrary,filtered=this.filtered(),browsing=!!(this.state.manual||this.state.book||this.state.category||this.state.query),size=8;
   const pages=Math.max(1,Math.ceil(filtered.length/size));this.state.page=Math.min(this.state.page,pages-1);
   const rows=browsing?filtered.slice(this.state.page*size,(this.state.page+1)*size):list(api?.recommend?.(filtered,{target:this.target,count:6,rotation:this.state.rotation}));
   const label=this.container.querySelector('[data-library-result-label]');if(label)label.textContent=browsing?'找到 '+filtered.length+' 项':'推荐搭配';
   host.innerHTML=rows.length?'<div class="writing-library-cards">'+rows.map(row=>this.card(row)).join('')+'</div>':'<p class="writing-library-note">这个范围暂无合适词条。可换分类，或在下方补充已学范围。</p>';
   if(browsing&&pages>1)host.insertAdjacentHTML('beforeend','<nav class="writing-library-pages" aria-label="词库分页"><button type="button" data-library-action="previous"'+(!this.state.page?' disabled':'')+'>上一页</button><span>'+e(this.state.page+1)+' / '+pages+'</span><button type="button" data-library-action="next"'+(this.state.page>=pages-1?' disabled':'')+'>下一页</button></nav>');
  }
  card(row){
   const e=this.e,chosen=list(this.state.selectedByTarget[this.target.key]).includes(row.key),sources=list(row.sources?.length?row.sources:[row.source]);
   const source=sources.find(x=>!this.state.book||String(x.book)===this.state.book)||row.source;
   const location=source?.id===this.lesson.id?'本课':'第'+source?.book+'册 · 第'+source?.number+'课';
   return '<button type="button" class="writing-library-card" data-library-key="'+e(row.key)+'" aria-pressed="'+chosen+'"><span lang="en">'+e(row.label)+'</span><span>'+e(row.meaning)+'</span><small>'+e(categories[row.category]||'词语')+' · '+e(location)+(chosen?' · 已选':'')+'</small></button>';
  }
  drawSelected(){
   const host=this.container?.querySelector('[data-library-selected]');if(!host)return;const e=this.e,rows=this.selected();
   host.innerHTML=rows.length?'<div class="writing-library-selected"><strong>这组可融合</strong><div>'+rows.map(row=>'<button type="button" data-library-key="'+e(row.key)+'" aria-label="移除 '+e(row.label)+'">'+e(row.label)+' ×</button>').join('')+'</div>'+rows.filter(row=>row.example).map(row=>'<details><summary>'+e(row.label)+' · 看已有例句</summary><p lang="en">'+e(row.example)+'</p><small>来源资料例句，可按自己的意思造句。</small></details>').join('')+'</div>':'';
  }
  rangeHTML(){
   const e=this.e,range=plain(this.options.getLearningRange?.()),books=plain(range.books),lessons=list(this.options.getLessons?.());
   const byBook=new Map();for(const lesson of lessons){if(!(lesson.book<this.lesson.book||lesson.book===this.lesson.book&&lesson.number<this.lesson.number))continue;const values=byBook.get(lesson.book)||new Set();values.add(lesson.number);byBook.set(lesson.book,values);}
   return '<details class="writing-library-range"><summary>补充已学范围</summary><p>在别处学过的课也可选入；只影响推荐，不会标记完成或掌握。</p>'+[...byBook.entries()].sort((a,b)=>a[0]-b[0]).map(([book,values])=>'<label>第'+book+'册已学至<select data-library-range="'+book+'" aria-label="第'+book+'册已学范围"><option value="0">未设置</option>'+[...values].sort((a,b)=>a-b).map(number=>'<option value="'+number+'"'+(Number(books[book])===number?' selected':'')+'>第'+number+'课</option>').join('')+'</select></label>').join('')+'</details>';
  }
  async click(event){
   const button=event.target?.closest?.('[data-library-key],[data-library-action]');if(!button||!this.container?.contains(button)||button.disabled)return;
   const key=button.dataset.libraryKey;
   if(key){if(!this.bank().some(row=>row.key===key))return;const selected=list(this.state.selectedByTarget[this.target.key]).slice(),at=selected.indexOf(key);
    if(at>=0)selected.splice(at,1);else if(selected.length<4)selected.push(key);else{this.options.toast?.('先移除一个参考词，再选择新的。');return;}
    this.state.selectedByTarget[this.target.key]=selected;this.drawResults();this.drawSelected();
    const next=[...this.container.querySelectorAll('[data-library-key]')].find(node=>node.dataset.libraryKey===key);(next||this.container.querySelector('summary'))?.focus?.({preventScroll:true});
    await this.save();return;
   }
   const action=button.dataset.libraryAction;
   if(action==='manual'){this.state.manual=true;this.state.page=0;this.drawBody();this.container.querySelector('[data-library-book]')?.focus?.({preventScroll:true});}
   if(action==='rotate'){this.state.manual=false;this.state.book='';this.state.category='';this.state.query='';this.state.page=0;this.state.rotation++;this.drawBody();}
   if(action==='previous'){this.state.page=Math.max(0,this.state.page-1);this.drawResults();}
   if(action==='next'){this.state.page++;this.drawResults();}
   await this.save();
  }
  async change(event){
   const field=event.target;if(!this.container?.contains(field))return;
   if(field.hasAttribute('data-library-range')){
    const range=clone(this.options.getLearningRange?.()||{version:1,books:{}});range.books=plain(range.books);const previous=range.books[field.dataset.libraryRange]||0;range.books[field.dataset.libraryRange]=Number(field.value)||0;
    try{if(typeof this.options.saveLearningRange!=='function'||await this.options.saveLearningRange(range)!==true)throw Error('Range not saved');this.entries=null;this.drawBody();}
    catch(_){field.value=String(previous);this.options.toast?.('已学范围未保存，请重试。');}return;
   }
   if(field.hasAttribute('data-library-book'))this.state.book=field.value;
   else if(field.hasAttribute('data-library-category'))this.state.category=field.value;else return;
   this.state.manual=true;this.state.page=0;this.drawResults();await this.save();
  }
 }
 return WritingWordLibrary;
});
