const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const directory = path.resolve(__dirname, '..');

function setup({mobile = true, draft, failSave = false, failCopy = false} = {}) {
  const handlers = {}, timers = new Map(), fields = new Map(), drafts = {}, copies = [], downloads = [];
  const classes = new Set(mobile ? ['mls-book-workspace', 'mls-mobile', 'mls-writing-dark'] : []);
  let serial = 0, failing = failSave, writes = 0;
  if (draft) drafts.book = draft;
  const root = {
    html: '',
    get innerHTML() { return this.html; },
    set innerHTML(value) { this.html = value; writes++; },
    querySelector(selector) {
      if (!fields.has(selector)) fields.set(selector, {innerHTML:'', textContent:'', dataset:{}, value:'', selectionStart:0, focus(){this.focused=true;}, select(){this.selected=true;}});
      return fields.get(selector);
    }
  };
  const scope = {
    document: {
      body: {classList: {contains:value => classes.has(value)}},
      addEventListener:(kind, handler) => { handlers[kind] = handler; },
      querySelector:selector => selector === '#batch-sentence-content' ? root : null
    },
    setTimeout(callback, delay) { const id = ++serial; timers.set(id, {callback, delay}); return id; },
    clearTimeout:id => timers.delete(id)
  };
  scope.window = scope;
  vm.createContext(scope);
  for (const filename of ['grammar-check.js', 'sentence-core.js', 'batch-sentence-core.js', 'batch-sentence-practice.js']) {
    vm.runInContext(fs.readFileSync(path.join(directory, filename), 'utf8'), scope);
  }
  const ui = new scope.BatchSentencePractice({
    getLesson:() => ({id:'book', title:'Postcards'}), getDraft:id => drafts[id],
    saveDraft(id, value) { if (failing) return false; drafts[id] = JSON.parse(JSON.stringify(value)); return true; },
    grammarCheck:text => scope.StudyGrammar.check(text), sentenceCheck:options => scope.StudySentences.check(options),
    getGuidedText:() => '原句：I read a book.\n否定句：I do not read a book.',
    async copyText(text) { copies.push(text); if (failCopy) throw new Error('clipboard denied'); },
    downloadText:(name, text) => downloads.push({name, text})
  });
  function event(kind, dataset, value) {
    const target = {dataset, value, closest(selector) {
      return selector === '#batch-sentence-content' ? root : selector === '[data-batch-action]' && dataset.batchAction ? target : null;
    }};
    return handlers[kind]({target, preventDefault(){}});
  }
  function next(delay) {
    const pair = [...timers].find(([, job]) => job.delay === delay);
    if (!pair) return false;
    timers.delete(pair[0]); pair[1].callback(); return true;
  }
  return {ui, root, fields, drafts, copies, downloads, timers, classes,
    render() { root.innerHTML = ui.render(); return root.innerHTML; },
    input:(value, field = 'text') => event('input', {batchInput:field}, value),
    mode:value => event('change', {batchSelect:'mode'}, value), click:action => event('click', {batchAction:action}),
    next, finish() { while(next(0)){} }, setFailure:value => { failing = value; }, writes:() => writes
  };
}

function detail(html, className) {
  const found = html.match(new RegExp(`<details\\b([^>]*class="${className}"[^>]*)>([\\s\\S]*?)<\\/details>`));
  assert.ok(found, `${className} should remain reachable in a disclosure`);
  return {attributes:found[1], content:found[2]};
}

test('focused mobile writing keeps one editor and one primary check, with tools and notes initially folded', () => {
  const h = setup(); const html = h.render();
  const tools = detail(html, 'batch-tools'); const notes = detail(html, 'batch-notes-panel');
  assert.doesNotMatch(tools.attributes, /\bopen\b/); assert.doesNotMatch(notes.attributes, /\bopen\b/);
  for (const action of ['template', 'guided', 'export', 'save']) assert.match(tools.content, new RegExp(`data-batch-action="${action}"`));
  assert.match(notes.content, /data-batch-input="notes"/);
  assert.equal((html.match(/data-batch-input="text"/g) || []).length, 1);
  assert.equal((html.match(/class="button primary[^\"]*"/g) || []).length, 1);
  assert.match(html, /class="batch-editor-meta"[\s\S]*class="batch-count"[\s\S]*class="batch-save-status"/);
  assert.match(html, /type="radio"[^>]*data-batch-select="mode"[^>]*value="free"[^>]*checked/);
  assert.match(html, /type="radio"[^>]*data-batch-select="mode"[^>]*value="conversion"/);
  assert.ok(html.indexOf('data-batch-input="text"') < html.indexOf('data-batch-action="check"'));
  assert.ok(html.indexOf('data-batch-action="check"') < html.indexOf('data-batch-action="copy"'));
  assert.doesNotMatch(html, /maxlength=|全部正确|整句正确|<svg/);
});

test('mobile mode is gated by all workspace classes and leaves the desktop controls available', () => {
  const h = setup({mobile:false});
  let html = h.render(); assert.match(html, /<select id="batch-mode"/); assert.doesNotMatch(html, /class="batch-tools"/);
  h.classes.add('mls-book-workspace'); h.classes.add('mls-mobile');
  html = h.render(); assert.match(html, /<select id="batch-mode"/);
  h.classes.add('mls-writing-dark'); html = h.render(); assert.match(html, /class="batch-tools"/);
});

