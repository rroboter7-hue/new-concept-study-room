const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(options={}){
 const spoken=[],timers=new Map();let serial=0,paused=0;
 const listeners=new Map(),errors=[];let voices=options.voices||[{lang:'en-GB',name:'English',voiceURI:'English',localService:true,default:true}];
 const w={speechSynthesis:{paused:false,cancel(){},resume(){this.paused=false;},getVoices:()=>voices,addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},speak(u){spoken.push(u);if(options.starts!==false)u.onstart?.();}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../focus-listening.js'),'utf8'),{window:w});
 const engine=new w.FocusListeningEngine({beforePlay(){paused++;},getVoice:()=> 'en-GB',getRate:()=>.75,onError:message=>errors.push(message)});
 return {engine,w,spoken,timers,errors,listeners,get paused(){return paused;},setVoices(next){voices=next;listeners.get('voiceschanged')?.();},tick(){const entry=[...timers][0];assert(entry);timers.delete(entry[0]);entry[1].fn();}};
}
test('single sentence uses exact source and settings, pausing full lesson audio',()=>{
 const h=setup();h.engine.setLesson({id:'a'},[{en:'I was angry.'},{en:'I turned round.'}]);h.engine.play(1);
 assert.equal(h.paused,1);assert.equal(h.spoken[0].text,'I turned round.');assert.equal(h.spoken[0].rate,.75);assert.equal(h.spoken[0].lang,'en-GB');
 h.spoken[0].onend();assert.equal(h.engine.playing,false);assert.equal(h.spoken.length,1);
});
test('loop repeats selected sentence; stale completions cannot play after lesson change',()=>{
 const h=setup();h.engine.setLesson({id:'a'},[{en:'First.'},{en:'Second.'}]);h.engine.loop=true;h.engine.play(1);h.spoken[0].onend();h.tick();assert.equal(h.spoken[1].text,'Second.');
 const stale=h.spoken[1].onend;h.engine.setLesson({id:'b'},[{en:'New lesson.'}]);stale();assert.equal(h.timers.size,0);assert.equal(h.engine.playing,false);
});
test('follow mode leaves gap; stopping cancels replay; out of range is rejected',()=>{
 const h=setup();h.engine.setLesson({id:'a'},[{en:'Say it.'}]);h.engine.follow=true;h.engine.loop=true;h.engine.play(0);h.spoken[0].onend();assert.equal(h.engine.phase,'follow');h.engine.stop();assert.equal(h.timers.size,0);assert.equal(h.engine.play(7),false);
});
test('unavailable speech reports useful error without false playing state',()=>{
 const w={setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../focus-listening.js'),'utf8'),{window:w});let error='';const e=new w.FocusListeningEngine({onError:x=>error=x});e.setLesson({id:'a'},[{en:'Hello.'}]);assert.equal(e.play(0),false);assert.match(error,/语音/);assert.equal(e.playing,false);
});
test('a click waits for real English voices, then starts the exact sentence when voiceschanged fires',()=>{
 const h=setup({voices:[]});h.engine.setLesson({id:'a'},[{en:'Please listen to this sentence.'}]);h.engine.play();
 assert.equal(h.spoken.length,0);assert.equal(h.engine.phase,'voices');assert.equal(h.engine.availability.status,'loading');
 h.setVoices([{lang:'zh-CN',name:'Chinese'},{lang:'en_US',name:'English US'}]);
 assert.equal(h.spoken.length,1);assert.equal(h.spoken[0].text,'Please listen to this sentence.');assert.equal(h.spoken[0].voice.name,'English US');assert.equal(h.engine.phase,'speaking');assert.equal(h.engine.availability.status,'ready');
});
test('stopping a pending voice request prevents later voiceschanged from starting an old sentence',()=>{
 const h=setup({voices:[]});h.engine.setLesson({id:'a'},[{en:'Old sentence.'}]);h.engine.play();h.engine.stop();h.setVoices([{lang:'en-GB',name:'English'}]);
 assert.equal(h.spoken.length,0);assert.equal(h.engine.playing,false);assert.equal(h.timers.size,0);
});
test('missing English voices remain visibly unavailable and a later installed voice can be retried',()=>{
 const h=setup({voices:[{lang:'zh-CN',name:'Chinese'}]});h.engine.setLesson({id:'a'},[{en:'Hello.'}]);h.engine.play();
 assert.equal(h.spoken.length,0);h.tick();assert.equal(h.engine.phase,'unavailable');assert.equal(h.engine.playing,false);assert.equal(h.engine.availability.status,'unavailable');assert.match(h.engine.message,/英语语音/);
 h.setVoices([{lang:'en-GB',name:'English'}]);assert.equal(h.engine.play(),true);assert.equal(h.spoken.length,1);
});
test('a silent speech service times out with persistent state and never enters the follow gap',()=>{
 const h=setup({starts:false});h.engine.setLesson({id:'a'},[{en:'Hello.'}]);h.engine.follow=true;h.engine.play();h.tick();
 assert.equal(h.engine.phase,'error');assert.equal(h.engine.playing,false);assert.match(h.engine.message,/启动/);assert.equal(h.errors.length,1);assert.equal(h.timers.size,0);
});
test('an onend without audible start cannot pretend a sentence has finished or enter follow mode',()=>{
 const h=setup({starts:false});h.engine.setLesson({id:'a'},[{en:'Hello.'}]);h.engine.follow=true;h.engine.play();h.spoken[0].onend();
 assert.equal(h.engine.phase,'error');assert.equal(h.engine.playing,false);assert.equal(h.timers.size,0);assert.match(h.engine.message,/启动/);
});
test('paused speech resumes before playback and a 437 character sentence is never truncated',()=>{
 const h=setup();const sentence='A'.repeat(436)+'.';h.w.speechSynthesis.paused=true;h.engine.setLesson({id:'a'},[{en:sentence}]);h.engine.play();
 assert.equal(h.w.speechSynthesis.paused,false);assert.equal(h.spoken[0].text,sentence);assert.equal(h.spoken[0].text.length,437);
});
test('an active speech error is persistent while a canceled old callback cannot affect a new lesson',()=>{
 const h=setup();h.engine.setLesson({id:'a'},[{en:'Hello.'}]);h.engine.play();const stale=h.spoken[0].onerror;stale({error:'not-allowed'});
 assert.equal(h.engine.phase,'error');assert.match(h.engine.message,/阻止/);h.engine.setLesson({id:'b'},[{en:'New lesson.'}]);h.engine.play();stale({error:'canceled'});assert.equal(h.engine.phase,'speaking');
});
function recordedSetup({reject=false}={}){
 const h=setup(),media=[];
 h.w.Audio=class{
  constructor(){this.paused=true;this.listeners=new Map();media.push(this);}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  removeEventListener(name,fn){if(this.listeners.get(name)===fn)this.listeners.delete(name);}
  play(){if(reject)return Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'}));this.paused=false;this.listeners.get('playing')?.();return Promise.resolve();}
  pause(){this.paused=true;}
  removeAttribute(name){if(name==='src')this.src='';}
  load(){}
  emit(name){this.listeners.get(name)?.();}
 };
 h.w.STUDY_SENTENCE_AUDIO={a:[{en:'First sentence.',src:'audio/sentences/a-0.mp3'},{en:'Second sentence.',src:'audio/sentences/a-1.mp3'}]};
 h.engine.setLesson({id:'a'},[{en:'First sentence.'},{en:'Second sentence.'}]);return {...h,media};
}
test('verified sentence recordings play without a system speech service and preserve playback rate',async()=>{
 const h=recordedSetup();delete h.w.speechSynthesis;delete h.w.SpeechSynthesisUtterance;
 assert.equal(h.engine.availability.source,'recorded');assert.equal(h.engine.availability.status,'ready');assert.equal(h.engine.play(1),true);await Promise.resolve();
 assert.equal(h.media[0].src,'audio/sentences/a-1.mp3');assert.equal(h.media[0].playbackRate,.75);assert.equal(h.engine.phase,'speaking');assert.equal(h.spoken.length,0);
 h.media[0].emit('ended');assert.equal(h.engine.playing,false);assert.equal(h.engine.phase,'idle');
});
test('recording maps with wrong source text cannot substitute unrelated or whole lesson audio',()=>{
 const h=recordedSetup();h.w.STUDY_SENTENCE_AUDIO.a[0]={en:'An entire lesson.',src:'audio/whole-lesson.mp3'};h.engine.play(0);
 assert.equal(h.media.length,0);assert.equal(h.spoken[0].text,'First sentence.');assert.equal(h.engine.availability.source,'speech');
});
test('recorded sentence completion starts the real follow gap and loop; stopping cancels the recording',()=>{
 const h=recordedSetup();h.engine.follow=true;h.engine.loop=true;h.engine.play();h.media[0].emit('ended');assert.equal(h.engine.phase,'follow');h.tick();assert.equal(h.media[1].src,'audio/sentences/a-0.mp3');
 const stale=h.media[1].listeners.get('ended');h.engine.setLesson({id:'b'},[{en:'New lesson.'}]);stale();assert.equal(h.media[1].paused,true);assert.equal(h.timers.size,0);assert.equal(h.engine.playing,false);
});
test('a blocked recorded sentence reports persistent audio error and offers a retry',async()=>{
 const h=recordedSetup({reject:true});h.engine.play();await Promise.resolve();await Promise.resolve();
 assert.equal(h.engine.playing,false);assert.equal(h.engine.phase,'error');assert.match(h.engine.message,/阻止/);assert.equal(h.engine.availability.canPlay,true);
});
test('a delayed play resolution after stop cannot restart or relabel the old sentence',async()=>{
 const h=recordedSetup();let resolve;h.w.Audio.prototype.play=function(){return new Promise(r=>{resolve=r;});};h.engine.play();const old=h.media[0];h.engine.stop();old.paused=false;resolve();await Promise.resolve();
 assert.equal(old.paused,true);assert.equal(h.engine.playing,false);assert.equal(h.engine.phase,'idle');assert.equal(h.timers.size,0);
});
function listeningUI(h){
 const events=new Map(),nodes=new Map();
 h.w.document={hidden:false,addEventListener(name,fn){events.set(name,fn);},removeEventListener(name,fn){if(events.get(name)===fn)events.delete(name);}};h.w.addEventListener=(name,fn)=>events.set(name,fn);h.w.removeEventListener=(name,fn)=>{if(events.get(name)===fn)events.delete(name);};
 const root={querySelectorAll:()=>[]},ui=new h.w.FocusListening({getRoot:()=>root});ui.engine.destroy();ui.engine=h.engine;h.engine.options.onChange=()=>ui.update();
 ui.panel={isConnected:true,dataset:{},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',disabled:false,hidden:false,setAttribute(){}});return nodes.get(selector);}};
 for(const selector of ['.fl-source-note','.fl-source-toggle','[data-fl-setting="follow"]'])ui.panel.querySelector(selector);
 return {ui,nodes,events};
}
test('the panel identifies synthetic sentence audio, keeps an error visible and offers a retry',()=>{
 const h=recordedSetup(),{ui,nodes}=listeningUI(h);h.w.STUDY_SENTENCE_AUDIO.a[0].source='synthetic';ui.update();
 assert.match(nodes.get('.fl-source-note').textContent,/逐句合成音频/);assert.match(nodes.get('.fl-source-note').textContent,/非原版录音/);
 h.engine.fail('本句音频加载失败。');assert.equal(nodes.get('.fl-status').textContent,'本句音频加载失败。');assert.match(nodes.get('[data-fl-action="play"]').textContent,/重试/);assert.equal(nodes.get('[data-fl-action="play"]').disabled,false);
});
test('switching from a recording to system speech stops the file before starting the same exact sentence',()=>{
 const h=recordedSetup(),{ui,nodes}=listeningUI(h);h.engine.play();ui.click({target:{closest:()=>({dataset:{flAction:'source'}})}});
 assert.equal(h.media[0].paused,true);assert.equal(h.spoken[0].text,'First sentence.');assert.equal(h.engine.availability.source,'speech');assert.match(nodes.get('.fl-source-toggle').textContent,/逐句音频/);
});
test('an unsupported browser with no recording has disabled sentence playback and a persistent explanation',()=>{
 const h=recordedSetup(),{ui,nodes}=listeningUI(h);delete h.w.STUDY_SENTENCE_AUDIO;delete h.w.speechSynthesis;delete h.w.SpeechSynthesisUtterance;h.engine.refreshVoices();ui.update();
 assert.equal(nodes.get('[data-fl-action="play"]').disabled,true);assert.equal(nodes.get('[data-fl-setting="follow"]').disabled,true);assert.match(nodes.get('.fl-status').textContent,/没有可用的单句音源/);
});
test('leaving the page stops current sentence media and removes page listeners on destruction',()=>{
 const h=recordedSetup(),{ui,events}=listeningUI(h);h.engine.play();h.w.document.hidden=true;assert.equal(typeof events.get('visibilitychange'),'function');events.get('visibilitychange')();
 assert.equal(h.media[0].paused,true);assert.equal(h.engine.playing,false);ui.destroy();assert.equal(events.size,0);
});
test('punctuation-only units keep their reading index but cannot speak and are skipped by sentence navigation',()=>{
 const h=setup();h.engine.setLesson({id:'a'},[{en:'First.'},{en:'. .'},{en:'Third.'}]);assert.equal(h.engine.nextIndex(1),2);assert.equal(h.engine.play(1),false);assert.equal(h.spoken.length,0);assert.equal(h.engine.availability.canPlay,false);assert.equal(h.engine.rows[1].en,'. .');h.engine.index=2;assert.equal(h.engine.nextIndex(-1),0);
});
test('yielding lesson TTS preserves cursor while invalidating paused utterance callbacks', async()=>{
 const w={speechSynthesis:{cancel(){},pause(){},resume(){},getVoices:()=>[],speak(u){this.last=u;u.onstart();}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},performance:{now:()=>100},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../audio.js'),'utf8'),{window:w});
 const audio=new w.StudyAudio();audio.setLesson({id:'a',paragraphs:[{en:'First. Second.'}]});await audio.play();
 const old=w.speechSynthesis.last;audio.pauseForSentence();const index=audio.state.sentenceIndex;old.onend();assert.equal(audio.state.sentenceIndex,index);assert.equal(audio.state.playing,false);await audio.play();assert.equal(w.speechSynthesis.last.text,'First.');
});
