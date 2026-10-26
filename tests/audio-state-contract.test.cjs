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
