const test=require('node:test'),assert=require('node:assert/strict');
const Pipeline=require('../learning-pipeline.js');
function setup(){const lesson={id:'audio-lesson',book:2,number:2,title:'Audio'},state={lessonId:'audio-lesson',duration:80,currentTime:12,canSeek:true,mode:'audio'},calls=[];const ui=new Pipeline({getLesson:()=>lesson,getState:()=>({}),saveState:()=>true,getAudioState:()=>state,seekLessonAudio:(fraction,l)=>calls.push([fraction,l.id])});ui.lesson=lesson;return {ui,state,calls};}
test('reading audio controls seek by fraction and rewind five seconds with bounds',()=>{const {ui,state,calls}=setup();assert.match(ui.readingHTML(),/data-pipeline-audio-seek/);assert.match(ui.readingHTML(),/回退5秒/);assert.equal(ui.seekAudio(500),true);assert.deepEqual(calls.pop(),[.5,'audio-lesson']);assert.equal(ui.rewindAudio(),true);assert.deepEqual(calls.pop(),[7/80,'audio-lesson']);state.currentTime=2;ui.rewindAudio();assert.deepEqual(calls.pop(),[0,'audio-lesson']);ui.seekAudio(2000);assert.equal(calls.pop()[0],1);});
test('unavailable or stale lesson media cannot be seeked',()=>{const {ui,state,calls}=setup();state.duration=0;assert.equal(ui.seekAudio(500),false);state.duration=80;state.lessonId='other';assert.equal(ui.rewindAudio(),false);state.lessonId='audio-lesson';state.canSeek=false;assert.equal(ui.seekAudio(200),false);assert.equal(calls.length,0);assert.equal(ui.seekAudio(NaN),false);});
test('progress updates do not replace editor or overwrite a thumb being dragged',()=>{const {ui,state}=setup();const range={value:'0',disabled:false,setAttribute(){}},back={disabled:false};let paints=0;ui.container={set innerHTML(x){paints++;},querySelector:s=>s==='[data-pipeline-audio-seek]'?range:s==='[data-pipeline-action="rewind-audio"]'?back:null};ui.updateAudioProgress(state);assert.equal(range.value,'150');ui.audioSeekDraft=600;range.value='600';ui.updateAudioProgress({...state,currentTime:30});assert.equal(range.value,'600');assert.equal(paints,0);ui.audioSeekDraft=null;ui.updateAudioProgress({...state,currentTime:40});assert.equal(range.value,'500');});

test('returning to reading restores time and pause state without waiting for another media event',()=>{
 const {ui,state}=setup(),timeline={textContent:''},play={textContent:'播放本课音频',setAttribute(k,v){this[k]=v;}};
 ui.container={querySelector:s=>s==='[data-pipeline-audio-progress]'?timeline:s==='[data-pipeline-action="play"]'?play:null};
 ui.updateAudioProgress({...state,playing:true});
 assert.equal(timeline.textContent,'00:12 / 01:20');assert.equal(play.textContent,'暂停本课音频');assert.equal(play['aria-pressed'],'true');
 ui.updateAudioProgress({...state,currentTime:0,duration:0,playing:false});
 assert.equal(timeline.textContent,'00:00 / --:--');assert.equal(play.textContent,'播放本课音频');
 ui.updateAudioProgress({...state,lessonId:'another-lesson',playing:true});
 assert.equal(play.textContent,'播放本课音频');
});
