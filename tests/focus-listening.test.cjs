const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(){
 const spoken=[],timers=new Map();let serial=0,paused=0;
 const w={speechSynthesis:{cancel(){},getVoices:()=>[],speak(u){spoken.push(u);u.onstart?.();}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../focus-listening.js'),'utf8'),{window:w});
 const engine=new w.FocusListeningEngine({beforePlay(){paused++;},getVoice:()=> 'en-GB',getRate:()=>.75});
 return {engine,spoken,timers,get paused(){return paused;},tick(){const entry=[...timers][0];assert(entry);timers.delete(entry[0]);entry[1]();}};
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
test('yielding lesson TTS preserves cursor while invalidating paused utterance callbacks', async()=>{
 const w={speechSynthesis:{cancel(){},pause(){},resume(){},getVoices:()=>[],speak(u){this.last=u;u.onstart();}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},performance:{now:()=>100},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../audio.js'),'utf8'),{window:w});
 const audio=new w.StudyAudio();audio.setLesson({id:'a',paragraphs:[{en:'First. Second.'}]});await audio.play();
 const old=w.speechSynthesis.last;audio.pauseForSentence();const index=audio.state.sentenceIndex;old.onend();assert.equal(audio.state.sentenceIndex,index);assert.equal(audio.state.playing,false);await audio.play();assert.equal(w.speechSynthesis.last.text,'First.');
});
