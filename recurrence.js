/* Pure, source-backed recurrence index. No storage, DOM, network, or inferred grammar. */
(function (root) {
  'use strict';
  var VERSION='1.0.0';
  // An auditable allow-list, never a stemmer. Only the first token of verb phrases changes.
  var FORMS={
    be:['am','is','are','was','were','been','being'],have:['has','had','having'],do:['does','did','done','doing'],
    go:['goes','went','gone','going'],come:['comes','came','coming'],sit:['sits','sat','sitting'],
    get:['gets','got','gotten','getting'],take:['takes','took','taken','taking'],make:['makes','made','making'],
    give:['gives','gave','given','giving'],pay:['pays','paid','paying'],say:['says','said','saying'],
    tell:['tells','told','telling'],see:['sees','saw','seen','seeing'],hear:['hears','heard','hearing'],
    know:['knows','knew','known','knowing'],think:['thinks','thought','thinking'],find:['finds','found','finding'],
    leave:['leaves','left','leaving'],write:['writes','wrote','written','writing'],read:['reads','reading'],
    speak:['speaks','spoke','spoken','speaking'],eat:['eats','ate','eaten','eating'],drink:['drinks','drank','drunk','drinking'],
    run:['runs','ran','running'],stand:['stands','stood','standing'],keep:['keeps','kept','keeping'],
    buy:['buys','bought','buying'],bring:['brings','brought','bringing'],send:['sends','sent','sending'],
    begin:['begins','began','begun','beginning'],feel:['feels','felt','feeling'],meet:['meets','met','meeting'],
    put:['puts','putting'],hold:['holds','held','holding'],lose:['loses','lost','losing'],
    sleep:['sleeps','slept','sleeping'],wake:['wakes','woke','woken','waking'],fly:['flies','flew','flown','flying'],
    catch:['catches','caught','catching'],teach:['teaches','taught','teaching'],learn:['learns','learned','learnt','learning'],
    work:['works','worked','working'],look:['looks','looked','looking'],listen:['listens','listened','listening'],
    play:['plays','played','playing'],turn:['turns','turned','turning'],call:['calls','called','calling'],
    ask:['asks','asked','asking'],wait:['waits','waited','waiting'],walk:['walks','walked','walking'],
    live:['lives','lived','living'],arrive:['arrives','arrived','arriving'],enjoy:['enjoys','enjoyed','enjoying'],
    want:['wants','wanted','wanting'],need:['needs','needed','needing'],open:['opens','opened','opening'],
    close:['closes','closed','closing'],try:['tries','tried','trying'],stop:['stops','stopped','stopping']
  };
  function normalize(value){return String(value==null?'':value).normalize('NFKC').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim().toLowerCase();}
  function tokens(text){
    var out=[],re=/\p{L}+(?:['‘’]\p{L}+)*(?:[-‐‑]\p{L}+(?:['‘’]\p{L}+)*)*/gu,m;
    while((m=re.exec(text)))out.push({value:normalize(m[0]).replace(/[‐‑]/g,'-'),start:m.index,end:re.lastIndex});
    return out;
  }
  function order(a,b){return a.book-b.book||a.number-b.number||a.id.localeCompare(b.id);}
  function earlier(a,b){return a.book<b.book||a.book===b.book&&a.number<b.number;}
  function strings(value){return Array.isArray(value)?value:[];}
  function sentenceParts(text){
    var out=[],start=0;
    for(var i=0;i<text.length;i++){
      if(!/[.!?]/.test(text[i]))continue;
      if(text[i]==='.'&&(/\d/.test(text[i-1]||'')&&/\d/.test(text[i+1]||'')||/\b(?:Mr|Mrs|Ms|Dr|Prof|St)\.$/i.test(text.slice(start,i+1))||/[A-Za-z]/.test(text[i-1]||'')&&/[A-Za-z]/.test(text[i+1]||'')))continue;
      var end=i+1;while(end<text.length&&/[.!?‘’“”"']/.test(text[end]))end++;
      var raw=text.slice(start,end),trimmed=raw.trim();if(trimmed)out.push({text:trimmed,start:start+raw.indexOf(trimmed)});
      start=end;i=end-1;
    }
    var tail=text.slice(start),trimmed=tail.trim();if(trimmed)out.push({text:trimmed,start:start+tail.indexOf(trimmed)});
    return out;
  }
  function passageType(lesson,paragraph){
    if(paragraph&&/笔记|来源例句/.test(String(paragraph.source||'')))return {sourceType:'notes',sourceLabel:'学习笔记例句（非教材原文）'};
    if(lesson.textbook){return {sourceType:'textbook',sourceLabel:lesson.textbook.verified&&!lesson.textbook.ocrDraft?'教材正文 · 已校对':'教材正文 · OCR待校对'};}
    if(lesson.source==='original')return {sourceType:'original',sourceLabel:'原创补充内容'};
    return {sourceType:'notes',sourceLabel:'学习笔记例句（非教材原文）'};
  }
  function introduction(lesson,item,kind){
    var note=lesson.source==='provided'||/笔记/.test(String(item.source||''));
    return {lessonId:lesson.id,book:lesson.book,number:lesson.number,title:String(lesson.textbook&&lesson.textbook.title||lesson.title||''),
      sourceType:item.sourceType||(note?'notes':lesson.source==='original'?'original':'provided'),sourceLabel:item.sourceLabel||(note?'学习笔记 · '+(kind==='vocabulary'?'词表':kind==='usage'?'搭配':'语法知识点'):'来源课程知识点'),
      sourceDocId:item.sourceDocId||lesson.sourceDocId||null,sourcePage:item.sourcePage||lesson.sourcePage||null,
      meaning:String(item.meaning||''),definitionSource:String(item.meaningSource||item.source||'')};
  }
  function patternsFor(item,kind){
    var label=kind==='vocabulary'?item.word:item.phrase,base=tokens(String(label||'')).map(function(t){return t.value;});
    if(!base.length||base.length>12)return [];
    var patterns=[base],isVerb=kind==='usage'||!item.pos||/\b(?:v|vt|vi|verb)\b/i.test(String(item.pos));
    if(isVerb&&FORMS[base[0]])FORMS[base[0]].forEach(function(form){patterns.push([form].concat(base.slice(1)));});
    return patterns;
  }
  function grammarKey(item){return item.knowledgeId?'id:'+normalize(item.knowledgeId):item.title?'title:'+normalize(item.title):'';}
  function build(input){
    var seenIds=new Set(),lessons=strings(input).filter(function(l){if(!l||!l.id||seenIds.has(String(l.id))||!Number.isFinite(Number(l.book))||!Number.isFinite(Number(l.number)))return false;seenIds.add(String(l.id));return true;}).map(function(l){
      return {id:String(l.id),book:Number(l.book),number:Number(l.number),title:l.title,source:l.source,sourceDocId:l.sourceDocId,sourcePage:l.sourcePage,textbook:l.textbook,
        vocabulary:strings(l.vocabulary),usage:strings(l.usage),grammar:strings(l.grammar),paragraphs:strings(l.paragraphs)};
    }).sort(order);
    var byId=new Map(lessons.map(function(l){return [l.id,l];})),concepts=new Map(),firstToken=new Map(),cache=new Map();
    lessons.forEach(function(lesson){
      ['vocabulary','usage','grammar'].forEach(function(kind){
        var inLesson=new Set();lesson[kind].forEach(function(item){
          if(!item||typeof item!=='object')return;
          var label=String(kind==='vocabulary'?item.word||'':kind==='usage'?item.phrase||'':item.title||''),key=kind+':'+(kind==='grammar'?grammarKey(item):normalize(label));
          if(!label.trim()||key===kind+':'||inLesson.has(key))return;inLesson.add(key);
          var concept=concepts.get(key);
          if(!concept){concept={key:key,kind:kind,label:label,meaning:String(item.meaning||''),patterns:kind==='grammar'?[]:patternsFor(item,kind),introductions:[]};concepts.set(key,concept);}
          concept.introductions.push({lesson:lesson,origin:introduction(lesson,item,kind)});
        });
      });
    });
    concepts.forEach(function(c){c.patterns.forEach(function(pattern){var list=firstToken.get(pattern[0])||[];list.push({concept:c,pattern:pattern});firstToken.set(pattern[0],list);});});
    function baseFor(lesson){
      if(cache.has(lesson.id))return cache.get(lesson.id);
      var hits=new Map();
      function prior(concept){return concept.introductions.filter(function(o){return earlier(o.lesson,lesson);}).map(function(o){return o.origin;});}
      lesson.paragraphs.forEach(function(paragraph,paragraphIndex){
        var text=String(typeof paragraph==='string'?paragraph:paragraph&&paragraph.en||'');if(!text)return;
        sentenceParts(text).forEach(function(part){
          var ts=tokens(part.text);
          ts.forEach(function(token,i){
            (firstToken.get(token.value)||[]).forEach(function(candidate){
              var c=candidate.concept,pattern=candidate.pattern;if(hits.has(c.key)||i+pattern.length>ts.length)return;
              for(var n=0;n<pattern.length;n++){
                if(ts[i+n].value!==pattern[n])return;
                if(n&&!/^[\s‘’“”"']*$/.test(part.text.slice(ts[i+n-1].end,ts[i+n].start)))return;
              }
              var origins=prior(c);if(!origins.length)return;
              var start=ts[i].start,end=ts[i+pattern.length-1].end,matched=part.text.slice(start,end),type=passageType(lesson,paragraph);
              hits.set(c.key,{id:'recurrence:'+lesson.id+':'+c.key,key:c.key,kind:c.kind,label:c.label,meaning:c.meaning||origins[0].meaning,matchedForm:matched,matchType:normalize(matched)===normalize(c.label)?'exact':'finite-inflection',
                origins:origins,evidence:{type:'passage-token-match',sentence:part.text,paragraphIndex:paragraphIndex,fromParagraph:true,sourceType:type.sourceType,sourceLabel:type.sourceLabel,
                  sourcePage:paragraph&&paragraph.sourcePage||lesson.textbook&&lesson.textbook.sourcePdfPage||lesson.sourcePage||null,matchStart:part.start+start,matchEnd:part.start+end}});
            });
          });
        });
      });
      lesson.grammar.forEach(function(item){
        if(!item||!item.title)return;var key='grammar:'+grammarKey(item),c=concepts.get(key);if(!c||hits.has(key))return;var origins=prior(c);if(!origins.length)return;
        hits.set(key,{id:'recurrence:'+lesson.id+':'+key,key:key,kind:'grammar',label:String(item.title),meaning:String(item.note||''),matchedForm:String(item.title),matchType:'explicit-grammar-tag',origins:origins,
          evidence:{type:'explicit-grammar-tag',sentence:String(item.example||''),paragraphIndex:null,fromParagraph:false,sourceType:'grammar-note',sourceLabel:'本课明确语法标签/语法笔记例句（非正文语法推断）',sourcePage:item.sourcePage||lesson.sourcePage||null,knowledgeId:item.knowledgeId||null}});
      });
      var result=Array.from(hits.values()).sort(function(a,b){return a.origins[0].book-b.origins[0].book||a.origins[0].number-b.origins[0].number||a.kind.localeCompare(b.kind)||a.label.localeCompare(b.label);});cache.set(lesson.id,result);return result;
    }
    return Object.freeze({version:VERSION,stats:Object.freeze({lessons:lessons.length,concepts:concepts.size}),forLesson:function(id,options){
      var lesson=byId.get(String(id));if(!lesson)return [];
      options=options||{};var value=options.studiedIds,studied=new Set(Array.isArray(value)?value.map(String):value&&typeof value.forEach==='function'?Array.from(value,String):[]);
      var limit=options.limit==null?30:Number(options.limit);if(!Number.isFinite(limit))limit=30;limit=Math.max(0,Math.min(100,Math.floor(limit)));
      return baseFor(lesson).slice(0,limit).map(function(hit){
        var origins=hit.origins.map(function(origin){return Object.assign({},origin,{studied:studied.has(origin.lessonId)});});
        return Object.assign({},hit,{origin:origins[0],origins:origins,studied:origins[0].studied,hasStudiedOrigin:origins.some(function(o){return o.studied;}),evidence:Object.assign({},hit.evidence)});
      });
    }});
  }
  root.StudyRecurrence=Object.freeze({version:VERSION,build:build,finiteForms:Object.freeze(Object.fromEntries(Object.entries(FORMS).map(function(entry){return [entry[0],Object.freeze(entry[1].slice())];})))});
})(typeof window!=='undefined'?window:globalThis);
