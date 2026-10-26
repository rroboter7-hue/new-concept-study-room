(function (global) {
  'use strict';

  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const steps = [
    {kind:'affirmative',label:'肯定句',hint:'用目标词写一个完整的肯定原句。后面三句都沿用这句的人物、时态和情境。'},
    {kind:'negative',label:'否定句',hint:'把第 1 句改为否定句，保留目标词和原来的情境。注意 be、助动词与动词形式。'},
    {kind:'yesno',label:'一般疑问句',hint:'把第 1 句改为可用 yes / no 回答的问题，保留目标词，检查助动词和问号。'},
    {kind:'wh',label:'特殊疑问句',hint:'围绕第 1 句用 what / who / where / when / why / how 等提问，并保留目标词。who 作主语时不一定需要 do。'},
    {kind:'combined',label:'旧知综合造句',hint:'另写一个新句子，同时用目标词、一个不同的旧词和一个旧用法。不能逐字重复前四句。'}
  ];

  class SentencePractice {
    constructor(options) {
      this.options = options || {};
      this.escape = this.options.escapeHTML || escapeText;
      this.entries = new Map();
      this.lessonSelections = new Map();
      this.currentLesson = null;
      this.active = null;
      this.context = null;
      this.temporarySources = [];
      this.result = null;
      this.timer = null;
      this.failureNotified = false;
      this.adjustmentsOpen = false;
      document.addEventListener('click', event => this.handleClick(event));
      document.addEventListener('input', event => this.handleInput(event));
      document.addEventListener('change', event => this.handleChange(event));
      document.addEventListener('toggle', event => {
        if (this.inside(event.target) && event.target.dataset?.sentenceAdjustments !== undefined) this.adjustmentsOpen = event.target.open;
      }, true);
    }

    core() { return global.StudySentences; }
    notify(message) { this.options.toast?.(message); }
    sourceLabel(source) { return `第 ${source?.book ?? '?'} 册 · 第 ${source?.number ?? '?'} 课${source?.title ? ' · ' + source.title : ''}`; }
    isBookWorkspace() { return Boolean(document.body?.classList?.contains('mls-book-workspace') && document.body.classList.contains('mls-mobile')); }
    target() { return this.context?.targets.find(item => item.key === this.active?.draft.targetKey) || null; }
    oldWords() {
      const target = this.target()?.word;
      return (this.context?.oldWords || []).filter(item => !this.core().matchesExpression(item.word, target) && !this.core().matchesExpression(target, item.word));
    }
    oldWord() { return this.oldWords().find(item => item.key === this.active?.draft.oldWordKey) || null; }
    oldPhrase() { return this.context?.oldPhrases.find(item => item.key === this.active?.draft.oldPhraseKey) || null; }

    makeContext(sourceLessonIds) {
      return this.core().context({lessons:this.options.getLessons?.() || [],currentLesson:this.currentLesson,records:this.options.getRecords?.() || {},sourceLessonIds});
    }

    selectionKey(lessonId) { return `selection:v1:${encodeURIComponent(String(lessonId).slice(0, 160))}`; }

    remember(persist = false) {
      if (!this.currentLesson || !this.active) return;
      const active = this.active.draft;
      this.lessonSelections.set(this.currentLesson.id, {targetKey:active.targetKey,sourceLessonIds:[...active.sourceLessonIds]});
      if (persist) {
        const key = this.selectionKey(this.currentLesson.id);
        const draft = this.core().sanitizeDraft({targetKey:active.targetKey,step:active.step,sourceLessonIds:active.sourceLessonIds,oldWordKey:active.oldWordKey,oldPhraseKey:active.oldPhraseKey});
        this.entries.set(key, {key,draft,dirty:true,state:'pending'});
      }
    }

    loadTarget(targetKey, inheritedSources = [], forceSources = false) {
      if (!targetKey) { this.active = null; return; }
      const key = this.core().draftKey(this.currentLesson.id, targetKey);
      if (!this.entries.has(key)) {
        const saved = this.options.getDrafts?.()?.[key];
        const draft = this.core().sanitizeDraft(saved || {targetKey,sourceLessonIds:inheritedSources});
        draft.targetKey = targetKey;
        this.entries.set(key, {key,draft,dirty:false,state:saved ? 'saved' : 'new'});
      }
      this.active = this.entries.get(key);
      if (forceSources) this.active.draft.sourceLessonIds = [...inheritedSources];
      this.result = null;
      this.remember();
    }

    updateContext() {
      const sources = this.active?.draft.sourceLessonIds || this.temporarySources;
      this.context = this.makeContext(sources);
      const allowedIds = new Set(this.context.earlierLessons.map(source => source.id));
      const safeSources = sources.filter(id => allowedIds.has(id));
      if (this.active && safeSources.length !== sources.length) {
        this.active.draft.sourceLessonIds = safeSources;
        this.active.dirty = true;
      }
      if (this.active && !this.context.targets.some(item => item.key === this.active.draft.targetKey)) {
        this.flush();
        this.loadTarget(this.context.targets[0]?.key, safeSources);
        this.context = this.makeContext(this.active?.draft.sourceLessonIds || safeSources);
      }
      if (!this.active && this.context.targets.length) this.loadTarget(this.context.targets[0].key, safeSources, true);
      if (this.active) {
        const draft = this.active.draft;
        if (draft.oldWordKey && !this.oldWord()) { draft.oldWordKey = '';this.active.dirty = true;draft.checkedAt = 0;this.result = null; }
        if (draft.oldPhraseKey && !this.oldPhrase()) { draft.oldPhraseKey = '';this.active.dirty = true;draft.checkedAt = 0;this.result = null; }
      }
      this.remember();
    }

    ensureState() {
      if (!this.core()) return false;
      const lesson = this.options.getLesson?.() || null;
      if (lesson?.id !== this.currentLesson?.id) {
        this.flush();
        this.remember();
        this.currentLesson = lesson;
        this.active = null;
        this.result = null;
        this.temporarySources = [];
        this.adjustmentsOpen = false;
        if (lesson) {
          const savedSelection = this.options.getDrafts?.()?.[this.selectionKey(lesson.id)];
          const previous = this.lessonSelections.get(lesson.id) || (savedSelection ? this.core().sanitizeDraft(savedSelection) : null);
          const initial = this.makeContext(previous?.sourceLessonIds || []);
          this.context = initial;
          const targetKey = initial.targets.some(item => item.key === previous?.targetKey) ? previous.targetKey : initial.targets[0]?.key;
          this.loadTarget(targetKey, previous?.sourceLessonIds || []);
        }
      } else this.currentLesson = lesson;
      if (lesson) this.updateContext();
      return Boolean(lesson);
    }

    markChanged(clearReview = true) {
      if (!this.active) return;
      this.active.dirty = true;
      this.active.state = 'pending';
      if (clearReview) { this.active.draft.checkedAt = 0;this.result = null; }
      this.remember(true);
      if (this.timer !== null) global.clearTimeout(this.timer);
      this.timer = global.setTimeout(() => { this.timer = null;this.flush(); }, 450);
      this.updateSaveStatus();
    }

    flush() {
      if (this.timer !== null) { global.clearTimeout(this.timer);this.timer = null; }
      let success = true;
      for (const entry of this.entries.values()) {
        if (!entry.dirty) continue;
        let saved = false;
        try { saved = this.options.saveDraft?.(entry.key, this.core().sanitizeDraft(entry.draft)) === true; } catch (_) { saved = false; }
        if (saved) { entry.dirty = false;entry.state = 'saved'; }
        else { entry.state = 'failed';success = false; }
      }
      if (!success && !this.failureNotified) {
        this.notify('造句草稿未保存。输入仍保留在此页面，请重试保存，并在离开前备份学习数据。');
        this.failureNotified = true;
      } else if (success) this.failureNotified = false;
      this.updateSaveStatus();
      return success;
    }

    reloadFromStorage() {
      if (this.timer !== null) global.clearTimeout(this.timer);
      this.timer = null;
      this.entries.clear();
      this.lessonSelections.clear();
      this.currentLesson = null;
      this.active = null;
      this.context = null;
      this.temporarySources = [];
      this.result = null;
      this.failureNotified = false;
      this.adjustmentsOpen = false;
    }

    saveState() {
      if ([...this.entries.values()].some(entry => entry.state === 'failed')) return {state:'failed',text:'未保存：浏览器未能保存部分草稿。输入仍保留在此页面，请重试保存并备份学习数据。'};
      if (this.active?.dirty) return {state:'pending',text:'等待保存草稿…'};
      if (this.active?.state === 'saved') return {state:'saved',text:'草稿已保存到当前浏览器。'};
      return {state:'new',text:'输入后会自动保存；每个课程、每个单词都有独立草稿。'};
    }

    updateSaveStatus() {
      const node = document.querySelector('#sentence-practice-content')?.querySelector('.sentence-save-status');
      if (node) {
        const status = this.saveState();node.textContent = status.text;
        if (node.dataset) node.dataset.saveState = status.state;
      }
    }

    inside(target) { return Boolean(target?.closest?.('#sentence-practice-content')); }

    handleInput(event) {
      const input = event.target;
      if (!this.inside(input) || input.dataset.sentenceInput !== 'answer' || !this.active) return;
      const value = String(input.value || '').slice(0, 400);
      if (input.value !== value) input.value = value;
      this.active.draft.answers[steps[this.active.draft.step].kind] = value;
      this.markChanged();
      const root = document.querySelector('#sentence-practice-content');
      const counter = root?.querySelector('.sentence-counter');
      if (counter) counter.textContent = `${value.length} / 400 字符`;
      const feedback = root?.querySelector('.sentence-feedback');
      if (feedback) feedback.innerHTML = '<p class="sentence-note">输入已改变，请重新检查五句基本要求。</p>';
    }

    handleClick(event) {
      const button = event.target?.closest?.('[data-sentence-action]');
      if (!button || !this.inside(button) || !this.active) return;
      event.preventDefault();
      const action = button.dataset.sentenceAction;
      if (action === 'step' || action === 'previous' || action === 'next') {
        const requested = action === 'step' ? Number(button.dataset.sentenceStep) : this.active.draft.step + (action === 'next' ? 1 : -1);
        this.active.draft.step = Math.max(0, Math.min(4, Number.isFinite(requested) ? requested : 0));
        this.markChanged(false);this.redraw(true);
      } else if (action === 'save') { this.flush();this.redraw(); }
      else if (action === 'check') {
        this.result = this.evaluate();
        this.active.draft.checkedAt = Date.now();
        this.markChanged(false);this.flush();this.redraw();
      }
    }

    handleChange(event) {
      const select = event.target;
      if (!this.inside(select) || !this.currentLesson) return;
      const field = select.dataset.sentenceSelect;
      if (field === 'target' && this.context.targets.some(item => item.key === select.value)) {
        const sources = this.active?.draft.sourceLessonIds || this.temporarySources;
        this.flush();this.loadTarget(select.value, sources);this.updateContext();this.markChanged(false);this.redraw();
      } else if (field === 'old-word' && this.active) {
        this.active.draft.oldWordKey = this.oldWords().some(item => item.key === select.value) ? select.value : '';
        this.markChanged();this.redraw();
      } else if (field === 'old-phrase' && this.active) {
        this.active.draft.oldPhraseKey = this.context.oldPhrases.some(item => item.key === select.value) ? select.value : '';
        this.markChanged();this.redraw();
      } else if (select.dataset.sentenceSource !== undefined) {
        const id = select.dataset.sentenceSource;
        if (!this.context.earlierLessons.some(source => source.id === id)) return;
        const sources = new Set(this.active?.draft.sourceLessonIds || this.temporarySources);
        if (select.checked) sources.add(id);else sources.delete(id);
        this.temporarySources = [...sources];
        if (this.active) { this.active.draft.sourceLessonIds = [...sources];this.markChanged(); }
        const nextContext = this.makeContext([...sources]);
        if (this.active && !nextContext.targets.some(item => item.key === this.active.draft.targetKey)) {
          this.flush();this.loadTarget(nextContext.targets[0]?.key, [...sources], true);
          if (this.active) this.markChanged();
        }
        this.updateContext();this.markChanged();this.redraw();
      }
    }

    evaluate() {
      try {
        return this.core().check({answers:this.active.draft.answers,target:this.target(),oldWord:this.oldWord(),oldPhrase:this.oldPhrase(),grammarCheck:this.options.grammarCheck});
      } catch (_) {
        return {rows:[],writtenCount:0,rulesOnly:true,error:'本次检查暂时无法完成；草稿已保留，请自行核对句型、时态和句意后重试。'};
      }
    }

    render() {
      if (!this.core()) return '<section id="sentence-practice-content" class="sentence-practice"><p class="sentence-note">造句规则尚未加载，请刷新后重试。</p></section>';
      this.rememberAdjustments();
      if (!this.ensureState()) return '<section id="sentence-practice-content" class="sentence-practice"><p class="sentence-note">请选择一篇课文后开始五句造句。</p></section>';
      return `<section id="sentence-practice-content" class="sentence-practice" aria-label="五句造句练习">${this.bodyHTML()}</section>`;
    }

    rememberAdjustments(root = document.querySelector('#sentence-practice-content')) {
      const panel = root?.querySelector('.sentence-adjustments');
      if (typeof panel?.open === 'boolean') this.adjustmentsOpen = panel.open;
    }

    redraw(focusInput = false) {
      const root = document.querySelector('#sentence-practice-content');
      this.rememberAdjustments(root);
      if (!root || !this.ensureState()) return;
      root.innerHTML = this.bodyHTML();
      if (focusInput) root.querySelector('.sentence-textarea')?.focus?.();
    }

    optionHTML(item, selected, phrase = false) {
      const e = this.escape;
      return `<option value="${e(item.key)}"${item.key === selected ? ' selected' : ''}>${e(phrase ? item.phrase : item.word)}${item.meaning ? ' · ' + e(item.meaning) : ''} · ${e(this.sourceLabel(item.source))}</option>`;
    }

    sourceHTML() {
      const e = this.escape, earlier = this.context.earlierLessons, selected = this.active?.draft.sourceLessonIds || this.temporarySources;
      const records = this.options.getRecords?.() || {};
      const sourceList = earlier.map(source => {
        const record = Object.hasOwn(records, source.id) ? records[source.id] : null;
        const learned = record?.completed === true || (typeof record?.attempts === 'number' && Number.isFinite(record.attempts) && record.attempts > 0);
        return `<label class="sentence-source-option"><input type="checkbox" data-sentence-source="${e(source.id)}" value="${e(source.id)}"${learned || selected.includes(source.id) ? ' checked' : ''}${learned ? ' disabled' : ''}><span>${e(this.sourceLabel(source))}${learned ? '<small>已有学习记录</small>' : ''}</span></label>`;
      }).join('');
      return `<details class="sentence-source-panel"${!this.context.oldWords.length || !this.context.oldPhrases.length ? ' open' : ''}><summary>选择以前学过的课程，补充旧词和旧用法</summary><p class="sentence-note">这里只列当前课之前的课程。有学习记录的课程会自动提供旧知；没有记录时，请勾选你以前学过的课程作为本轮复习来源。</p>${earlier.length ? `<div class="sentence-source-list">${sourceList}</div>` : '<p class="sentence-note">当前没有更早的课程。可先练前四句，学过更早课程后再完成旧知综合句。</p>'}</details>`;
    }

    controlsHTML() {
      const draft = this.active?.draft;
      const currentTargets = this.context.targets.filter(item => item.source.id === this.currentLesson.id);
      const oldTargets = this.context.targets.filter(item => item.source.id !== this.currentLesson.id);
      const controls = `<div class="sentence-controls"><label class="sentence-field">练习目标词<select class="sentence-select" data-sentence-select="target"${!this.context.targets.length ? ' disabled' : ''}>${currentTargets.length ? `<optgroup label="本课单词">${currentTargets.map(item => this.optionHTML(item, draft?.targetKey)).join('')}</optgroup>` : ''}${oldTargets.length ? `<optgroup label="已学旧词">${oldTargets.map(item => this.optionHTML(item, draft?.targetKey)).join('')}</optgroup>` : ''}${!this.context.targets.length ? '<option>暂无可用目标词</option>' : ''}</select></label><label class="sentence-field">第 5 句的旧词<select class="sentence-select" data-sentence-select="old-word"${!this.oldWords().length ? ' disabled' : ''}><option value="">${this.oldWords().length ? '请选择一个不同的旧词' : '暂无不同的旧词，请选择已学来源'}</option>${this.oldWords().map(item => this.optionHTML(item, draft?.oldWordKey)).join('')}</select></label><label class="sentence-field">第 5 句的旧用法<select class="sentence-select" data-sentence-select="old-phrase"${!this.context.oldPhrases.length ? ' disabled' : ''}><option value="">${this.context.oldPhrases.length ? '请选择一个旧用法' : '暂无旧用法，请选择已学来源'}</option>${this.context.oldPhrases.map(item => this.optionHTML(item, draft?.oldPhraseKey, true)).join('')}</select></label></div>`;
      return controls;
    }

    bodyHTML() {
      if (this.isBookWorkspace()) return this.workspaceHTML();
      const e = this.escape, target = this.target(), draft = this.active?.draft;
      const controls = this.controlsHTML(), status = this.saveState();
      return `<div class="sentence-header"><h3>一个单词，写好五句话</h3><p>先围绕同一原句完成四种句型，再把旧词和旧用法放进一个新句子。</p></div>${controls}${this.sourceHTML()}${target && draft ? this.editorHTML() : '<p class="sentence-note">本课暂无可用单词。请选择一个以前学过的课程，或切换到有词汇资料的课文。</p>'}<p class="sentence-save-status" data-save-state="${status.state}" role="status" aria-live="polite">${e(status.text)}</p>${this.referenceHTML()}`;
    }

    knowledgeHTML() {
      const e = this.escape, target = this.target(), combined = this.active.draft.step === 4;
      const rows = [{kind:'target',label:target.source.id === this.currentLesson.id ? '本课目标词' : '复习目标词',item:target}];
      if (combined) rows.push({kind:'old-word',label:'已学旧词',item:this.oldWord(),empty:'尚未选择旧词'},{kind:'old-phrase',label:'已学旧用法',item:this.oldPhrase(),empty:'尚未选择旧用法'});
      return `<ol class="sentence-knowledge${combined ? ' sentence-knowledge-linked' : ''}" aria-label="本句练习用词">${rows.map((row,index) => `<li data-sentence-knowledge="${row.kind}"><span class="sentence-knowledge-number" aria-hidden="true">${index + 1}</span><div class="sentence-knowledge-content"><span class="sentence-knowledge-label">${row.label}</span><strong${row.item ? ' lang="en"' : ' class="sentence-knowledge-empty"'}>${e(row.item?.word || row.item?.phrase || row.empty)}</strong><div class="sentence-knowledge-meta">${row.item?.meaning ? `<p class="sentence-knowledge-meaning">${e(row.item.meaning)}</p>` : ''}${row.item ? `<span class="sentence-knowledge-source">第${e(row.item.source.book)}册 · 第${e(row.item.source.number)}课</span>` : '<p class="sentence-knowledge-source">在“调整练习用词”中选择</p>'}</div></div>${row.item && row.item.source.id !== this.currentLesson.id ? `<button type="button" class="sentence-source-backlink" data-lesson="${e(row.item.source.id)}" aria-label="回看${e(this.sourceLabel(row.item.source))}">回看</button>` : ''}</li>`).join('')}</ol>`;
    }

    workspaceHTML() {
      const e = this.escape, draft = this.active?.draft, target = this.target();
      const adjustments = `<details class="sentence-adjustments"${this.adjustmentsOpen ? ' open' : ''} data-sentence-adjustments><summary>调整练习用词</summary>${this.controlsHTML()}${this.sourceHTML()}${draft ? '<button type="button" class="button subtle sentence-save-button" data-sentence-action="save">保存草稿</button>' : ''}</details>`;
      if (!target || !draft) return `<div class="sentence-header"><h3>五句练习</h3><p>本课暂无可用单词，请选择以前学过的课程。</p></div>${adjustments}`;
      const step = steps[draft.step], combined = draft.step === 4, status = this.saveState();
      const titles = ['先写一句肯定句','把原句改成否定句','向原句提一个问题','试着用特殊疑问词提问','把旧知识，用进新句子'];
      const hints = ['用目标词，写一句完整的英文。','沿用第 1 句的人物、时态和情境。','保留目标词，写一个可用 yes / no 回答的问题。','保留目标词，用 what / who / where 等提问。','选一个旧词和一个旧用法，写一句新句子。'];
      const navigation = steps.map((item,index) => `<li><button type="button" class="sentence-step${index === draft.step ? ' active' : ''}${draft.answers[item.kind].trim() ? ' written' : ''}" data-sentence-action="step" data-sentence-step="${index}"${index === draft.step ? ' aria-current="step"' : ''} aria-label="第 ${index + 1} 步 ${e(item.label)}${draft.answers[item.kind].trim() ? '，已填写' : ''}"><span>${index + 1}</span></button></li>`).join('');
      const original = draft.step > 0 && !combined ? `<div class="sentence-original"><strong>第 1 句 · 肯定原句</strong><p lang="en">${draft.answers.affirmative.trim() ? e(draft.answers.affirmative) : '还没有原句，请先回到第 1 步。'}</p></div>` : '';
      const selected = [target,this.oldWord(),this.oldPhrase()];
      const combination = combined ? `<p class="sentence-combination"><span>要用到：</span>${selected.map((item,index) => `${index ? '<span aria-hidden="true"> + </span>' : ''}<strong${item ? ' lang="en"' : ''}>${e(item?.word || item?.phrase || (index === 1 ? '待选旧词' : '待选旧用法'))}</strong>`).join('')}</p>` : '';
      if (!this.result && draft.checkedAt) this.result = this.evaluate();
      return `<div class="sentence-workspace${combined ? ' sentence-workspace-combined' : ''}"><div class="sentence-progress"><ol class="sentence-steps" aria-label="五句练习步骤">${navigation}</ol><p class="sentence-step-count">第 ${draft.step + 1} 句 / 共 5 句</p></div><div class="sentence-header"><h3 id="sentence-step-title">${e(titles[draft.step])}</h3><p id="sentence-step-hint">${e(hints[draft.step])}</p></div>${this.knowledgeHTML()}${combination}${adjustments}${original}<section class="sentence-editor" aria-labelledby="sentence-step-title"><label class="sentence-field" for="sentence-answer">${combined ? '我的综合句' : '我的' + e(step.label)}<textarea id="sentence-answer" class="sentence-textarea" data-sentence-input="answer" rows="${combined ? 3 : 5}" maxlength="400" lang="en" spellcheck="true" autocapitalize="sentences" aria-describedby="sentence-step-hint sentence-counter" placeholder="在这里写下这一句英文…">${e(draft.answers[step.kind])}</textarea></label><div class="sentence-draft-meta"><p class="sentence-save-status" data-save-state="${status.state}" role="status" aria-live="polite">${e(status.text)}</p><p id="sentence-counter" class="sentence-counter">${draft.answers[step.kind].length} / 400 字符</p></div><div class="sentence-actions"><button type="button" class="button primary" data-sentence-action="check">检查五句基本要求</button><div class="sentence-page-actions"><button type="button" class="button subtle" data-sentence-action="previous"${draft.step === 0 ? ' disabled' : ''}>上一句</button><button type="button" class="button subtle" data-sentence-action="next"${draft.step === 4 ? ' disabled' : ''}>下一句</button></div></div></section><section class="sentence-feedback" aria-live="polite">${this.feedbackHTML()}</section></div>`;
    }

    editorHTML() {
      const e = this.escape, draft = this.active.draft, target = this.target(), step = steps[draft.step];
      const oldWord = this.oldWord(), oldPhrase = this.oldPhrase();
      const navigation = steps.map((item, index) => `<li><button type="button" class="sentence-step${index === draft.step ? ' active' : ''}${draft.answers[item.kind].trim() ? ' written' : ''}" data-sentence-action="step" data-sentence-step="${index}"${index === draft.step ? ' aria-current="step"' : ''} aria-label="第 ${index + 1} 步 ${e(item.label)}${draft.answers[item.kind].trim() ? '，已填写' : ''}"><span>${index + 1}</span>${e(item.label)}${draft.answers[item.kind].trim() ? '<small>已填写</small>' : ''}</button></li>`).join('');
      const original = draft.step > 0 && draft.step < 4 ? `<div class="sentence-original"><strong>第 1 句 · 肯定原句</strong><p lang="en">${draft.answers.affirmative.trim() ? e(draft.answers.affirmative) : '还没有原句，请先回到第 1 步写肯定句。'}</p><p class="sentence-note">对照原句自行核对人物、时态和情境；本地规则无法判断四句是否语义对应。</p></div>` : '';
      const combined = draft.step === 4 ? `<div class="sentence-summary"><p>目标词：<strong lang="en">${e(target.word)}</strong>　旧词：<strong lang="en">${e(oldWord?.word || '尚未选择')}</strong>　旧用法：<strong lang="en">${e(oldPhrase?.phrase || '尚未选择')}</strong></p>${!oldWord || !oldPhrase ? '<p class="sentence-note">请先选择旧词和旧用法。没有可选资料时，可在上方勾选以前学过的课程；你仍可保存未完成草稿。</p>' : ''}</div>` : '';
      if (!this.result && draft.checkedAt) this.result = this.evaluate();
      return `<ol class="sentence-steps" aria-label="五句练习步骤">${navigation}</ol><section class="sentence-editor" aria-labelledby="sentence-step-title"><p class="sentence-summary">当前目标：<strong lang="en">${e(target.word)}</strong>${target.meaning ? ' · ' + e(target.meaning) : ''}<small>${e(this.sourceLabel(target.source))}</small></p><h4 id="sentence-step-title">第 ${draft.step + 1} / 5 句 · ${e(step.label)}</h4><p id="sentence-step-hint" class="sentence-note">${e(step.hint)}</p>${original}${combined}<label class="sentence-field" for="sentence-answer">${e(step.label)}<textarea id="sentence-answer" class="sentence-textarea" data-sentence-input="answer" rows="5" maxlength="400" lang="en" spellcheck="true" autocapitalize="sentences" aria-describedby="sentence-step-hint sentence-counter" placeholder="在这里写下这一句英文…">${e(draft.answers[step.kind])}</textarea></label><p id="sentence-counter" class="sentence-counter">${draft.answers[step.kind].length} / 400 字符</p><div class="sentence-actions"><button type="button" class="button" data-sentence-action="previous"${draft.step === 0 ? ' disabled' : ''}>上一句</button><button type="button" class="button" data-sentence-action="next"${draft.step === 4 ? ' disabled' : ''}>下一句</button><button type="button" class="button primary" data-sentence-action="check">检查五句基本要求</button><button type="button" class="button subtle" data-sentence-action="save">保存草稿</button></div></section><section class="sentence-feedback" aria-live="polite">${this.feedbackHTML()}</section>`;
    }

    feedbackHTML() {
      const e = this.escape, result = this.result;
      if (!result) return '<p class="sentence-note">填写后检查五句基本要求。这里只提供有限句型和已覆盖语法反馈，句意、自然度及四句之间的对应关系仍需自己或老师核对。</p>';
      if (result.error) return `<p class="sentence-note">${e(result.error)}</p>`;
      const labels = {'empty':'尚未填写','needs-work':'请修改基本要求','review':'需要人工核对','ready':'有限检查已完成'};
      return `<h4>五句基本要求反馈</h4><p class="sentence-note">已填写 ${Number(result.writtenCount) || 0} / 5 句。有限检查已完成也不代表整句正确；请继续核对句意、自然度、时态和情境。</p>${(Array.isArray(result.rows) ? result.rows : []).map(row => `<article class="sentence-feedback-row" data-status="${Object.hasOwn(labels, row.status) ? row.status : 'review'}"><h5>${e(row.label || steps.find(item => item.kind === row.kind)?.label || '句子反馈')} <span class="sentence-status">${e(labels[row.status] || labels.review)}</span></h5>${Array.isArray(row.issues) && row.issues.length ? `<ul>${row.issues.map(issue => `<li>${e(issue)}</li>`).join('')}</ul>` : ''}${Array.isArray(row.notes) ? row.notes.map(note => `<p class="sentence-note">${e(note)}</p>`).join('') : ''}</article>`).join('')}`;
    }

    referenceHTML() {
      return '<details class="sentence-reference"><summary>查看教学示例：book + sister + look at</summary><p class="sentence-note">以下是为练习编写的教学示例，并非教材原文。请用自己选的词写句子；此示例不会填入你的草稿。</p><ol><li>肯定句：<span lang="en">You look at the book.</span></li><li>否定句：<span lang="en">You do not look at the book.</span></li><li>一般疑问句：<span lang="en">Do you look at the book?</span></li><li>特殊疑问句：<span lang="en">Why do you look at the book?</span></li><li>旧知综合句：<span lang="en">My sister and I look at the book after dinner.</span></li></ol><p class="sentence-note">前四句沿用同一情境；第五句加入 sister，另写新句子。自己的句子不必与示例相同。</p></details>';
    }
  }

  global.SentencePractice = SentencePractice;
})(window);
