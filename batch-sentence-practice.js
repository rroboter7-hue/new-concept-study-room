(function (global) {
  'use strict';

  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const template = '目标词：book\n旧词：sister\n旧用法：look at\n原句：You look at the book.\n否定句：You do not look at the book.\n一般疑问句：Do you look at the book?\n特殊疑问句：Why do you look at the book?\n旧知综合句：My sister and I look at the book after dinner.';
  const labels = {free:'自由造句',affirmative:'肯定原句',negative:'否定句',yesno:'一般疑问句',wh:'特殊疑问句',combined:'旧知综合句'};

  class BatchSentencePractice {
    constructor(options = {}) {
      this.options = options;
      this.escape = options.escapeHTML || escapeText;
      this.entries = new Map();
      this.active = null;
      this.lesson = null;
      this.lessonId = null;
      this.saveTimer = null;
      this.saveGeneration = 0;
      this.workTimer = null;
      this.generation = 0;
      this.copyGeneration = 0;
      this.results = [];
      this.checking = false;
      this.total = 0;
      this.progress = '';
      this.visibleResults = 50;
      this.promptChunks = [];
      this.promptIndex = 0;
      this.manualText = '';
      this.parsedCache = null;
      document.addEventListener('input', event => this.handleInput(event));
      document.addEventListener('change', event => this.handleChange(event));
      document.addEventListener('click', event => this.handleClick(event));
    }

    core() { return global.StudySentenceBatch; }
    root() { return document.querySelector('#batch-sentence-content'); }
    inside(target) { return Boolean(target?.closest?.('#batch-sentence-content')); }
    notify(text) { this.options.toast?.(text); }

    ensureState() {
      const lesson = this.options.getLesson?.() || null;
      const id = typeof lesson?.id === 'string' ? lesson.id : '';
      if (id !== this.lessonId) {
        this.flush();
        this.clearReview();
        this.lessonId = id;
        this.active = null;
      }
      this.lesson = lesson;
      if (!id || !this.core()) return false;
      if (!this.entries.has(id)) {
        const saved = this.options.getDraft?.(id);
        this.entries.set(id, {draft:this.core().sanitizeDraft(saved),dirty:false,state:saved ? 'saved' : 'new'});
      }
      this.active = this.entries.get(id);
      return true;
    }

    cancel(announce = true) {
      const wasChecking = this.checking;
      this.generation++;
      this.copyGeneration++;
      if (this.workTimer !== null) global.clearTimeout(this.workTimer);
      this.workTimer = null;
      this.checking = false;
      if (wasChecking) {
        this.progress = `已取消：已检查 ${this.results.length} / ${this.total} 句，输入和已完成反馈仍保留。`;
        if (announce) this.updatePanels();
      }
    }

    clearReview() {
      this.cancel(false);
      this.results = [];
      this.total = 0;
      this.progress = '';
      this.visibleResults = 50;
      this.promptChunks = [];
      this.promptIndex = 0;
      this.manualText = '';
      this.parsedCache = null;
    }

    markChanged(reviewChanged = true) {
      if (!this.active) return;
      if (reviewChanged) {
        this.clearReview();
        this.progress = '输入已改变，请重新进行本地初检。';
      }
      this.active.dirty = true;
      this.active.state = 'pending';
      if (this.saveTimer !== null) global.clearTimeout(this.saveTimer);
      const saveGeneration = ++this.saveGeneration;
      this.saveTimer = global.setTimeout(() => {
        if (saveGeneration !== this.saveGeneration) return;
        this.saveTimer = null;
        this.flush();
      }, 450);
      this.updatePanels();
    }

    flush() {
      this.saveGeneration++;
      if (this.saveTimer !== null) global.clearTimeout(this.saveTimer);
      this.saveTimer = null;
      let success = true;
      for (const [id, entry] of this.entries) {
        if (!entry.dirty) continue;
        let saved = false;
        try { saved = this.options.saveDraft?.(id, this.core().sanitizeDraft(entry.draft)) === true; } catch (_) { saved = false; }
        entry.state = saved ? 'saved' : 'failed';
        entry.dirty = !saved;
        if (!saved) success = false;
      }
      this.updateSaveStatus();
      return success;
    }

    reloadFromStorage() {
      this.clearReview();
      this.saveGeneration++;
      if (this.saveTimer !== null) global.clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.entries.clear();
      this.active = null;
      this.lesson = null;
      this.lessonId = null;
    }

    saveStatus() {
      if ([...this.entries.values()].some(entry => entry.state === 'failed')) return {state:'failed',text:'未保存：浏览器未能保存部分草稿。文字仍保留在当前页面，请导出全部文字后重试保存。'};
      if (this.active?.dirty) return {state:'pending',text:'等待保存草稿…'};
      if (this.active?.state === 'saved') return {state:'saved',text:'草稿已保存到当前浏览器，也会包含在学习备份中。'};
      return {state:'new',text:'每课独立保存；输入和批改笔记会自动保存。'};
    }

    updateSaveStatus() {
      const node = this.root()?.querySelector('.batch-save-status');
      if (!node) return;
      const status = this.saveStatus();
      node.textContent = status.text;
      if (node.dataset) node.dataset.saveState = status.state;
    }

    parseCurrent() {
      const draft = this.active?.draft;
      if (!draft) return {rows:[],groups:[],notices:[]};
      if (!this.parsedCache || this.parsedCache.rawText !== draft.rawText || this.parsedCache.mode !== draft.mode) {
        this.parsedCache = {rawText:draft.rawText,mode:draft.mode,value:this.core().parse(draft.rawText,draft.mode)};
      }
      return this.parsedCache.value;
    }

    handleInput(event) {
      const input = event.target;
      if (!this.inside(input) || !this.active) return;
      const field = input.dataset.batchInput;
      if (field === 'text') { this.active.draft.rawText = String(input.value ?? '');this.markChanged(); }
      else if (field === 'notes') { this.active.draft.notes = String(input.value ?? '');this.markChanged(false); }
    }

    handleChange(event) {
      const input = event.target;
      if (!this.inside(input) || input.dataset.batchSelect !== 'mode' || !this.active) return;
      this.active.draft.mode = input.value === 'conversion' ? 'conversion' : 'free';
      this.markChanged();
      this.redraw();
    }

    async handleClick(event) {
      const button = event.target?.closest?.('[data-batch-action]');
      if (!button || !this.inside(event.target)) return;
      event.preventDefault?.();
      if (!this.ensureState()) return;
      switch (button.dataset.batchAction) {
        case 'check': this.startCheck();break;
        case 'cancel': this.cancel();break;
        case 'save': this.flush();break;
        case 'more': this.visibleResults += 50;this.updatePanels();break;
        case 'template': this.appendText(template);break;
        case 'guided': {
          let text = '';
          try { text = this.options.getGuidedText?.() || ''; } catch (_) { text = ''; }
          if (typeof text !== 'string' || !text.trim()) this.notify('当前五句草稿还没有可追加的内容。');
          else this.appendText(text);
          break;
        }
        case 'copy': await this.copyCurrent();break;
        case 'prompt-previous': this.movePrompt(-1);break;
        case 'prompt-next': this.movePrompt(1);break;
        case 'export': this.exportAll();break;
      }
    }

    appendText(text) {
      const draft = this.active.draft;
      draft.rawText += (draft.rawText ? '\n\n' : '') + text;
      draft.mode = 'conversion';
      this.markChanged();
      this.redraw();
    }

    startCheck() {
      if (!this.ensureState()) return;
      this.clearReview();
      const parsed = this.parseCurrent();
      this.total = parsed.rows.length;
      if (!this.total) { this.progress = '请先输入要检查的英文句子。';this.updatePanels();return; }
      this.flush();
      this.checking = true;
      const generation = this.generation, entry = this.active, lessonId = this.lessonId;
      let index = 0;
      const step = () => {
        if (generation !== this.generation || entry !== this.active || this.options.getLesson?.()?.id !== lessonId) return;
        this.workTimer = null;
        const stop = Math.min(index + 25, parsed.rows.length);
        for (; index < stop; index++) {
          const row = parsed.rows[index];
          let result;
          try { result = this.core().checkRow(row, {grammarCheck:this.options.grammarCheck,sentenceCheck:this.options.sentenceCheck}); }
          catch (_) { result = {id:row.id,lineNumber:row.lineNumber,kind:row.kind,original:row.text,status:'review',issues:[],notes:['这一句的本地检查暂时未完成，请人工复核。']}; }
          this.results.push(result);
        }
        this.checking = index < parsed.rows.length;
        this.progress = this.checking ? `正在进行本地初检：${index} / ${this.total} 句…` : `本地初检完成：${index} / ${this.total} 句。请继续完整复核句意与转换对应。`;
        this.updatePanels();
        if (this.checking) this.workTimer = global.setTimeout(step, 0);
      };
      step();
    }

    preparePrompts() {
      if (!this.promptChunks.length) this.promptChunks = this.core().promptParts(this.parseCurrent(), {lessonTitle:this.lesson?.title || ''});
      this.promptIndex = Math.max(0, Math.min(this.promptIndex, this.promptChunks.length - 1));
      return this.promptChunks[this.promptIndex];
    }

    movePrompt(amount) {
      this.preparePrompts();
      this.copyGeneration++;
      this.promptIndex = Math.max(0, Math.min(this.promptChunks.length - 1, this.promptIndex + amount));
      this.manualText = '';
      this.updatePanels();
    }

    async copyCurrent() {
      const part = this.preparePrompts();
      if (!part) { this.progress = '请先输入句子，再复制给豆包。';this.updatePanels();return; }
      this.flush();
      const token = ++this.copyGeneration, generation = this.generation, entry = this.active, lessonId = this.lessonId;
      const stillCurrent = () => token === this.copyGeneration && generation === this.generation && entry === this.active && this.options.getLesson?.()?.id === lessonId;
      try {
        if (typeof this.options.copyText !== 'function') throw new Error('Copy unavailable');
        await this.options.copyText(part.text);
        if (!stillCurrent()) return;
        this.manualText = '';
        this.progress = `已复制第 ${this.promptIndex + 1} / ${this.promptChunks.length} 段。打开豆包后自行粘贴发送。`;
      } catch (_) {
        if (!stillCurrent()) return;
        this.manualText = part.text;
        this.progress = '自动复制未成功，请在下方文本框中手动复制当前完整分段。';
      }
      this.updatePanels();
      if (this.manualText) {
        const textarea = this.root()?.querySelector('[data-batch-copy-text]');
        textarea?.focus?.();textarea?.select?.();
      }
    }

    exportAll() {
      const draft = this.active.draft;
      const lines = [`批量造句 · ${this.lesson?.title || this.lessonId}`, `输入模式：${draft.mode === 'conversion' ? '四句型转换' : '自由造句'}`, '', '【完整输入】', draft.rawText, '', '【本地初检反馈】', `已完成 ${this.results.length} / ${this.parseCurrent().rows.length} 句；反馈仍需完整复核。`];
      if (!this.results.length) lines.push('尚未进行本地初检。');
      for (const result of this.results) {
        lines.push(`第 ${result.lineNumber} 行 · ${result.status === 'needs-work' ? '发现已覆盖问题' : '待完整复核'}`, result.original);
        lines.push(...(result.issues || []), ...(result.notes || []), '');
      }
      lines.push('', '【批改结果笔记】', draft.notes);
      this.preparePrompts();
      lines.push('', '【豆包完整分段文本】');
      this.promptChunks.forEach((part, index) => lines.push(`\n第 ${index + 1} / ${this.promptChunks.length} 段`, part.text));
      const text = lines.join('\n');
      const title = (this.lesson?.title || this.lessonId || '本课').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
      try {
        if (typeof this.options.downloadText !== 'function') throw new Error('Download unavailable');
        this.options.downloadText(`${title}-批量造句.txt`, text);
        this.notify('完整输入、已完成反馈和笔记已导出。');
      } catch (_) {
        this.manualText = text;
        this.progress = '自动导出未成功，请在下方文本框中手动复制全部文字。';
        this.updatePanels();
      }
    }

    countText() {
      const parsed = this.parseCurrent();
      return `共 ${parsed.rows.length} 句${this.active?.draft.mode === 'conversion' ? ` · ${parsed.groups.length} 组` : ''}；不限制输入条数。`;
    }

    render() {
      if (!this.core()) return '<section id="batch-sentence-content" class="batch-sentence-practice"><p class="batch-note">批量检查尚未加载，请刷新后重试。</p></section>';
      if (!this.ensureState()) return '<section id="batch-sentence-content" class="batch-sentence-practice"><p class="batch-note">请先选择一篇课文。</p></section>';
      return `<section id="batch-sentence-content" class="batch-sentence-practice" aria-label="批量造句检查">${this.bodyHTML()}</section>`;
    }

    redraw() { const root = this.root();if (root && this.active) root.innerHTML = this.bodyHTML(); }

    updatePanels() {
      const root = this.root();
      if (!root || !this.active) return;
      const counter = root.querySelector('.batch-count');if (counter) counter.textContent = this.countText();
      const feedback = root.querySelector('.batch-feedback');if (feedback) feedback.innerHTML = this.feedbackHTML();
      const prompt = root.querySelector('.batch-prompt-panel');if (prompt) prompt.innerHTML = this.promptHTML();
      this.updateSaveStatus();
    }

    bodyHTML() {
      const e = this.escape, draft = this.active.draft, status = this.saveStatus();
      return `<div class="batch-heading"><h3>批量造句检查</h3><p>一起写下多句英文，先做本地初检，再复制给豆包完整复核。</p></div><div class="batch-controls"><label class="batch-field" for="batch-mode">输入模式<select id="batch-mode" data-batch-select="mode"><option value="free"${draft.mode === 'free' ? ' selected' : ''}>自由造句 · 一行一句</option><option value="conversion"${draft.mode === 'conversion' ? ' selected' : ''}>四句型转换 · 标明原句和句型</option></select></label><div class="batch-actions"><button type="button" class="button subtle" data-batch-action="template">追加转换模板</button><button type="button" class="button subtle" data-batch-action="guided">追加当前五句草稿</button></div></div><p id="batch-input-hint" class="batch-note">${draft.mode === 'conversion' ? '每组用“原句：”或“肯定句：”开始，再标明否定句、一般疑问句、特殊疑问句；可加旧知综合句。目标词、旧词、旧用法也可按模板标明。未标明的行仍会保留。' : '每个非空行作为一句独立检查。需要核对句型转换时，请选择四句型转换并标明每组原句。'}</p><label class="batch-field" for="batch-text">英文句子<textarea id="batch-text" class="batch-textarea" data-batch-input="text" rows="10" lang="en" spellcheck="true" aria-describedby="batch-input-hint batch-count">${e(draft.rawText)}</textarea></label><p id="batch-count" class="batch-count">${e(this.countText())}</p><div class="batch-actions"><button type="button" class="button primary" data-batch-action="check">本地初检全部</button><button type="button" class="button" data-batch-action="export">导出全部文字和反馈</button><button type="button" class="button subtle" data-batch-action="save">重试保存</button></div><p class="batch-save-status" data-save-state="${status.state}" role="status">${e(status.text)}</p><section class="batch-feedback" aria-live="polite">${this.feedbackHTML()}</section><section class="batch-prompt-panel" aria-label="复制给豆包">${this.promptHTML()}</section><label class="batch-field batch-notes" for="batch-notes">批改结果笔记（可选）<textarea id="batch-notes" class="batch-textarea" data-batch-input="notes" rows="5" placeholder="把豆包的批改结果粘贴到这里，作为本课笔记保存。">${e(draft.notes)}</textarea></label><p class="batch-note">笔记按原文本保存，不会自动评分或改变课程学习记录。</p>`;
    }

    feedbackHTML() {
      const e = this.escape, parsed = this.parseCurrent();
      const notices = parsed.notices.map(notice => `<p class="batch-notice">${e(notice)}</p>`).join('');
      const rows = this.results.slice(0, this.visibleResults).map(result => `<article class="batch-result-card" data-status="${result.status === 'needs-work' ? 'needs-work' : 'review'}"><h4>第 ${Number(result.lineNumber) || 0} 行 · ${e(labels[result.kind] || '句子')} <span>${result.status === 'needs-work' ? '发现已覆盖问题' : '待完整复核'}</span></h4><p class="batch-result-original" lang="en">${e(result.original)}</p>${Array.isArray(result.issues) && result.issues.length ? `<ul>${result.issues.map(issue => `<li>${e(issue)}</li>`).join('')}</ul>` : ''}${Array.isArray(result.notes) ? result.notes.map(note => `<p class="batch-note">${e(note)}</p>`).join('') : ''}</article>`).join('');
      return `<p class="batch-progress" role="status">${e(this.progress || '本地初检只覆盖部分语法和词项要求；未发现已覆盖问题的句子仍待完整复核。')}</p>${this.checking ? '<button type="button" class="button" data-batch-action="cancel">取消本次检查</button>' : ''}${notices}${rows}${this.results.length > this.visibleResults ? `<p class="batch-note">已显示 ${this.visibleResults} / ${this.results.length} 条反馈，所有输入都会检查和导出。</p><button type="button" class="button" data-batch-action="more">再显示 50 条反馈</button>` : ''}`;
    }

    promptHTML() {
      const e = this.escape, total = this.promptChunks.length;
      return `<h4>复制给豆包完整复核</h4><p class="batch-note">句子和原句对应关系会连同要求一起复制。长内容自动分段，每次复制一段；豆包自身的上下文长度和免费额度仍适用。</p>${total ? `<p class="batch-note">当前第 ${this.promptIndex + 1} / ${total} 段</p>` : ''}<div class="batch-actions"><button type="button" class="button primary" data-batch-action="copy">复制${total ? '当前' : '第 1'}段给豆包</button><button type="button" class="button" data-batch-action="prompt-previous"${!total || this.promptIndex === 0 ? ' disabled' : ''}>上一段</button><button type="button" class="button" data-batch-action="prompt-next"${!total || this.promptIndex >= total - 1 ? ' disabled' : ''}>下一段</button><a class="button" href="https://www.doubao.com/chat/" target="_blank" rel="noopener noreferrer">打开豆包</a></div>${this.manualText ? `<label class="batch-field batch-copy-fallback" for="batch-copy-text">手动复制文本<textarea id="batch-copy-text" class="batch-textarea" data-batch-copy-text rows="8" readonly>${e(this.manualText)}</textarea></label>` : ''}`;
    }
  }

  global.BatchSentencePractice = BatchSentencePractice;
})(window);
