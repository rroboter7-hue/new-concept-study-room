const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  let lesson = {id:'now', title:'A quiet day', paragraphs:[{en:'We read beside the quiet theatre.'}], vocabulary:[{word:'theatre',meaning:'剧院'}]};
  const calls = [], records = [], evidence = [], root = {innerHTML:'', querySelector(){return {focus(){}};}};
  const scope = {document:{addEventListener(){},querySelector:selector => selector === '#output-content' ? root : null}};
  scope.window = scope;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'output-practice.js'), 'utf8'), scope);
  const ui = new scope.OutputPractice({
    getLesson:() => lesson, defaultMode:() => 'sentences', isMobileWorkspace:() => true,
    onModeChange:mode => calls.push(`mode:${mode}`),
    sentencePractice:{flush(){calls.push('sentence:flush');}, render(){calls.push('sentence:render'); return '<section id="mobile-guided">guided</section>';}},
    batchPractice:{flush(){calls.push('batch:flush');}, cancel(){calls.push('batch:cancel');}, render(){calls.push('batch:render'); return '<section id="mobile-batch">batch</section>';}},
    saveRecord:record => {records.push(record); return true;}, onEvidence:item => {evidence.push(item); return true;}
  });
  function action(name, extra = {}) {
    const target = {dataset:{outputAction:name,...extra}, closest:selector => selector === '[data-output-action]' ? target : selector === '#output-content' ? root : null};
    ui.click({target});
  }
  return {ui, calls, records, evidence, action, changeLesson() {lesson = {...lesson,id:'next'}; ui.setLesson(lesson);}};
}

test('mobile output always exposes writing, dictation and retell while keeping bulk tools secondary', () => {
  const h = setup(); h.ui.render();
  for (const [mode, id, renderer] of [['sentences','mobile-guided','sentence:render'], ['batch','mobile-batch','batch:render']]) {
    h.ui.mode = mode; h.calls.length = 0;
    const html = h.ui.render();
    assert.equal(h.calls[0], `mode:${mode}`); assert.equal(h.calls[1], renderer);
    const mainTabs = html.slice(0, html.indexOf(`id="${id}"`));
    assert.match(mainTabs, /data-output-mode="sentences"/);
    assert.match(mainTabs, /data-output-mode="write"/); assert.match(mainTabs, /data-output-mode="retell"/);
    assert.doesNotMatch(mainTabs, /data-output-mode="batch"|class="mls-output-more"/);
    assert.ok(html.indexOf(`id="${id}"`) < html.indexOf('class="mls-output-more"'));
    assert.match(html, /data-output-mode="retell"/);
  }
});

test('daily task overrides the mobile default while preserving assistance until a new round', () => {
  const h = setup(); h.ui.render(); assert.equal(h.ui.mode, 'sentences');
  assert.equal(h.ui.startTask({lessonId:'now', mode:'retell', roundKey:'today-retell'}), true);
  assert.equal(h.ui.mode, 'retell'); assert.equal(h.ui.assisted, false); assert.equal(h.ui.pendingEvidence, null);
  const html = h.ui.render();
  assert.match(html.slice(0,html.indexOf('class="output-intro"')),/data-output-mode="retell" aria-pressed="true"/);
  assert.doesNotMatch(html, /class="mls-output-more" open/);
  h.action('original'); h.action('original'); h.ui.answer = 'We read beside the quiet theatre.';
  assert.equal(h.ui.startTask({lessonId:'now', mode:'retell', roundKey:'today-retell'}), true);
  assert.equal(h.ui.answer, 'We read beside the quiet theatre.'); assert.equal(h.ui.assisted, true);
  h.ui.submit(); assert.equal(h.evidence.length, 1); assert.equal(h.evidence[0].type, 'retell'); assert.equal(h.evidence[0].assisted, true);
  assert.equal(h.evidence[0].roundKey, 'today-retell'); assert.equal(h.records[0].details.evidenceVersion, 1);
  h.ui.startTask({lessonId:'now', mode:'dictation', roundKey:'today-write'});
  assert.equal(h.ui.mode, 'write'); assert.equal(h.ui.answer, ''); assert.equal(h.ui.assisted, false); assert.equal(h.ui.pendingEvidence, null);
  h.changeLesson(); assert.equal(h.ui.mode, 'sentences'); assert.equal(h.ui.roundKey, ''); assert.equal(h.ui.roundLessonId, '');
});

test('daily evidence failures retain retryable status across the mobile output layout', () => {
  const h = setup(); let accepted = false, attempts = 0;
  h.ui.options.onEvidence = () => {attempts++; return accepted;};
  h.ui.startTask({lessonId:'now', mode:'dictation', roundKey:'today-write'});
  h.ui.answer = 'We read beside the quiet theatre.'; h.ui.submit();
  assert.match(h.ui.render(), /重试保存任务状态/); assert.equal(h.records.length, 1); assert.equal(attempts, 1);
  accepted = true; h.action('evidence-retry');
  assert.equal(attempts, 2); assert.equal(h.records.length, 1); assert.doesNotMatch(h.ui.render(), /重试保存任务状态/);
  assert.equal(h.ui.answer, 'We read beside the quiet theatre.');
});
