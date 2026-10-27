(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudyDictionaryContext = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const normalize = value => typeof value === 'string' ? value.normalize('NFKC').replace(/[‘’]/g, "'").trim().toLowerCase() : '';
  const wordOf = value => { const word = normalize(value); return word.length <= 64 && /^[a-z]+(?:[-'][a-z]+)*['-]?$/i.test(word) ? word : ''; };
  const list = value => Array.isArray(value) ? value : [];
  const clean = value => typeof value === 'string' ? value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 1200) : '';
  const occurs = (text, word) => new RegExp("(^|[^a-z0-9'-])" + normalize(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "(?=$|[^a-z0-9'-])").test(normalize(text));

  // Chinese text alone does not make a dictionary gloss. These are note
  // headings, review statuses, or unfinished explanations found in the corpus.
  function isUsableMeaning(value) {
    const meaning = clean(value), compact = meaning.replace(/\s+/g, '').replace(/[。.:：]$/, '');
    if (!/[\u3400-\u9fff]/.test(meaning)) return false;
    if (/^(?:本课)?词义暂待复核|^(?:未提供|暂无|待补充|待核对|见上文|见下文|同上)/.test(compact)) return false;
    if (/^(?:(?:一般|现在|过去|将来|过去将来)(?:完成|进行|完成进行)?时|现在完成|过去完成)(?:态)?$/.test(compact)) return false;
    if (/^(?:比较级(?:和|与|及|、)?最高级|比较级|最高级|动词不定式|动名词|现在分词|过去分词|被动语态|主动语态|虚拟语气|直接引语|间接引语|主谓一致|定语从句|宾语从句|状语从句|含有.+的句子)$/.test(compact)) return false;
    if (/^(?:国家|城市|职业|国籍|颜色|时间|地点){2,}$/.test(compact)) return false;
    if (/^(?:对|把|被|使|让|向|从|在|关于)?[.…·]+[。.]?$/.test(compact) || /(?:[:：]|\.\.\.|……)$/.test(compact)) return false;
    return true;
  }

  function sourceMatches(item, lesson, query, form = false) {
    if (!item || !lesson || item.needsContextReview === true || !isUsableMeaning(item.meaning)) return false;
    if (item.sourceLessonId && item.sourceLessonId !== lesson.id) return false;
    const context = item.contextEvidence;
    if (context) {
      if (typeof context !== 'object' || Array.isArray(context)) return false;
      if (context.sourceDocId && lesson.textbook?.sourceUrl && !lesson.textbook.sourceUrl.includes(context.sourceDocId)) return false;
      if (context.sourceBodySha256 && lesson.textbook?.bodySha256 && context.sourceBodySha256 !== lesson.textbook.bodySha256) return false;
      const forms = list(context.matchedForms);
      if (form && forms.length && !forms.some(value => normalize(value) === query)) return false;
      const evidenceForms = form ? [query] : forms.length ? forms : [query];
      if (context.sourceType === 'lesson-title') {
        const title = lesson.textbook?.title || lesson.title;
        return context.sourceTitle === title && evidenceForms.some(value => occurs(title,value));
      }
      if (!['textbook-passage','lesson-passage'].includes(context.sourceType)) return false;
      const passage = lesson.paragraphs?.[context.sourceParagraphIndex]?.en;
      return Number.isInteger(context.sourceParagraphIndex) && typeof context.sourceText === 'string' && !!context.sourceText && typeof passage === 'string' && passage.includes(context.sourceText) && evidenceForms.some(value => occurs(context.sourceText,value));
    }
    if (form) return false; // Never guess a lemma from a suffix or another lesson.
    if (item.exampleSourceType === 'lesson-title') {
      const title = lesson.textbook?.title || lesson.title;
      return item.example === title && occurs(title, query);
    }
    if (['textbook-passage','lesson-passage'].includes(item.exampleSourceType)) {
      return !!item.example && list(lesson.paragraphs).some(p => typeof p?.en === 'string' && p.en.includes(item.example));
    }
    return normalize(item.word) === query;
  }

  function lessonEntry(item, lesson, query, form = false) {
    const entry = {...item, word:query, meaning:clean(item.meaning), sourceLessonId:lesson.id, meaningKind:'lesson',
      translationSource:item.translationSource || '本课词表 / 语境释义', sourceLabel:item.sourceLabel || '本课词表 / 笔记释义',
      meaningProvenance:{version:1,kind:'lesson',lessonId:lesson.id}};
    if (form) Object.assign(entry, {lemma:item.word,lemmaPhonetic:item.phonetic || '',phonetic:'',sourceFormMatched:true,matchedSourceForm:query});
    return entry;
  }

  const book4Source = {sourceSha256:'aed8a2a10c90ae46c51190798938f834bb9b7a673ed0ca9b4d1470bfa90735d7',sourceUrl:'resources/aed8a2a10c90ae46.pdf'};
  // These self-authored senses are bound to exact, already verified local
  // passage excerpts. They are not quotations of a Chinese textbook glossary.
  const reviewed = [
    {number:1,title:'Finding fossil man',body:'962ca868d47db8c31e07a2357e73cb9a58eb5926d6ed202b468cb64725f390ea',paragraph:2,word:'may',meaning:'可能；也许',pos:'modal v.',example:'They may also have used wood and skins, but these have rotted away.'},
    {number:2,title:'Spare that spider',body:'3687b04b13954659504241843f52057280d75196432eb8dcd3826c62eced63b3',paragraph:0,word:'live',meaning:'生存；活着',pos:'v.',example:'Insects would make it impossible for us to live in the world: they would devour all our crops and kill our flocks and herds, if it were not for the protection we get from insect-eating animals.'},
    {number:4,title:'Seeing hands',body:'b90976dd92f6e736c0344fc521250a110e7f6ace9d31849520e36f3f523cfbea',paragraph:1,word:'moving',lemma:'move',meaning:'移动（move 的现在分词）',pos:'v.',example:"by moving her elbow over a child's game of Lotto she was able to describe the figures and colours printed on it"},
    {number:5,title:'Youth',body:'c6381a0eb5b452863dba18d498495fcbaca9627ba1b6e83dc24ad2c069df2724',paragraph:0,word:'future',meaning:'前途；未来',pos:'n.',example:'There is only one difference between an old man and a young one: the young man has a glorious future before him and the old one has a splendid future behind him: and maybe that is where the rub is.'},
    {number:5,title:'Youth',body:'c6381a0eb5b452863dba18d498495fcbaca9627ba1b6e83dc24ad2c069df2724',paragraph:2,word:'turn',meaning:'求助；转而依靠（turn to）',pos:'v.',example:'He may be conceited, ill-mannered, presumptuous or fatuous, but I do not turn for protection to dreary clichés about respect for elders—as if mere age were a reason for respect.'}
  ];
  function reviewedEntry(query, lesson) {
    const row = reviewed.find(row => row.word === query && lesson?.book === 4 && lesson.number === row.number);
    const source = lesson?.textbook;
    if (!row || lesson.id !== 'nce-textbook-b4-l' + String(row.number).padStart(3,'0') || source?.verified !== true || source.title !== row.title || source.sourceSha256 !== book4Source.sourceSha256 || source.sourceUrl !== book4Source.sourceUrl || source.bodySha256 !== row.body || !lesson.paragraphs?.[row.paragraph]?.en?.includes(row.example)) return null;
    return lessonEntry({word:query,meaning:row.meaning,pos:row.pos,phonetic:'',lemma:row.lemma,example:row.example,
      sourceType:'self-authored-context-translation',sourceLabel:'自编本课语境释义（非教材官方释义）',
      exampleSourceType:'lesson-passage',exampleSourceLabel:'本课正文片段（英文原文）',
      sourceUrl:book4Source.sourceUrl,sourceSha256:book4Source.sourceSha256,sourcePdfPage:source.sourcePdfPage,
      contextEvidence:{sourceType:'lesson-passage',sourceParagraphIndex:row.paragraph,sourceText:row.example,matchedForms:[query],sourceBodySha256:row.body}
    },lesson,query);
  }

  function fromDictionary(entry) {
    if (!entry || entry.sourceName !== 'ECDICT' || !wordOf(entry.word) || !isUsableMeaning(entry.translation)) return null;
    return {word:wordOf(entry.word),meaning:clean(entry.translation),meaningKind:'dictionary',translationSource:'ECDICT',
      sourceLabel:'ECDICT 通用词典释义（未按本课语境筛选）',exampleSourceLabel:'',example:'',pos:'',
      phonetic:clean(entry.phonetic),lemma:wordOf(entry.headword) || wordOf(entry.word),
      meaningProvenance:{version:1,kind:'dictionary',provider:'ECDICT',headword:wordOf(entry.headword) || wordOf(entry.word)}};
  }
  function needsDictionaryFallback(entry) {
    return !isUsableMeaning(entry?.meaning) || !['lesson','glossary','dictionary','saved-dictionary'].includes(entry?.meaningKind);
  }
  function canReplaceMeaning(current, incoming) {
    return !!incoming && isUsableMeaning(incoming.meaning) && (needsDictionaryFallback(current) || ['dictionary','saved-dictionary'].includes(current?.meaningKind));
  }
  function resolve(input, {lesson,bank,glossary,saved,preferNotes=false} = {}) {
    const query = wordOf(input), empty = {word:query,meaning:'',meaningKind:'unresolved',sourceLabel:'',example:'',meaningProvenance:{version:1,kind:'unresolved'}};
    if (!query) return empty;
    const rows = list(lesson?.vocabulary), notes = list(lesson?.notesVocabularyExtensions);
    const bankHasLesson = !!bank?.hasLesson?.(lesson?.id);
    const exact = bankHasLesson ? bank.wordForLesson?.(lesson.id, query) : rows.find(row => normalize(row?.word) === query);
    const note = notes.find(row => normalize(row?.word) === query);
    const override = reviewedEntry(query, lesson);
    if (override) return override;
    const candidates = preferNotes ? [note,exact] : [exact,note];
    for (const item of candidates) if (sourceMatches(item,lesson,query)) return lessonEntry(item,lesson,query);
    const vocabulary = bankHasLesson ? list(bank.vocabularyForLesson?.(lesson.id)) : rows;
    const forms = vocabulary.filter(item => (list(item?.sourceForms).length ? item.sourceForms : list(item?.contextEvidence?.matchedForms)).some(form => normalize(form) === query) && sourceMatches(item,lesson,query,true));
    if (forms.length === 1) return lessonEntry(forms[0],lesson,query,true);
    const general = glossary && Object.hasOwn(glossary,query) ? glossary[query] : null;
    if (general && !general.sourceLessonId && !general.contextEvidence && !/本课|lesson-(?:title|passage)/.test((general.sourceLabel || '') + (general.sourceType || '')) && isUsableMeaning(general.meaning)) {
      return {...general,word:query,meaning:clean(general.meaning),meaningKind:'glossary',translationSource:'通用词汇表',sourceLabel:'通用词汇表（未按本课语境筛选）',exampleSourceLabel:'通用词汇例句（非本课正文）',meaningProvenance:{version:1,kind:'glossary'}};
    }
    if (saved && normalize(saved.word) === query) {
      const legacyMeaning = clean(saved.meaning);
      if (isUsableMeaning(legacyMeaning)) {
        const dictionary = saved.translationSource === 'ECDICT' ? fromDictionary({word:query,headword:saved.lemma || query,translation:legacyMeaning,phonetic:saved.phonetic,sourceName:'ECDICT'}) : null;
        if (dictionary) return {...dictionary,meaningKind:'saved-dictionary'};
        return {...empty,meaning:legacyMeaning,legacyMeaning,meaningKind:'saved-unverified',translationSource:'已存释义（未核对当前课文）',sourceLabel:'已存释义（未核对当前课文）',meaningProvenance:{version:1,kind:'saved-unverified'}};
      }
      return {...empty,legacyMeaning};
    }
    return empty;
  }
  return {resolve,isUsableMeaning,needsDictionaryFallback,fromDictionary,canReplaceMeaning};
});
