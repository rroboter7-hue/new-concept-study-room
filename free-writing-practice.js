/* Independent free-writing drafts. Finite feedback is not a language score. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FreeWritingPractice = api;
})(typeof window !== 'undefined' ? window : globalThis, function (global) {
  'use strict';

  const MAX_ANSWER = 1000;
  const TYPE_LABELS = Object.freeze({spelling:'拼写',grammar:'语法',tense:'时态与动词',collocation:'搭配',capitalization:'大小写',punctuation:'标点',target:'目标表达',completeness:'句意完整性',review:'需复核'});
  const HONORIFICS = new Set(['mr','mrs','ms','dr','sir','madam','prof','rev','esq','mister','madame','mademoiselle','monsieur','signor']);
  const own = (value, field) => {
    if (!value || typeof value !== 'object') return undefined;
    const property = Object.getOwnPropertyDescriptor(value, field);
    return property && Object.prototype.hasOwnProperty.call(property, 'value') ? property.value : undefined;
  };
  const text = (value, max = 1200) => typeof value === 'string' ? value.slice(0, max) : '';
  const normalize = value => text(value).normalize('NFKC').replace(/[‘’]/g, "'").trim().toLowerCase();
  const escapeHTML = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const encoded = value => encodeURIComponent(Array.from(String(value)).map(char => char.length === 1 && /[\uD800-\uDFFF]/.test(char) ? '\uFFFD' : char).join(''));
  const before = (a, b) => !!a && !!b && Number.isInteger(a.book) && Number.isInteger(a.number) && (a.book < b.book || a.book === b.book && a.number < b.number);
  const draftKey = lessonId => 'free-writing:v1:' + encoded(lessonId);
  const clone = value => JSON.parse(JSON.stringify(value));
  function excludedPerson(item, lesson, api) {
    if (own(item, 'isPersonName') === true || own(item, 'isHonorific') === true || own(item, 'isPersonNameTarget') === true) return true;
    const word = normalize(own(item, 'word') || own(item, 'label')).replace(/\.$/, '');
    return HONORIFICS.has(word) || !!api?.isPersonNameTarget?.(item, lesson);
  }

  function buildTargets(options = {}) {
    const lesson = options.lesson;
    if (!lesson || typeof lesson.id !== 'string' || !lesson.id) return [];
    const input = Array.isArray(options.targets) ? {words:options.targets.filter(row => row.kind !== 'phrase'),phrases:options.targets.filter(row => row.kind === 'phrase')} : options.targets || {};
    const result = [], seen = new Set(), personAPI = options.personAPI || global.StudyPersonNameTargets;
    const earlierLesson = row => {
      const source = own(row, 'source');
      if (source && typeof source === 'object') return source;
      const sourceId = own(row, 'sourceLessonId') || own(row, 'lessonId');
      return (options.lessons || []).find(item => item.id === sourceId);
    };
    function add(rows, kind, prior) {
      let count = 0;
      for (const item of Array.isArray(rows) ? rows : []) {
        if (!item || typeof item !== 'object') continue;
        const label = text(own(item, kind) || own(item, 'label'), 160).trim(), normalized = normalize(label);
        if (!label || !/[a-z]/i.test(label) || seen.has(kind + ':' + normalized)) continue;
        if (kind === 'word' && (own(item, 'isLessonNew') === false && !prior || excludedPerson(item, prior ? earlierLesson(item) : lesson, personAPI))) continue;
        const source = prior ? earlierLesson(item) : lesson;
        if (prior && !before(source, lesson)) continue;
        if (prior && count >= (Number.isInteger(options.priorLimit) ? Math.max(0, Math.min(4, options.priorLimit)) : kind === 'phrase' ? 1 : 2)) break;
        const requiredCount = prior ? (own(item, 'requiredCount') === 2 ? 2 : 1) : 5;
        const key = kind + ':' + encoded(source.id) + ':' + encoded(normalized);
        result.push({...item,key,kind,label,[kind]:label,prior,requiredCount,meaning:text(own(item,'meaning') || own(item,'note')),source:{id:source.id,book:source.book,number:source.number,title:text(source.title,300)}});
        seen.add(kind + ':' + normalized); count++;
      }
    }
    add(input.words, 'word', false); add(input.phrases, 'phrase', false);
    add(input.priorWords, 'word', true); add(input.priorPhrases, 'phrase', true);
    return result;
  }

  function classifyIssue(issue) {
    const explicit = text(own(issue, 'type') || own(issue, 'category') || own(issue,'kind'), 100);
    if (TYPE_LABELS[explicit]) return explicit;
    if (/spell|拼写/i.test(explicit)) return 'spelling';
    if (/punct|标点/i.test(explicit)) return 'punctuation';
    if (/capital|大小写/i.test(explicit)) return 'capitalization';
    if (/tense|verb|agreement|时态|动词/i.test(explicit)) return 'tense';
    if (/collocat|搭配/i.test(explicit)) return 'collocation';
    const rule = text(own(issue,'rule') || own(issue,'id'),160);
    if (/did-|modal-|person-|singular-|plural-|progressive-|i-be|past-be/.test(rule)) return 'tense';
    if (/gerund|interested|married|discuss|like|article|uncountable|many-people|source-bound-example/.test(rule)) return 'collocation';
    if (/complet|fragment|heading|clause|dangling|placeholder/.test(rule)) return 'completeness';
    return 'review';
  }
  function cleanFeedback(value, sentence) {
    const result = Array.isArray(value) ? {issues:value} : value && typeof value === 'object' ? value : {};
    const issues = (Array.isArray(result.issues) ? result.issues : []).slice(0,30).map(issue => typeof issue === 'string' ? {type:'review',message:text(issue,700)} : {type:classifyIssue(issue),message:text(own(issue,'message') || own(issue,'explanation'),700),original:text(own(issue,'original'),1000),replacement:text(own(issue,'replacement') || own(issue,'suggestion'),1000)}).filter(issue => issue.message || issue.replacement);
    const review = (Array.isArray(result.reviewNeeded) ? result.reviewNeeded : []).map(value => text(value,300)).filter(Boolean);
    return {sentence,issues,reviewNeeded:Array.from(new Set(review.concat(['语义、自然度和规则未覆盖的语法仍需复核。']))),reference:text(result.reference || result.suggestedSentence || result.correctedSentence,1000),rulesOnly:true,incomplete:result.incomplete === true};
  }
  function hasExpression(sentence, target, sentenceAPI) {
    if (sentenceAPI?.matchesExpression) return sentenceAPI.matchesExpression(sentence, target.label);
    const source = normalize(sentence).replace(/[^a-z0-9'\s-]/g,' ').replace(/\s+/g,' ');
    const term = normalize(target.label).replace(/[^a-z0-9'\s-]/g,' ').replace(/\s+/g,' ');
    return !!term && (' ' + source + ' ').includes(' ' + term + ' ');
  }
  function localCheck(sentence, context = {}, options = {}) {
    const issues = [], reviewNeeded = ['拼写未接入完整词典检查，拼写与专有词请复核。','语境中的时态选择和搭配自然度仍需复核。'];
    const grammar = options.grammarCheck || global.StudyGrammar?.check;
    if (typeof grammar === 'function') {
      try { const found = grammar(sentence); if (!Array.isArray(found)) throw new Error('Invalid grammar feedback'); issues.push(...found); }
      catch (_) { reviewNeeded.push('本地语法规则暂不可用，时态和搭配检查未完成。'); }
    } else reviewNeeded.push('本地语法规则未接入，时态和搭配请复核。');
    const first = sentence.match(/[A-Za-z]/);
    if (first && first[0] === first[0].toLowerCase()) issues.push({type:'capitalization',original:first[0],replacement:first[0].toUpperCase(),message:'句首英文字母通常需要大写；请结合引号或品牌写法复核。'});
    if (/\bi\b/.test(sentence)) issues.push({type:'capitalization',original:'i',replacement:'I',message:'英语人称代词 I 应大写。'});
    if (!/[.!?]["'’”)]*\s*$/.test(sentence)) issues.push({type:'punctuation',replacement:sentence.trim() + '.',message:'请补上符合句意的句末标点；陈述可用句号，提问用问号。'});
    if (/[，。？！；：]/.test(sentence)) issues.push({type:'punctuation',message:'英文句子中检测到中文标点，请核对并换成英文标点。'});
    const sentenceAPI = options.sentenceAPI || global.StudySentences;
    for (const target of [context.target].concat(context.fusionTargets || []).filter(Boolean)) {
      if (!hasExpression(sentence, target, sentenceAPI)) issues.push({type:'target',message:'尚未识别到“' + target.label + '”及已支持词形；请核对，复杂变化需自行复核。'});
    }
    const phraseAPI = options.phraseAPI || global.PhrasePractice;
    if (phraseAPI?.writingValidation) {
      const validation = phraseAPI.writingValidation(sentence, context.target?.kind === 'phrase' ? context.target : {});
      if (Array.isArray(validation?.issues)) issues.push(...validation.issues);
    }
    return cleanFeedback({issues,reviewNeeded},sentence);
  }

  function sanitizeDraft(value, lesson, targets) {
    const saved = own(value,'version') === 1 && own(value,'lessonId') === lesson.id ? value : {};
    const draft = {version:1,lessonId:lesson.id,activeTargetKey:'',targets:{},updatedAt:0};
    const storedTargets = own(saved,'targets');
    // A changed vocabulary/learned range may temporarily hide a target. Preserve
    // its free-writing rows so the next successful save cannot delete this work.
    function restoreRow(row, requiredCount) {
      const answers = own(row,'answers'), feedback = own(row,'feedback'), fusion = own(row,'fusion');
      const count = Math.max(requiredCount, Array.isArray(answers) ? answers.length : 0);
      const restored = {answers:[],feedback:[],fusion:[]};
      for (let index=0;index<count;index++) {
        const answer = typeof own(answers,String(index)) === 'string' ? own(answers,String(index)) : '';
        restored.answers.push(answer);
        const previous = own(feedback,String(index));
        restored.feedback.push(previous && own(previous,'sentence') === answer ? cleanFeedback(previous,answer) : null);
        const chosen = own(fusion,String(index));
        restored.fusion.push(Array.isArray(chosen) ? Array.from(new Set(chosen.filter(key => typeof key === 'string' && /^(word|phrase):/.test(key)))).slice(0,2) : []);
      }
      return restored;
    }
    if (storedTargets && typeof storedTargets === 'object') for (const key of Object.keys(storedTargets)) {
      if (/^(word|phrase):/.test(key)) draft.targets[key] = restoreRow(own(storedTargets,key),0);
    }
    for (const target of targets) {
      draft.targets[target.key] = restoreRow(own(storedTargets,target.key),target.requiredCount);
    }
    const active = own(saved,'activeTargetKey');
    draft.activeTargetKey = targets.some(target => target.key === active) ? active : targets[0]?.key || '';
    draft.updatedAt = Number.isFinite(own(saved,'updatedAt')) ? saved.updatedAt : 0;
    return draft;
  }

  class FreeWritingPractice {
    constructor(options = {}) {
      this.options = options; this.cache = new Map(); this.container = null; this.lessonOverride = null;
      this.timer = null; this.saving = null; this.handlers = null;
      this.active = null;
    }
    lesson() { return this.lessonOverride || this.options.getLesson?.(); }
    defaultTargets(lesson) {
      const wordsAPI = this.options.wordTargetsAPI || global.StudyLessonWordTargets, phraseAPI = this.options.phraseAPI || global.PhrasePractice;
      const words = wordsAPI?.newWordsForLesson ? wordsAPI.newWordsForLesson(lesson) : (lesson.vocabulary || []).filter(row => row.isLessonNew !== false);
      const usages = source => (source.usage || []).filter(row => !phraseAPI?.isGradedEligible || phraseAPI.isGradedEligible(row,source)).map(row => phraseAPI?.practiceView ? phraseAPI.practiceView(row,source) : row);
      const lessons = this.options.getLessons?.() || [], confirmed = new Set(this.options.getLearnedLessonIds?.() || []);
      const prior = lessons.filter(source => confirmed.has(source.id) && before(source,lesson)).sort((a,b) => b.book-a.book || b.number-a.number);
      return {words,phrases:usages(lesson),priorWords:prior.flatMap(source => (source.vocabulary || []).map(row => ({...row,source}))),priorPhrases:this.options.getPriorPhrases?.(lesson) || prior.flatMap(source => usages(source).map(row => ({...row,source})))};
    }
    ensure() {
      const lesson = this.lesson();
      if (!lesson || typeof lesson.id !== 'string' || !lesson.id) { this.active = null; return null; }
      let entry = this.cache.get(lesson.id);
      if (!entry) {
        const supplied = this.options.getTargets?.(lesson) || this.defaultTargets(lesson);
        const targets = buildTargets({lesson,targets:supplied,lessons:this.options.getLessons?.() || [],priorLimit:this.options.priorLimit,personAPI:this.options.personAPI});
        const key = draftKey(lesson.id);
        let stored;
        try { stored = own(this.options.getDrafts?.(),key); } catch (_) { /* Keep the workspace usable if draft reading fails. */ }
        entry = {key,lesson,targets,draft:sanitizeDraft(stored,lesson,targets),revision:0,savedRevision:0,status:'idle',checking:new Set(),checkError:''};
        this.cache.set(lesson.id,entry);
      }
      this.active = entry; return entry;
    }
    targets() { return this.ensure()?.targets || []; }
    setLesson(lesson) {
      this.lessonOverride = lesson || null;
      const entry = this.ensure();
      if (entry) {
        entry.lesson = this.lesson();
        const supplied = this.options.getTargets?.(entry.lesson) || this.defaultTargets(entry.lesson);
        entry.targets = buildTargets({lesson:entry.lesson,targets:supplied,lessons:this.options.getLessons?.() || [],priorLimit:this.options.priorLimit,personAPI:this.options.personAPI});
        entry.draft = sanitizeDraft(entry.draft,entry.lesson,entry.targets);
      }
      this.refresh();
    }
    currentTarget(entry = this.ensure()) { return entry?.targets.find(target => target.key === entry.draft.activeTargetKey) || null; }
    touch(entry) {
      entry.revision++; entry.draft.updatedAt = Date.now();
      entry.status = 'dirty';
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, this.options.saveDelay ?? 300);
      this.timer?.unref?.();
      this.updateStatus(entry);
    }
    selectTarget(key) {
      const entry = this.ensure(); if (!entry?.targets.some(target => target.key === key)) return false;
      entry.draft.activeTargetKey = key; this.touch(entry); this.refresh(); return true;
    }
    editAnswer(key, index, value) {
      const entry = this.ensure(), row = entry?.draft.targets[key];
      if (!row || !Number.isInteger(index) || index < 0 || index >= row.answers.length) return false;
      row.answers[index] = text(value,MAX_ANSWER); row.feedback[index] = null; entry.checkError = '';
      this.touch(entry);
      const feedbackNode = this.container?.querySelector?.('[data-free-feedback="' + index + '"]');
      if (feedbackNode) feedbackNode.innerHTML = '';
      return true;
    }
    setFusion(key, index, keys) {
      const entry = this.ensure(), row = entry?.draft.targets[key];
      if (!row || !Number.isInteger(index) || index < 0 || index >= row.answers.length) return false;
      const allowed = new Set(entry.targets.filter(target => target.kind === 'phrase' && target.key !== key).map(target => target.key));
      row.fusion[index] = Array.from(new Set((Array.isArray(keys) ? keys : []).filter(value => allowed.has(value)))).slice(0,2);
      row.feedback[index] = null; this.touch(entry); this.refresh(); return true;
    }
    statusMessage(entry) {
      if (entry.status === 'error') return '保存失败，输入仍保留在本页；请重试保存，成功前不要关闭页面。';
      if (entry.status === 'saving') return '正在保存草稿…';
      if (entry.revision > entry.savedRevision) return '草稿待保存…';
      return entry.status === 'saved' ? '草稿已保存' : '逐行输入后自动保存草稿';
    }
    updateStatus(entry) {
      const state = {lessonId:entry.lesson.id,status:entry.status,message:this.statusMessage(entry)};
      this.options.onStatus?.(state);
      if (entry !== this.active) return;
      const node = this.container?.querySelector?.('[data-free-save-status]');
      if (node) { node.textContent = state.message; node.dataset.state = entry.status; }
      const retry = this.container?.querySelector?.('[data-free-action="save"]');
      if (retry) retry.hidden = entry.status !== 'error';
    }
    flush() {
      if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
      if (this.saving) return this.saving;
      this.saving = (async () => {
        let success = true;
        for (const entry of this.cache.values()) {
          while (entry.revision > entry.savedRevision) {
            const revision = entry.revision, snapshot = clone(entry.draft);
            entry.status = 'saving'; this.updateStatus(entry);
            try {
              if (typeof this.options.saveDraft !== 'function' || await this.options.saveDraft(entry.key,snapshot) !== true) throw new Error('Draft storage did not confirm saving');
              entry.savedRevision = revision; entry.status = revision === entry.revision ? 'saved' : 'dirty'; this.updateStatus(entry);
            } catch (_) { entry.status = 'error'; this.updateStatus(entry); success = false; break; }
          }
        }
        return success;
      })().finally(() => { this.saving = null; });
      return this.saving;
    }
    async check(key) {
      const entry = this.ensure(), target = entry?.targets.find(item => item.key === (key || entry.draft.activeTargetKey));
      if (!target || entry.checking.has(target.key)) return false;
      const row = entry.draft.targets[target.key];
      if (!row.answers.some(value => value.trim())) { entry.checkError = '先写一句，再逐句检查。'; this.refresh(); return false; }
      entry.checking.add(target.key); entry.checkError = ''; this.refresh();
      try {
        for (let index=0;index<row.answers.length;index++) {
          const sentence = row.answers[index], selected = row.fusion[index].slice(), selection = selected.join('\n');
          if (!sentence.trim()) continue;
          const context = {target,lesson:entry.lesson,index,fusionTargets:selected.map(key => entry.targets.find(item => item.key === key)).filter(Boolean)};
          let feedback;
          try {
            if (this.options.checkSentence) {
              const result = await this.options.checkSentence(sentence,context);
              if (!Array.isArray(result) && (!result || !Array.isArray(result.issues))) throw new Error('Invalid sentence feedback');
              feedback = cleanFeedback(result,sentence);
            } else feedback = localCheck(sentence,context,this.options);
          }
          catch (_) { feedback = cleanFeedback({issues:[],incomplete:true,reviewNeeded:['本句检查失败，尚未完成拼写、时态、搭配检查；请重试。']},sentence); }
          if (entry.draft.targets[target.key] === row && row.answers[index] === sentence && row.fusion[index].join('\n') === selection) { row.feedback[index] = feedback; this.touch(entry); }
        }
      } finally { entry.checking.delete(target.key); this.refresh(); }
      await this.flush(); return true;
    }
    feedbackHTML(feedback) {
      if (!feedback) return '';
      return '<div class="free-writing-feedback"><p class="free-writing-feedback-title">' + (feedback.incomplete ? '本句检查未完成' : feedback.issues.length ? '检查建议' : '有限规则未发现已覆盖的问题') + '</p>' + feedback.issues.map(issue => '<div class="free-writing-issue"><strong>' + escapeHTML(TYPE_LABELS[issue.type] || TYPE_LABELS.review) + '</strong><p>' + escapeHTML(issue.message) + '</p>' + (issue.replacement ? '<p class="free-writing-reference">修改参考：' + (issue.original ? '<del>' + escapeHTML(issue.original) + '</del> → ' : '') + '<span lang="en">' + escapeHTML(issue.replacement) + '</span></p>' : '') + '</div>').join('') + (feedback.reference ? '<p class="free-writing-reference">局部修改参考（整句仍需复核）：<span lang="en">' + escapeHTML(feedback.reference) + '</span></p>' : '') + '<p class="free-writing-review">' + feedback.reviewNeeded.map(escapeHTML).join(' ') + '</p></div>';
    }
    render() {
      const entry = this.ensure();
      if (!entry) return '<section class="free-writing-practice"><p>选择一课后开始自由造句。</p></section>';
      const target = this.currentTarget(entry);
      if (!target) return '<section class="free-writing-practice"><h3>自由造句</h3><p>本课暂无可用的新词或习惯用法目标。来源资料整理后可继续练习。</p></section>';
      const row = entry.draft.targets[target.key], written = row.answers.filter(value => value.trim()).length;
      const phrases = entry.targets.filter(item => item.kind === 'phrase' && item.key !== target.key);
      const total = entry.targets.reduce((sum,item) => sum + item.requiredCount,0), allWritten = entry.targets.reduce((sum,item) => sum + entry.draft.targets[item.key].answers.filter(value => value.trim()).length,0);
      const group = prior => entry.targets.filter(item => item.prior === prior).map(item => '<option value="' + escapeHTML(item.key) + '"' + (item.key === target.key ? ' selected' : '') + '>' + escapeHTML(item.label) + ' · ' + (item.kind === 'phrase' ? '用法' : '单词') + ' · ' + item.requiredCount + '句</option>').join('');
      return '<section class="free-writing-practice" aria-label="自由造句专项"><header class="free-writing-header"><div><h3>自由造句</h3><p>每个本课新词、习惯用法各写5句；少量已学旧词、旧用法各写1–2句。</p></div><span class="free-writing-progress">已写 ' + allWritten + ' / ' + total + ' 句</span></header><p class="free-writing-guidance">肯定、否定、疑问自由搭配，按自己的意思造句；也可以把单词和本课或前课用法写在同一句中。</p><label class="free-writing-target-label">本轮目标<select data-free-select="target" aria-label="选择自由造句目标"><optgroup label="本课目标">' + group(false) + '</optgroup>' + (entry.targets.some(item => item.prior) ? '<optgroup label="已学前课复习">' + group(true) + '</optgroup>' : '') + '</select></label><div class="free-writing-target"><strong lang="en">' + escapeHTML(target.label) + '</strong><span>' + escapeHTML(target.meaning) + '</span><small>' + (target.prior ? '前课复习 · 第' + target.source.book + '册第' + target.source.number + '课' : '本课' + (target.kind === 'phrase' ? '习惯用法' : '新单词')) + ' · 已写 ' + written + '/' + target.requiredCount + '</small></div><div class="free-writing-lines">' + row.answers.map((answer,index) => '<article class="free-writing-line"><label for="free-writing-' + index + '">第 ' + (index+1) + ' 句</label><textarea id="free-writing-' + index + '" data-free-answer="' + index + '" rows="2" maxlength="' + MAX_ANSWER + '" lang="en" spellcheck="true" placeholder="写一句自己的英文，句型自由选择…">' + escapeHTML(answer) + '</textarea>' + (phrases.length ? '<label class="free-writing-fusion-label">融合用法（可选）<select data-free-fusion="' + index + '" aria-label="第' + (index+1) + '句融合用法"><option value="">自由搭配</option>' + phrases.map(phrase => '<option value="' + escapeHTML(phrase.key) + '"' + (row.fusion[index].includes(phrase.key) ? ' selected' : '') + '>' + escapeHTML(phrase.label) + (phrase.prior ? ' · 前课' : ' · 本课') + '</option>').join('') + '</select></label>' : '') + '<div data-free-feedback="' + index + '">' + this.feedbackHTML(row.feedback[index]) + '</div></article>').join('') + '</div><div class="free-writing-actions"><button type="button" class="button primary" data-free-action="check"' + (entry.checking.has(target.key) ? ' disabled' : '') + '>' + (entry.checking.has(target.key) ? '正在逐句检查…' : '逐句检查本组') + '</button><span data-free-save-status data-state="' + entry.status + '" role="status" aria-live="polite">' + escapeHTML(this.statusMessage(entry)) + '</span>' + ('<button type="button" class="button subtle" data-free-action="save"' + (entry.status === 'error' ? '' : ' hidden') + '>重试保存</button>') + '</div>' + (entry.checkError ? '<p role="alert" class="free-writing-error">' + escapeHTML(entry.checkError) + '</p>' : '') + '<p class="free-writing-limit">检查提供拼写、时态、搭配、大小写与标点的修改参考；规则覆盖不足会标为需复核，不计学习成绩。</p></section>';
    }
    refresh() {
      if (!this.container && !this.options.onRender) return;
      const html = this.render();
      if (this.container) this.container.innerHTML = html;
      this.options.onRender?.(html,this);
    }
    mount(container) {
      this.unmount();
      if (!container || typeof container.addEventListener !== 'function') return false;
      this.container = container;
      const input = event => {
        const index = event.target?.dataset?.freeAnswer;
        if (index !== undefined) this.editAnswer(this.currentTarget()?.key,Number(index),event.target.value);
      };
      const change = event => {
        if (event.target?.dataset?.freeSelect === 'target') this.selectTarget(event.target.value);
        const index = event.target?.dataset?.freeFusion;
        if (index !== undefined) this.setFusion(this.currentTarget()?.key,Number(index),event.target.value ? [event.target.value] : []);
      };
      const click = event => {
        const button = event.target?.closest?.('[data-free-action]');
        if (!button || container.contains && !container.contains(button)) return;
        event.preventDefault();
        if (button.dataset.freeAction === 'check') void this.check();
        else if (button.dataset.freeAction === 'save') void this.flush();
      };
      this.handlers = {input,change,click};
      for (const [event,handler] of Object.entries(this.handlers)) container.addEventListener(event,handler);
      this.refresh(); return true;
    }
    unmount() {
      if (this.container && this.handlers) for (const [event,handler] of Object.entries(this.handlers)) this.container.removeEventListener?.(event,handler);
      this.container = null; this.handlers = null;
    }
  }
  Object.assign(FreeWritingPractice,{buildTargets,sanitizeDraft,localCheck,cleanFeedback,classifyIssue,draftKey,TYPE_LABELS,MAX_ANSWER});
  FreeWritingPractice.FreeWritingPractice = FreeWritingPractice;
  return FreeWritingPractice;
});
