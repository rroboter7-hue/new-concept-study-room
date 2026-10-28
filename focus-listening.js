/* Exact-source sentence listening. Full-lesson recordings remain in StudyAudio. */
(function(global){
 'use strict';
 class FocusListeningEngine {
  constructor(options={}){this.options=options;this.rows=[];this.lessonId=null;this.index=0;this.loop=false;this.follow=false;this.playing=false;this.phase='idle';this.token=0;this.timer=null;this.utterance=null;}
  setLesson(lesson,rows){if(this.lessonId!==lesson?.id){this.stop();this.index=0;this.lessonId=lesson?.id||null;}this.rows=rows||[];this.index=Math.max(0,Math.min(this.index,this.rows.length-1));}
  changed(){this.options.onChange?.(this);}
  stop(){this.token++;if(this.timer!==null)global.clearTimeout(this.timer);this.timer=null;if(this.utterance)global.speechSynthesis?.cancel();this.utterance=null;this.playing=false;this.phase='idle';this.changed();}
  play(index=this.index){
   if(!Number.isInteger(index)||index<0||index>=this.rows.length)return false;
   this.stop();this.index=index;
   if(!global.speechSynthesis||!global.SpeechSynthesisUtterance){this.options.onError?.('当前设备没有可用的英语语音，请安装英语语音；整课音频仍可播放。');return false;}
   this.options.beforePlay?.();const token=++this.token;this.playing=true;
   const speak=()=>{
    if(token!==this.token)return;
    const u=new global.SpeechSynthesisUtterance(this.rows[this.index].en);
    u.lang=this.options.getVoice?.()||'en-GB';u.rate=Math.max(.5,Math.min(2,Number(this.options.getRate?.())||1));
    const voices=global.speechSynthesis.getVoices?.()||[];u.voice=voices.find(v=>v.lang.toLowerCase()===u.lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith('en'))||null;
    this.utterance=u;this.phase='loading';this.changed();
    this.timer=global.setTimeout(()=>{if(token===this.token){this.stop();this.options.onError?.('逐句语音未能启动，请确认设备已有英语语音后重试。');}},12000);
    u.onstart=()=>{if(token!==this.token)return;global.clearTimeout(this.timer);this.timer=null;this.phase='speaking';this.changed();};
    u.onend=()=>{
     if(token!==this.token)return;global.clearTimeout(this.timer);this.timer=null;this.utterance=null;
     if(!this.loop&&!this.follow){this.playing=false;this.phase='idle';this.changed();return;}
     this.phase=this.follow?'follow':'gap';this.changed();
     this.timer=global.setTimeout(()=>{if(token!==this.token)return;this.timer=null;if(this.loop)speak();else{this.playing=false;this.phase='idle';this.changed();}},this.follow?5000:700);
    };
    u.onerror=e=>{if(token!==this.token)return;this.stop();if(e.error!=='canceled'&&e.error!=='interrupted')this.options.onError?.('逐句朗读失败，请检查设备英语语音或播放整课音频。');};
    try{global.speechSynthesis.resume?.();global.speechSynthesis.speak(u);}catch{this.stop();this.options.onError?.('无法启动逐句语音，请检查浏览器英语语音设置。');}
   };speak();return this.playing;
  }
 }
 const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 class FocusListening {
  constructor(options){
   this.options=options;this.panel=null;this.open=false;this.lessonId=null;
   this.engine=new FocusListeningEngine({...options,onChange:()=>this.update(),onError:options.toast});
   this.click=event=>{const b=event.target.closest?.('[data-fl-action]');if(!b)return;const action=b.dataset.flAction;
    if(action==='notes'){this.stop();this.options.onNotes?.(Number(b.dataset.flIndex));return;}
    if(action==='pick'){this.open=true;this.engine.index=Number(b.dataset.flIndex);this.panel.open=true;this.engine.play(this.engine.index);this.panel.scrollIntoView?.({block:'nearest',behavior:'smooth'});}
    if(action==='play'){if(this.engine.playing)this.stop();else this.engine.play();}
    if(action==='prev'||action==='next'){const index=this.engine.index+(action==='prev'?-1:1);if(index<0||index>=this.engine.rows.length)return;this.engine.stop();this.engine.index=index;this.update();}
   };
   this.change=event=>{const input=event.target;if(input.dataset.flSetting==='loop')this.engine.loop=input.checked;if(input.dataset.flSetting==='follow')this.engine.follow=input.checked;};
   global.document.addEventListener('click',this.click);global.document.addEventListener('change',this.change);
   this.pagehide=()=>this.stop();global.addEventListener('pagehide',this.pagehide);
  }
  mount(root,lesson){
   const rows=global.StudyReading?.units(lesson)||[];
   if(!rows.length){this.engine.setLesson(lesson,rows);this.stop();this.panel?.remove();this.panel=null;this.lessonId=lesson?.id||null;return;}
   if(this.lessonId!==lesson.id){this.open=false;this.lessonId=lesson.id;}
   this.engine.setLesson(lesson,rows);
   root.querySelector('[data-focus-listening]')?.remove();
   const panel=global.document.createElement('details');panel.className='focus-listening';panel.dataset.focusListening='';panel.open=this.open;
   panel.innerHTML='<summary>单句精听与跟读<small>系统语音</small></summary><div class="fl-body"><p class="fl-source-note">逐句使用系统英语语音；教材整课音频在上方播放器。</p><p class="fl-counter"></p><p class="fl-sentence" lang="en"></p><div class="fl-actions"><button type="button" data-fl-action="prev" aria-label="上一句">上一句</button><button type="button" class="fl-play" data-fl-action="play">播放本句</button><button type="button" data-fl-action="next" aria-label="下一句">下一句</button></div><div class="fl-settings"><label><input type="checkbox" data-fl-setting="loop">循环本句</label><label><input type="checkbox" data-fl-setting="follow">留 5 秒跟读</label></div><p class="fl-status" role="status" aria-live="polite"></p></div>';
   panel.addEventListener('toggle',()=>{this.open=panel.open;if(!this.open)this.stop();});
   root.querySelector('.reading-layout')?.before(panel);this.panel=panel;
   panel.querySelector('[data-fl-setting="loop"]').checked=this.engine.loop;panel.querySelector('[data-fl-setting="follow"]').checked=this.engine.follow;
   root.querySelectorAll('.reading-pair').forEach(pair=>{
    if(pair.querySelector('.fl-row-actions'))return;const row=pair.querySelector('[data-sentence]');if(!row)return;const index=Number(row.dataset.sentence);
    const bar=global.document.createElement('div');bar.className='fl-row-actions';bar.innerHTML='<button type="button" data-fl-action="pick" data-fl-index="'+index+'" aria-label="精听第 '+(index+1)+' 句">精听</button><button type="button" data-fl-action="notes" data-fl-index="'+index+'" aria-label="从第 '+(index+1)+' 句查看本课笔记">看笔记</button>';pair.append(bar);
   });this.update();
  }
  update(){
   if(!this.panel?.isConnected)return;const a=this.engine,p=this.panel;
   p.querySelector('.fl-counter').textContent='第 '+(a.index+1)+' / '+a.rows.length+' 句';
   p.querySelector('.fl-sentence').textContent=a.rows[a.index]?.en||'';
   const play=p.querySelector('[data-fl-action="play"]');play.textContent=a.playing?'停止朗读':'播放本句';play.setAttribute('aria-pressed',String(a.playing));
   p.querySelector('[data-fl-action="prev"]').disabled=a.index<=0;p.querySelector('[data-fl-action="next"]').disabled=a.index>=a.rows.length-1;
   p.querySelector('.fl-status').textContent=({loading:'正在启动语音…',speaking:'正在朗读',follow:'轮到你了，留 5 秒跟读。',gap:'即将再次朗读',idle:'点击课文旁的“精听”可选择句子。'})[a.phase];
   const root=this.options.getRoot?.();root?.querySelectorAll('.reading-pair').forEach(pair=>{const r=pair.querySelector('[data-sentence]');pair.classList.toggle('fl-current',a.playing&&Number(r?.dataset.sentence)===a.index);});
  }
  stop(){this.engine.stop();}
  destroy(){this.stop();global.document.removeEventListener('click',this.click);global.document.removeEventListener('change',this.change);global.removeEventListener('pagehide',this.pagehide);}
 }
 global.FocusListeningEngine=FocusListeningEngine;global.FocusListening=FocusListening;
})(window);