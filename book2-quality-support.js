/* Source-checked corrections and authored teaching for Book 2. Load after book2-vocabulary.js. */
(function(root){
  'use strict';
  var LABEL='自编学习整理 · 已核对本课正文 · 非教材原配讲解';
  var TEXTBOOK='30f1219bd738cfbf',NOTES='eef57c5b3d1610c5';
  var RULES=[
    {
      id:'nce-b2-eef57c-l001-quality-past-simple',
      title:'一般过去时：讲述过去发生的事',
      note:'【自编学习整理】一般过去时用来讲述过去发生的动作或当时的状态。Last week 把故事放在上周；went 是 go 的过去式，had 是 have 的过去式，was 是 be 的过去式。肯定句用主语 + 动词过去式；普通动词的否定句用 did not + 动词原形，所以正文是 I did not enjoy it.，enjoy 不再变成过去式。提问时用 Did + 主语 + 动词原形；be 动词用 was/were，本课 The play was very interesting. 描述当时的状态。先用时间词确定过去，再检查过去式或 did 后的原形。',
      example:'Last week I went to the theatre.',
      supportingExamples:['I had a very good seat.','I did not enjoy it.','The play was very interesting.'],
      matchedForm:'went'
    },
    {
      id:'nce-b2-eef57c-l001-quality-past-continuous',
      title:'过去进行时：描述当时正在进行的动作',
      note:'【自编学习整理】过去进行时的结构是主语 + was/were + 现在分词（动词 -ing），表示过去某一时刻正在进行的动作。I/he/she/it 用 was，you/we/they 和复数主语用 were。正文中的一男一女是复数主语，所以用 were sitting；They were talking loudly. 说明我看戏时他们正在大声交谈。它在这里交代故事的背景，而 went、got、turned 等一般过去时推进故事。否定时在 was/were 后加 not；提问时把 was/were 放到主语前。不要省去 was/were，也不要把 were talking 写成 were talked。',
      example:'They were talking loudly.',
      supportingExamples:['A young man and a young woman were sitting behind me.','I got very angry.','I turned round.'],
      matchedForm:'were talking'
    },
    {
      id:'nce-b2-eef57c-l001-quality-could-not',
      title:'could not + 动词原形：当时不能做某事',
      note:'【自编学习整理】could 是情态动词 can 的过去式之一，本课用来表示当时的能力或条件；could not（缩写 couldn’t）表示当时不能。could 后接动词原形，所以是 could not hear、could not bear，不加 to，也不用 heard、bore。I could not hear the actors. 表示当时听不清演员说话；In the end, I could not bear it. 表示最后无法忍受。情态动词直接加 not，否定句不用 did；提问时把 could 放到主语前。正文直接引语 I can’t hear a word! 用 can’t，因为作者是在当场说“我听不见”。',
      example:'I could not hear the actors.',
      supportingExamples:['In the end, I could not bear it.'],
      matchedForm:'could not hear'
    }
  ];
  // [lesson, exact word, exact bad meaning, authored replacement, actual notes PDF page, exact context, context kind]
  var DEFINITION_FIXES=[
    [6,'food','怎么找?','食物',34,'He ate the food and drank the beer.'],
    [7,'sand','过去进行时','沙子',38,'To their surprise, the precious parcel was full of stones and sand!'],
    [10,'touch','被动-be+done','触摸',52,'Now we are not allowed to touch it.'],
    [14,'journey','写&朗读 4X4','旅行；旅途',68,'Neither of us spoke during the journey.'],
    [15,'extra','宾语从句','额外的',72,'Then he smiled and told me I would receive an extra thousand pounds a year!'],
    [16,'park','公园','停车',76,'If you park your car in the wrong place, a traffic policeman will soon find it.'],
    [25,'wonder','并列连词conj.','感到疑惑；怀疑',112,'I wonder.'],
    [26,'pretend','句子','假装',116,'Many people pretend that they understand modern art.'],
    [30,'wayle','反复听电影片段,直到能听出关键短语/句子','Wayle 河（河名）',131,'The Wayle is a small river that cuts across the park near my home.'],
    [35,'while','当……时；然而','一会儿；一段时间',150,'A short while ago, however, he became a bus driver and he has not regretted it.'],
    [38,'mediterranean','反复听电影片段,直到能听出关键短语/句子','地中海（本课指地中海地区）',162,'My old friend, Harrison, had lived in the Mediterranean for many years before he returned to England.'],
    [46,'normal','同位语从句','正常的；通常的',195,'The normal price of a ticket is £2,000!'],
    [47,'suggest','句子','提出（某种解释）',200,'When I suggested that some villagers must have come in for a free drink, Mr. Thompson shook his head.'],
    [51,'virtue','反复听电影片段,直到能听出关键短语/句子','美德',222,'Patience is a virtue.','notes'],
    [58,'church','做礼拜/go','教堂',256,'The tree was planted near the church fifty years ago, but it is only in recent years that it has gained an evil reputation.'],
    [64,'fear','句子','害怕；担心',286,'If, at the time, the British had not feared invasion, it would have been completed.'],
    [65,'fortunate','句子...','幸运的',292,'it was fortunate that we didn’t have to carry him.'],
    [69,'confidence','句子','信心',310,'After having been instructed to drive out of town, I began to acquire confidence.'],
    [74,'notice','句子','告示；布告',332,'Do you see that notice?'],
    [78,'delighted','句子','高兴的；欣喜的',351,'My wife was delighted that things had returned to normal once more.'],
    [78,'urge','强烈欲望','力劝；敦促',351,'When my old friend Brian urged me to accept a cigarette, it was more than I could bear.'],
    [79,'curious','句子','好奇的',354,'Everybody on board was worried and we were curious to find out what had happened.'],
    [84,'state','句子','声明；陈述',374,'The busmen have stated that the strike will continue until general agreement is reached about pay and working conditions.'],
    [84,'relieve','句子','减轻；缓解',374,'This will relieve pressure on the trains to some extent.'],
    [84,'object','句子','提出异议；反对',375,'Only one or two people have objected that the students will drive too fast!'],
    [85,'inform','句子','通知；告知',378,'I have just received a letter from my old school, informing me that my former headmaster, Mr. Stuart Page, will be retiring next week.'],
    [85,'coincidence','句子','巧合',379,'It is a curious coincidence that the day before his retirement, Mr. Page will have been teaching for a total of forty years.'],
    [86,'dismay','句子','惊慌；沮丧（with dismay：惊慌地）',382,'Both men had just begun to swim towards the shore, when they noticed with dismay that the speedboat was moving in a circle.'],
    [87,'confirm','句子','证实；确认',386,'My employer will confirm that I was there on time.']
  ];
  var FIRST_LESSON_FIXES=[
    ['play','meaning','戏剧；玩耍','戏剧'],
    ['attention','pos','','n.'],
    ['business','pos','','n.']
  ];
  var api={version:'1.1.0',label:LABEL,report:null};
  function locate(lesson,sentence){return (lesson.paragraphs||[]).findIndex(function(p){return String(p.en||'').includes(sentence);});}
  function correctField(lesson,word,field,oldValue,newValue,evidence,report){
    var item=(lesson.vocabulary||[]).find(function(v){return v.word===word;});
    var id='book2-l'+lesson.number+'-'+word+'-'+field+'-source-correction';
    if(!item)return;
    var existing=(item.qualityCorrections||[]).find(function(c){return c.id===id;});
    if(existing&&item[field]===newValue){report[field==='meaning'?'definitionCorrections':'fieldCorrections'].push(existing);return;}
    if(item[field]!==oldValue){report.skippedDefinitions.push({lesson:lesson.number,word:word,field:field,expectedOld:oldValue,observed:item[field],reason:'现值与已审计旧值不精确匹配，保留现值'});return;}
    var correction={id:id,lesson:lesson.number,lessonId:lesson.id,word:word,field:field,oldValue:oldValue,newValue:newValue,originalItem:Object.assign({},item),sourceDocId:evidence.docId,sourcePdfPage:evidence.pdfPage,sourceUrl:'resources/'+evidence.docId+'.pdf',sourceEvidence:evidence.text,exampleSourceDocId:evidence.exampleDocId,exampleSourcePdfPage:evidence.examplePdfPage,sourceLabel:'自编语境修正（非原PDF译文）'};
    item[field]=newValue;
    item.qualityCorrections=(item.qualityCorrections||[]).concat([correction]);
    if(field==='meaning'){
      item.meaningSource='根据本课真实正文、标题或笔记例句自编语境修正；非原PDF中文译文';
      item.sourceType='self-authored-context-correction';item.sourceLabel=correction.sourceLabel;
      item.sourceDocId=evidence.docId;item.sourcePage=evidence.pdfPage;
      if(evidence.example){item.example=evidence.example;item.exampleSourceDocId=evidence.exampleDocId;item.exampleSourcePage=evidence.examplePdfPage;item.exampleSourceType=evidence.kind;}
      item.needsContextReview=false;report.vocabularyDefinitionsCorrected++;
    }else report.vocabularyFieldsCorrected++;
    report[field==='meaning'?'definitionCorrections':'fieldCorrections'].push(correction);
  }
  function apply(lessons){
    var list=Array.isArray(lessons)?lessons:[],report={label:LABEL,addedGrammar:0,addedUsage:0,skippedExamples:[],skippedDefinitions:[],vocabularyCorrections:[],definitionCorrections:[],fieldCorrections:[],vocabularyDefinitionsCorrected:0,vocabularyFieldsCorrected:0};
    DEFINITION_FIXES.forEach(function(row){
      var lesson=list.find(function(l){return l.id==='nce-b2-eef57c-l'+String(row[0]).padStart(3,'0')&&l.book===2&&l.number===row[0];});
      if(!lesson)return;
      var kind=row[6]||'textbook-passage';
      if(kind!=='notes'&&locate(lesson,row[5])<0){report.skippedExamples.push({lesson:row[0],word:row[1],reason:'修正依据与当前正文不精确匹配，保留现值'});return;}
      correctField(lesson,row[1],'meaning',row[2],row[3],{docId:NOTES,pdfPage:row[4],text:row[5],example:row[5],exampleDocId:kind==='notes'?NOTES:TEXTBOOK,examplePdfPage:kind==='notes'?row[4]:lesson.textbook&&lesson.textbook.sourcePdfPage,kind:kind},report);
    });
    var first=list.find(function(l){return l.book===2&&l.number===1;});
    if(first){
      if(first.id==='nce-b2-eef57c-l001')FIRST_LESSON_FIXES.forEach(function(row){
        correctField(first,row[0],row[1],row[2],row[3],{docId:TEXTBOOK,pdfPage:15,text:'教材 New words and expressions：play n. 戏；attention n. 注意；business n. 事。',exampleDocId:TEXTBOOK,examplePdfPage:15},report);
      });
      first.grammar=first.grammar||[];
      RULES.forEach(function(rule){
        if(first.grammar.some(function(g){return g.id===rule.id;}))return;
        var paragraphIndex=locate(first,rule.example);
        if(paragraphIndex<0||!rule.supportingExamples.every(function(s){return locate(first,s)>=0;})){
          report.skippedExamples.push({lesson:1,id:rule.id,reason:'当前正文未精确匹配，未添加'});return;
        }
        first.grammar.push(Object.assign({},rule,{
          supportingExamples:rule.supportingExamples.slice(),
          label:LABEL,source:LABEL,sourceLabel:LABEL,sourceType:'self-authored-passage-grammar',
          sourceDocId:TEXTBOOK,sourceUrl:'resources/'+TEXTBOOK+'.pdf',sourcePdfPage:15,sourcePrintedPage:12,
          sourceParagraphIndex:paragraphIndex,reviewedExample:true,containsOriginalWorkbookExercise:false
        }));
        report.addedGrammar++;
      });
    }
    var seventyFive=list.find(function(l){return l.book===2&&l.number===75;});
    if(seventyFive){
      var badIndex=(seventyFive.vocabulary||[]).findIndex(function(v){return v.word==='get'&&v.phonetic==='/hot/'&&v.pos==='adj.';});
      if(badIndex>=0){
        var original=seventyFive.vocabulary.splice(badIndex,1)[0];
        var correction={
          id:'book2-l075-get-extraction-boundary',lesson:75,action:'remove-misclassified-vocabulary',
          originalItem:original,sourceDocId:NOTES,sourceUrl:'resources/'+NOTES+'.pdf',
          sourcePdfPage:337,sourcePrintedPage:334,wordListPdfPage:336,wordListPrintedPage:333,
          sourceHeading:'75 Story+Expressions',sourceLines:[18,19,20,21,22,23,24],
          sourceEvidence:'get adj. / get cold/hot/warm/dark/angry/old/better/worse...',
          reason:'已对照笔记PDF：get adj. 是下一页的用法标题，hot 位于斜线分隔的形容词列表中，既非音标，也不是本课 Words 区的独立词条。',
          sourceLabel:'来源抽取纠错 · 已目视核对原PDF第336–337页'
        };
        seventyFive.sourceCorrections=seventyFive.sourceCorrections||[];
        if(!seventyFive.sourceCorrections.some(function(c){return c.id===correction.id;}))seventyFive.sourceCorrections.push(correction);
      }
      report.vocabularyCorrections=(seventyFive.sourceCorrections||[]).filter(function(c){return c.id==='book2-l075-get-extraction-boundary';});
      var sentence='During the night, it got terribly cold.',paragraphIndex=locate(seventyFive,sentence),usageId='nce-b2-eef57c-l075-quality-get-adjective';
      seventyFive.usage=seventyFive.usage||[];
      if(!seventyFive.usage.some(function(u){return u.id===usageId;})){
        if(paragraphIndex<0)report.skippedExamples.push({lesson:75,id:usageId,reason:'当前正文未精确匹配，未添加'});
        else{
          seventyFive.usage.push({
            id:usageId,phrase:'get + 形容词',meaning:'变得……',matchedForm:'got terribly cold',
            note:'【自编学习整理】笔记中的 get adj. 表示 get 后接形容词，说明状态发生变化。正文 got 是 get 的过去式，cold 表示冷，terribly 加强程度，整句表示夜里变得非常冷。原笔记列出的 cold/hot/warm 等是可接的形容词，不是 get 的音标。',
            example:sentence,label:LABEL,source:LABEL,sourceLabel:LABEL,sourceType:'self-authored-passage-usage',
            sourceDocId:TEXTBOOK,sourceUrl:'resources/'+TEXTBOOK+'.pdf',sourcePdfPage:353,sourcePrintedPage:350,
            sourceParagraphIndex:paragraphIndex,sourceNotesDocId:NOTES,sourceNotesUrl:'resources/'+NOTES+'.pdf',sourceNotesPage:337,
            reviewedExample:true,containsOriginalWorkbookExercise:false
          });report.addedUsage++;
        }
      }
    }
    report.lessonsWithAddedGrammar=list.filter(function(l){return (l.grammar||[]).some(function(g){return g.sourceType==='self-authored-passage-grammar';});}).map(function(l){return l.number;});
    if(root.LESSONS===lessons){
      root.BOOK2_VOCAB_STATUS=root.BOOK2_VOCAB_STATUS||{};
      root.BOOK2_VOCAB_STATUS.unresolved=list.filter(function(l){return l.book===2;}).flatMap(function(l){return (l.vocabulary||[]).filter(function(v){return !String(v.meaning||'').trim();}).map(function(v){return {lesson:l.number,word:v.word};});});
      root.BOOK2_VOCAB_STATUS.qualityCorrectedDefinitions=report.definitionCorrections.length;
      root.BOOK2_VOCAB_STATUS.qualityCorrectedFields=report.fieldCorrections.length;
      root.BOOK2_VOCAB_STATUS.qualitySourceCorrectionCount=report.vocabularyCorrections.length;
    }
    api.report=report;return report;
  }
  api.apply=apply;root.Book2QualitySupport=api;apply(root.LESSONS);
})(typeof window!=='undefined'?window:globalThis);
