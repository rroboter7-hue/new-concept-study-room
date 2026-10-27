(function (global) {
  'use strict';

  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const wordCategories = [{key:'all',label:'全部'},{key:'verb',label:'动词'},{key:'adjective',label:'形容词'},{key:'phrase',label:'习惯用法'},{key:'selected',label:'已选'}];
  const recommendationProfile = 'phrases-verbs-v1';
  const steps = [
    {kind:'affirmative',label:'肯定句',hint:'用目标词写一个完整的肯定原句。后面三句都沿用这句的人物、时态和情境。'},
    {kind:'negative',label:'否定句',hint:'把第 1 句改为否定句，保留目标词和原来的情境。注意 be、助动词与动词形式。'},
    {kind:'yesno',label:'一般疑问句',hint:'把第 1 句改为可用 yes / no 回答的问题，保留目标词，检查助动词和问号。'},
    {kind:'wh',label:'特殊疑问句',hint:'围绕第 1 句用 what / who / where / when / why / how 等提问，并保留目标词。who 作主语时不一定需要 do。'},
    {kind:'combined',label:'旧知综合造句',hint:'用目标词另写一个新句子，可按需结合旧词或旧用法。不能逐字重复前四句。'}
  ];
  const flexibleSteps = [
    {kind:'affirmative',label:'换一个语境',hint:'用目标单词或习惯用法写一句自己的话，可以联系今天的生活。'},
    {kind:'negative',label:'补充时间地点',hint:'换一个时间、地点或人物，再用目标表达写一句；不必硬改成否定句。'},
    {kind:'yesno',label:'模仿并改写',hint:'回忆课文中的表达，改变人物、动作或情境；参考例句可以按需展开。'},
    {kind:'wh',label:'提问或回应',hint:'用目标表达提出一个问题，或写一句对话中的回应。'},
    {kind:'combined',label:'结合旧知',hint:'尝试联系一个已学词或用法，另写新句子。暂时没有合适旧知时也可以换一个语境。'}
  ];
  const phraseSteps = [{kind:'affirmative',label:'习惯用法造句',hint:'用这个表达写一句与自己有关的话。先想清楚“谁、做什么、何时或何地”，再写英文；不必再做四种转换。'}];

  const ownData = (value, field) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
  };

  function sentenceDraftIdentity(key, core) {
    const parts = key.split(':');
    let lesson, target, round = '', mode;
    if (parts.length === 3 && parts[0] === 'v1') { [, lesson, target] = parts; mode = 'transform'; }
    else if (parts.length === 4 && parts[0] === 'v2' && parts[1] === 'flexible') { [, , lesson, target] = parts; mode = 'flexible'; }
    else if (parts.length === 4 && parts[0] === 'v3' && ['four','phrase'].includes(parts[1])) [, mode, lesson, target] = parts;
    else if (parts.length === 6 && parts[0] === 'round' && parts[1] === 'v1' && (core.MODES || ['transform','flexible']).includes(parts[5])) [, , lesson, target, round, mode] = parts;
    else return null;
    try { lesson = decodeURIComponent(lesson); target = decodeURIComponent(target); round = decodeURIComponent(round); }
    catch (_) { return null; }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(lesson) || !target || target.length > 600 || parts[0] === 'round' && !core.validRoundKey(round)) return null;
    return {lessonId:lesson,targetKey:target,roundKey:round,mode};
  }

  function expressionSnapshot(key, item) {
    const phrase = item?.category === 'phrase' || item?.kind === 'phrase' || key.startsWith('phrase:');
    let label = item?.label || item?.phrase || item?.word;
    if (typeof label !== 'string' || !label.trim()) {
      const parts = key.split(':');
      try { label = parts.length === 3 && ['word','phrase'].includes(parts[0]) && parts[1] !== 'long' ? decodeURIComponent(parts[2]) : ''; }
      catch (_) { label = ''; }
      if (!label.trim()) label = key;
    }
    return {key,label,category:phrase ? 'phrase' : item?.category || 'word', [phrase ? 'phrase' : 'word']:label};
  }

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
      this.wordCategory = 'all';
      this.wordLimit = 80;
      this.lessonTargetsExpanded = false;
      this.lessonGroupPages = new Map();
      this.lessonGroupRender = 0;
      this.lessonCarousel = null;
      this.lessonCarouselObserver = null;
      this.lessonCarouselTimer = null;
      this.wordSearch = '';
      this.pickerDialog = null;
      this.pickerTrigger = null;
      this.copyFallback = '';
      document.addEventListener('click', event => this.handleClick(event));
      document.addEventListener('input', event => this.handleInput(event));
      document.addEventListener('change', event => this.handleChange(event));
      document.addEventListener('keydown', event => this.handleKeydown(event));
      global.addEventListener?.('resize', () => this.restoreLessonCarousel(this.lessonCarousel));
      document.addEventListener('toggle', event => {
        if (!this.inside(event.target)) return;
        if (event.target.dataset?.sentenceAdjustments !== undefined) this.adjustmentsOpen = event.target.open;
        if (event.target?.dataset?.sentenceReference !== undefined && event.target.open) this.markAssisted();
      }, true);
    }

    core() { return global.StudySentences; }
    stepList() { return this.active?.draft.mode==='phrase'?phraseSteps:this.active?.draft.mode==='four'?steps.slice(0,4):this.active?.draft.mode==='flexible'?flexibleSteps:steps; }
    isQuickMode() { return ['four','phrase'].includes(this.active?.draft.mode); }
    switchMode(mode) {
      if(!this.core()?.MODES.includes(mode)||!this.ensureState())return false;
      const draft=this.active?.draft,kind=mode==='phrase'?'phrase':mode==='four'?'word':null;
      const candidates=this.context.targets.filter(item=>!kind||(item.kind||'word')===kind);
      const target=candidates.find(item=>item.key===draft?.targetKey)||candidates.find(item=>item.source.id===this.currentLesson.id)||candidates[0];
      if(!target){this.notify(mode==='phrase'?'本课暂无可用习惯用法，可先做四句型转换。':'本课暂无可用词项。');return false;}
      if(draft?.mode===mode&&draft.targetKey===target.key)return true;
      this.flush();this.loadTarget(target.key,draft?.sourceLessonIds||[],false,{mode,roundKey:draft?.targetKey===target.key?draft?.roundKey:''});
      this.updateContext();if(draft?.targetKey!==target.key)this.revealLessonTarget();this.markChanged(false);this.flush();this.redraw();return true;
    }
    markAssisted() { if(!this.active||this.active.draft.assisted)return;this.active.draft.assisted=true;this.markChanged(false);this.flush(); }
    openTarget(request = {}) {
      if(!this.core()?.validRoundKey(request.roundKey)||!this.ensureState()||request.lessonId!==this.currentLesson?.id)return false;
      const expression=String(request.expression||'').trim().toLowerCase(),kind=request.kind==='phrase'?'phrase':request.kind==='word'?'word':null;
      const target=this.context.targets.find(item=>(!kind||(item.kind||'word')===kind)&&item.key===request.targetKey)||this.context.targets.find(item=>(!kind||(item.kind||'word')===kind)&&String(item.word||item.phrase||'').toLowerCase()===expression);
      if(!target)return false;
      const requestedMode=request.sentenceMode==='four-forms'?'four':request.sentenceMode==='phrase-writing'?'phrase':this.core().MODES.includes(request.mode)?request.mode:'flexible';
      this.flush();this.loadTarget(target.key,this.active?.draft.sourceLessonIds||[],false,{mode:requestedMode,roundKey:request.roundKey});
      this.active.draft.evidenceTargetKey=typeof request.targetKey==='string'?request.targetKey.slice(0,600):target.key;
      this.updateContext();this.revealLessonTarget();this.markChanged(false);this.flush();this.redraw();return true;
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
      return this.core().context({lessons:this.options.getLessons?.() || [],currentLesson:this.currentLesson,records:this.options.getRecords?.() || {},getVocabulary:this.options.getVocabulary,getUsage:this.options.getUsage,sourceLessonIds,includePhrases:true});
    }

    allDrafts() {
      const drafts = {...(this.options.getDrafts?.() || {})};
      for (const entry of this.entries.values()) drafts[entry.key] = entry.draft;
      return drafts;
    }

    exportLessonDrafts(lesson = this.options.getLesson?.()) {
      const core = this.core(), lessonId = ownData(lesson, 'id');
      if (!core || typeof lessonId !== 'string') return [];
      // Resolve each saved context without loading targets or changing the current
      // editor. In-memory entries win even if their last save failed.
      const lessons = (this.options.getLessons?.() || []).map(item => {
        if (typeof this.options.getUsage !== 'function') return item;
        try { const usage = this.options.getUsage(item); return Array.isArray(usage) ? {...item,usage} : item; }
        catch (_) { return item; }
      });
      const bank = core.wordBank({lessons,currentLesson:lesson,getVocabulary:this.options.getVocabulary,getUsage:this.options.getUsage});
      const byKey = new Map();
      for (const item of bank) {
        byKey.set(item.key,item);
        for (const alias of item.aliases || []) byKey.set(alias,item);
      }
      const drafts = this.allDrafts(), bundles = [], contexts = new Map();
      for (const sourceKey of Object.keys(drafts)) {
        const identity = sentenceDraftIdentity(sourceKey, core);
        if (!identity || identity.lessonId !== lessonId) continue;
        const draft = ownData(drafts,sourceKey), supplied = ownData(draft,'answers'), answers = {};
        for (const kind of core.KINDS) {
          const value = ownData(supplied,kind);
          answers[kind] = typeof value === 'string' ? value : '';
        }
        if (!Object.values(answers).some(value => value.trim())) continue;
        const savedSources = ownData(draft,'sourceLessonIds');
        const sourceLessonIds = Array.isArray(savedSources) ? savedSources.filter(id => typeof id === 'string') : [];
        const contextKey = JSON.stringify(sourceLessonIds);
        if (!contexts.has(contextKey)) contexts.set(contextKey,core.context({lessons,currentLesson:lesson,records:this.options.getRecords?.() || {},getVocabulary:this.options.getVocabulary,sourceLessonIds,includePhrases:true}));
        const item = contexts.get(contextKey).targets.find(value => value.key === identity.targetKey) || byKey.get(identity.targetKey);
        const target = {...expressionSnapshot(identity.targetKey,item),kind:item?.kind || (identity.targetKey.startsWith('phrase:') ? 'phrase' : 'word')};
        target.word = target.label;
        if (item?.source) target.source = {id:item.source.id,book:item.source.book,number:item.source.number,title:item.source.title};
        const selected = Object.prototype.hasOwnProperty.call(draft,'selectedOldKeys') ? ownData(draft,'selectedOldKeys') : [ownData(draft,'oldWordKey'),ownData(draft,'oldPhraseKey')];
        const selectedOldItems = [], seen = new Set();
        for (const key of Array.isArray(selected) ? selected : []) {
          if (typeof key !== 'string' || !key.trim()) continue;
          const old = byKey.get(key), canonical = old?.key || key;
          if (seen.has(canonical)) continue;
          seen.add(canonical); selectedOldItems.push(expressionSnapshot(canonical,old));
        }
        bundles.push({sourceKey,...identity,target,selectedOldItems,answers});
      }
      return bundles;
    }

    lessonTargets() {
      if(this.active?.draft.mode==='phrase')return (this.context?.targets||[]).filter(item=>item.kind==='phrase'&&item.source.id===this.currentLesson?.id);
      const words = (this.context?.targets || []).filter(item => (item.kind || 'word') === 'word' && item.source.id === this.currentLesson?.id);
      const flagged = words.some(item => typeof item.isLessonNew === 'boolean');
      return words.filter(item => !flagged || item.isLessonNew === true);
    }

    lessonProgress() { return this.core().lessonProgress({targets:this.lessonTargets(),drafts:this.allDrafts()}); }

    lessonGroupKey() { return JSON.stringify([this.currentLesson?.id,this.active?.draft.mode]); }

    lessonGroupInfo() {
      const targets = this.lessonTargets(), count = Math.ceil(targets.length / 4), key = this.lessonGroupKey();
      const activeIndex = targets.findIndex(item => item.key === this.active?.draft.targetKey), activePage = activeIndex < 0 ? -1 : Math.floor(activeIndex / 4);
      const page = Math.max(0,Math.min(count - 1,this.lessonGroupPages.get(key) ?? Math.max(0,activePage)));
      this.lessonGroupPages.set(key,page);
      return {targets,count,key,page,activePage};
    }

    revealLessonTarget() {
      const info = this.lessonGroupInfo();
      if (info.activePage >= 0) this.lessonGroupPages.set(info.key,info.activePage);
    }

    invalidateLessonCarousel() {
      this.lessonGroupRender++;
      this.lessonCarousel = null;
      this.lessonCarouselObserver?.disconnect();
      this.lessonCarouselObserver = null;
      if (this.lessonCarouselTimer !== null) global.clearTimeout(this.lessonCarouselTimer);
      this.lessonCarouselTimer = null;
    }

    validLessonCarousel(binding) {
      return Boolean(binding && binding === this.lessonCarousel && binding.render === this.lessonGroupRender && binding.key === this.lessonGroupKey() &&
        this.options.getLesson?.()?.id === this.currentLesson?.id && !this.lessonTargetsExpanded && !this.isQuickMode() && binding.carousel.isConnected !== false &&
        document.querySelector('#sentence-practice-content') === binding.root && binding.root.querySelector('.sentence-lesson-carousel') === binding.carousel);
    }

    syncLessonGroupDOM(binding) {
      if (!this.validLessonCarousel(binding)) return;
      const {page,count,activePage} = this.lessonGroupInfo(), {root,carousel} = binding;
      carousel.querySelectorAll?.('[data-sentence-group]').forEach((group,index) => {
        const hidden = index !== page, cards = group.querySelectorAll?.('[data-sentence-action="lesson-target"]') || [];
        if (hidden && Array.from(cards).some(card => card === document.activeElement)) carousel.focus?.({preventScroll:true});
        group.setAttribute('aria-hidden',String(hidden));
        cards.forEach(card => { card.tabIndex = hidden ? -1 : 0; });
      });
      const indicator = root.querySelector('.sentence-lesson-page-indicator');
      if (indicator) indicator.textContent = `第 ${page + 1} / ${count} 组`;
      const previous = root.querySelector('[data-sentence-action="prev-lesson-group"]'), next = root.querySelector('[data-sentence-action="next-lesson-group"]');
      if (previous) previous.disabled = page === 0;
      if (next) next.disabled = page >= count - 1;
      const hint = root.querySelector('.sentence-group-current'), target = this.target();
      if (hint) {
        hint.hidden = activePage === page || !target;
        hint.textContent = hint.hidden ? '' : `当前练习：${target.word || target.phrase}${activePage >= 0 ? `（第 ${activePage + 1} 组）` : ''}`;
      }
    }

    restoreLessonCarousel(binding) {
      if (!this.validLessonCarousel(binding)) return;
      const width = binding.carousel.clientWidth, {page} = this.lessonGroupInfo();
      if (width > 0) {
        const left = page * width;
        if (typeof binding.carousel.scrollTo === 'function') binding.carousel.scrollTo({left,behavior:'auto'});
        else binding.carousel.scrollLeft = left;
      }
      this.syncLessonGroupDOM(binding);
    }

    scheduleLessonCarousel() {
      const render = this.lessonGroupRender, key = this.lessonGroupKey();
      const mount = () => {
        if (render !== this.lessonGroupRender || key !== this.lessonGroupKey() || this.lessonTargetsExpanded || this.isQuickMode()) return;
        const root = document.querySelector('#sentence-practice-content'), carousel = root?.querySelector('.sentence-lesson-carousel');
        if (carousel?.getAttribute?.('data-sentence-group-render') !== String(render)) return;
        const binding = {root,carousel,render,key};
        this.lessonCarousel = binding;
        carousel.addEventListener('scroll', () => {
          if (!this.validLessonCarousel(binding) || !(carousel.clientWidth > 0)) return;
          const info = this.lessonGroupInfo(), page = Math.max(0,Math.min(info.count - 1,Math.round(carousel.scrollLeft / carousel.clientWidth)));
          if (!Number.isFinite(page)) return;
          this.lessonGroupPages.set(key,page);this.syncLessonGroupDOM(binding);
        }, {passive:true});
        if (typeof global.ResizeObserver === 'function') {
          this.lessonCarouselObserver = new global.ResizeObserver(() => this.restoreLessonCarousel(binding));
          this.lessonCarouselObserver.observe(carousel);
        }
        this.restoreLessonCarousel(binding);
      };
      if (typeof global.requestAnimationFrame === 'function') global.requestAnimationFrame(mount);
      else this.lessonCarouselTimer = global.setTimeout(() => { this.lessonCarouselTimer = null;mount(); },0);
    }

    browseLessonGroup(offset) {
      if (this.lessonTargetsExpanded || this.isQuickMode()) return false;
      const info = this.lessonGroupInfo();
      if (!info.count) return false;
      const page = Math.max(0,Math.min(info.count - 1,info.page + offset));
      this.lessonGroupPages.set(info.key,page);
      this.restoreLessonCarousel(this.lessonCarousel);
      return page !== info.page;
    }

    chooseLessonTarget(key) {
      if (!this.lessonTargets().some(item => item.key === key)) return false;
      const draft = this.active?.draft;
      this.flush();
      this.loadTarget(key, draft?.sourceLessonIds || [], false, {mode:draft?.mode,roundKey:draft?.targetKey===key?draft?.roundKey:''});
      this.updateContext();this.revealLessonTarget();this.markChanged(false);this.flush();this.redraw();
      return true;
    }

    nextUnfinished() {
      const targets = this.lessonTargets(), progress = this.lessonProgress();
      const completed = new Set(progress.items.filter(item => item.complete).map(item => item.key));
      const index = targets.findIndex(item => item.key === this.active?.draft.targetKey);
      for (let offset = 1; offset <= targets.length; offset++) {
        const target = targets[(index + offset + targets.length) % targets.length];
        if (!completed.has(target.key)) return this.chooseLessonTarget(target.key);
      }
      return false;
    }

    recommendedOldItems() {
      const keys = this.lessonSelections.get(this.currentLesson?.id)?.recommendedOldKeys || [];
      const bank = new Map(this.wordBank().map(item => [item.key, item]));
      return keys.map(key => bank.get(key)).filter(item => this.core().recommendationEligible?.(item) === true);
    }

    captureRecommendedItems(currentKeys) {
      if (!this.active) return;
      const previous = this.active.draft.recommendedOldKeys || [];
      const current = Array.isArray(currentKeys) ? this.normalizeOldKeys(currentKeys) : this.recommendedOldItems().map(item => item.key), candidates = [...new Set([...previous,...current])];
      const bank = new Map();
      for (const item of this.wordBank()) {
        bank.set(item.key,item);
        for (const alias of item.aliases || []) bank.set(alias,item);
      }
      const kinds = this.core().requiredKinds(this.active.draft.mode);
      const used = candidates.filter(key => {
        const item = bank.get(key), expression = item?.label || item?.word || item?.phrase;
        return expression && kinds.some(kind => this.core().matchesExpression(this.active.draft.answers[kind],expression));
      });
      const keys = [...new Set([...used,...current,...previous])].slice(0,20);
      if (JSON.stringify(keys) === JSON.stringify(previous)) return;
      this.active.draft.recommendedOldKeys = keys;
      this.active.dirty = true;this.active.state = 'pending';
    }

    ensureRecommendations(refresh = false) {
      if (!this.active || typeof this.core().recommendOldWords !== 'function' || typeof this.core().recommendationEligible !== 'function') return;
      const previous = this.lessonSelections.get(this.currentLesson.id) || {};
      const stored = Array.isArray(previous.recommendedOldKeys) ? previous.recommendedOldKeys : [], keys = this.normalizeOldKeys(stored);
      const bank = new Map(this.wordBank().map(item => [item.key,item]));
      const valid = previous.recommendationProfile === recommendationProfile && stored.length === keys.length && keys.every(key => this.core().recommendationEligible(bank.get(key)));
      const hasEligible = this.wordBank().some(item => this.core().recommendationEligible(item));
      if (!refresh && valid && (keys.length || previous.recommendationsReady && !hasEligible)) {
        if (JSON.stringify(stored) !== JSON.stringify(keys)) {
          this.captureRecommendedItems(stored);
          this.lessonSelections.set(this.currentLesson.id, {...previous,recommendedOldKeys:keys});
          this.remember(true);this.flush();
        }
        return;
      }
      if (refresh || stored.length) this.captureRecommendedItems(keys);
      const items = this.core().recommendOldWords({profile:'phrases-verbs',items:this.wordBank(),drafts:this.allDrafts(),lessonId:this.currentLesson.id,previousKeys:refresh ? keys : [],count:4,random:this.options.random});
      this.lessonSelections.set(this.currentLesson.id, {...previous,recommendedOldKeys:items.map(item => item.key),recommendationProfile,recommendationsReady:true});
      this.remember(true);this.flush();
    }

    selectionKey(lessonId) { return `selection:v1:${encodeURIComponent(String(lessonId).slice(0, 160))}`; }

    remember(persist = false) {
      if (!this.currentLesson || !this.active) return;
      const active = this.active.draft;
      const previous = this.lessonSelections.get(this.currentLesson.id) || {};
      this.lessonSelections.set(this.currentLesson.id, {...previous,targetKey:active.targetKey,sourceLessonIds:[...active.sourceLessonIds],mode:active.mode,roundKey:active.roundKey});
      if (persist) {
        const key = this.selectionKey(this.currentLesson.id);
        const draft = this.core().sanitizeDraft({targetKey:active.targetKey,step:active.step,sourceLessonIds:active.sourceLessonIds,oldWordKey:active.oldWordKey,oldPhraseKey:active.oldPhraseKey,selectedOldKeys:active.selectedOldKeys,recommendedOldKeys:previous.recommendedOldKeys || [],recommendationProfile:previous.recommendationProfile,mode:active.mode,roundKey:active.roundKey});
        this.entries.set(key, {key,draft,dirty:true,state:'pending'});
      }
    }

    loadTarget(targetKey, inheritedSources = [], forceSources = false, requested = {}) {
      this.closeWordPicker(false);
      if (!targetKey) { this.active = null; return; }
      const stored=this.options.getDrafts?.()||{},legacyKey=this.core().draftKey(this.currentLesson.id,targetKey);
      const mode=this.core().MODES.includes(requested.mode)?requested.mode:stored[legacyKey]?'transform':this.core().MODES.includes(this.options.defaultMode)?this.options.defaultMode:'flexible';
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
      this.copyFallback = '';
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
        this.loadTarget(this.lessonTargets()[0]?.key || this.context.targets[0]?.key, safeSources);
        this.context = this.makeContext(this.active?.draft.sourceLessonIds || safeSources);
      }
      if (!this.active && this.context.targets.length) this.loadTarget(this.lessonTargets()[0]?.key || this.context.targets[0].key, safeSources, true);
      this.syncOldSelection();
      this.remember();
      this.ensureRecommendations();
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
        this.lessonTargetsExpanded = false;
        if (lesson) {
          const savedSelection = this.options.getDrafts?.()?.[this.selectionKey(lesson.id)];
          const previous = this.lessonSelections.get(lesson.id) || (savedSelection ? this.core().sanitizeDraft(savedSelection) : null);
          if (previous) this.lessonSelections.set(lesson.id, {...previous,recommendationsReady:Array.isArray(previous.recommendedOldKeys)});
          const initial = this.makeContext(previous?.sourceLessonIds || []);
          this.context = initial;
          const targetKey = initial.targets.some(item => item.key === previous?.targetKey) ? previous.targetKey : this.lessonTargets()[0]?.key || initial.targets[0]?.key;
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
      this.invalidateLessonCarousel();
      this.lessonGroupPages.clear();
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
      this.wordCategory = 'all';
      this.wordLimit = 80;
      this.lessonTargetsExpanded = false;
      this.copyFallback = '';
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
      this.setWordCategory('all');
      this.refreshOldSelection();
      try { dialog.showModal(); }
      catch (_) { this.closeWordPicker(false);return false; }
      dialog.querySelector('[data-sentence-action="close-word-picker"]')?.focus?.({preventScroll:true});
      return true;
    }

    closeWordPicker(restoreFocus = true) {
      const dialog = this.pickerDialog, trigger = this.pickerTrigger;
      this.pickerDialog = null;
      this.pickerTrigger = null;
      const list = dialog?.querySelector('.sentence-word-list');
      if (list) list.innerHTML = '';
      if (dialog?.open) dialog.close();
      if (restoreFocus && dialog && trigger?.isConnected !== false) trigger?.focus?.({preventScroll:true});
    }

    handleKeydown(event) {
      if (event.key === 'Escape' && this.pickerDialog?.open && this.inside(event.target)) {
        event.preventDefault();this.closeWordPicker();return;
      }
      const carousel = event.target?.closest?.('[data-sentence-lesson-carousel]');
      if (carousel === this.lessonCarousel?.carousel && this.validLessonCarousel(this.lessonCarousel) && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && ['ArrowLeft','ArrowRight'].includes(event.key)) {
        event.preventDefault();this.browseLessonGroup(event.key === 'ArrowRight' ? 1 : -1);return;
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
      this.wordLimit = 80;
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
      const selected = new Set(this.active?.draft.selectedOldKeys || []);
      return this.wordBank().filter(item => (this.wordCategory === 'all' || this.wordCategory === 'selected' ? this.wordCategory !== 'selected' || selected.has(item.key) : item.category === this.wordCategory) && (!query || normalize(`${item.label || item.word || item.phrase} ${item.meaning}`).includes(query)));
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
      const recommendations = this.recommendationsHTML();
      return `<div class="sentence-old-picker">${recommendations || this.oldPickerTriggerHTML()}<div class="sentence-old-selection"><div class="sentence-selected-old" aria-label="已选旧词">${this.oldChipsHTML()}</div></div></div>`;
    }

    oldPickerTriggerHTML() {
      return `<button type="button" class="sentence-old-trigger" data-sentence-action="open-word-picker" aria-haspopup="dialog" aria-controls="sentence-word-picker">${this.pickerIcon('book','▤')}<strong>全部旧词</strong><span class="sentence-old-trigger-hint">${this.selectedOldItems().length ? `已选 ${this.selectedOldItems().length} 项` : '按需选用'}</span></button>`;
    }

    recommendationsHTML() {
      const e = this.escape, items = this.recommendedOldItems(), selected = new Set(this.active?.draft.selectedOldKeys || []);
      if (!items.length) return '';
      return `<div class="sentence-recommendations"><div class="sentence-recommendation-heading"><span title="习惯用法为主、动词为辅，按需选用">用法与动词</span><button type="button" class="sentence-recommendation-refresh" data-sentence-action="refresh-recommendations">换一组</button>${this.oldPickerTriggerHTML()}</div><div class="sentence-recommendation-items sentence-recommendation-chips">${items.map(item => `<button type="button" class="sentence-recommendation${item.category === 'phrase' ? ' is-phrase' : ''}${selected.has(item.key) ? ' is-selected' : ''}" data-sentence-action="toggle-recommended-old" data-sentence-old-key="${e(item.key)}" aria-pressed="${selected.has(item.key)}" aria-label="${e(item.label || item.word || item.phrase)}${item.meaning ? ' · ' + e(item.meaning) : ''}"${item.meaning ? ` title="${e(item.meaning)}"` : ''}><span class="sentence-recommendation-label" lang="en">${e(item.label || item.word || item.phrase)}</span>${item.meaning ? `<span class="sentence-recommendation-meaning">${e(this.shortOldMeaning(item))}</span>` : ''}</button>`).join('')}</div></div>`;
    }

    shortOldMeaning(item) {
      const label = String(item.label || item.word || item.phrase || '');
      let meaning = String(item.meaning || '').trim();
      if (label && meaning.slice(0,label.length).toLowerCase() === label.toLowerCase() && /^[\s:：]/.test(meaning.slice(label.length))) meaning = meaning.slice(label.length).trim();
      meaning = meaning.replace(/^(?:adj|adv|pron|prep|conj|interj|aux|art|num|vi|vt|n|v|a)\.\s*/i,'').replace(/^[:：]\s*/,'');
      const senses = meaning.split(/[；;，,。\n]/).map(sense => sense.trim()).filter(Boolean);
      const sense = senses.find(value => /[\u3400-\u9fff]/.test(value)) || senses[0] || meaning;
      const characters = Array.from(sense);
      return characters.slice(0,12).join('') + (characters.length > 12 ? '…' : '');
    }

    wordPickerListHTML() {
      const e = this.escape, items = this.filteredOldItems(), selected = new Set(this.active?.draft.selectedOldKeys || []);
      if (!items.length) return `<p class="sentence-word-empty">${!this.wordBank().length ? '前面课程暂无可用的重点词或习惯用法，仍可围绕当前目标写句子。' : this.wordSearch.trim() ? '没有找到匹配的表达，试试其他英文或中文。' : '前面课程暂无这一类表达，可以切换其他分类。'}</p>`;
      const visible = items.slice(0,this.wordLimit);
      return visible.map(item => `<div class="sentence-word-row${item.category === 'phrase' ? ' is-phrase' : ''}${selected.has(item.key) ? ' is-selected' : ''}" data-category="${e(item.category)}"><label class="sentence-word-choice"><input type="checkbox" data-sentence-old-key="${e(item.key)}" value="${e(item.key)}"${selected.has(item.key) ? ' checked' : ''}><span class="sentence-word-copy"><span class="sentence-word-expression" lang="en">${e(item.label || item.word || item.phrase)}</span><span class="sentence-word-meaning">${e(item.meaning)}</span></span></label><button type="button" class="sentence-word-speak" data-sentence-action="speak-old" data-sentence-old-key="${e(item.key)}" aria-label="朗读 ${e(item.label || item.word || item.phrase)}">${this.pickerIcon('volume','♪')}</button></div>`).join('') + (visible.length < items.length ? `<button type="button" class="sentence-word-more" data-sentence-action="more-words">显示更多（已显示 ${visible.length} / 总 ${items.length}）</button>` : '');
    }

    wordPickerFooterHTML() {
      const count = this.selectedOldItems().length;
      return `<div class="sentence-word-selection-heading"><strong class="sentence-word-selection-count" role="status" aria-live="polite">已选 ${count} 项</strong><button type="button" class="sentence-word-clear" data-sentence-action="clear-old"${count ? '' : ' disabled'}>清空</button></div><button type="button" class="sentence-word-done" data-sentence-action="close-word-picker">完成选择</button>`;
    }

    wordPickerHTML() {
      const e = this.escape;
      return `<dialog id="sentence-word-picker" class="sentence-word-dialog" aria-labelledby="sentence-word-title" aria-describedby="sentence-word-description"><div class="sentence-word-handle" aria-hidden="true"></div><header class="sentence-word-header"><div><h3 id="sentence-word-title">已学重点词表</h3><p id="sentence-word-description">汇总前面课程的重点，按需选用</p></div><button type="button" class="sentence-word-close" data-sentence-action="close-word-picker" aria-label="关闭词表">${this.pickerIcon('close','×')}</button></header><label class="sentence-word-search">${this.pickerIcon('search','⌕')}<span class="sentence-sr-only">搜索英文或中文</span><input type="search" data-sentence-input="word-search" maxlength="160" placeholder="搜索英文或中文" value="${e(this.wordSearch)}" autocomplete="off" autocapitalize="none" spellcheck="false"></label><div class="sentence-word-tabs" role="tablist" aria-label="旧知分类">${wordCategories.map(item => `<button type="button" id="sentence-word-tab-${item.key}" role="tab" data-sentence-action="word-category" data-sentence-category="${item.key}" aria-selected="${this.wordCategory === item.key}" aria-controls="sentence-word-list" tabindex="${this.wordCategory === item.key ? 0 : -1}">${item.label}</button>`).join('')}</div><p class="sentence-sr-only sentence-word-results" role="status" aria-live="polite"></p><div id="sentence-word-list" class="sentence-word-list" role="tabpanel" aria-labelledby="sentence-word-tab-${this.wordCategory}" tabindex="0"></div><footer class="sentence-word-footer">${this.wordPickerFooterHTML()}</footer></dialog>`;
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
      if (hint) hint.textContent = this.selectedOldItems().length ? `已选 ${this.selectedOldItems().length} 项` : '按需选用';
      const selected = new Set(this.active?.draft.selectedOldKeys || []);
      this.pickerDialog?.querySelectorAll?.('input[type="checkbox"][data-sentence-old-key]').forEach(input => {
        input.checked = selected.has(input.dataset.sentenceOldKey);
        input.closest('.sentence-word-row')?.classList?.toggle('is-selected', input.checked);
      });
      const footer = this.pickerDialog?.querySelector('.sentence-word-footer');
      if (footer) footer.innerHTML = this.wordPickerFooterHTML();
      if (this.wordCategory === 'selected') this.refreshWordPickerList();
      root?.querySelectorAll?.('[data-sentence-action="toggle-recommended-old"]').forEach(button => {
        const pressed = selected.has(button.dataset.sentenceOldKey);
        button.setAttribute('aria-pressed', String(pressed));button.classList?.toggle('is-selected', pressed);
      });
      const feedback = root?.querySelector('.sentence-feedback');
      if (feedback) feedback.innerHTML = this.feedbackHTML();
    }

    handleInput(event) {
      const input = event.target;
      if (this.inside(input) && input.dataset.sentenceInput === 'word-search' && this.active) {
        this.wordSearch = String(input.value || '').slice(0, 160);
        this.wordLimit = 80;
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
      if (feedback) feedback.innerHTML = '<p class="sentence-note">输入已改变，可重新检查或复制到豆包检查。</p>';
      this.copyFallback='';
      root?.querySelector('.sentence-copy-fallback')?.remove?.();
    }

    handleClick(event) {
      const button = event.target?.closest?.('[data-sentence-action]');
      if (!button || !this.inside(button) || !this.active) return;
      const action = button.dataset.sentenceAction;
      if(action==='reference'){this.markAssisted();return;}
      event.preventDefault();
      if(action==='writing-mode'){this.switchMode(button.dataset.sentenceMode);return;}
      if(action==='copy-review'){void this.copyForReview();return;}
      if(action==='select-copy'){const field=document.querySelector('#sentence-practice-content')?.querySelector('.sentence-copy-fallback textarea');field?.focus?.();field?.select?.();return;}
      if(action==='reuse-original'){
        const kind=this.stepList()[this.active.draft.step].kind;
        if(kind==='affirmative')return;
        if(this.active.draft.answers[kind].trim()){this.notify('这一句已有内容，已保留。需要时可手动修改。');return;}
        this.active.draft.answers[kind]=this.active.draft.answers.affirmative;this.markChanged();this.redraw(true);return;
      }
      if(action==='insert-target'){
        const field=document.querySelector('#sentence-practice-content')?.querySelector('.sentence-textarea'),kind=this.stepList()[this.active.draft.step].kind;
        const value=this.active.draft.answers[kind],expression=this.target()?.word||this.target()?.phrase||'';
        const start=Number.isInteger(field?.selectionStart)?field.selectionStart:value.length,end=Number.isInteger(field?.selectionEnd)?field.selectionEnd:start;
        const prefix=value.slice(0,start),suffix=value.slice(end),insert=(prefix&&!/\s$/.test(prefix)?' ':'')+expression+(suffix&&!/^\s|^[.,!?]/.test(suffix)?' ':'');
        this.active.draft.answers[kind]=(prefix+insert+suffix).slice(0,400);this.markChanged();this.redraw(true);return;
      }
      if (action === 'open-word-picker') { this.openWordPicker(button);return; }
      if (action === 'close-word-picker') { this.closeWordPicker();return; }
      if (action === 'word-category') { this.setWordCategory(button.dataset.sentenceCategory);return; }
      if (action === 'more-words' && this.pickerDialog?.open) {
        const list = this.pickerDialog.querySelector('.sentence-word-list'), scrollTop = list?.scrollTop || 0;
        this.wordLimit += 80;this.refreshWordPickerList();
        if (list) list.scrollTop = scrollTop;
        (list?.querySelector?.('[data-sentence-action="more-words"]') || list)?.focus?.({preventScroll:true});
        return;
      }
      if (action === 'lesson-target') { this.chooseLessonTarget(button.dataset.sentenceTargetKey);return; }
      if (action === 'prev-lesson-group' || action === 'next-lesson-group') { this.browseLessonGroup(action === 'next-lesson-group' ? 1 : -1);return; }
      if (action === 'next-unfinished') { this.nextUnfinished();return; }
      if (action === 'expand-lesson-targets') { this.lessonTargetsExpanded = !this.lessonTargetsExpanded;if(!this.lessonTargetsExpanded)this.revealLessonTarget();this.redraw();return; }
      if (action === 'refresh-recommendations') { this.ensureRecommendations(true);this.redraw();return; }
      if (action === 'toggle-recommended-old') {
        const key = button.dataset.sentenceOldKey, selected = this.active.draft.selectedOldKeys || [];
        if (this.wordBank().some(item => item.key === key)) this.setOldSelection(selected.includes(key) ? selected.filter(item => item !== key) : [...selected,key]);
        return;
      }
      if (action === 'clear-old') { this.setOldSelection([]);this.pickerDialog?.querySelector('[data-sentence-action="close-word-picker"]')?.focus?.({preventScroll:true});return; }
      if (action === 'remove-old') {
        const key = button.dataset.sentenceOldKey, selected = this.active.draft.selectedOldKeys || [];
        const fromPicker = Boolean(button.closest?.('.sentence-word-dialog'));
        this.setOldSelection(selected.filter(item => item !== key));
        const scope = fromPicker ? this.pickerDialog : document.querySelector('#sentence-practice-content');
        (scope?.querySelector(fromPicker ? '[data-sentence-action="remove-old"]' : '.sentence-selected-old [data-sentence-action="remove-old"]') || scope?.querySelector(fromPicker ? '[data-sentence-action="close-word-picker"]' : '[data-sentence-action="open-word-picker"]'))?.focus?.({preventScroll:true});
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
        this.active.draft.step = Math.max(0, Math.min(this.stepList().length-1, Number.isFinite(requested) ? requested : 0));
        this.markChanged(false);this.redraw(true);
      } else if (action === 'save') { this.flush();this.redraw(); }
      else if (action === 'check') {
        this.result = this.evaluate();
        this.captureRecommendedItems();
        this.active.draft.checkedAt = Date.now();
        this.markChanged(false);const saved=this.flush();
        if(saved&&this.core().completion({mode:this.active.draft.mode,answers:this.active.draft.answers,target:this.target()})){
          const draft=this.active.draft,target=this.target(),signature=JSON.stringify([draft.mode,draft.assisted,draft.answers]);
          if(this.active.evidenceSignature!==signature){
            this.active.evidenceSignature=signature;
            try{const accepted=this.options.onEvidence?.({lessonId:this.currentLesson.id,targetKey:draft.evidenceTargetKey||target.key,target:target.word||target.phrase,kind:target.kind||'word',roundKey:draft.roundKey,answer:this.core().requiredKinds(draft.mode).map(kind=>draft.answers[kind]).join('\n'),answers:{...draft.answers},complete:true,assisted:draft.assisted===true,mode:draft.mode,sentenceMode:draft.mode==='four'?'four-forms':draft.mode==='phrase'?'phrase-writing':undefined,requiredCount:this.stepList().length,requiredKinds:this.core().requiredKinds(draft.mode),at:draft.checkedAt,rulesOnly:true});if(accepted===false){this.active.evidenceSignature=null;this.notify('草稿已保存，但任务记录未保存，请再次点击检查重试。');}}catch(_){this.notify('检查已保存；任务记录暂未更新，请稍后再次检查。');this.active.evidenceSignature=null;}
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
      if(field==='mode'&&this.active&&this.core().MODES.includes(select.value)){this.switchMode(select.value);return;}
      if (field === 'target' && this.context.targets.some(item => item.key === select.value)) {
        const sources = this.active?.draft.sourceLessonIds || this.temporarySources;
        const mode=this.isQuickMode()?this.active.draft.mode:undefined;
        this.flush();this.loadTarget(select.value, sources,false,{mode});this.updateContext();this.revealLessonTarget();this.markChanged(false);this.redraw();
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
        return this.core().check({mode:this.active.draft.mode,answers:this.active.draft.answers,target:this.target(),oldWord,oldPhrase,requireOldKnowledge:false,grammarCheck:this.options.grammarCheck});
      } catch (_) {
        return {rows:[],writtenCount:0,rulesOnly:true,error:'本次检查暂时无法完成；草稿已保留，请自行核对句型、时态和句意后重试。'};
      }
    }

    copyReviewText() {
      const draft=this.active?.draft,target=this.target(),lesson=this.currentLesson;
      if(!draft||!target)return '';
      const list=this.stepList(),selected=this.selectedOldItems();
      return ['请帮我检查下面的英语练习。','课程：第 '+lesson.book+' 册 · 第 '+lesson.number+' 课 · '+String(lesson.title||''),
        '练习方式：'+(draft.mode==='four'?'四句型转换':draft.mode==='phrase'?'习惯用法造句':draft.mode==='transform'?'旧版五句句型训练':'旧版灵活五句'),
        '目标表达：'+(target.word||target.phrase)+(target.meaning?'（'+target.meaning+'）':''),
        selected.length?'我按需选用的旧词／用法：'+selected.map(item=>(item.label||item.word||item.phrase)+(item.meaning?'（'+item.meaning+'）':'')).join('；'):'',
        '以下是我的原句，请逐句保留并检查：',
        ...list.map((step,index)=>(index+1)+'. '+step.label+'：'+(draft.answers[step.kind].trim()||'【未填写，请勿代写】')),
        '',
        '检查要求：检查语法、时态、主谓一致、拼写、习惯搭配和表达自然度。指出具体问题，说明原因，再给出尽量保留我原意的修改。',
        draft.mode==='four'?'请另外检查四句是否围绕同一肯定原句、转换是否正确；特殊疑问句的提问对象是否清楚。':'请结合我写的具体语境检查目标表达是否用对；没有足够语境时先说明不确定之处。',
        '不要把未填写的句子当作我写的内容，也不要只给分数或笼统说“正确”。'].filter(Boolean).join('\n');
    }

    async copyForReview() {
      const payload=this.copyReviewText(),key=this.active?.key;
      if(!payload||!this.stepList().some(step=>this.active.draft.answers[step.kind].trim())){this.notify('先写一句英文，再复制给豆包检查。');return false;}
      this.flush();
      try {
        if(typeof this.options.copyText==='function')await this.options.copyText(payload);
        else {if(typeof global.navigator?.clipboard?.writeText!=='function')throw new Error('Clipboard unavailable');await global.navigator.clipboard.writeText(payload);}
        this.copyFallback='';this.notify('已复制句子和检查要求，请到豆包粘贴检查。');return true;
      } catch (_) {
        this.notify('浏览器未能自动复制，请在下方选中文字手动复制。');
        if(this.active?.key===key){this.copyFallback=payload;this.redraw();const field=document.querySelector('#sentence-practice-content')?.querySelector('.sentence-copy-fallback textarea');field?.focus?.();field?.select?.();}
        return false;
      }
    }

    copyFallbackHTML() {
      if(!this.copyFallback)return '';
      return `<section class="sentence-copy-fallback" aria-label="手动复制到豆包"><p>自动复制未完成，可长按以下文字手动复制，再到豆包粘贴。</p><textarea readonly rows="8" aria-label="待复制的句子与检查要求">${this.escape(this.copyFallback)}</textarea><button type="button" class="button subtle" data-sentence-action="select-copy">全选文本</button></section>`;
    }

    quickEditorHTML() {
      const e=this.escape,draft=this.active.draft,target=this.target(),list=this.stepList(),step=list[draft.step],phrase=draft.mode==='phrase',status=this.saveState();
      const current=this.lessonTargets().filter(item=>phrase?item.kind==='phrase':(item.kind||'word')==='word');
      const old=current.some(item=>item.key===target.key)?[]:[target],progress=this.lessonProgress();
      const options=rows=>rows.map(item=>this.optionHTML(item,draft.targetKey)).join('');
      const tabs=phrase?'':`<ol class="sentence-steps sentence-four-steps" aria-label="四句型转换步骤">${list.map((item,index)=>`<li><button type="button" class="sentence-step${index===draft.step?' active':''}${draft.answers[item.kind].trim()?' written':''}" data-sentence-action="step" data-sentence-step="${index}"${index===draft.step?' aria-current="step"':''}><span>${index+1}</span>${e(item.label)}${draft.answers[item.kind].trim()?'<small>已填写</small>':''}</button></li>`).join('')}</ol>`;
      const original=!phrase&&draft.step>0?`<div class="sentence-original"><strong>对照肯定原句</strong><p lang="en">${e(draft.answers.affirmative.trim()||'先写肯定句，再做转换。')}</p><button type="button" class="button subtle" data-sentence-action="reuse-original"${!draft.answers.affirmative.trim()||draft.answers[step.kind].trim()?' disabled':''}>沿用原句再修改</button></div>`:'';
      return `<div class="sentence-quick-workspace" data-writing-mode="${draft.mode}"><div class="sentence-writing-modes" role="group" aria-label="造句训练方式"><button type="button" data-sentence-action="writing-mode" data-sentence-mode="four" aria-pressed="${!phrase}">四句型转换</button><button type="button" data-sentence-action="writing-mode" data-sentence-mode="phrase" aria-pressed="${phrase}">习惯用法造句</button></div><label class="sentence-field sentence-quick-target">${phrase?'选择习惯用法':'选择目标词'}<select class="sentence-select" data-sentence-select="target">${current.length?`<optgroup label="本课表达">${options(current)}</optgroup>`:''}${old.length?`<optgroup label="前面学过的表达">${options(old)}</optgroup>`:''}</select></label><p class="sentence-quick-progress">本课已练 ${progress.done} / ${progress.total} ${phrase?'项用法':'个词'} · 已练不代表掌握<button type="button" data-sentence-action="next-unfinished"${progress.done===progress.total?' disabled':''}>下一个未练</button></p>${tabs}<section class="sentence-editor" aria-labelledby="sentence-step-title"><h3 id="sentence-step-title">${e(step.label)}</h3><p id="sentence-step-hint" class="sentence-note">${e(step.hint)}</p>${original}<label class="sentence-field" for="sentence-answer">我的${phrase?'句子':e(step.label)}<textarea id="sentence-answer" class="sentence-textarea" data-sentence-input="answer" rows="4" maxlength="400" lang="en" spellcheck="true" autocapitalize="sentences" aria-describedby="sentence-step-hint sentence-counter" placeholder="${phrase?'例如：谁 + '+e(target.word||target.phrase)+' + 时间／地点…':'写一句自己的英文…'}">${e(draft.answers[step.kind])}</textarea></label><div class="sentence-writing-tools"><button type="button" data-sentence-action="insert-target">插入目标表达</button><span id="sentence-counter" class="sentence-counter">${draft.answers[step.kind].length} / 400</span></div><div class="sentence-draft-meta"><p class="sentence-save-status" data-save-state="${status.state}" role="status" aria-live="polite">${e(status.text)}</p></div>${!phrase?`<div class="sentence-page-actions"><button type="button" class="button subtle" data-sentence-action="previous"${draft.step===0?' disabled':''}>上一句</button><span>${draft.step+1} / 4</span><button type="button" class="button" data-sentence-action="next"${draft.step===3?' disabled':''}>下一句</button></div>`:''}<div class="sentence-actions sentence-quick-actions"><button type="button" class="button" data-sentence-action="check">检查基本要求</button><button type="button" class="button primary" data-sentence-action="copy-review">一键复制到豆包检查</button></div><p class="sentence-copy-note">复制后到豆包粘贴，连同检查要求一起带过去。</p></section>${this.copyFallbackHTML()}<details class="sentence-quick-old"><summary>选用旧词与习惯用法（可选）</summary>${this.oldPickerEntryHTML()}</details><section class="sentence-feedback" aria-live="polite">${this.feedbackHTML()}</section>${draft.assisted?'<p class="sentence-note sentence-assisted">本轮已借助参考。</p>':''}<details class="sentence-quick-legacy"><summary>更多训练与旧版草稿</summary>${this.controlsHTML(true)}</details>${this.referenceHTML()}${this.wordPickerHTML()}</div>`;
    }

    render() {
      this.invalidateLessonCarousel();
      this.closeWordPicker(false);
      if (!this.core()) return '<section id="sentence-practice-content" class="sentence-practice"><p class="sentence-note">造句规则尚未加载，请刷新后重试。</p></section>';
      this.rememberAdjustments();
      if (!this.ensureState()) return '<section id="sentence-practice-content" class="sentence-practice"><p class="sentence-note">请选择一篇课文后开始五句造句。</p></section>';
      const html = `<section id="sentence-practice-content" class="sentence-practice" aria-label="${this.isQuickMode()?'造句练习':'五句造句练习'}">${this.bodyHTML()}</section>`;
      this.scheduleLessonCarousel();return html;
    }

    rememberAdjustments(root = document.querySelector('#sentence-practice-content')) {
      const panel = root?.querySelector('.sentence-adjustments');
      if (typeof panel?.open === 'boolean') this.adjustmentsOpen = panel.open;
    }

    redraw(focusInput = false) {
      this.invalidateLessonCarousel();
      this.closeWordPicker(false);
      const root = document.querySelector('#sentence-practice-content');
      this.rememberAdjustments(root);
      if (!root || !this.ensureState()) return;
      root.innerHTML = this.bodyHTML();
      this.scheduleLessonCarousel();
      if (focusInput) root.querySelector('.sentence-textarea')?.focus?.();
    }

    optionHTML(item, selected, phrase = false) {
      const e = this.escape;
      return `<option value="${e(item.key)}"${item.key === selected ? ' selected' : ''}>${e(phrase ? item.phrase : item.word || item.phrase)}${item.meaning ? ' · ' + e(item.meaning) : ''}</option>`;
    }

    sourceHTML() { return ''; }

    controlsHTML(compact = false) {
      const draft = this.active?.draft, flexible = draft?.mode === 'flexible';
      if(compact)return `<div class="sentence-controls"><label class="sentence-field">训练方式<select class="sentence-select" data-sentence-select="mode"><option value="four"${draft?.mode==='four'?' selected':''}>四句型转换</option><option value="phrase"${draft?.mode==='phrase'?' selected':''}>习惯用法造句</option><option value="flexible"${flexible?' selected':''}>灵活五句（旧版草稿）</option><option value="transform"${draft?.mode==='transform'?' selected':''}>句型变换（旧版五句，可选）</option></select></label></div>`;
      const currentTargets = this.context.targets.filter(item => item.source.id === this.currentLesson.id);
      const oldTargets = this.context.targets.filter(item => item.source.id !== this.currentLesson.id);
      return `<div class="sentence-controls"><label class="sentence-field">练习目标<select class="sentence-select" data-sentence-select="target"${!this.context.targets.length ? ' disabled' : ''}>${currentTargets.length ? `<optgroup label="本课表达">${currentTargets.map(item => this.optionHTML(item, draft?.targetKey)).join('')}</optgroup>` : ''}${oldTargets.length ? `<optgroup label="复习表达">${oldTargets.map(item => this.optionHTML(item, draft?.targetKey)).join('')}</optgroup>` : ''}${!this.context.targets.length ? '<option>暂无可用目标</option>' : ''}</select></label><label class="sentence-field">训练方式<select class="sentence-select" data-sentence-select="mode"><option value="four"${draft?.mode==='four'?' selected':''}>四句型转换</option><option value="phrase"${draft?.mode==='phrase'?' selected':''}>习惯用法造句</option><option value="flexible"${flexible ? ' selected' : ''}>灵活五句（旧版草稿）</option><option value="transform"${draft?.mode==='transform' ? ' selected' : ''}>句型变换（旧版五句，可选）</option></select></label></div>`;
    }

    adjustmentsHTML() {
      return `<details class="sentence-adjustments"${this.adjustmentsOpen ? ' open' : ''} data-sentence-adjustments><summary>调整练习目标与方式</summary>${this.controlsHTML()}</details>`;
    }

    lessonQueueHTML() {
      const e = this.escape, targets = this.lessonTargets(), progress = this.lessonProgress();
      if (!targets.length) return '<section class="sentence-lesson-queue" aria-label="本课新词练习"><p class="sentence-note">本课没有新增单词，可在调整中选词复习。</p></section>';
      const items = new Map(progress.items.map(item => [item.key,item])), {page,count,activePage} = this.lessonGroupInfo();
      const cards = (rows,hidden = false) => rows.map(target => {
        const item = items.get(target.key) || {written:0,complete:false}, active = target.key === this.active?.draft.targetKey;
        return `<button type="button" class="sentence-lesson-target${active ? ' active' : ''}${item.complete ? ' is-complete' : ''}" data-sentence-action="lesson-target" data-sentence-target-key="${e(target.key)}" tabindex="${hidden ? -1 : 0}"${active ? ' aria-current="true"' : ''} aria-label="${e(target.word)}，${item.complete ? '已练五句' : `已写 ${item.written} / 5 句`}"><span class="sentence-target-label" lang="en">${e(target.word)}</span><span class="sentence-target-meaning">${e(target.meaning)}</span><span class="sentence-target-progress">${item.complete ? '已练' : `${item.written}/5`}</span></button>`;
      }).join('');
      const grouped = Array.from({length:count},(_,index) => `<div class="sentence-lesson-group" data-sentence-group="${index}" role="group" aria-label="第 ${index + 1} 组，共 ${count} 组" aria-hidden="${index !== page}"><div class="sentence-lesson-targets">${cards(targets.slice(index * 4,index * 4 + 4),index !== page)}</div></div>`).join('');
      const target = this.target(), hint = activePage !== page && target ? `当前练习：${target.word || target.phrase}${activePage >= 0 ? `（第 ${activePage + 1} 组）` : ''}` : '';
      const list = this.lessonTargetsExpanded ? `<div class="sentence-lesson-targets">${cards(targets)}</div>` : `<div id="sentence-lesson-carousel" class="sentence-lesson-carousel" data-sentence-lesson-carousel data-sentence-group-render="${this.lessonGroupRender}" role="region" aria-label="本课新词分组，左右方向键切换" tabindex="0">${grouped}</div><div class="sentence-lesson-group-controls" role="group" aria-label="浏览本课新词分组"><button type="button" data-sentence-action="prev-lesson-group" aria-controls="sentence-lesson-carousel"${page === 0 ? ' disabled' : ''}>上一组</button><span class="sentence-lesson-page-indicator" role="status" aria-live="polite" aria-atomic="true">第 ${page + 1} / ${count} 组</span><button type="button" data-sentence-action="next-lesson-group" aria-controls="sentence-lesson-carousel"${page >= count - 1 ? ' disabled' : ''}>下一组</button></div><p class="sentence-group-current"${hint ? '' : ' hidden'}>${e(hint)}</p>`;
      return `<section class="sentence-lesson-queue" aria-label="本课新词练习"><div class="sentence-lesson-heading"><strong>本课新词 <span>${progress.done} / ${progress.total}</span></strong>${targets.length > 4 ? `<button type="button" class="sentence-lesson-expand" data-sentence-action="expand-lesson-targets" aria-expanded="${this.lessonTargetsExpanded}">${this.lessonTargetsExpanded ? '收起词表' : `全部 ${targets.length} 词`}</button>` : ''}<button type="button" class="sentence-next-target" data-sentence-action="next-unfinished"${progress.done === progress.total ? ' disabled' : ''}>下一个未练</button></div>${list}<p class="sentence-lesson-note">每个新词写五句并检查；已练不代表掌握。</p></section>`;
    }

    bodyHTML() {
      if(this.isQuickMode()&&this.target())return this.quickEditorHTML();
      const quickEntries='<div class="sentence-writing-modes" role="group" aria-label="切换新的造句训练"><button type="button" data-sentence-action="writing-mode" data-sentence-mode="four" aria-pressed="false">四句型转换</button><button type="button" data-sentence-action="writing-mode" data-sentence-mode="phrase" aria-pressed="false">习惯用法造句</button></div><p class="sentence-note sentence-legacy-entry-note">当前旧版草稿会保留，切换后仍可在“更多训练与旧版草稿”中找回。</p>';
      if (this.isBookWorkspace()) return quickEntries+this.workspaceHTML();
      const e = this.escape, target = this.target(), draft = this.active?.draft, flexible = draft?.mode === 'flexible';
      const status = this.saveState();
      return `${quickEntries}${this.lessonQueueHTML()}<div class="sentence-header"><h3>${flexible ? '一个目标，灵活写五句' : '句型变换练习'}</h3><p>${flexible ? '围绕一个单词或习惯用法变换语境，尝试补充信息、提问、回应和联系旧知。这五个提示是本站的训练安排，不是固定五种句型要求。' : '围绕同一原句练句型转换，再联系旧知写新句子。此模式保留独立草稿，可切回灵活五句。'}</p></div>${target && draft ? this.editorHTML() : '<p class="sentence-note">本课暂无可用单词或习惯用法。</p>'}${this.adjustmentsHTML()}<p class="sentence-save-status" data-save-state="${status.state}" role="status" aria-live="polite">${e(status.text)}</p>${draft?.assisted ? '<p class="sentence-note sentence-assisted">本轮已查看参考示例；关闭示例后仍保留参考标记。</p>' : ''}${this.referenceHTML()}${this.wordPickerHTML()}`;
    }

    knowledgeHTML() {
      const e = this.escape, target = this.target();
      if (!target) return '';
      if (this.isBookWorkspace() && this.lessonTargets().some(item => item.key === target.key)) return '';
      return `<div class="sentence-target"><span class="sentence-target-label">本次目标</span><p><strong lang="en">${e(target.word || target.phrase)}</strong>${target.meaning ? `<span> · ${e(target.meaning)}</span>` : ''}</p></div>`;
    }

    workspaceHTML() {
      const e = this.escape, draft = this.active?.draft, target = this.target();
      const adjustments = this.adjustmentsHTML();
      if (!target || !draft) return `<div class="sentence-header"><h3>五句练习</h3><p>本课暂无可用单词或习惯用法。</p></div>${adjustments}`;
      const list=this.stepList(),step = list[draft.step], flexible=draft.mode==='flexible',combined = draft.step === 4, status = this.saveState();
      const hints = flexible?['用目标单词或习惯用法，联系自己的生活。','换一个时间、地点或人物，不必改成否定句。','回忆课文表达，试着变化人物、动作或情境。','用目标表达提出问题，或写一句对话回应。','可联系旧知，也可换个语境写一句。']:['用目标词，写一句完整的英文。','沿用第 1 句的人物、时态和情境。','保留目标词，写一个可用 yes / no 回答的问题。','保留目标词，用 what / who / where 等提问。','用目标词另写新句子，可按需结合旧知。'];
      const navigation = list.map((item,index) => `<li><button type="button" class="sentence-step${index === draft.step ? ' active' : ''}${draft.answers[item.kind].trim() ? ' written' : ''}" data-sentence-action="step" data-sentence-step="${index}"${index === draft.step ? ' aria-current="step"' : ''} aria-label="第 ${index + 1} 步 ${e(item.label)}${draft.answers[item.kind].trim() ? '，已填写' : ''}"><span>${index + 1}</span></button></li>`).join('');
      const original = !flexible && draft.step > 0 && !combined ? `<div class="sentence-original"><strong>第 1 句 · 肯定原句</strong><p lang="en">${draft.answers.affirmative.trim() ? e(draft.answers.affirmative) : '还没有原句，请先回到第 1 步。'}</p></div>` : '';
      if (!this.result && draft.checkedAt) this.result = this.evaluate();
      return `<div class="sentence-workspace${combined ? ' sentence-workspace-combined' : ''}">${this.lessonQueueHTML()}<div class="sentence-progress"><ol class="sentence-steps" aria-label="五句练习步骤">${navigation}</ol><p class="sentence-step-count">第 ${draft.step + 1} 句 / 共 5 句</p></div><div class="sentence-header"><h3 id="sentence-step-title">${e(step.label)}</h3><p id="sentence-step-hint">${e(hints[draft.step])}</p></div>${this.knowledgeHTML()}${this.oldPickerEntryHTML()}${original}<section class="sentence-editor" aria-labelledby="sentence-step-title"><label class="sentence-field" for="sentence-answer">${combined ? '我的综合句' : flexible ? '我的句子' : '我的' + e(step.label)}<textarea id="sentence-answer" class="sentence-textarea" data-sentence-input="answer" rows="3" maxlength="400" lang="en" spellcheck="true" autocapitalize="sentences" aria-describedby="sentence-step-hint sentence-counter" placeholder="在这里写下这一句英文…">${e(draft.answers[step.kind])}</textarea></label><div class="sentence-draft-meta"><p class="sentence-save-status" data-save-state="${status.state}" role="status" aria-live="polite">${e(status.text)}</p><p id="sentence-counter" class="sentence-counter">${draft.answers[step.kind].length} / 400 字符</p></div><div class="sentence-actions"><button type="button" class="button primary" data-sentence-action="check">检查五句基本要求</button><div class="sentence-page-actions"><button type="button" class="button subtle" data-sentence-action="previous"${draft.step === 0 ? ' disabled' : ''}>上一句</button><button type="button" class="button subtle" data-sentence-action="next"${draft.step === 4 ? ' disabled' : ''}>下一句</button></div></div></section>${adjustments}<section class="sentence-feedback" aria-live="polite">${this.feedbackHTML()}</section>${draft.assisted?'<p class="sentence-note sentence-assisted">本轮已查看参考示例；关闭示例后仍保留参考标记。</p>':''}${this.referenceHTML()}${this.wordPickerHTML()}</div>`;
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
      if(this.isQuickMode()) {
        if(!result)return '<p class="sentence-note">写好后可检查基本要求，再复制到豆包核对语法和用法。本站的有限规则检查不代表整句正确。</p>';
        if(result.error)return `<p class="sentence-note">${e(result.error)}</p>`;
        const labels={'empty':'尚未填写','needs-work':'需要修改','review':'需核对语法与句意','ready':'基本要求已检查'};
        return `<h4>基本要求反馈</h4><p class="sentence-note">已填写 ${Number(result.writtenCount)||0} / ${this.stepList().length} 句；语法与自然度可复制给豆包进一步检查。</p>${(result.rows||[]).map(row=>`<article class="sentence-feedback-row" data-status="${Object.hasOwn(labels,row.status)?row.status:'review'}"><h5>${e(row.label)} · ${e(labels[row.status]||labels.review)}</h5>${row.issues?.length?`<ul>${row.issues.map(issue=>`<li>${e(issue)}</li>`).join('')}</ul>`:'<p class="sentence-note">暂未发现已覆盖的基本问题，仍需核对句意和语法。</p>'}</article>`).join('')}`;
      }
      if (!result) return '<p class="sentence-note">填写后检查五句基本要求。这里只提供有限规则反馈；句意、自然度和语法仍需自己或老师核对，写完不代表掌握。</p>';
      if (result.error) return `<p class="sentence-note">${e(result.error)}</p>`;
      const labels = {'empty':'尚未填写','needs-work':'请修改基本要求','review':'需要人工核对','ready':'有限检查已完成'};
      return `<h4>五句基本要求反馈</h4><p class="sentence-note">已填写 ${Number(result.writtenCount) || 0} / 5 句。有限检查已完成也不代表整句正确；请继续核对句意、自然度、时态和情境。</p>${(Array.isArray(result.rows) ? result.rows : []).map(row => `<article class="sentence-feedback-row" data-status="${Object.hasOwn(labels, row.status) ? row.status : 'review'}"><h5>${e(row.label || steps.find(item => item.kind === row.kind)?.label || '句子反馈')} <span class="sentence-status">${e(labels[row.status] || labels.review)}</span></h5>${Array.isArray(row.issues) && row.issues.length ? `<ul>${row.issues.map(issue => `<li>${e(issue)}</li>`).join('')}</ul>` : ''}${Array.isArray(row.notes) ? row.notes.map(note => `<p class="sentence-note">${e(note)}</p>`).join('') : ''}</article>`).join('')}`;
    }

    referenceHTML() {
      if(this.active?.draft.mode==='phrase')return '<details class="sentence-reference" data-sentence-reference><summary data-sentence-action="reference">查看造句思路（会标记借助参考）</summary><p class="sentence-note">先想一个自己的场景：谁，做什么，在什么时候或什么地方。只需用目标表达写一句，不要求重复或硬改句型。</p></details>';
      if(this.active?.draft.mode==='four')return '<details class="sentence-reference" data-sentence-reference><summary data-sentence-action="reference">查看四句型示例（会标记借助参考）</summary><p class="sentence-note">本站自编示例，请使用自己选择的目标词。</p><ol><li lang="en">You read a book every night.</li><li lang="en">You do not read a book every night.</li><li lang="en">Do you read a book every night?</li><li lang="en">When do you read a book?</li></ol></details>';
      if(this.active?.draft.mode==='flexible')return '<details class="sentence-reference" data-sentence-reference><summary data-sentence-action="reference">查看参考示例（查看会标记本轮借助参考）</summary><p class="sentence-note">以下是本站自编的变化示例，用于说明练习方式，不是本轮标准答案。请不要直接照抄。</p><ul><li lang="en">My sister looks at the book after dinner.</li><li lang="en">Yesterday I looked at the book in the library.</li><li lang="en">Why do you look at that book every morning?</li></ul><p class="sentence-note">可以变化人物、时间、地点或回应方式，无需固定成五种句型。</p></details>';
      return '<details class="sentence-reference" data-sentence-reference><summary data-sentence-action="reference">查看教学示例：book + sister + look at</summary><p class="sentence-note">以下是为练习编写的教学示例，并非教材原文。请用自己选的词写句子；此示例不会填入你的草稿。</p><ol><li>肯定句：<span lang="en">You look at the book.</span></li><li>否定句：<span lang="en">You do not look at the book.</span></li><li>一般疑问句：<span lang="en">Do you look at the book?</span></li><li>特殊疑问句：<span lang="en">Why do you look at the book?</span></li><li>旧知综合句：<span lang="en">My sister and I look at the book after dinner.</span></li></ol><p class="sentence-note">前四句沿用同一情境；第五句加入 sister，另写新句子。自己的句子不必与示例相同。</p></details>';
    }
  }

  global.SentencePractice = SentencePractice;
})(window);
