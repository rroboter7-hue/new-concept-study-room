(function (global) {
  'use strict';

  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const wordCategories = [{key:'verb',label:'动词'},{key:'adjective',label:'形容词'},{key:'phrase',label:'习惯用法'}];
  const steps = [
    {kind:'affirmative',label:'肯定句',hint:'用目标词写一个完整的肯定原句。后面三句都沿用这句的人物、时态和情境。'},
    {kind:'negative',label:'否定句',hint:'把第 1 句改为否定句，保留目标词和原来的情境。注意 be、助动词与动词形式。'},
    {kind:'yesno',label:'一般疑问句',hint:'把第 1 句改为可用 yes / no 回答的问题，保留目标词，检查助动词和问号。'},
    {kind:'wh',label:'特殊疑问句',hint:'围绕第 1 句用 what / who / where / when / why / how 等提问，并保留目标词。who 作主语时不一定需要 do。'},
    {kind:'combined',label:'旧知综合造句',hint:'另写一个新句子，同时用目标词、一个不同的旧词和一个旧用法。不能逐字重复前四句。'}
  ];
  const flexibleSteps = [
    {kind:'affirmative',label:'换一个语境',hint:'用目标单词或习惯用法写一句自己的话，可以联系今天的生活。'},
    {kind:'negative',label:'补充时间地点',hint:'换一个时间、地点或人物，再用目标表达写一句；不必硬改成否定句。'},
    {kind:'yesno',label:'模仿并改写',hint:'回忆课文中的表达，改变人物、动作或情境；参考例句可以按需展开。'},
    {kind:'wh',label:'提问或回应',hint:'用目标表达提出一个问题，或写一句对话中的回应。'},
    {kind:'combined',label:'结合旧知',hint:'尝试联系一个已学词或用法，另写新句子。暂时没有合适旧知时也可以换一个语境。'}
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
      this.oldBank = [];
      this.wordCategory = 'verb';
      this.wordSearch = '';
      this.pickerDialog = null;
      this.pickerTrigger = null;
      document.addEventListener('click', event => this.handleClick(event));
      document.addEventListener('input', event => this.handleInput(event));
      document.addEventListener('change', event => this.handleChange(event));
      document.addEventListener('keydown', event => this.handleKeydown(event));
      document.addEventListener('toggle', event => {
        if (!this.inside(event.target)) return;
        if (event.target.dataset?.sentenceAdjustments !== undefined) this.adjustmentsOpen = event.target.open;
        if (event.target?.dataset?.sentenceReference !== undefined && event.target.open) this.markAssisted();
      }, true);
    }

    core() { return global.StudySentences; }
    stepList() { return this.active?.draft.mode==='flexible'?flexibleSteps:steps; }
    markAssisted() { if(!this.active||this.active.draft.assisted)return;this.active.draft.assisted=true;this.markChanged(false);this.flush(); }
    openTarget(request = {}) {
      if(!this.core()?.validRoundKey(request.roundKey)||!this.ensureState()||request.lessonId!==this.currentLesson?.id)return false;
      const expression=String(request.expression||'').trim().toLowerCase(),kind=request.kind==='phrase'?'phrase':request.kind==='word'?'word':null;
      const target=this.context.targets.find(item=>(!kind||(item.kind||'word')===kind)&&item.key===request.targetKey)||this.context.targets.find(item=>(!kind||(item.kind||'word')===kind)&&String(item.word||item.phrase||'').toLowerCase()===expression);
      if(!target)return false;
      this.flush();this.loadTarget(target.key,this.active?.draft.sourceLessonIds||[],false,{mode:'flexible',roundKey:request.roundKey});
      this.active.draft.evidenceTargetKey=typeof request.targetKey==='string'?request.targetKey.slice(0,600):target.key;
      this.updateContext();this.markChanged(false);this.flush();this.redraw();return true;
    }
    notify(message) { this.options.toast?.(message); }
    sourceLabel(source) { return `第 ${source?.book ?? '?'} 册 · 第 ${source?.number ?? '?'} 课${source?.title ? ' · ' + source.title : ''}`; }
    isBookWorkspace() { return Boolean(document.body?.classList?.contains('mls-book-workspace') && document.body.classList.contains('mls-mobile')); }
    target() { return this.context?.targets.find(item => item.key === this.active?.draft.targetKey) || null; }
    oldWords() {
      const target = this.target()?.word;
      return (this.context?.oldWords || []).filter(item => !this.core().matchesExpression(item.word, target) && !this.core().matchesExpression(target, item.word));
    }
    oldWord() {
      const target = this.target()?.word;
      return this.selectedOldItems().find(item => item.category !== 'phrase' && !this.core().matchesExpression(item.word, target) && !this.core().matchesExpression(target, item.word)) || null;
    }
    oldPhrase() { return this.selectedOldItems().find(item => item.category === 'phrase') || null; }

    wordBank() { return this.oldBank; }

    selectedOldItems() {
      const selected = this.active?.draft.selectedOldKeys || [];
      const byKey = new Map(this.wordBank().map(item => [item.key, item]));
      return selected.map(key => byKey.get(key)).filter(Boolean);
    }

    normalizeOldKeys(keys) {
      const aliases = new Map();
      for (const item of this.wordBank()) {
        aliases.set(item.key, item.key);
        for (const alias of item.aliases || []) aliases.set(alias, item.key);
      }
      return [...new Set((Array.isArray(keys) ? keys : []).map(key => aliases.get(key)).filter(Boolean))].slice(0, 100);
    }

    syncOldSelection() {
      if (!this.active) return;
      const draft = this.active.draft;
      const keys = this.normalizeOldKeys(draft.selectedOldKeys);
      if (JSON.stringify(keys) !== JSON.stringify(draft.selectedOldKeys)) this.active.dirty = true;
      draft.selectedOldKeys = keys;
      draft.oldWordKey = this.oldWord()?.key || '';
      draft.oldPhraseKey = this.oldPhrase()?.key || '';
    }

    setOldSelection(keys) {
      if (!this.active) return false;
      const normalized = this.normalizeOldKeys(keys);
      if (JSON.stringify(normalized) === JSON.stringify(this.active.draft.selectedOldKeys)) return false;
      this.active.draft.selectedOldKeys = normalized;
      this.syncOldSelection();
      this.markChanged();
      this.flush();
      this.refreshOldSelection();
      return true;
    }

    makeContext(sourceLessonIds) {
      return this.core().context({lessons:this.options.getLessons?.() || [],currentLesson:this.currentLesson,records:this.options.getRecords?.() || {},sourceLessonIds,includePhrases:true});
    }

    selectionKey(lessonId) { return `selection:v1:${encodeURIComponent(String(lessonId).slice(0, 160))}`; }

    remember(persist = false) {
      if (!this.currentLesson || !this.active) return;
      const active = this.active.draft;
      this.lessonSelections.set(this.currentLesson.id, {targetKey:active.targetKey,sourceLessonIds:[...active.sourceLessonIds],mode:active.mode,roundKey:active.roundKey});
      if (persist) {
        const key = this.selectionKey(this.currentLesson.id);
        const draft = this.core().sanitizeDraft({targetKey:active.targetKey,step:active.step,sourceLessonIds:active.sourceLessonIds,oldWordKey:active.oldWordKey,oldPhraseKey:active.oldPhraseKey,selectedOldKeys:active.selectedOldKeys,mode:active.mode,roundKey:active.roundKey});
        this.entries.set(key, {key,draft,dirty:true,state:'pending'});
      }
    }

    loadTarget(targetKey, inheritedSources = [], forceSources = false, requested = {}) {
      this.closeWordPicker(false);
      if (!targetKey) { this.active = null; return; }
      const stored=this.options.getDrafts?.()||{},legacyKey=this.core().draftKey(this.currentLesson.id,targetKey);
      const mode=requested.mode==='flexible'?'flexible':requested.mode==='transform'?'transform':stored[legacyKey]?'transform':this.options.defaultMode==='transform'?'transform':'flexible';
      const roundKey=this.core().validRoundKey(requested.roundKey)?requested.roundKey:'';
      const key=roundKey?this.core().roundDraftKey(this.currentLesson.id,targetKey,roundKey,mode):this.core().modeDraftKey(this.currentLesson.id,targetKey,mode);
      const inheritEvidenceKey=this.active?.draft.targetKey===targetKey&&this.active?.draft.roundKey===roundKey?this.active.draft.evidenceTargetKey:'';
      const inheritAssisted=this.active?.draft.targetKey===targetKey&&this.active?.draft.roundKey===roundKey&&this.active.draft.assisted===true;
      if (!this.entries.has(key)) {
        const saved = this.options.getDrafts?.()?.[key];
        const draft = this.core().sanitizeDraft(saved || {targetKey,sourceLessonIds:inheritedSources,mode,roundKey});
        draft.targetKey = targetKey;
        draft.mode=mode;draft.roundKey=roundKey;
        this.entries.set(key, {key,draft,dirty:false,state:saved ? 'saved' : 'new'});
      }
      this.active = this.entries.get(key);
      if(inheritEvidenceKey&&!this.active.draft.evidenceTargetKey){this.active.draft.evidenceTargetKey=inheritEvidenceKey;this.active.dirty=true;}
      if(inheritAssisted){this.active.draft.assisted=true;this.active.dirty=true;}
      if (forceSources) this.active.draft.sourceLessonIds = [...inheritedSources];
      this.result = null;
      this.remember();
    }

    updateContext() {
      const sources = this.active?.draft.sourceLessonIds || this.temporarySources;
      this.context = this.makeContext(sources);
      this.oldBank = this.core().wordBank?.({lessons:this.options.getLessons?.() || [],currentLesson:this.currentLesson,getVocabulary:this.options.getVocabulary,getUsage:this.options.getUsage}) || [];
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
      this.syncOldSelection();
      this.remember();
    }

    ensureState() {
      if (!this.core()) return false;
      const lesson = this.options.getLesson?.() || null;
      if (lesson?.id !== this.currentLesson?.id) {
        this.closeWordPicker(false);
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
          this.loadTarget(targetKey, previous?.sourceLessonIds || [],false,previous||{});
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
      this.closeWordPicker(false);
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
      this.oldBank = [];
      this.wordSearch = '';
      this.wordCategory = 'verb';
    }

    saveState() {
      if ([...this.entries.values()].some(entry => entry.state === 'failed')) return {state:'failed',text:'未保存：浏览器未能保存部分草稿。输入仍保留在此页面，请重试保存并备份学习数据。'};
      if (this.active?.dirty) return {state:'pending',text:'等待保存草稿…'};
      if (this.active?.state === 'saved') return {state:'saved',text:'草稿已保存到当前浏览器。'};
      return {state:'new',text:'输入后会自动保存；每课、每个目标与每一轮都有独立草稿。'};
    }

    updateSaveStatus() {
      const node = document.querySelector('#sentence-practice-content')?.querySelector('.sentence-save-status');
      if (node) {
        const status = this.saveState();node.textContent = status.text;
        if (node.dataset) node.dataset.saveState = status.state;
      }
    }

    inside(target) { return Boolean(target?.closest?.('#sentence-practice-content')); }

    openWordPicker(trigger = document.activeElement) {
      if (!this.ensureState() || !this.active) return false;
      const dialog = document.querySelector('#sentence-practice-content')?.querySelector('.sentence-word-dialog');
      if (!dialog || typeof dialog.showModal !== 'function') {
        this.notify('当前浏览器暂不支持词表弹窗，请更新浏览器后重试。');
        return false;
      }
      if (dialog.open) return true;
      this.pickerDialog = dialog;
      this.pickerTrigger = trigger;
      this.wordSearch = '';
      const input = dialog.querySelector('[data-sentence-input="word-search"]');
      if (input) input.value = '';
      if (!dialog.sentencePickerBound) {
        dialog.addEventListener('cancel', event => { event.preventDefault();this.closeWordPicker(); });
        dialog.addEventListener('close', () => { if (this.pickerDialog === dialog && !dialog.open) this.closeWordPicker(); });
        dialog.sentencePickerBound = true;
      }
      this.setWordCategory(this.wordCategory);
      this.refreshOldSelection();
      try { dialog.showModal(); }
      catch (_) { this.pickerDialog = null;this.pickerTrigger = null;return false; }
      input?.focus?.();
      return true;
    }

    closeWordPicker(restoreFocus = true) {
      const dialog = this.pickerDialog, trigger = this.pickerTrigger;
      this.pickerDialog = null;
      this.pickerTrigger = null;
      if (dialog?.open) dialog.close();
      if (restoreFocus && dialog && trigger?.isConnected !== false) trigger?.focus?.({preventScroll:true});
    }

    handleKeydown(event) {
      if (event.key === 'Escape' && this.pickerDialog?.open && this.inside(event.target)) {
        event.preventDefault();this.closeWordPicker();return;
      }
      const tab = event.target?.closest?.('[data-sentence-category]');
      if (!tab || !this.inside(tab) || !this.pickerDialog?.open) return;
      const index = wordCategories.findIndex(item => item.key === tab.dataset.sentenceCategory);
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % wordCategories.length;
      else if (event.key === 'ArrowLeft') next = (index + wordCategories.length - 1) % wordCategories.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = wordCategories.length - 1;
      else return;
      event.preventDefault();
      this.setWordCategory(wordCategories[next].key, true);
    }

    setWordCategory(category, focusTab = false) {
      if (!wordCategories.some(item => item.key === category)) return false;
      this.wordCategory = category;
      this.pickerDialog?.querySelectorAll?.('[data-sentence-category]').forEach(tab => {
        const selected = tab.dataset.sentenceCategory === category;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focusTab) tab.focus?.();
      });
      const list = this.pickerDialog?.querySelector('.sentence-word-list');
      list?.setAttribute?.('aria-labelledby', `sentence-word-tab-${category}`);
      if (list) list.scrollTop = 0;
      this.refreshWordPickerList();
      return true;
    }

    filteredOldItems() {
      const normalize = value => String(value || '').normalize('NFKC').replace(/[‘’]/g, "'").trim().toLowerCase();
      const query = normalize(this.wordSearch);
      return this.wordBank().filter(item => item.category === this.wordCategory && (!query || normalize(`${item.label || item.word || item.phrase} ${item.meaning}`).includes(query)));
    }

    pickerIcon(name, fallback) {
      const icon = this.options.icon?.(name);
      return icon ? `<span aria-hidden="true">${icon}</span>` : `<span aria-hidden="true">${fallback}</span>`;
    }

    oldChipsHTML() {
      const e = this.escape;
      return this.selectedOldItems().map(item => `<button type="button" class="sentence-old-chip" data-sentence-action="remove-old" data-sentence-old-key="${e(item.key)}" aria-label="移除 ${e(item.label || item.word || item.phrase)}${item.meaning ? ' · ' + e(item.meaning) : ''}"><span lang="en">${e(item.label || item.word || item.phrase)}</span><span class="sentence-chip-remove" aria-hidden="true">×</span></button>`).join('');
    }

    oldPickerEntryHTML() {
      return `<div class="sentence-old-picker"><button type="button" class="sentence-old-trigger" data-sentence-action="open-word-picker" aria-haspopup="dialog" aria-controls="sentence-word-picker">${this.pickerIcon('book','▤')}<strong>选用旧词</strong><span class="sentence-old-trigger-hint">${this.selectedOldItems().length ? `已选 ${this.selectedOldItems().length} 项` : '选择之前学过的词汇'}</span><span aria-hidden="true">›</span></button><div class="sentence-selected-old" aria-label="已选旧词">${this.oldChipsHTML()}</div></div>`;
    }

    wordPickerListHTML() {
      const e = this.escape, items = this.filteredOldItems(), selected = new Set(this.active?.draft.selectedOldKeys || []);
      if (!items.length) return `<p class="sentence-word-empty">${!this.wordBank().length ? '前面课程暂无可用的重点词或习惯用法，仍可围绕当前目标写句子。' : this.wordSearch.trim() ? '没有找到匹配的表达，试试其他英文或中文。' : '前面课程暂无这一类表达，可以切换其他分类。'}</p>`;
      return items.map(item => `<div class="sentence-word-row${selected.has(item.key) ? ' is-selected' : ''}"><label class="sentence-word-choice"><input type="checkbox" data-sentence-old-key="${e(item.key)}" value="${e(item.key)}"${selected.has(item.key) ? ' checked' : ''}><span class="sentence-word-expression" lang="en">${e(item.label || item.word || item.phrase)}</span><span class="sentence-word-meaning">${e(item.meaning)}</span></label><button type="button" class="sentence-word-speak" data-sentence-action="speak-old" data-sentence-old-key="${e(item.key)}" aria-label="朗读 ${e(item.label || item.word || item.phrase)}">${this.pickerIcon('volume','♪')}</button></div>`).join('');
    }

    wordPickerFooterHTML() {
      const count = this.selectedOldItems().length;
      return `<div class="sentence-word-selection-heading"><strong role="status" aria-live="polite">已选 ${count} 项</strong><button type="button" class="sentence-word-clear" data-sentence-action="clear-old"${count ? '' : ' disabled'}>清空</button></div><div class="sentence-word-chips" aria-label="词表已选表达">${this.oldChipsHTML()}</div><p class="sentence-word-footer-note">选好后回到句子里，自然运用</p><button type="button" class="sentence-word-done" data-sentence-action="close-word-picker">完成选择</button>`;
    }

    wordPickerHTML() {
      const e = this.escape;
      return `<dialog id="sentence-word-picker" class="sentence-word-dialog" aria-labelledby="sentence-word-title" aria-describedby="sentence-word-description"><div class="sentence-word-handle" aria-hidden="true"></div><header class="sentence-word-header"><div><h3 id="sentence-word-title">已学重点词表</h3><p id="sentence-word-description">汇总前面课程的重点，按需选用</p></div><button type="button" class="sentence-word-close" data-sentence-action="close-word-picker" aria-label="关闭词表">${this.pickerIcon('close','×')}</button></header><label class="sentence-word-search">${this.pickerIcon('search','⌕')}<span class="sentence-sr-only">搜索英文或中文</span><input type="search" data-sentence-input="word-search" maxlength="160" placeholder="搜索英文或中文" value="${e(this.wordSearch)}" autocomplete="off" autocapitalize="none" spellcheck="false"></label><div class="sentence-word-tabs" role="tablist" aria-label="旧知分类">${wordCategories.map(item => `<button type="button" id="sentence-word-tab-${item.key}" role="tab" data-sentence-action="word-category" data-sentence-category="${item.key}" aria-selected="${this.wordCategory === item.key}" aria-controls="sentence-word-list" tabindex="${this.wordCategory === item.key ? 0 : -1}">${item.label}</button>`).join('')}</div><p class="sentence-sr-only sentence-word-results" role="status" aria-live="polite"></p><div id="sentence-word-list" class="sentence-word-list" role="tabpanel" aria-labelledby="sentence-word-tab-${this.wordCategory}" tabindex="0">${this.wordPickerListHTML()}</div><footer class="sentence-word-footer">${this.wordPickerFooterHTML()}</footer></dialog>`;
    }

    refreshWordPickerList() {
      const list = this.pickerDialog?.querySelector('.sentence-word-list');
      if (list) list.innerHTML = this.wordPickerListHTML();
      const status = this.pickerDialog?.querySelector('.sentence-word-results');
      if (status) status.textContent = `找到 ${this.filteredOldItems().length} 项${wordCategories.find(item => item.key === this.wordCategory)?.label || ''}`;
    }

    refreshOldSelection() {
      const root = document.querySelector('#sentence-practice-content');
      const chips = root?.querySelector('.sentence-selected-old');
      if (chips) chips.innerHTML = this.oldChipsHTML();
      const hint = root?.querySelector('.sentence-old-trigger-hint');
      if (hint) hint.textContent = this.selectedOldItems().length ? `已选 ${this.selectedOldItems().length} 项` : '选择之前学过的词汇';
      const selected = new Set(this.active?.draft.selectedOldKeys || []);
      this.pickerDialog?.querySelectorAll?.('input[type="checkbox"][data-sentence-old-key]').forEach(input => {
        input.checked = selected.has(input.dataset.sentenceOldKey);
        input.closest('.sentence-word-row')?.classList?.toggle('is-selected', input.checked);
      });
      const footer = this.pickerDialog?.querySelector('.sentence-word-footer');
      if (footer) footer.innerHTML = this.wordPickerFooterHTML();
      const feedback = root?.querySelector('.sentence-feedback');
      if (feedback) feedback.innerHTML = this.feedbackHTML();
    }

    handleInput(event) {
      const input = event.target;
      if (this.inside(input) && input.dataset.sentenceInput === 'word-search' && this.active) {
        this.wordSearch = String(input.value || '').slice(0, 160);
        this.refreshWordPickerList();
        return;
      }
      if (!this.inside(input) || input.dataset.sentenceInput !== 'answer' || !this.active) return;
      const value = String(input.value || '').slice(0, 400);
      if (input.value !== value) input.value = value;
      this.active.draft.answers[this.stepList()[this.active.draft.step].kind] = value;
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
      const action = button.dataset.sentenceAction;
      if(action==='reference'){this.markAssisted();return;}
      event.preventDefault();
      if (action === 'open-word-picker') { this.openWordPicker(button);return; }
      if (action === 'close-word-picker') { this.closeWordPicker();return; }
      if (action === 'word-category') { this.setWordCategory(button.dataset.sentenceCategory);return; }
      if (action === 'clear-old') { this.setOldSelection([]);this.pickerDialog?.querySelector('[data-sentence-input="word-search"]')?.focus?.();return; }
      if (action === 'remove-old') {
        const key = button.dataset.sentenceOldKey, selected = this.active.draft.selectedOldKeys || [];
        const fromPicker = Boolean(button.closest?.('.sentence-word-dialog'));
        this.setOldSelection(selected.filter(item => item !== key));
        const scope = fromPicker ? this.pickerDialog : document.querySelector('#sentence-practice-content');
        (scope?.querySelector(fromPicker ? '[data-sentence-action="remove-old"]' : '.sentence-selected-old [data-sentence-action="remove-old"]') || scope?.querySelector(fromPicker ? '[data-sentence-input="word-search"]' : '[data-sentence-action="open-word-picker"]'))?.focus?.();
        return;
      }
      if (action === 'speak-old') {
        const item = this.wordBank().find(entry => entry.key === button.dataset.sentenceOldKey);
        if (item) {
          try { Promise.resolve(this.options.speak?.(item.label || item.word || item.phrase)).catch(() => this.notify('暂时无法播放发音，请稍后重试。')); }
          catch (_) { this.notify('暂时无法播放发音，请稍后重试。'); }
        }
        return;
      }
      if (action === 'step' || action === 'previous' || action === 'next') {
        const requested = action === 'step' ? Number(button.dataset.sentenceStep) : this.active.draft.step + (action === 'next' ? 1 : -1);
        this.active.draft.step = Math.max(0, Math.min(4, Number.isFinite(requested) ? requested : 0));
        this.markChanged(false);this.redraw(true);
      } else if (action === 'save') { this.flush();this.redraw(); }
      else if (action === 'check') {
        this.result = this.evaluate();
        this.active.draft.checkedAt = Date.now();
        this.markChanged(false);const saved=this.flush();
        if(saved&&this.core().completion({answers:this.active.draft.answers,target:this.target()})){
          const draft=this.active.draft,target=this.target(),signature=JSON.stringify([draft.mode,draft.assisted,draft.answers]);
          if(this.active.evidenceSignature!==signature){
            this.active.evidenceSignature=signature;
            try{const accepted=this.options.onEvidence?.({lessonId:this.currentLesson.id,targetKey:draft.evidenceTargetKey||target.key,target:target.word||target.phrase,kind:target.kind||'word',roundKey:draft.roundKey,answer:this.core().KINDS.map(kind=>draft.answers[kind]).join('\n'),answers:{...draft.answers},complete:true,assisted:draft.assisted===true,mode:draft.mode,at:draft.checkedAt,rulesOnly:true});if(accepted===false){this.active.evidenceSignature=null;this.notify('草稿已保存，但任务记录未保存，请再次点击检查重试。');}}catch(_){this.notify('检查已保存；任务记录暂未更新，请稍后再次检查。');this.active.evidenceSignature=null;}
          }
        }
        this.redraw();
      }
    }

    handleChange(event) {
      const select = event.target;
      if (!this.inside(select) || !this.currentLesson) return;
      if (select.dataset.sentenceOldKey !== undefined && this.active) {
        const key = select.dataset.sentenceOldKey, selected = this.active.draft.selectedOldKeys || [];
        if (select.checked && !selected.includes(key) && selected.length >= 100) {
          select.checked = false;
          this.notify('本轮最多保存 100 项旧知，请先移除部分已选表达。');
          return;
        }
        this.setOldSelection(select.checked ? [...selected, key] : selected.filter(item => item !== key));
        return;
      }
      const field = select.dataset.sentenceSelect;
      if(field==='mode'&&this.active&&['flexible','transform'].includes(select.value)){const draft=this.active.draft;this.flush();this.loadTarget(draft.targetKey,draft.sourceLessonIds,false,{mode:select.value,roundKey:draft.roundKey});this.updateContext();this.markChanged(false);this.redraw();return;}
      if (field === 'target' && this.context.targets.some(item => item.key === select.value)) {
        const sources = this.active?.draft.sourceLessonIds || this.temporarySources;
        this.flush();this.loadTarget(select.value, sources);this.updateContext();this.markChanged(false);this.redraw();
      } else if (field === 'old-word' && this.active) {
        const remaining = this.selectedOldItems().filter(item => item.category === 'phrase').map(item => item.key);
        this.setOldSelection([...remaining, select.value]);this.redraw();
      } else if (field === 'old-phrase' && this.active) {
        const remaining = this.selectedOldItems().filter(item => item.category !== 'phrase').map(item => item.key);
        this.setOldSelection([...remaining, select.value]);this.redraw();
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
        const combined=this.active.draft.answers.combined,selected=this.selectedOldItems(),target=this.target()?.word;
        const oldWord=selected.find(item=>item.category!=='phrase'&&!this.core().matchesExpression(item.word,target)&&!this.core().matchesExpression(target,item.word)&&this.core().matchesExpression(combined,item.word))||this.oldWord();
        const oldPhrase=selected.find(item=>item.category==='phrase'&&this.core().matchesExpression(combined,item.phrase))||this.oldPhrase();
        return this.core().check({mode:this.active.draft.mode,answers:this.active.draft.answers,target:this.target(),oldWord,oldPhrase,grammarCheck:this.options.grammarCheck});
      } catch (_) {
        return {rows:[],writtenCount:0,rulesOnly:true,error:'本次检查暂时无法完成；草稿已保留，请自行核对句型、时态和句意后重试。'};
      }
    }

    render() {
      this.closeWordPicker(false);
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
      this.closeWordPicker(false);
      const root = document.querySelector('#sentence-practice-content');
      this.rememberAdjustments(root);
      if (!root || !this.ensureState()) return;
      root.innerHTML = this.bodyHTML();
      if (focusInput) root.querySelector('.sentence-textarea')?.focus?.();
    }

    optionHTML(item, selected, phrase = false) {
      const e = this.escape;
      return `<option value="${e(item.key)}"${item.key === selected ? ' selected' : ''}>${e(phrase ? item.phrase : item.word || item.phrase)}${item.meaning ? ' · ' + e(item.meaning) : ''}</option>`;
    }

    sourceHTML() { return ''; }

    controlsHTML() {
      const draft = this.active?.draft, flexible = draft?.mode === 'flexible';
      const currentTargets = this.context.targets.filter(item => item.source.id === this.currentLesson.id);
      const oldTargets = this.context.targets.filter(item => item.source.id !== this.currentLesson.id);
      return `<div class="sentence-controls"><label class="sentence-field">练习目标<select class="sentence-select" data-sentence-select="target"${!this.context.targets.length ? ' disabled' : ''}>${currentTargets.length ? `<optgroup label="本课表达">${currentTargets.map(item => this.optionHTML(item, draft?.targetKey)).join('')}</optgroup>` : ''}${oldTargets.length ? `<optgroup label="复习表达">${oldTargets.map(item => this.optionHTML(item, draft?.targetKey)).join('')}</optgroup>` : ''}${!this.context.targets.length ? '<option>暂无可用目标</option>' : ''}</select></label><label class="sentence-field">训练方式<select class="sentence-select" data-sentence-select="mode"><option value="flexible"${flexible ? ' selected' : ''}>灵活五句</option><option value="transform"${!flexible ? ' selected' : ''}>句型变换（可选）</option></select></label></div>`;
    }

    adjustmentsHTML() {
      return `<details class="sentence-adjustments"${this.adjustmentsOpen ? ' open' : ''} data-sentence-adjustments><summary>调整练习目标与方式</summary>${this.controlsHTML()}</details>`;
    }

    bodyHTML() {
      if (this.isBookWorkspace()) return this.workspaceHTML();
      const e = this.escape, target = this.target(), draft = this.active?.draft, flexible = draft?.mode === 'flexible';
      const status = this.saveState();
      return `<div class="sentence-header"><h3>${flexible ? '一个目标，灵活写五句' : '句型变换练习'}</h3><p>${flexible ? '围绕一个单词或习惯用法变换语境，尝试补充信息、提问、回应和联系旧知。这五个提示是本站的训练安排，不是固定五种句型要求。' : '围绕同一原句练句型转换，再联系旧知写新句子。此模式保留独立草稿，可切回灵活五句。'}</p></div>${this.adjustmentsHTML()}${target && draft ? this.editorHTML() : '<p class="sentence-note">本课暂无可用单词或习惯用法。</p>'}<p class="sentence-save-status" data-save-state="${status.state}" role="status" aria-live="polite">${e(status.text)}</p>${draft?.assisted ? '<p class="sentence-note sentence-assisted">本轮已查看参考示例；关闭示例后仍保留参考标记。</p>' : ''}${this.referenceHTML()}${this.wordPickerHTML()}`;
    }

    knowledgeHTML() {
      const e = this.escape, target = this.target();
      if (!target) return '';
      return `<div class="sentence-target"><span class="sentence-target-label">本次目标</span><p><strong lang="en">${e(target.word || target.phrase)}</strong>${target.meaning ? `<span> · ${e(target.meaning)}</span>` : ''}</p></div>`;
    }

    workspaceHTML() {
      const e = this.escape, draft = this.active?.draft, target = this.target();
      const adjustments = this.adjustmentsHTML();
      if (!target || !draft) return `<div class="sentence-header"><h3>五句练习</h3><p>本课暂无可用单词或习惯用法。</p></div>${adjustments}`;
      const list=this.stepList(),step = list[draft.step], flexible=draft.mode==='flexible',combined = draft.step === 4, status = this.saveState();
      const titles = flexible?['换一个语境，写一句自己的话','给句子补充时间地点','模仿表达，换个说法','试着提问，或写一句回应','把旧知识，用进新句子']:['先写一句肯定句','把原句改成否定句','向原句提一个问题','试着用特殊疑问词提问','把旧知识，用进新句子'];
      const hints = flexible?['用目标单词或习惯用法，联系自己的生活。','换一个时间、地点或人物，不必改成否定句。','回忆课文表达，试着变化人物、动作或情境。','用目标表达提出问题，或写一句对话回应。','可联系旧知，也可换个语境写一句。']:['用目标词，写一句完整的英文。','沿用第 1 句的人物、时态和情境。','保留目标词，写一个可用 yes / no 回答的问题。','保留目标词，用 what / who / where 等提问。','选一个旧词和一个旧用法，写一句新句子。'];
      const navigation = list.map((item,index) => `<li><button type="button" class="sentence-step${index === draft.step ? ' active' : ''}${draft.answers[item.kind].trim() ? ' written' : ''}" data-sentence-action="step" data-sentence-step="${index}"${index === draft.step ? ' aria-current="step"' : ''} aria-label="第 ${index + 1} 步 ${e(item.label)}${draft.answers[item.kind].trim() ? '，已填写' : ''}"><span>${index + 1}</span></button></li>`).join('');
      const original = !flexible && draft.step > 0 && !combined ? `<div class="sentence-original"><strong>第 1 句 · 肯定原句</strong><p lang="en">${draft.answers.affirmative.trim() ? e(draft.answers.affirmative) : '还没有原句，请先回到第 1 步。'}</p></div>` : '';
      if (!this.result && draft.checkedAt) this.result = this.evaluate();
      return `<div class="sentence-workspace${combined ? ' sentence-workspace-combined' : ''}"><div class="sentence-progress"><ol class="sentence-steps" aria-label="五句练习步骤">${navigation}</ol><p class="sentence-step-count">第 ${draft.step + 1} 句 / 共 5 句</p></div><div class="sentence-header"><h3 id="sentence-step-title">${e(titles[draft.step])}</h3><p id="sentence-step-hint">${e(hints[draft.step])}</p></div>${this.knowledgeHTML()}${this.oldPickerEntryHTML()}${adjustments}${original}<section class="sentence-editor" aria-labelledby="sentence-step-title"><label class="sentence-field" for="sentence-answer">${combined ? '我的综合句' : flexible ? '我的句子' : '我的' + e(step.label)}<textarea id="sentence-answer" class="sentence-textarea" data-sentence-input="answer" rows="${combined ? 3 : 5}" maxlength="400" lang="en" spellcheck="true" autocapitalize="sentences" aria-describedby="sentence-step-hint sentence-counter" placeholder="在这里写下这一句英文…">${e(draft.answers[step.kind])}</textarea></label><div class="sentence-draft-meta"><p class="sentence-save-status" data-save-state="${status.state}" role="status" aria-live="polite">${e(status.text)}</p><p id="sentence-counter" class="sentence-counter">${draft.answers[step.kind].length} / 400 字符</p></div><div class="sentence-actions"><button type="button" class="button primary" data-sentence-action="check">检查五句基本要求</button><div class="sentence-page-actions"><button type="button" class="button subtle" data-sentence-action="previous"${draft.step === 0 ? ' disabled' : ''}>上一句</button><button type="button" class="button subtle" data-sentence-action="next"${draft.step === 4 ? ' disabled' : ''}>下一句</button></div></div></section><section class="sentence-feedback" aria-live="polite">${this.feedbackHTML()}</section>${draft.assisted?'<p class="sentence-note sentence-assisted">本轮已查看参考示例；关闭示例后仍保留参考标记。</p>':''}${this.referenceHTML()}${this.wordPickerHTML()}</div>`;
    }

    editorHTML() {
      const e = this.escape, draft = this.active.draft, target = this.target(), list=this.stepList(),step = list[draft.step];
      const navigation = list.map((item, index) => `<li><button type="button" class="sentence-step${index === draft.step ? ' active' : ''}${draft.answers[item.kind].trim() ? ' written' : ''}" data-sentence-action="step" data-sentence-step="${index}"${index === draft.step ? ' aria-current="step"' : ''} aria-label="第 ${index + 1} 步 ${e(item.label)}${draft.answers[item.kind].trim() ? '，已填写' : ''}"><span>${index + 1}</span>${e(item.label)}${draft.answers[item.kind].trim() ? '<small>已填写</small>' : ''}</button></li>`).join('');
      const original = draft.mode==='transform'&&draft.step > 0 && draft.step < 4 ? `<div class="sentence-original"><strong>第 1 句 · 肯定原句</strong><p lang="en">${draft.answers.affirmative.trim() ? e(draft.answers.affirmative) : '还没有原句，请先回到第 1 步写肯定句。'}</p><p class="sentence-note">对照原句自行核对人物、时态和情境；本地规则无法判断四句是否语义对应。</p></div>` : '';
      if (!this.result && draft.checkedAt) this.result = this.evaluate();
      return `<ol class="sentence-steps" aria-label="五句练习步骤">${navigation}</ol><section class="sentence-editor" aria-labelledby="sentence-step-title">${this.knowledgeHTML()}${this.oldPickerEntryHTML()}<h4 id="sentence-step-title">第 ${draft.step + 1} / 5 句 · ${e(step.label)}</h4><p id="sentence-step-hint" class="sentence-note">${e(step.hint)}</p>${original}<label class="sentence-field" for="sentence-answer">${e(step.label)}<textarea id="sentence-answer" class="sentence-textarea" data-sentence-input="answer" rows="5" maxlength="400" lang="en" spellcheck="true" autocapitalize="sentences" aria-describedby="sentence-step-hint sentence-counter" placeholder="在这里写下这一句英文…">${e(draft.answers[step.kind])}</textarea></label><p id="sentence-counter" class="sentence-counter">${draft.answers[step.kind].length} / 400 字符</p><div class="sentence-actions"><button type="button" class="button" data-sentence-action="previous"${draft.step === 0 ? ' disabled' : ''}>上一句</button><button type="button" class="button" data-sentence-action="next"${draft.step === 4 ? ' disabled' : ''}>下一句</button><button type="button" class="button primary" data-sentence-action="check">检查五句基本要求</button><button type="button" class="button subtle" data-sentence-action="save">保存草稿</button></div></section><section class="sentence-feedback" aria-live="polite">${this.feedbackHTML()}</section>`;
    }

    feedbackHTML() {
      const e = this.escape, result = this.result;
      if (!result) return '<p class="sentence-note">填写后检查五句基本要求。这里只提供有限规则反馈；句意、自然度和语法仍需自己或老师核对，写完不代表掌握。</p>';
      if (result.error) return `<p class="sentence-note">${e(result.error)}</p>`;
      const labels = {'empty':'尚未填写','needs-work':'请修改基本要求','review':'需要人工核对','ready':'有限检查已完成'};
      return `<h4>五句基本要求反馈</h4><p class="sentence-note">已填写 ${Number(result.writtenCount) || 0} / 5 句。有限检查已完成也不代表整句正确；请继续核对句意、自然度、时态和情境。</p>${(Array.isArray(result.rows) ? result.rows : []).map(row => `<article class="sentence-feedback-row" data-status="${Object.hasOwn(labels, row.status) ? row.status : 'review'}"><h5>${e(row.label || steps.find(item => item.kind === row.kind)?.label || '句子反馈')} <span class="sentence-status">${e(labels[row.status] || labels.review)}</span></h5>${Array.isArray(row.issues) && row.issues.length ? `<ul>${row.issues.map(issue => `<li>${e(issue)}</li>`).join('')}</ul>` : ''}${Array.isArray(row.notes) ? row.notes.map(note => `<p class="sentence-note">${e(note)}</p>`).join('') : ''}</article>`).join('')}`;
    }

    referenceHTML() {
      if(this.active?.draft.mode==='flexible')return '<details class="sentence-reference" data-sentence-reference><summary data-sentence-action="reference">查看参考示例（查看会标记本轮借助参考）</summary><p class="sentence-note">以下是本站自编的变化示例，用于说明练习方式，不是本轮标准答案。请不要直接照抄。</p><ul><li lang="en">My sister looks at the book after dinner.</li><li lang="en">Yesterday I looked at the book in the library.</li><li lang="en">Why do you look at that book every morning?</li></ul><p class="sentence-note">可以变化人物、时间、地点或回应方式，无需固定成五种句型。</p></details>';
      return '<details class="sentence-reference" data-sentence-reference><summary data-sentence-action="reference">查看教学示例：book + sister + look at</summary><p class="sentence-note">以下是为练习编写的教学示例，并非教材原文。请用自己选的词写句子；此示例不会填入你的草稿。</p><ol><li>肯定句：<span lang="en">You look at the book.</span></li><li>否定句：<span lang="en">You do not look at the book.</span></li><li>一般疑问句：<span lang="en">Do you look at the book?</span></li><li>特殊疑问句：<span lang="en">Why do you look at the book?</span></li><li>旧知综合句：<span lang="en">My sister and I look at the book after dinner.</span></li></ol><p class="sentence-note">前四句沿用同一情境；第五句加入 sister，另写新句子。自己的句子不必与示例相同。</p></details>';
    }
  }

  global.SentencePractice = SentencePractice;
})(window);
