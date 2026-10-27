/* Pure, source-backed recurrence index. No storage, DOM, network, or inferred grammar. */
(function (root) {
  'use strict';
  var VERSION='1.3.0';
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
  // These exact pairs are extraction mistakes in the supplied notes, not definitions.
  var BAD_GLOSSES={make:'多模仿少创造',catch:'特殊疑问词',live:'国家城市'};
  function definitionFor(item,kind,glossary){
    item=item||{};var label=normalize(kind==='usage'?item.phrase:item.word),original=String(item.meaning||'').trim();
    function usable(value){return !!value&&!/未附(?:独立)?中文释义|未提供中文释义|暂无释义|待(?:补充|复核)|原笔记习惯表达/.test(value)&&BAD_GLOSSES[label]!==value;}
    if(usable(original)&&item.needsContextReview!==true)return {meaning:original,originalMeaning:original,meaningStatus:'source-definition',definitionSource:String(item.meaningSource||item.source||'来源课程词义；需结合本句理解')};
    var entry=kind==='vocabulary'&&glossary&&Object.hasOwn(glossary,label)?glossary[label]:null,value=entry&&String(entry.meaning||'').trim();
    if(entry&&normalize(entry.word)===label&&usable(value))return {meaning:value,originalMeaning:original,meaningStatus:'dictionary-fallback',definitionSource:'通用词典释义补充；尚未判定本句具体词义'};
    return {meaning:'',originalMeaning:original,meaningStatus:'needs-context-review',definitionSource:'来源词义待语境核对；当前仅确认词形复现'};
  }
  function introduction(lesson,item,kind,glossary){
    var note=lesson.source==='provided'||/笔记/.test(String(item.source||''));
    return {lessonId:lesson.id,book:lesson.book,number:lesson.number,title:String(lesson.textbook&&lesson.textbook.title||lesson.title||''),
      sourceType:item.sourceType||(note?'notes':lesson.source==='original'?'original':'provided'),sourceLabel:item.sourceLabel||(note?'学习笔记 · '+(kind==='vocabulary'?'词表':kind==='usage'?'搭配':'语法知识点'):'来源课程知识点'),
      sourceDocId:item.sourceDocId||lesson.sourceDocId||null,sourcePage:item.sourcePage||lesson.sourcePage||null,
      ...definitionFor(item,kind,glossary)};
  }
  function observedForm(source,values){
    var ts=tokens(String(source||''));
    for(var i=0;i+values.length<=ts.length;i++){
      var matches=true;
      for(var j=0;j<values.length;j++)if(ts[i+j].value!==values[j]||j&&!/^[\s‘’“”"']*$/.test(source.slice(ts[i+j-1].end,ts[i+j].start))){matches=false;break;}
      if(matches)return true;
    }
    return false;
  }
  function recordedWordForms(item,lesson){
    var evidence=item.contextEvidence||{},source='';
    if(!lesson||!lesson.textbook||lesson.textbook.verified!==true)return [];
    if(item.sourceType==='lesson-title'&&evidence.sourceType==='lesson-title'&&evidence.sourceTitle===lesson.textbook.title)source=evidence.sourceTitle;
    else if(item.sourceType==='textbook-passage'&&evidence.sourceType==='textbook-passage'&&Number.isInteger(evidence.sourceParagraphIndex)&&typeof evidence.sourceText==='string'&&evidence.sourceText&&String(lesson.paragraphs[evidence.sourceParagraphIndex]?.en||'').includes(evidence.sourceText))source=evidence.sourceText;
    if(!source)return [];
    return strings(item.sourceForms).slice(0,20).filter(function(form){if(typeof form!=='string')return false;var values=tokens(form).map(function(t){return t.value;});return values.length>0&&values.length<=12&&observedForm(source,values);});
  }
  function patternsFor(item,kind,lesson){
    var label=kind==='vocabulary'?item.word:item.phrase,base=tokens(String(label||'')).map(function(t){return t.value;});
    if(!base.length||base.length>12)return [];
    var patterns=[base],isVerb=kind==='usage'||!item.pos||/\b(?:v|vt|vi|verb)\b/i.test(String(item.pos));
    if(isVerb&&FORMS[base[0]])FORMS[base[0]].forEach(function(form){patterns.push([form].concat(base.slice(1)));});
    if(kind==='vocabulary')recordedWordForms(item,lesson).forEach(function(form){var recorded=tokens(form).map(function(t){return t.value;});if(!patterns.some(function(p){return p.join(' ')===recorded.join(' ');}))patterns.push(recorded);});
    if(kind==='usage')[item.matchedForm].concat(strings(item.variants).slice(0,20)).forEach(function(form){
      if(typeof form!=='string')return;var recorded=tokens(form).map(function(t){return t.value;});
      if(recorded.length&&recorded.length<=12&&!patterns.some(function(p){return p.join(' ')===recorded.join(' ');}))patterns.push(recorded);
    });
    return patterns;
  }
  function phraseForms(phrase){var value=normalize(phrase),patterns=patternsFor({phrase:phrase},'usage');if(!patterns.length||patterns[0].join(' ')!==value)return value?[value]:[];return patterns.map(function(pattern){return pattern.join(' ');});}
  function grammarKey(item){
    var value=item.knowledgeId||item.conceptId||item.grammarConceptId,match=typeof value==='string'&&value.match(/^knowledge:[^:]+:grammar:(.+)$/);
    if(match){try{value=decodeURIComponent(match[1]);}catch(_){value='';}}
    return value?'id:'+normalize(value):item.title?'title:'+normalize(item.title):'';
  }
  function balancedPreview(rows){
    var out=[];
    [true,false].forEach(function(known){
      var groups=['vocabulary','usage','grammar'].map(function(kind){return rows.filter(function(row){return row.hasStudiedOrigin===known&&row.kind===kind;});});
      var count=Math.max.apply(null,groups.map(function(group){return group.length;}));
      for(var i=0;i<count;i++)groups.forEach(function(group){if(group[i])out.push(group[i]);});
    });
    return out;
  }
  function build(input,options){
    var glossary=options&&options.glossary;
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
          if(!concept){concept={key:key,kind:kind,label:label,meaning:String(item.meaning||''),patterns:[],introductions:[]};concepts.set(key,concept);}
          if(kind!=='grammar')patternsFor(item,kind,lesson).forEach(function(values){
            var pattern=concept.patterns.find(function(p){return p.values.join(' ')===values.join(' ');});
            if(!pattern){pattern={values:values,sources:new Set()};concept.patterns.push(pattern);}
            pattern.sources.add(lesson.id);
          });
          concept.introductions.push({lesson:lesson,origin:introduction(lesson,item,kind,glossary)});
        });
      });
    });
    concepts.forEach(function(c){c.patterns.forEach(function(entry){var pattern=entry.values,list=firstToken.get(pattern[0])||[];list.push({concept:c,pattern:pattern,sources:entry.sources});firstToken.set(pattern[0],list);});});
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
              var c=candidate.concept,pattern=candidate.pattern,hitKey=c.key+'\0'+pattern.join(' ');if(hits.has(hitKey)||i+pattern.length>ts.length)return;
              for(var n=0;n<pattern.length;n++){
                if(ts[i+n].value!==pattern[n])return;
                if(n&&!/^[\s‘’“”"']*$/.test(part.text.slice(ts[i+n-1].end,ts[i+n].start)))return;
              }
              // The fixed noun phrase "living room" does not reuse the verb live.
              if(c.kind==='vocabulary'&&normalize(c.label)==='live'&&token.value==='living'&&ts[i+1]&&ts[i+1].value==='room')return;
              var origins=prior(c).filter(function(origin){return candidate.sources.has(origin.lessonId);});if(!origins.length)return;
              var start=ts[i].start,end=ts[i+pattern.length-1].end,matched=part.text.slice(start,end),type=passageType(lesson,paragraph);
              hits.set(hitKey,{id:'recurrence:'+lesson.id+':'+c.key,key:c.key,kind:c.kind,label:c.label,meaning:origins[0].meaning,semanticMatch:false,matchedForm:matched,matchType:normalize(matched)===normalize(c.label)?'exact':c.kind==='usage'&&!phraseForms(c.label).includes(normalize(matched))?'recorded-form':'finite-inflection',
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
      var rows=baseFor(lesson).map(function(hit){
        var origins=hit.origins.map(function(origin){return Object.assign({},origin,{studied:studied.has(origin.lessonId)});});
        var chosen=origins.find(function(origin){return origin.studied;})||origins[0];
        return Object.assign({},hit,hit.kind==='grammar'?{}:{meaning:chosen.meaning,meaningStatus:chosen.meaningStatus,definitionSource:chosen.definitionSource},{origin:chosen,origins:origins,studied:chosen.studied,hasStudiedOrigin:chosen.studied,evidence:Object.assign({},hit.evidence)});
      });
      var selected=new Map();
      rows.forEach(function(row){var previous=selected.get(row.key);if(!previous||!previous.hasStudiedOrigin&&row.hasStudiedOrigin)selected.set(row.key,row);});
      return balancedPreview(Array.from(selected.values())).slice(0,limit);
    }});
  }
  // Compatibility with the earlier call order; both entry points use one matcher.
  function selectReviewCards(items,cards,options){return root.StudyReview&&typeof root.StudyReview.matchRecurrences==='function'?root.StudyReview.matchRecurrences(cards,items,options):[];}
  root.StudyRecurrence=Object.freeze({version:VERSION,build:build,definitionFor:definitionFor,selectReviewCards:selectReviewCards,phraseForms:phraseForms,finiteForms:Object.freeze(Object.fromEntries(Object.entries(FORMS).map(function(entry){return [entry[0],Object.freeze(entry[1].slice())];})))});
})(typeof window!=='undefined'?window:globalThis);
