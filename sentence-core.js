/* Local, finite sentence-practice checks. No DOM, storage, network or language score. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudySentences = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var KINDS = Object.freeze(['affirmative', 'negative', 'yesno', 'wh', 'combined']);
  var LABELS = ['肯定句', '否定句', '一般疑问句', '特殊疑问句', '旧知综合造句'];
  var LIMITATION = '这里只做有限的本地规则检查；语义、自然度和完整语法仍需人工复核。';
  var ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
  var own = function (value, key) { return value != null && Object.prototype.hasOwnProperty.call(value, key); };
  var object = function (value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; };
  var text = function (value, limit) { return typeof value === 'string' ? value.slice(0, limit) : ''; };
  var normalize = function (value) { return text(value, 10000).normalize('NFKC').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase(); };
  function encoded(value) {
    // A damaged imported surrogate must not make draft saving throw.
    return encodeURIComponent(Array.from(value).map(function (char) { return char.length === 1 && /[\uD800-\uDFFF]/.test(char) ? '\uFFFD' : char; }).join(''));
  }
  function itemKey(kind, id, value) {
    var key = kind + ':' + encoded(id) + ':' + encoded(value);
    if (key.length <= 600) return key;
    // Only overlong imported labels use a compact identifier, to survive draft bounds.
    // The two deterministic hashes identify content; they are not security hashes.
    var first = 2166136261, second = 3339675911;
    for (var index = 0; index < key.length; index++) {
      first = Math.imul(first ^ key.charCodeAt(index), 16777619) >>> 0;
      second = Math.imul(second ^ key.charCodeAt(index), 2246822519) >>> 0;
    }
    return kind + ':long:' + first.toString(16).padStart(8, '0') + second.toString(16).padStart(8, '0');
  }
  function source(lesson) { return { id: lesson.id, book: lesson.book, number: lesson.number, title: text(lesson.title, 300) }; }
  function validLesson(value) {
    return value && typeof value.id === 'string' && ID.test(value.id) && Number.isInteger(value.book) && value.book > 0 && value.book <= 4 && Number.isInteger(value.number) && value.number > 0 && value.number <= 10000;
  }
  function before(a, b) { return a.book < b.book || a.book === b.book && a.number < b.number; }
  // The word bank is independent of site learning records: an earlier lesson may
  // have been learned elsewhere. Read data properties only, never inherited rows.
  function ownValue(value, field) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    var descriptor = Object.getOwnPropertyDescriptor(value, field);
    return descriptor && own(descriptor, 'value') ? descriptor.value : undefined;
  }
  function bankLesson(value) {
    return validLesson({ id: ownValue(value, 'id'), book: ownValue(value, 'book'), number: ownValue(value, 'number') });
  }
  function bankMeaning(item) {
    var meaning = text(ownValue(item, 'meaning'), 1200).trim();
    if (ownValue(item, 'needsContextReview') === true || !/[\u3400-\u9fff]/.test(meaning)) return '';
    if (/未附|未提供|暂无|待(?:补|填|译|核|校|确认|整理|审)|缺少|缺失|占位|怎么找|[?？]/.test(meaning)) return '';
    if (/^(?:句子|短语|词组|例句|用法|习惯表达|的用法\s*[:：]?)$/.test(meaning)) return '';
    return meaning;
  }
  function bankCategory(pos) {
    if (pos !== undefined && typeof pos !== 'string') return '';
    var tokens = normalize(pos).match(/[a-z]+|[\u3400-\u9fff]+/g) || [];
    // Multi-POS words use one stable card/key; explicit verb takes precedence.
    if (tokens.some(function (token) { return ['v','vt','vi','verb','verbs','动词','及物动词','不及物动词','助动词'].includes(token); })) return 'verb';
    if (tokens.some(function (token) { return ['a','adj','adjective','adjectives','形容词'].includes(token); })) return 'adjective';
    if (tokens.some(function (token) { return ['n','noun','nouns','名词'].includes(token); })) return 'noun';
    if (tokens.some(function (token) { return ['adv','adverb','adverbs','副词'].includes(token); })) return 'adverb';
    return 'word';
  }
  function mergeBankMeanings(first, next) {
    var seen = new Set(), meanings = [];
    (first + '；' + next).split(/[;；]/).forEach(function (part) {
      part = part.trim();
      var key = normalize(part);
      if (key && !seen.has(key)) { seen.add(key); meanings.push(part); }
    });
    return meanings.join('；').slice(0, 1200);
  }
  function wordBank(options) {
    options = object(options);
    var current = ownValue(options, 'currentLesson'), supplied = ownValue(options, 'lessons');
    if (!bankLesson(current) || !Array.isArray(supplied)) return [];
    var seenLessons = new Set(), entries = new Map(), result = [];
    var earlier = supplied.filter(function (lesson) { return bankLesson(lesson) && lesson.id !== current.id && before(lesson, current); })
      .slice().sort(function (a, b) { return a.book - b.book || a.number - b.number || a.id.localeCompare(b.id); });
    var getVocabulary = ownValue(options, 'getVocabulary'), getUsage = ownValue(options, 'getUsage');
    function add(item, lesson, category, field) {
      var label = text(ownValue(item, field), 160).trim(), normalized = normalize(label), meaning = bankMeaning(item);
      if (!category || !normalized || !meaning) return;
      var rawKey = itemKey(field === 'word' ? 'word' : 'phrase', lesson.id, normalized), groupKey = category + ':' + normalized;
      var entry = entries.get(groupKey);
      if (!entry) {
        var origin = { id: lesson.id, book: lesson.book, number: lesson.number, title: text(ownValue(lesson, 'title'), 300) };
        entry = { key: rawKey, category: category, label: label, meaning: meaning, pos: field === 'word' ? text(ownValue(item, 'pos'), 120).trim() : '', source: origin, sources: [], aliases: [] };
        entry[field] = label;
        entries.set(groupKey, entry); result.push(entry);
      } else entry.meaning = mergeBankMeanings(entry.meaning, meaning);
      if (!entry.sources.some(function (origin) { return origin.id === lesson.id; })) {
        entry.sources.push({ id: lesson.id, book: lesson.book, number: lesson.number, title: text(ownValue(lesson, 'title'), 300) });
      }
      if (!entry.aliases.includes(rawKey)) entry.aliases.push(rawKey);
    }
    earlier.forEach(function (lesson) {
      if (seenLessons.has(lesson.id)) return;
      seenLessons.add(lesson.id);
      var vocabulary = ownValue(lesson, 'vocabulary'), usage = ownValue(lesson, 'usage');
      if (typeof getVocabulary === 'function') {
        try { var provided = getVocabulary(lesson); if (Array.isArray(provided)) vocabulary = provided; } catch (_) { /* Keep the original lesson vocabulary if a lookup is unavailable. */ }
      }
      if (typeof getUsage === 'function') {
        try { var providedUsage = getUsage(lesson); if (Array.isArray(providedUsage)) usage = providedUsage; } catch (_) { /* Keep the original lesson usage if a lookup is unavailable. */ }
      }
      var wordRows = (Array.isArray(vocabulary) ? vocabulary : []).map(function (item) {
        return { item: item, category: bankCategory(ownValue(item, 'pos')), expression: normalize(text(ownValue(item, 'word'), 160).trim()) };
      }).filter(function (row) { return row.category && row.expression && bankMeaning(row.item); });
      var categories = new Map();
      var priority = { verb: 5, adjective: 4, noun: 3, adverb: 2, word: 1 };
      wordRows.forEach(function (row) { if (!categories.has(row.expression) || priority[row.category] > priority[categories.get(row.expression)]) categories.set(row.expression, row.category); });
      wordRows.forEach(function (row) { if (categories.get(row.expression) === row.category) add(row.item, lesson, row.category, 'word'); });
      (Array.isArray(usage) ? usage : []).forEach(function (item) { add(item, lesson, 'phrase', 'phrase'); });
    });
    return result;
  }
  function context(options) {
    options = object(options);
    var empty = { targets: [], oldWords: [], oldPhrases: [], earlierLessons: [] };
    var seen = new Set();
    var lessons = (Array.isArray(options.lessons) ? options.lessons : []).filter(function (lesson) {
      if (!validLesson(lesson) || seen.has(lesson.id)) return false;
      seen.add(lesson.id); return true;
    }).slice().sort(function (a, b) { return a.book - b.book || a.number - b.number || a.id.localeCompare(b.id); });
    var current = validLesson(options.currentLesson) && lessons.find(function (lesson) { return lesson.id === options.currentLesson.id; });
    if (!current) return empty;
    var earlier = lessons.filter(function (lesson) { return before(lesson, current); });
    var selected = new Set((Array.isArray(options.sourceLessonIds) ? options.sourceLessonIds : []).filter(function (id) { return typeof id === 'string' && ID.test(id); }));
    var records = object(options.records);
    var learned = earlier.filter(function (lesson) {
      var record = own(records, lesson.id) ? object(records[lesson.id]) : {};
      return selected.has(lesson.id) || record.completed === true || typeof record.attempts === 'number' && Number.isFinite(record.attempts) && record.attempts > 0;
    });
    var getVocabulary = ownValue(options, 'getVocabulary');
    function items(list, field, label) {
      var result = [];
      list.forEach(function (lesson) {
        var used = new Set();
        var rows = lesson[field];
        if (field === 'vocabulary' && typeof getVocabulary === 'function') {
          try { var provided = getVocabulary(lesson); if (Array.isArray(provided)) rows = provided; } catch (_) { /* An unavailable expansion keeps the original vocabulary. */ }
        }
        (Array.isArray(rows) ? rows : []).forEach(function (item) {
          item = object(item);
          var value = text(item[label], 160).trim(), normalized = normalize(value);
          if (!normalized || used.has(normalized)) return;
          used.add(normalized);
          var entry = { key: itemKey(label === 'word' ? 'word' : 'phrase', lesson.id, normalized), meaning: text(item.meaning, 1200), source: source(lesson) };
          entry[label] = value;
          var isLessonNew = ownValue(item, 'isLessonNew');
          if (typeof isLessonNew === 'boolean') entry.isLessonNew = isLessonNew;
          ['sourceSentence', 'sourceLocation'].forEach(function (field) {
            var detail = ownValue(item, field);
            if (typeof detail === 'string') entry[field] = text(detail, field === 'sourceSentence' ? 2000 : 300);
          });
          result.push(entry);
        });
      });
      return result;
    }
    var targets=items([current].concat(learned), 'vocabulary', 'word');
    if(options.includePhrases===true){
      targets=targets.map(function(item){return Object.assign({},item,{kind:'word',label:item.word});}).concat(items([current].concat(learned),'usage','phrase').map(function(item){return Object.assign({},item,{kind:'phrase',word:item.phrase,label:item.phrase});}));
    }
    return { targets: targets, oldWords: items(learned, 'vocabulary', 'word'), oldPhrases: items(learned, 'usage', 'phrase'), earlierLessons: earlier.map(source) };
  }
  function sanitizeDraft(value) {
    var supplied = object(value);
    value = {};
    ['answers', 'step', 'targetKey', 'sourceLessonIds', 'oldWordKey', 'oldPhraseKey', 'selectedOldKeys', 'recommendedOldKeys', 'mode', 'roundKey', 'assisted', 'evidenceTargetKey', 'checkedAt'].forEach(function (field) {
      if (own(supplied, field)) value[field] = ownValue(supplied, field);
    });
    var answers = object(value.answers), result = {}, answersChanged = own(value, 'answers') && answers !== value.answers;
    KINDS.forEach(function (kind) {
      var answer = ownValue(answers, kind);
      result[kind] = text(answer, 400);
      if (own(answers, kind) && answer !== result[kind]) answersChanged = true;
    });
    var ids = (Array.isArray(value.sourceLessonIds) ? value.sourceLessonIds : []).filter(function (id) { return typeof id === 'string' && ID.test(id); });
    var selected = own(value, 'selectedOldKeys') ? ownValue(value, 'selectedOldKeys') : [ownValue(value, 'oldWordKey'), ownValue(value, 'oldPhraseKey')];
    var selectedOldKeys = Array.from(new Set((Array.isArray(selected) ? selected : []).map(function (key) { return text(key, 600).trim(); }).filter(Boolean))).slice(0, 100);
    var recommended = ownValue(value, 'recommendedOldKeys');
    var recommendedOldKeys = Array.from(new Set((Array.isArray(recommended) ? recommended : []).map(function (key) { return text(key, 600).trim(); }).filter(Boolean))).slice(0, 20);
    return { step: Number.isFinite(value.step) ? Math.max(0, Math.min(4, Math.floor(value.step))) : 0,
      targetKey: text(value.targetKey, 600), sourceLessonIds: Array.from(new Set(ids)).slice(0, 200), oldWordKey: text(value.oldWordKey, 600), oldPhraseKey: text(value.oldPhraseKey, 600), selectedOldKeys: selectedOldKeys, recommendedOldKeys: recommendedOldKeys, answers: result,
      mode:value.mode==='flexible'?'flexible':'transform',roundKey:validRoundKey(value.roundKey)?value.roundKey:'',assisted:value.assisted===true,evidenceTargetKey:text(value.evidenceTargetKey,600),
      checkedAt: !answersChanged && typeof value.checkedAt === 'number' && Number.isFinite(value.checkedAt) && value.checkedAt >= 0 && value.checkedAt <= 8640000000000000 ? Math.floor(value.checkedAt) : 0 };
  }
  function draftKey(lessonId, targetKey) { return 'v1:' + encoded(text(lessonId, 160)) + ':' + encoded(text(targetKey, 600)); }
  function validRoundKey(value){return typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(value);}
  function modeDraftKey(lessonId,targetKey,mode){return mode==='transform'?draftKey(lessonId,targetKey):'v2:flexible:'+encoded(text(lessonId,160))+':'+encoded(text(targetKey,600));}
  function roundDraftKey(lessonId,targetKey,roundKey,mode){if(!validRoundKey(roundKey))throw new TypeError('Invalid sentence round');return 'round:v1:'+encoded(text(lessonId,160))+':'+encoded(text(targetKey,600))+':'+encoded(roundKey)+':'+(mode==='transform'?'transform':'flexible');}

  // Explicit irregulars plus normal spelling rules; no unconstrained stemming.
  var IRREGULAR = {
    be: ['am','is','are','was','were','been','being'], have: ['has','had','having'], do: ['does','did','done','doing'],
    go: ['goes','went','gone','going'], come: ['comes','came','coming'], get: ['gets','got','gotten','getting'],
    take: ['takes','took','taken','taking'], make: ['makes','made','making'], give: ['gives','gave','given','giving'],
    say: ['says','said','saying'], tell: ['tells','told','telling'], see: ['sees','saw','seen','seeing'],
    hear: ['hears','heard','hearing'], know: ['knows','knew','known','knowing'], think: ['thinks','thought','thinking'],
    find: ['finds','found','finding'], leave: ['leaves','left','leaving'], write: ['writes','wrote','written','writing'],
    read: ['reads','reading'], speak: ['speaks','spoke','spoken','speaking'], eat: ['eats','ate','eaten','eating'],
    drink: ['drinks','drank','drunk','drinking'], run: ['runs','ran','running'], sit: ['sits','sat','sitting'],
    stand: ['stands','stood','standing'], keep: ['keeps','kept','keeping'], buy: ['buys','bought','buying'],
    bring: ['brings','brought','bringing'], send: ['sends','sent','sending'], begin: ['begins','began','begun','beginning'],
    feel: ['feels','felt','feeling'], meet: ['meets','met','meeting'], put: ['puts','putting'], hold: ['holds','held','holding'],
    lose: ['loses','lost','losing'], sleep: ['sleeps','slept','sleeping'], wake: ['wakes','woke','woken','waking'],
    fly: ['flies','flew','flown','flying'], catch: ['catches','caught','catching'], teach: ['teaches','taught','teaching'],
    pay: ['pays','paid','paying'], learn: ['learns','learned','learnt','learning'], swim: ['swims','swam','swum','swimming'],
    sing: ['sings','sang','sung','singing'], show: ['shows','showed','shown','showing'],
    child: ['children'], man: ['men'], woman: ['women'], person: ['people'], foot: ['feet'], tooth: ['teeth'], mouse: ['mice']
  };
  var FUNCTION_WORDS = new Set(('i you he she it we they me him her us them my your his its our their a an the this that these those some any no not never and or but if as to of in on at by for from with about who what which whose whom where when why how can could will would should must may might shall').split(' '));
  var DOUBLED = new Set('stop plan shop drop hop rob nod chat clap slip grab prefer admit permit occur travel'.split(' '));
  function forms(word) {
    var list = [word];
    if (IRREGULAR[word]) return list.concat(IRREGULAR[word]);
    if (!/^[a-z]{2,}$/.test(word) || FUNCTION_WORDS.has(word)) return list;
    list.push(/[^aeiou]y$/.test(word) ? word.slice(0, -1) + 'ies' : /(?:s|x|z|ch|sh|o)$/.test(word) ? word + 'es' : word + 's');
    if (!DOUBLED.has(word) || word === 'travel') {
      list.push(/[^aeiou]y$/.test(word) ? word.slice(0, -1) + 'ied' : /e$/.test(word) ? word + 'd' : word + 'ed');
      list.push(/ie$/.test(word) ? word.slice(0, -2) + 'ying' : /[^e]e$/.test(word) ? word.slice(0, -1) + 'ing' : word + 'ing');
    }
    if (DOUBLED.has(word)) { list.push(word + word.slice(-1) + 'ed'); list.push(word + word.slice(-1) + 'ing'); }
    return Array.from(new Set(list));
  }
  var IRREGULAR_BASE = Object.create(null);
  Object.keys(IRREGULAR).forEach(function (base) { forms(base).forEach(function (form) { IRREGULAR_BASE[form] = base; }); });
  function expand(value) {
    return normalize(value).replace(/\bcan't\b/g, 'can not').replace(/\bcannot\b/g, 'can not').replace(/\bwon't\b/g, 'will not').replace(/\bshan't\b/g, 'shall not')
      .replace(/\b([a-z]+)n't\b/g, '$1 not').replace(/\bi'm\b/g, 'i am').replace(/\b(you|we|they)'re\b/g, '$1 are')
      .replace(/\b(he|she|it|there|that|what|who)'s\b/g, '$1 is').replace(/\b(i|you|we|they)'ve\b/g, '$1 have').replace(/\b(i|you|he|she|it|we|they)'ll\b/g, '$1 will');
  }
  function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function matchesExpression(sentence, expression) {
    var expected = expand(expression);
    if (!expected) return false;
    var parts = expected.split(' '), base = IRREGULAR_BASE[parts[0]] || parts[0];
    var alternatives = forms(base).map(escapeRegex).join('|');
    var tail = parts.slice(1).map(escapeRegex).join('\\s+');
    var pattern = new RegExp('(?:^|[^\\p{L}\\p{N}_])(?:' + alternatives + ')' + (tail ? '\\s+' + tail : '') + '(?![\\p{L}\\p{N}_])', 'u');
    return pattern.test(expand(sentence));
  }

  var VERBS = Object.create(null);
  ('be have do go come get take make give say tell see hear know think find leave write read speak eat drink run sit stand keep buy bring send begin feel meet put hold lose sleep wake fly catch teach pay learn swim play work live like love want need look listen turn call ask wait walk arrive enjoy open close try stop help use visit watch cook dance sing study travel happen carry wash finish start explain show remember').split(' ').forEach(function (base) {
    forms(base).forEach(function (form) { VERBS[form] = base; });
  });
  var BE = new Set(['am','is','are','was','were']);
  var DO = new Set(['do','does','did']);
  var MODAL = new Set(['can','could','will','would','should','must','may','might','shall']);
  var AUX = new Set(Array.from(BE).concat(Array.from(DO), Array.from(MODAL), ['have','has','had']));
  var WH = new Set(['who','what','which','whose','whom','where','when','why','how']);
  var ADVERBS = new Set(['not','never','rarely','seldom','hardly','always','usually','often','sometimes','ever','really','just','still','also']);
  // These also have independent base-verb meanings: saw wood; found a club.
  var AMBIGUOUS_VERBS = new Set(['saw','found']);
  var PRONOUNS = { i: 'i', he: 'third', she: 'third', it: 'third', you: 'plural', we: 'plural', they: 'plural' };
  var DETERMINERS = new Set(['a','an','the','my','your','his','her','our','their','this','that','these','those']);
  function subject(words, index) {
    var word = words[index];
    if (!word || AUX.has(word) || WH.has(word) || ADVERBS.has(word)) return null;
    if (own(PRONOUNS, word)) return { end: index + 1, agreement: PRONOUNS[word] };
    if (DETERMINERS.has(word)) return words[index + 1] ? { end: index + 2, agreement: null } : null;
    return { end: index + 1, agreement: null };
  }
  function grammarForAux(aux, person, verb, issues) {
    if (person && BE.has(aux)) {
      var expected = aux === 'was' || aux === 'were' ? person === 'plural' ? 'were' : 'was' : person === 'i' ? 'am' : person === 'third' ? 'is' : 'are';
      if (aux !== expected) issues.push('这里的主语与 be 动词不一致；在这个常见结构中请用 ' + expected + '。');
    }
    if (DO.has(aux)) {
      if (person && aux !== 'did' && (person === 'third' ? aux !== 'does' : aux !== 'do')) issues.push('一般现在时中，这个主语通常与 ' + (person === 'third' ? 'does' : 'do') + ' 搭配。');
      if (verb && VERBS[verb] && VERBS[verb] !== verb && !AMBIGUOUS_VERBS.has(verb)) issues.push('do / does / did 后的谓语通常用动词原形；这里请核对 ' + VERBS[verb] + '。');
    }
  }
  function afterAdverbs(words, index) { while (ADVERBS.has(words[index])) index++; return index; }
  function predicate(words, index, person, issues) {
    var start = index, verbIndex = afterAdverbs(words, index), verb = words[verbIndex];
    var negative = words.slice(start, verbIndex).some(function (word) { return ['not','never','rarely','seldom','hardly'].includes(word); });
    if (!verb) return { supported: false, negative: negative };
    if (BE.has(verb) || DO.has(verb) || MODAL.has(verb)) {
      var next = afterAdverbs(words, verbIndex + 1);
      negative = negative || words.slice(verbIndex + 1, next).includes('not') || words.slice(verbIndex + 1, next).includes('never');
      grammarForAux(verb, person, words[next], issues);
      return { supported: BE.has(verb) ? next < words.length : !!VERBS[words[next]] && !AMBIGUOUS_VERBS.has(words[next]), negative: negative };
    }
    if (['have','has','had'].includes(verb)) {
      var following = afterAdverbs(words, verbIndex + 1);
      // Perfect auxiliaries and the less common have-not possession form are outside
      // this finite structural check. Do not treat them as a positive lexical have.
      if (following > verbIndex + 1 || VERBS[words[following]]) return { supported: false, negative: negative || words.slice(verbIndex + 1, following).some(function (word) { return ['not','never','rarely','seldom','hardly'].includes(word); }) };
    }
    if (VERBS[verb]) {
      negative = negative || ['no','nobody','nothing','none','neither'].includes(words[verbIndex + 1]);
      return { supported: true, negative: negative };
    }
    return { supported: false, negative: negative };
  }
  function analyze(sentence, kind, issues, notes) {
    var normalized = expand(sentence), words = normalized.match(/[a-z]+(?:'[a-z]+)*/g) || [];
    var wh = WH.has(words[0]), firstAux = AUX.has(words[0]), supported = false, negative = false, ambiguousPolarity = /\bnot only\b/.test(normalized);
    function declarative() {
      var s = subject(words, 0);
      return s ? predicate(words, s.end, s.agreement, issues) : { supported: false, negative: false };
    }
    function inverted(auxIndex) {
      var s = subject(words, auxIndex + 1);
      if (!s) return false;
      var next = afterAdverbs(words, s.end), aux = words[auxIndex];
      grammarForAux(aux, s.agreement, words[next], issues);
      return BE.has(aux) || !!VERBS[words[next]] && !AMBIGUOUS_VERBS.has(words[next]);
    }
    if (kind === 'wh') {
      if (wh) {
        var auxIndex = words.findIndex(function (word, i) { return i > 0 && i < 6 && AUX.has(word); });
        // Who plays...? has a subject WH word; it does not need do-support.
        var subjectWh = ['who','what','which'].includes(words[0]) && (auxIndex < 0 || auxIndex === 1 && !own(PRONOUNS, words[2]) && !DETERMINERS.has(words[2]));
        if (subjectWh) supported = predicate(words, words[0] === 'which' ? 2 : 1, null, issues).supported;
        else if (auxIndex > 0) supported = inverted(auxIndex);
      } else if (!words.some(function (word) { return WH.has(word); }) && (firstAux || declarative().supported)) issues.push('这一句请写特殊疑问句，用 who / what / where / when / why / how 等提出具体问题。');
    } else if (kind === 'yesno') {
      if (wh) issues.push('这一句请写一般疑问句，通常由助动词或 be 动词开头，不使用特殊疑问词开头。');
      else if (firstAux) supported = inverted(0);
    } else if (kind === 'combined' && (wh || firstAux && /\?$/.test(normalized))) {
      supported = firstAux ? inverted(0) : false;
    } else {
      var result = declarative(); supported = result.supported; negative = result.negative;
      if ((kind === 'affirmative' || kind === 'negative') && (wh || firstAux && /\?$/.test(normalized))) issues.push('这一句请写' + (kind === 'affirmative' ? '肯定' : '否定') + '陈述句，并以第一句的情境为基础。');
      if (!ambiguousPolarity && kind === 'affirmative' && supported && negative) issues.push('第一句需要肯定表达，请把否定表达留在第二句。');
      if (!ambiguousPolarity && kind === 'negative' && supported && !negative) issues.push('第二句需要否定表达；常见结构可用 not / n’t、never 或 no 等。');
    }
    // These checks do not attempt to parse subordinate clauses, quotations or multiple sentences.
    if (ambiguousPolarity || /\b(?:that|because|although|unless|while|whether|whose|whom)\b/.test(normalized) || /[.!?]\s+[a-z]/.test(normalized) || /[;"“”]/.test(normalized)) supported = false;
    if (!supported) notes.push('这个句子的完整结构尚未覆盖，请人工复核；不据此判定句子有错。');
    return supported;
  }
  function expression(value, field) { return typeof value === 'string' ? value.trim() : text(object(value)[field]||(field==='word'?(object(value).phrase||object(value).label):''), 160).trim(); }
  function duplicateKey(value) { return expand(value).replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim(); }
  function completion(options){options=object(options);var answers=object(options.answers),target=expression(options.target,'word'),keys=KINDS.map(function(k){return duplicateKey(answers[k]);});return Boolean(target&&keys.every(Boolean)&&new Set(keys).size===5&&KINDS.every(function(k){return typeof answers[k]==='string'&&answers[k].length<=400&&matchesExpression(answers[k],target);}));}
  // Persisted progress and rotation read only own data fields. Do not sanitize
  // answers here: truncating an imported overlong answer could fabricate completion.
  function draftValues(drafts) {
    if (!drafts || typeof drafts !== 'object') return [];
    return Object.keys(drafts).map(function (key) {
      var descriptor = Object.getOwnPropertyDescriptor(drafts, key);
      return descriptor && own(descriptor, 'value') ? descriptor.value : undefined;
    }).filter(function (draft) { return draft && typeof draft === 'object' && !Array.isArray(draft); });
  }
  function draftAnswers(draft) {
    var supplied = ownValue(draft, 'answers'), answers = {};
    KINDS.forEach(function (kind) {
      var answer = ownValue(supplied, kind);
      if (typeof answer === 'string') answers[kind] = answer;
    });
    return answers;
  }
  function checkedTime(draft) {
    var at = ownValue(draft, 'checkedAt');
    return typeof at === 'number' && Number.isFinite(at) && at > 0 && at <= 8640000000000000 ? at : 0;
  }
  function plainExpression(item) {
    var value = ownValue(item, 'word') || ownValue(item, 'phrase') || ownValue(item, 'label');
    return typeof value === 'string' && value.length <= 160 ? value.trim() : '';
  }
  function boundedKey(value) { return typeof value === 'string' && value.length <= 600 && value.trim() ? value : ''; }
  function lessonProgress(options) {
    var targets = ownValue(options, 'targets'), drafts = draftValues(ownValue(options, 'drafts')), seen = new Set();
    var items = (Array.isArray(targets) ? targets : []).filter(function (target) {
      var key = boundedKey(ownValue(target, 'key'));
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    }).map(function (target) {
      var key = ownValue(target, 'key'), word = plainExpression(target), written = 0, checked = false, complete = false;
      drafts.forEach(function (draft) {
        if (ownValue(draft, 'targetKey') !== key) return;
        var answers = draftAnswers(draft), at = checkedTime(draft);
        written = Math.max(written, KINDS.filter(function (kind) { return typeof answers[kind] === 'string' && answers[kind].length <= 400 && answers[kind].trim(); }).length);
        if (at) {
          checked = true;
          if (completion({ target: word, answers: answers })) complete = true;
        }
      });
      return { key: key, written: written, checked: checked, complete: complete };
    });
    return { total: items.length, done: items.filter(function (item) { return item.complete; }).length, items: items };
  }
  function decodedTarget(key) {
    if (!boundedKey(key) || /^(?:word|phrase):long:[0-9a-f]{16}$/i.test(key)) return '';
    var parts = /^(word|phrase):([^:]+):([^:]+)$/.exec(key);
    if (!parts) return '';
    try {
      var id = decodeURIComponent(parts[2]), value = decodeURIComponent(parts[3]);
      return ID.test(id) && value.length <= 160 && value.trim() ? value.trim() : '';
    } catch (_) { return ''; }
  }
  function recommendOldWords(options) {
    var supplied = ownValue(options, 'items'), count = ownValue(options, 'count');
    if (count === undefined) count = 4;
    if (!Array.isArray(supplied) || typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return [];
    count = Math.min(20, Math.floor(count));
    var random = ownValue(options, 'random'), previous = ownValue(options, 'previousKeys');
    if (typeof random !== 'function') random = Math.random;
    var previousKeys = new Set((Array.isArray(previous) ? previous : []).filter(function (key) { return boundedKey(key); }));
    var seen = new Map(), candidates = [];
    supplied.forEach(function (item) {
      var key = boundedKey(ownValue(item, 'key')), value = plainExpression(item), phrase = ownValue(item, 'category') === 'phrase' || key.indexOf('phrase:') === 0;
      var identity = (phrase ? 'phrase:' : 'word:') + normalize(value);
      if (!key || !value) return;
      var aliases = ownValue(item, 'aliases');
      var keys = [key].concat(Array.isArray(aliases) ? aliases.filter(function (alias) { return boundedKey(alias); }) : []);
      var candidate = seen.get(identity);
      if (candidate) {
        candidate.keys = Array.from(new Set(candidate.keys.concat(keys)));
        candidate.previous = candidate.previous || keys.some(function (alias) { return previousKeys.has(alias); });
      } else {
        candidate = { item: item, keys: keys, value: value, phrase: phrase, lastUsed: 0, previous: keys.some(function (alias) { return previousKeys.has(alias); }) };
        seen.set(identity, candidate); candidates.push(candidate);
      }
    });
    draftValues(ownValue(options, 'drafts')).forEach(function (draft) {
      var at = checkedTime(draft), target = decodedTarget(ownValue(draft, 'targetKey'));
      if (!at || !target) return;
      var answers = draftAnswers(draft);
      if (!completion({ target: target, answers: answers })) return;
      var selected = own(draft, 'selectedOldKeys') ? ownValue(draft, 'selectedOldKeys') : [ownValue(draft, 'oldWordKey'), ownValue(draft, 'oldPhraseKey')];
      var recommended = ownValue(draft, 'recommendedOldKeys');
      var keys = new Set((Array.isArray(selected) ? selected : []).concat(Array.isArray(recommended) ? recommended : []).filter(function (key) { return boundedKey(key); }));
      candidates.forEach(function (candidate) {
        if (candidate.keys.some(function (key) { return keys.has(key); }) && KINDS.some(function (kind) { return matchesExpression(answers[kind], candidate.value); })) candidate.lastUsed = Math.max(candidate.lastUsed, at);
      });
    });
    var unused = candidates.filter(function (candidate) { return !candidate.lastUsed; });
    var pool = unused.length ? unused : candidates.slice();
    // Shuffle first so stable sorting resolves equal usage/previous-choice groups
    // using the injected random source rather than source lesson order.
    for (var index = pool.length - 1; index > 0; index--) {
      var value;
      try { value = random(); } catch (_) { value = 0; }
      if (typeof value !== 'number' || !Number.isFinite(value)) value = 0;
      var other = Math.floor(Math.max(0, Math.min(0.9999999999999999, value)) * (index + 1));
      var held = pool[index]; pool[index] = pool[other]; pool[other] = held;
    }
    pool.sort(function (a, b) { return Number(a.previous) - Number(b.previous) || a.lastUsed - b.lastUsed; });
    var result = [], phrase = pool.find(function (candidate) { return candidate.phrase; });
    if (phrase && count > 1) result.push(phrase);
    pool.filter(function (candidate) { return !candidate.phrase; }).slice(0, count - result.length).forEach(function (candidate) { result.push(candidate); });
    pool.forEach(function (candidate) { if (result.length < count && !result.includes(candidate)) result.push(candidate); });
    return result.map(function (candidate) { return candidate.item; });
  }
  function flexibleCheck(options){
    var answers=object(options.answers),target=expression(options.target,'word'),labels=['换一个语境','补充时间地点','模仿并改写','提问或回应','结合旧知'],written=0;
    var rows=KINDS.map(function(kind,index){var sentence=text(answers[kind],10000).trim(),issues=[],notes=[LIMITATION];if(!sentence)return {kind:kind,label:labels[index],status:'empty',issues:[],notes:notes};written++;
      if(!target||!matchesExpression(sentence,target))issues.push('尚未识别到目标单词或习惯用法，以及已支持的常见词形。');
      if(sentence.length>400)issues.push('每句最多400字符。');
      if(KINDS.some(function(other){return other!==kind&&duplicateKey(answers[other])===duplicateKey(sentence);}))issues.push('五句应有变化，不能只重复同一句。');
      if(typeof options.grammarCheck==='function')try{var feedback=options.grammarCheck(sentence.slice(0,400));if(!Array.isArray(feedback))throw Error();feedback.slice(0,20).forEach(function(x){var message=text(object(x).message,600);if(message)notes.push('有限规则建议：'+message);});}catch(_){notes.push('附加规则暂时不可用，请自行或请老师核对。');}
      notes.push('提示方向可灵活选择；本地不判断是否真正换了语境、表达是否自然或语法完整正确。');return {kind:kind,label:labels[index],status:issues.length?'needs-work':'review',issues:issues,notes:notes};});
    return {rows:rows,writtenCount:written,readyForReview:completion(options),complete:completion(options),rulesOnly:true,mode:'flexible'};
  }
  function check(options) {
    options = object(options);
    if(options.mode==='flexible')return flexibleCheck(options);
    var answers = object(options.answers), target = expression(options.target, 'word'), oldWord = expression(options.oldWord, 'word'), oldPhrase = expression(options.oldPhrase, 'phrase');
    var writtenCount = 0;
    var rows = KINDS.map(function (kind, index) {
      var sentence = text(answers[kind], 10000).trim(), issues = [], notes = [LIMITATION], review = false;
      if (index > 0 && index < 4) notes.push('请保持第一句原句的主语、时态和基本情境；本地规则无法确认情境是否一致。');
      if (!sentence) return { kind: kind, label: LABELS[index], status: 'empty', issues: [], notes: notes };
      writtenCount++;
      if (typeof answers[kind] === 'string' && answers[kind].length > 400) issues.push('每句最多 400 个字符，请缩短后再检查。');
      if (!target) { if (options.requireTarget !== false) issues.push('请先选择本轮目标词。'); }
      else if (!matchesExpression(sentence, target)) issues.push('还未识别到目标词“' + target + '”或已支持的常见词形。');
      if (kind === 'combined') {
        if (!oldWord) issues.push('请先选择一个来自已学早期课程的旧词。');
        else if (target && (matchesExpression(oldWord, target) || matchesExpression(target, oldWord))) issues.push('旧词需要与目标词不同，不能使用同一词的其他词形。');
        else if (!matchesExpression(sentence, oldWord)) issues.push('还未识别到已选旧词“' + oldWord + '”或已支持的词形。');
        if (!oldPhrase) issues.push('请先选择一个来自已学早期课程的旧用法或短语。');
        else if (!matchesExpression(sentence, oldPhrase)) issues.push('还未识别到已选旧用法“' + oldPhrase + '”或已支持的词形；请保留搭配。');
        var key = duplicateKey(sentence);
        if (KINDS.slice(0, 4).some(function (other) { return text(answers[other], 10000).trim() && duplicateKey(answers[other]) === key; })) issues.push('第五句需要另写一个新句子，不能逐字重复前四句。');
      }
      review = !analyze(sentence.slice(0, 400), kind, issues, notes);
      if (typeof options.grammarCheck === 'function') {
        try {
          var grammarIssues = options.grammarCheck(sentence.slice(0, 400));
          if (!Array.isArray(grammarIssues)) throw new TypeError('Invalid rule-check result');
          grammarIssues.slice(0, 20).forEach(function (issue) {
            var message = text(object(issue).message, 600);
            if (!message) return;
            if (issue.confidence === 'high') issues.push(message);
            else { notes.push('语法规则提醒（请结合语境）：' + message); review = true; }
          });
        } catch (_) { review = true; notes.push('附加语法规则暂时不可用，这部分尚未完成，请人工核对。'); }
      } else notes.push('当前只检查词项和已支持句型；未接入附加语法规则。');
      if (!issues.length && !review) notes.push('已完成词项覆盖和已支持的基本句型检查，请继续人工复核。');
      return { kind: kind, label: LABELS[index], status: issues.length ? 'needs-work' : review ? 'review' : 'ready', issues: Array.from(new Set(issues)), notes: Array.from(new Set(notes)) };
    });
    return { rows: rows, writtenCount: writtenCount, readyForReview: writtenCount === 5 && rows.every(function (row) { return row.status !== 'needs-work'; }), rulesOnly: true };
  }

  return Object.freeze({ KINDS: KINDS, context: context, wordBank: wordBank, sanitizeDraft: sanitizeDraft, lessonProgress: lessonProgress, recommendOldWords: recommendOldWords, draftKey: draftKey, modeDraftKey:modeDraftKey,roundDraftKey:roundDraftKey,validRoundKey:validRoundKey,completion:completion,matchesExpression: matchesExpression, check: check });
});