test('mobile typing preserves literal input, caret and folded panels while count and save state update', () => {
  const h = setup(); h.render();
  const editor = h.root.querySelector('[data-batch-input="text"]');
  editor.value = 'I read <book>.\n\nI write.'; editor.selectionStart = 8;
  const writes = h.writes(); h.input(editor.value);
  assert.equal(h.writes(), writes, 'input updates must not replace the editor or disclosure DOM');
  assert.equal(editor.selectionStart, 8); assert.equal(editor.value, 'I read <book>.\n\nI write.');
  assert.equal(h.fields.get('.batch-count').textContent, '共 2 句');
  assert.match(h.fields.get('.batch-save-status').textContent, /等待保存/);
  assert.equal(h.next(450), true); assert.equal(h.drafts.book.rawText, 'I read <book>.\n\nI write.');
  assert.equal(h.fields.get('.batch-save-status').textContent, '已自动保存');
  assert.match(h.ui.bodyHTML(), /I read &lt;book&gt;\.\n\nI write\./);
});

test('folded mobile tools still append, check every row, cancel stale work and export exact drafts', async () => {
  const h = setup({failSave:true}); h.render(); h.input('My existing writing.');
  await h.click('guided'); h.input('<b>Teacher notes</b>', 'notes');
  assert.equal(h.ui.active.draft.mode, 'conversion'); assert.ok(h.ui.active.draft.rawText.startsWith('My existing writing.'));
  h.mode('free'); h.input('I enjoy to read a book.\n' + Array.from({length:60}, () => 'I read a book.').join('\n'));
  const raw = h.ui.active.draft.rawText; await h.click('check');
  assert.equal(h.ui.results.length, 25); assert.equal(h.ui.results[0].status, 'needs-work');
  const late = [...h.timers.values()].find(job => job.delay === 0).callback;
  await h.click('cancel'); late(); assert.equal(h.ui.results.length, 25);
  assert.match(h.ui.feedbackHTML(), /已取消/); assert.equal(h.ui.active.draft.rawText, raw);
  await h.click('check'); h.finish(); assert.equal(h.ui.results.length, 61);
  assert.match(h.ui.bodyHTML(), /未保存/); assert.doesNotMatch(h.ui.feedbackHTML(), /全部正确|整句正确/);
  await h.click('export'); assert.ok(h.downloads[0].text.includes(raw)); assert.ok(h.downloads[0].text.includes('<b>Teacher notes</b>'));
  h.setFailure(false); await h.click('save'); assert.equal(h.drafts.book.rawText, raw); assert.equal(h.drafts.book.notes, '<b>Teacher notes</b>');
});

test('mobile copy exposes pagination and escaped manual fallback after clipboard denial', async () => {
  const h = setup({failCopy:true}); h.render();
  h.input(Array.from({length:105}, (_, index) => `Sentence ${index} <i> ${'word '.repeat(40)}.`).join('\n'));
  await h.click('copy');
  let html = h.ui.promptHTML(); const options = detail(html, 'batch-prompt-details');
  assert.match(options.attributes, /\bopen\b/); assert.ok(h.ui.promptChunks.length > 1);
  assert.match(options.content, /data-batch-action="prompt-next"/); assert.match(options.content, /readonly/);
  assert.match(options.content, /\\u003ci\\u003e/); assert.doesNotMatch(options.content, /<i>/);
  assert.equal(h.fields.get('[data-batch-copy-text]').focused, true);
  await h.click('prompt-next'); await h.click('copy'); assert.equal(h.copies[1], h.ui.promptChunks[1].text);
  assert.doesNotMatch(html, /class="button primary"/);
});

test('mobile feedback folds scope notes while keeping the original, review status and concrete issues visible', async () => {
  const raw = '原句：You look at the postcard.\n否定句：You does not look at the postcard.\n特殊疑问句：Why do you look at the postcard?';
  const decode = html => html.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  for (const mobile of [true, false]) {
    const h = setup({mobile}); h.render(); h.mode('conversion'); h.input(raw); await h.click('check');
    const articles = [...h.ui.feedbackHTML().matchAll(/<article\b[^>]*class="batch-result-card"[^>]*>([\s\S]*?)<\/article>/g)];
    assert.equal(articles.length, 3);
    for (let index = 0; index < articles.length; index++) {
      const content = articles[index][1], result = h.ui.results[index];
      assert.ok(result.notes.length > 0);
      let visible = content;
      if (mobile) {
        const notes = detail(content, 'batch-result-notes');
        assert.doesNotMatch(notes.attributes, /\bopen\b/);
        assert.match(notes.content, /<summary>检查范围与提示<\/summary>/);
        for (const note of result.notes) assert.ok(decode(notes.content).includes(note), 'every full scope note remains available in the disclosure');
        visible = content.replace(/<details\b[\s\S]*?<\/details>/g, '');
        for (const note of result.notes) assert.ok(!decode(visible).includes(note), 'scope notes should not crowd the visible result');
      } else {
        assert.doesNotMatch(content, /<details\b/);
        for (const note of result.notes) assert.ok(decode(content).includes(note), 'desktop notes stay directly visible');
      }
      assert.ok(decode(visible).includes(result.original));
      assert.match(visible, result.status === 'needs-work' ? /发现已覆盖问题/ : /待完整复核/);
      for (const issue of result.issues) assert.ok(decode(visible).includes(issue), 'concrete issues stay outside the disclosure');
    }
    assert.ok(h.ui.results.some(result => result.issues.length > 0), 'the real checker must produce a concrete issue for this fixture');
    assert.doesNotMatch(h.ui.feedbackHTML(), /全部正确|整句正确/);
    assert.equal(h.ui.active.draft.rawText, raw);
  }
});
