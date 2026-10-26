/* Pure, source-backed recurrence index. No storage, DOM, network, or inferred grammar. */
(function (root) {
  'use strict';
  var VERSION='1.2.0';
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
  function phraseForms(phrase){var value=normalize(phrase),patterns=patternsFor({phrase:phrase},'usage');if(!patterns.length||patterns[0].join(' ')!==value)return value?[value]:[];return patterns.map(function(pattern){return pattern.join(' ');});}
  // Only explicit concept identities can connect a grammar note to a review card.
  // Scoped knowledge IDs share a final canonical key, but a card's scope must
  // still agree with its source lesson. Titles and question text are not IDs.
  function grammarIdentities(item,sourceLessonId){
    var values=[],ids=[],invalidScope=false;
    [item,item&&item.evidence,item&&item.metadata].forEach(function(value){
      if(!value||typeof value!=='object')return;
      ['knowledgeId','conceptId','grammarConceptId'].forEach(function(key){if(typeof value[key]==='string'&&value[key].trim())values.push(value[key]);});
    });
    if(item&&typeof item.key==='string'&&item.key.indexOf('grammar:id:')===0)values.push(item.key.slice(11));
    values.forEach(function(value){
      var scoped=value.match(/^knowledge:([^:]+):grammar:(.+)$/);
      if(scoped){
        try{
          if(sourceLessonId!=null&&decodeURIComponent(scoped[1])!==String(sourceLessonId)){invalidScope=true;return;}
          value=decodeURIComponent(scoped[2]);
        }catch(_){invalidScope=true;return;}
      }else if(/^knowledge:/.test(value)){invalidScope=true;return;}
      var id=normalize(value);if(id&&ids.indexOf(id)===-1)ids.push(id);
    });
    return invalidScope?[]:ids;
  }
  function grammarKey(item){var ids=grammarIdentities(item);return ids.length?'id:'+ids[0]:item.title?'title:'+normalize(item.title):'';}
  function balanced(rows){
    var selected=[];
    [true,false].forEach(function(studied){
      var buckets=['vocabulary','usage','grammar'].map(function(kind){return rows.filter(function(row){return row.hasStudiedOrigin===studied&&row.kind===kind;});});
      for(var offset=0;buckets.some(function(bucket){return offset<bucket.length;});offset++)buckets.forEach(function(bucket){if(bucket[offset])selected.push(bucket[offset]);});
    });
    return selected;
  }
  // Pure selection: prefer the displayed learned origin, one card per concept, and never
  // turn a broad grammar tag into every question from the source lesson.
  function selectReviewCards(items,cards,options){
    options=options||{};var studiedOnly=options.studiedOnly!==false,seen=new Set(),concepts=new Set(),selected=[];
    function forms(value,primary){return [value&&value[primary],value&&value.matchedForm].concat(strings(value&&value.variants)).filter(function(form){return typeof form==='string'&&form.trim();}).map(normalize);}
    strings(items).forEach(function(item){
      if(!item)return;var concept=item.key||item.kind+':'+normalize(item.label);if(concepts.has(concept))return;
      var candidates=strings(cards).filter(function(card){
        if(!card||!card.id||!card.sourceLesson||seen.has(card.id)||/未附独立中文释义|未提供中文释义/.test(String(card.prompt||'')))return false;
        if(!strings(item.origins).some(function(origin){return origin&&origin.lessonId===card.sourceLesson.id&&(!studiedOnly||origin.studied===true);}))return false;
        if(item.kind==='grammar'){
          if(card.kind!=='grammar')return false;
          var wanted=grammarIdentities(item),available=grammarIdentities(card,card.sourceLesson.id);
          return wanted.some(function(id){return available.indexOf(id)!==-1;});
        }
        if(card.kind!==(item.kind==='vocabulary'?'word':item.kind==='usage'?'phrase':null))return false;
        var wanted=forms(item,'label'),available=forms(card,'target');
        return wanted.some(function(form){return available.indexOf(form)!==-1;});
      });
      candidates.sort(function(a,b){return Number(b.sourceLesson.id===item.origin?.lessonId)-Number(a.sourceLesson.id===item.origin?.lessonId);});
      if(candidates.length){var card=candidates[0];seen.add(card.id);concepts.add(concept);selected.push(card);}
    });
    return selected;
  }
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
          evidence:{type:'explicit-grammar-tag',sentence:String(item.example||''),paragraphIndex:null,fromParagraph:false,sourceType:'grammar-note',sourceLabel:'本课明确语法标签/语法笔记例句（非正文语法推断）',sourcePage:item.sourcePage||lesson.sourcePage||null,knowledgeId:item.knowledgeId||null,conceptId:item.conceptId||null,grammarConceptId:item.grammarConceptId||null}});
      });
      var result=Array.from(hits.values()).sort(function(a,b){return a.origins[0].book-b.origins[0].book||a.origins[0].number-b.origins[0].number||a.kind.localeCompare(b.kind)||a.label.localeCompare(b.label);});cache.set(lesson.id,result);return result;
    }
    return Object.freeze({version:VERSION,stats:Object.freeze({lessons:lessons.length,concepts:concepts.size}),forLesson:function(id,options){
      var lesson=byId.get(String(id));if(!lesson)return [];
      options=options||{};var value=options.studiedIds,studied=new Set(Array.isArray(value)?value.map(String):value&&typeof value.forEach==='function'?Array.from(value,String):[]);
      var limit=options.limit==null?30:Number(options.limit);if(!Number.isFinite(limit))limit=30;limit=Math.max(0,Math.min(100,Math.floor(limit)));
      var annotated=baseFor(lesson).map(function(hit){
        var origins=hit.origins.map(function(origin){return Object.assign({},origin,{studied:studied.has(origin.lessonId)});});
        var origin=origins.find(function(value){return value.studied;})||origins[0];
        return Object.assign({},hit,{origin:origin,origins:origins,studied:origin.studied,hasStudiedOrigin:origin.studied,evidence:Object.assign({},hit.evidence)});
      });
      return balanced(annotated).slice(0,limit);
    }});
  }
  root.StudyRecurrence=Object.freeze({version:VERSION,build:build,selectReviewCards:selectReviewCards,phraseForms:phraseForms,finiteForms:Object.freeze(Object.fromEntries(Object.entries(FORMS).map(function(entry){return [entry[0],Object.freeze(entry[1].slice())];})))});
})(typeof window!=='undefined'?window:globalThis);
