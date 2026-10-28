/* Exact-source sentence listening. Full-lesson recordings remain in StudyAudio. */
(function(global){
 'use strict';
 class FocusListeningEngine {
  constructor(options={}){
   this.options=options;this.rows=[];this.lessonId=null;this.index=0;this.loop=false;this.follow=false;this.playing=false;this.phase='idle';this.token=0;this.timer=null;this.utterance=null;this.media=null;this.mediaListeners=[];this.useSpeech=false;this.pendingVoice=null;this.message='';this.voices=[];
   this.voicesChanged=()=>{this.refreshVoices();if(this.pendingVoice&&this.chooseVoice()){const start=this.pendingVoice;this.pendingVoice=null;this.clearTimer();start();}this.changed();};
   const synth=global.speechSynthesis;
   if(synth?.addEventListener)synth.addEventListener('voiceschanged',this.voicesChanged);
   else if(synth){this.previousVoicesChanged=synth.onvoiceschanged;this.voiceListener=event=>{this.previousVoicesChanged?.call(synth,event);this.voicesChanged();};synth.onvoiceschanged=this.voiceListener;}
   this.refreshVoices();
  }
  refreshVoices(){
   const synth=global.speechSynthesis;
   if(!synth||!global.SpeechSynthesisUtterance){this.voices=[];this.voiceStatus='unavailable';return;}
   try{this.voices=Array.from(synth.getVoices?.()||[]);}catch{this.voices=[];}
   this.voiceStatus=this.chooseVoice()?'ready':this.voices.length?'unavailable':'loading';
  }
  chooseVoice(){const english=this.voices.filter(v=>/^en(?:[-_]|$)/i.test(v.lang||'')),lang=(this.options.getVoice?.()||'en-GB').toLowerCase().replace(/_/g,'-');return english.find(v=>v.lang.toLowerCase().replace(/_/g,'-')===lang)||english[0]||null;}
  isSpeakable(index=this.index){return /[A-Za-z0-9]/.test(this.rows[index]?.en||'');}
  nextIndex(direction){for(let i=this.index+(direction<0?-1:1);i>=0&&i<this.rows.length;i+=direction<0?-1:1)if(this.isSpeakable(i))return i;return -1;}
  recording(index=this.index){
   // Each entry must be an actual sentence file, never an estimated section of a lesson.
   const clip=global.STUDY_SENTENCE_AUDIO?.[this.lessonId]?.[index];
   if(!this.isSpeakable(index)||!global.Audio||!clip||clip.en!==this.rows[index]?.en||typeof clip.src!=='string'||!clip.src.trim())return null;
   const src=clip.src.trim();
   if(/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src)){
    try{const url=new global.URL(src,global.location.href);if(url.origin!==global.location.origin||!/^https?:$/.test(url.protocol))return null;}catch{return null;}
   }
   return clip;
  }
  get availability(){
   if(!this.isSpeakable())return {status:'unavailable',source:'none',label:'非语言标点',canPlay:false,message:'本行只有标点，无需朗读。请选择相邻句子。'};
   const clip=!this.useSpeech&&this.recording();
   if(clip)return {status:'ready',source:'recorded',label:clip.source==='synthetic'?'逐句合成音频':'逐句录音',canPlay:true,message:clip.source==='synthetic'?'逐句合成音频已就绪 · 非原版录音':'逐句录音已就绪'};
   const supported=Boolean(global.speechSynthesis&&global.SpeechSynthesisUtterance),status=supported?this.voiceStatus:'unavailable';
   return {status,source:'speech',label:'系统语音',canPlay:supported,message:status==='ready'?'英语系统语音已就绪':status==='loading'?'正在加载设备英语语音…':supported?'设备尚无可用的英语语音；安装英语语音后可重试。':'此浏览器不支持系统语音，当前没有可用的单句音源。'};
  }
  setLesson(lesson,rows){if(this.lessonId!==lesson?.id){this.stop();this.index=0;this.lessonId=lesson?.id||null;}this.rows=rows||[];this.index=Math.max(0,Math.min(this.index,this.rows.length-1));this.refreshVoices();}
  changed(){this.options.onChange?.(this);}
  clearTimer(){if(this.timer!==null)global.clearTimeout(this.timer);this.timer=null;}
  releaseMedia(){const media=this.media;this.media=null;if(!media)return;this.mediaListeners.forEach(([name,callback])=>media.removeEventListener(name,callback));this.mediaListeners=[];media.pause();media.removeAttribute('src');media.load();}
  stop(){this.token++;this.clearTimer();this.pendingVoice=null;this.releaseMedia();const utterance=this.utterance;this.utterance=null;if(utterance){utterance.onstart=utterance.onend=utterance.onerror=null;global.speechSynthesis?.cancel();}this.playing=false;this.phase='idle';this.message='';this.changed();}
  fail(message,phase='error'){this.stop();this.phase=phase;this.message=message;this.changed();this.options.onError?.(message);return false;}
  finish(token){
   if(token!==this.token)return;this.clearTimer();
   if(!this.loop&&!this.follow){this.playing=false;this.phase='idle';this.changed();return;}
   this.phase=this.follow?'follow':'gap';this.changed();
   this.timer=global.setTimeout(()=>{if(token!==this.token)return;this.timer=null;if(this.loop)this.start(token);else{this.playing=false;this.phase='idle';this.changed();}},this.follow?5000:700);
  }
  start(token){if(token!==this.token)return;const clip=!this.useSpeech&&this.recording();if(clip)this.playRecording(token,clip);else this.speak(token);}
  playRecording(token,clip){
   let media;
   try{media=new global.Audio();}catch{this.fail('无法创建本句音频播放器，请重试或切换系统语音。');return;}
   this.media=media;this.phase='loading';media.preload='auto';media.playbackRate=Math.max(.5,Math.min(2,Number(this.options.getRate?.())||1));let started=false;
   const current=()=>token===this.token&&this.media===media;
   const start=()=>{if(!current())return;started=true;this.clearTimer();this.phase='speaking';this.changed();};
   const listen=(name,callback)=>{media.addEventListener(name,callback);this.mediaListeners.push([name,callback]);};
   listen('playing',start);
   listen('ended',()=>{if(!current())return;if(!started){this.fail('本句音频未能启动，请重试或切换系统语音。');return;}this.releaseMedia();this.finish(token);});
   listen('error',()=>{if(current())this.fail('本句音频加载失败，请检查网络后重试，或切换系统语音。');});
   this.timer=global.setTimeout(()=>{if(current())this.fail('本句音频未能启动，请检查网络后重试，或切换系统语音。');},12000);this.changed();
   try{
    media.src=clip.src;
    const result=media.play();
    if(result?.then)result.then(()=>{if(!current()){media.pause();return;}if(!media.paused)start();},error=>{if(current())this.fail(error?.name==='NotAllowedError'?'浏览器阻止了本句音频，请点击重试，并允许网站播放声音。':'本句音频无法播放，请重试或切换系统语音。');});
   }catch{if(current())this.fail('本句音频无法播放，请重试或切换系统语音。');}
  }
  speak(token){
   if(token!==this.token)return;
   const voice=this.chooseVoice();if(!voice){this.fail('设备没有可用的英语语音，请安装英语语音后重试；整课音频仍可播放。','unavailable');return;}
   const u=new global.SpeechSynthesisUtterance(this.rows[this.index].en);let started=false;
   u.lang=voice.lang;u.voice=voice;u.rate=Math.max(.5,Math.min(2,Number(this.options.getRate?.())||1));
   this.utterance=u;this.phase='loading';this.changed();
   const current=()=>token===this.token&&this.utterance===u;
   this.timer=global.setTimeout(()=>{if(current())this.fail('系统语音未能启动。请点击重试，并检查设备英语语音或浏览器声音权限；整课音频仍可播放。');},12000);
   u.onstart=()=>{if(!current())return;started=true;this.clearTimer();this.phase='speaking';this.changed();};
   u.onend=()=>{if(!current())return;if(!started){this.fail('系统语音未能启动，请点击重试或检查设备英语语音。');return;}this.utterance=null;this.finish(token);};
   u.onerror=event=>{
    if(!current())return;
    const messages={'not-allowed':'浏览器阻止了系统语音，请点击重试，并允许网站播放声音。','audio-busy':'音频设备正忙，请稍后重试。','audio-hardware':'音频设备不可用，请检查扬声器或耳机。','network':'系统语音服务连接失败，请检查网络后重试。','language-unavailable':'设备英语语音不可用，请安装英语语音后重试。','voice-unavailable':'所选英语语音不可用，请安装或切换英语语音后重试。','synthesis-unavailable':'设备语音服务不可用，请安装英语语音后重试。','text-too-long':'设备语音服务无法朗读本句全文，请使用本句音频。','interrupted':'系统语音被中断，请点击重试。','canceled':'系统语音被取消，请点击重试。'};
    this.fail(messages[event?.error]||'系统语音朗读失败，请检查设备英语语音后重试；整课音频仍可播放。');
   };
   try{global.speechSynthesis.resume?.();global.speechSynthesis.speak(u);}catch{this.fail('无法启动系统语音，请检查浏览器英语语音设置后重试。');}
  }
  play(index=this.index){
   if(!Number.isInteger(index)||index<0||index>=this.rows.length)return false;
   this.stop();this.index=index;
   if(!this.isSpeakable()){this.phase='unavailable';this.message=this.availability.message;this.changed();return false;}
   this.refreshVoices();
   const clip=!this.useSpeech&&this.recording();
   if(clip){this.options.beforePlay?.();const token=++this.token;this.playing=true;this.playRecording(token,clip);return this.playing;}
   if(!global.speechSynthesis||!global.SpeechSynthesisUtterance)return this.fail('此浏览器不支持系统语音，当前没有可用的单句音源；整课音频仍可播放。','unavailable');
   this.options.beforePlay?.();const token=++this.token;this.playing=true;
   if(this.chooseVoice())this.speak(token);
   else{
    this.phase='voices';this.pendingVoice=()=>{if(token===this.token)this.speak(token);};this.changed();
    this.timer=global.setTimeout(()=>{if(token!==this.token)return;this.timer=null;this.refreshVoices();if(this.chooseVoice()){const start=this.pendingVoice;this.pendingVoice=null;start?.();}else{this.voiceStatus='unavailable';this.fail('设备没有加载可用的英语语音。请安装英语语音后重试；整课音频仍可播放。','unavailable');}},6000);
   }
   return this.playing;
  }
  destroy(){this.stop();const synth=global.speechSynthesis;if(synth?.removeEventListener)synth.removeEventListener('voiceschanged',this.voicesChanged);else if(synth&&synth.onvoiceschanged===this.voiceListener)synth.onvoiceschanged=this.previousVoicesChanged||null;}
 }
 const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 class FocusListening {
  constructor(options){
   this.options=options;this.panel=null;this.open=false;this.lessonId=null;
   this.engine=new FocusListeningEngine({...options,onChange:()=>this.update(),onError:options.toast});
   this.click=event=>{const b=event.target.closest?.('[data-fl-action]');if(!b)return;const action=b.dataset.flAction;
    if(action==='notes'){this.stop();this.options.onNotes?.(b.dataset.flIndex===undefined?this.engine.index:Number(b.dataset.flIndex));return;}
    if(action==='pick'){this.open=true;this.engine.index=Number(b.dataset.flIndex);this.panel.open=true;this.engine.play(this.engine.index);this.panel.scrollIntoView?.({block:'nearest',behavior:'smooth'});}
    if(action==='play'){if(this.engine.playing)this.stop();else this.engine.play();}
    if(action==='source'){this.engine.stop();this.engine.useSpeech=!this.engine.useSpeech;this.engine.play();}
    if(action==='prev'||action==='next'){const index=this.engine.nextIndex(action==='prev'?-1:1);if(index<0)return;this.engine.stop();this.engine.index=index;this.update();}
   };
   this.change=event=>{const input=event.target;if(input.dataset.flSetting==='loop')this.engine.loop=input.checked;if(input.dataset.flSetting==='follow')this.engine.follow=input.checked;};
   global.document.addEventListener('click',this.click);global.document.addEventListener('change',this.change);
   this.pagehide=()=>this.stop();global.addEventListener('pagehide',this.pagehide);
   this.visibility=()=>{if(global.document.hidden)this.stop();};global.document.addEventListener('visibilitychange',this.visibility);
  }
  mount(root,lesson){
   const rows=global.StudyReading?.units(lesson)||[];
   if(!rows.length){this.engine.setLesson(lesson,rows);this.stop();this.panel?.remove();this.panel=null;this.lessonId=lesson?.id||null;return;}
   if(this.lessonId!==lesson.id){this.open=false;this.lessonId=lesson.id;}
   this.engine.setLesson(lesson,rows);
   root.querySelector('[data-focus-listening]')?.remove();
   const panel=global.document.createElement('details');panel.className='focus-listening';panel.dataset.focusListening='';panel.open=this.open;
   panel.innerHTML='<summary>单句精听<small class="fl-source-label"></small></summary><div class="fl-body"><p class="fl-source-note"></p><p class="fl-counter"></p><p class="fl-sentence" lang="en"></p><div class="fl-actions"><button type="button" data-fl-action="prev" aria-label="上一句">上一句</button><button type="button" class="fl-play" data-fl-action="play">播放本句</button><button type="button" data-fl-action="next" aria-label="下一句">下一句</button></div><button type="button" class="fl-notes" data-fl-action="notes">查看本句笔记</button><div class="fl-settings"><label><input type="checkbox" data-fl-setting="loop">循环本句</label><label><input type="checkbox" data-fl-setting="follow">播完后留 5 秒跟读</label><button type="button" class="fl-source-toggle" data-fl-action="source" hidden></button></div><p class="fl-status" role="status" aria-live="polite"></p></div>';
   panel.addEventListener('toggle',()=>{if(this.panel!==panel)return;this.open=panel.open;if(!this.open)this.stop();});
   root.querySelector('.reading-layout')?.before(panel);this.panel=panel;
   panel.querySelector('[data-fl-setting="loop"]').checked=this.engine.loop;panel.querySelector('[data-fl-setting="follow"]').checked=this.engine.follow;
   root.querySelectorAll('.reading-pair').forEach(pair=>{
    if(pair.querySelector('.fl-row-actions'))return;const row=pair.querySelector('[data-sentence]');if(!row)return;const index=Number(row.dataset.sentence);
    const bar=global.document.createElement('div');bar.className='fl-row-actions';bar.innerHTML='<button type="button" data-fl-action="pick" data-fl-index="'+index+'" aria-label="精听第 '+(index+1)+' 句">听这一句</button>';pair.append(bar);
   });this.update();
  }
  update(){
   if(!this.panel?.isConnected)return;const a=this.engine,p=this.panel,availability=a.availability;
   p.dataset.state=a.phase==='error'||a.phase==='unavailable'?a.phase:availability.status;
   p.querySelector('.fl-source-label').textContent=availability.label;
   p.querySelector('.fl-source-note').textContent=availability.label+(availability.source==='recorded'&&a.recording()?.source==='synthetic'?' · 非原版录音':'')+(global.document?.body?.classList?.contains('learning-pipeline-active')?' · 整课音频使用上方播放按钮':' · 整课音频见底部播放器');
   p.querySelector('.fl-counter').textContent='第 '+(a.index+1)+' / '+a.rows.length+' 句';
   p.querySelector('.fl-sentence').textContent=a.rows[a.index]?.en||'';
   const play=p.querySelector('[data-fl-action="play"]');play.textContent=a.playing?'停止播放':!availability.canPlay?'单句音源不可用':a.phase==='error'||a.phase==='unavailable'?'重试本句':'播放本句';play.disabled=!availability.canPlay;play.setAttribute('aria-pressed',String(a.playing));
   ['loop','follow'].forEach(name=>{p.querySelector('[data-fl-setting="'+name+'"]').disabled=!availability.canPlay;});
   const source=p.querySelector('.fl-source-toggle');source.hidden=!(a.recording()&&global.speechSynthesis&&global.SpeechSynthesisUtterance);source.textContent=a.useSpeech?'改用逐句音频':'改用系统语音';
   p.querySelector('[data-fl-action="prev"]').disabled=a.nextIndex(-1)<0;p.querySelector('[data-fl-action="next"]').disabled=a.nextIndex(1)<0;
   p.querySelector('.fl-status').textContent=a.message||({voices:'正在加载设备英语语音…',loading:availability.source==='recorded'?'正在加载本句音频…':'正在启动系统语音…',speaking:'正在播放本句',follow:'轮到你了，留 5 秒跟读。',gap:'即将再次播放本句',idle:availability.message})[a.phase]||availability.message;
   const root=this.options.getRoot?.();root?.querySelectorAll('.reading-pair').forEach(pair=>{const r=pair.querySelector('[data-sentence]'),index=Number(r?.dataset.sentence);pair.classList.toggle('fl-current',a.playing&&index===a.index);const pick=pair.querySelector('[data-fl-action="pick"]');if(pick)pick.disabled=!a.isSpeakable(index)||!(a.recording(index)||global.speechSynthesis&&global.SpeechSynthesisUtterance);});
  }
  stop(){this.engine.stop();}
  destroy(){this.engine.destroy();global.document.removeEventListener('click',this.click);global.document.removeEventListener('change',this.change);global.document.removeEventListener('visibilitychange',this.visibility);global.removeEventListener('pagehide',this.pagehide);}
 }
 global.FocusListeningEngine=FocusListeningEngine;global.FocusListening=FocusListening;
})(window);
