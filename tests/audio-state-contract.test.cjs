const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('audio state identifies the lesson so reading highlights can reject stale callbacks', () => {
  const emitted = [];
  const window = {
    speechSynthesis: { cancel() {}, pause() {}, resume() {}, speak() {}, getVoices: () => [] },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    performance: { now: () => 1 },
    setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'audio.js'), 'utf8'), { window });
  const audio = new window.StudyAudio({ onState: state => emitted.push(state.lessonId) });
  assert.equal(audio.state.lessonId, null);
  audio.setLesson({ id: 'lesson-a', paragraphs: [{ en: 'First sentence.' }] });
  const previous = audio.state;
  assert.equal(previous.lessonId, 'lesson-a');
  audio.setLesson({ id: 'lesson-b', paragraphs: [{ en: 'Another sentence.' }] });
  assert.equal(audio.state.lessonId, 'lesson-b');
  assert.equal(previous.lessonId, 'lesson-a');
  assert.equal(emitted.at(-1), 'lesson-b');
  audio.setLesson(null);
  assert.equal(audio.state.lessonId, null);
  assert.equal(emitted.at(-1), null);
});

function mediaHarness(){
  const errors=[],instances=[];
  class Media{
    constructor(){this.listeners={};this.paused=true;instances.push(this);}
    addEventListener(name,fn){this.listeners[name]=fn;}removeEventListener(name){delete this.listeners[name];}
    pause(){this.paused=true;}load(){}removeAttribute(){}
    play(){return Promise.reject(new Error('source unavailable'));}
  }
  class AudioURL extends URL{static createObjectURL(){return 'blob:local-test';}static revokeObjectURL(){}}
  const window={Audio:Media,Blob,URL:AudioURL,location:{href:'https://example.test/study/',origin:'https://example.test'},performance:{now:()=>1},setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','audio.js'),'utf8'),{window});
  const audio=new window.StudyAudio({onError:message=>errors.push(message)});
  return {audio,instances,errors,lesson:{id:'a',paragraphs:[{en:'A real passage.'}]}};
}
test('unavailable remote lesson audio does not falsely diagnose a decoding or missing-text problem',()=>{
  const h=mediaHarness();h.audio.setLesson(h.lesson,'audio/a.mp3');const media=h.instances.at(-1);
  media.error={code:4};media.listeners.error();
  assert.match(h.errors.at(-1),/网络|稍后重试/);assert.doesNotMatch(h.errors.at(-1),/解码|暂无.*内容|重新导入/);
  media.error={code:3};media.listeners.error();assert.match(h.errors.at(-1),/解码/);
});
test('remote play rejection requests network retry while an imported unsupported file keeps format guidance',async()=>{
  const h=mediaHarness();h.audio.setLesson(h.lesson,'audio/a.mp3');
  await assert.rejects(h.audio.play(),/网络/);
  h.audio.setLesson(h.lesson,new Blob(['invalid local audio']));const media=h.instances.at(-1);
  media.error={code:4};media.listeners.error();assert.match(h.errors.at(-1),/格式|MP3/);
});
