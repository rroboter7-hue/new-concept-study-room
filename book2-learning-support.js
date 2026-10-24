/* Learning guidance authored from exact current Book 2 passages. Not the textbook's original exercises. */
(function(root){
  'use strict';
  var LABEL='自编学习整理 · 非教材原配练习';
  // [lesson, expression, Chinese explanation, usage note, exact current sentence, actual matched form]
  var ROWS=[
    [41,'sit down','坐下','sit down 表示坐下；本课用过去式 sat down。','I sat down on one of those modern chairs with holes in it and waited.','sat down'],
    [41,'in front of','在……前面','in front of 后接名词或代词；本句说明妻子仍在镜子前。','We had been in the hat shop for half an hour and my wife was still in front of the mirror.','in front of'],
    [41,'at once','立刻；马上','at once 作时间状语，表示没有拖延。','I regretted saying it almost at once.','at once'],
    [41,'look like','看起来像……','look like 后接比较对象；本课 looked like 表示看起来像灯塔。','My wife was wearing a hat that looked like a lighthouse!','looked like'],
    [41,"needn't have + 过去分词",'本来没有必要做……','needn’t have + 过去分词：事情已经做了，但说话人认为没有必要；与表示禁止的 mustn’t 区分。',"‘You needn't have said that,’ my wife answered.","needn't have said"],
    [48,'pull out','拔出；拉出','本句 pulled out 的宾语是牙齿，表示拔牙；过去完成形式见原句 had just pulled out。','My dentist had just pulled out one of my teeth and had told me to rest for a while.','pulled out'],
    [48,'for a while','一会儿；一段时间','for a while 表示持续一小段时间，本句修饰 rest。','My dentist had just pulled out one of my teeth and had told me to rest for a while.','for a while'],
    [48,'be full of','充满……；装满……','be full of 后接名词；本句 was full of 描述嘴里塞满棉花的状态。','I tried to say something, but my mouth was full of cotton wool.','was full of'],
    [48,'in answer to','作为对……的回答','in answer to 后接被回应的问题、请求等；本句指用点头或声音回应问题。','In answer to these questions I either nodded or made strange noises.','In answer to'],
    [48,'be able to','能够做……','be able to 后接动词原形；本句 was able to tell 表示当时终于能说出来。','When the dentist at last removed the cotton wool from my mouth, I was able to tell him that he had pulled out the wrong tooth.','was able to'],
    [53,'put out','扑灭','put out 可表示扑灭火；本句 put 的形式与原形相同，前有 have 构成完成形式。','At last firemen have put out a big forest fire in California.','put out'],
    [53,'find out','查明；弄清楚','find out 常接事实或疑问词引导的内容；本句要查明火灾怎样开始。','Since then, they have been trying to find out how the fire began.','find out'],
    [53,'throw away','扔掉','throw away 表示丢弃；本句 which 指代前面的 cigarette ends，作 throw away 的宾语。','Forest fires are often caused by broken glass or by cigarette ends which people carelessly throw away.','throw away'],
    [53,'in this way','用这种方法；这样','in this way 指借助上文提到的线索或办法，本句引出解开谜团的结果。','In this way, he was able to solve the mystery.','In this way'],
    [57,'for a moment','片刻；一会儿','for a moment 表示持续片刻；本句指她犹豫了一会儿。','Though she hesitated for a moment, she finally went in and asked to see a dress that was in the window.','for a moment'],
    [57,'be eager to','急于；渴望做……','be eager to 后接动词原形；本句 was eager to serve 描述店员急于接待她。','Not realizing who she was, the assistant was eager to serve her this time.','was eager to'],
    [57,'with great difficulty','费了很大力气；十分困难地','with great difficulty 描述做事时遇到的困难，可放在句首。','With great difficulty, he climbed into the shop window to get the dress.','With great difficulty'],
    [57,'as soon as','一……就……','as soon as 连接两个动作；本句描述她一看到那件衣服就说不喜欢。','As soon as she saw it, the woman said she did not like it.','As soon as'],
    [61,'at a cost of','以……的费用；耗资……','at a cost of 后接金额，本句说明发射望远镜所花的费用。','The Hubble telescope was launched into space by NASA on April 20, 1990 at a cost of over a billion dollars.','at a cost of'],
    [61,'right from the start','从一开始就','right 在这里加强 from the start 的语气。','Right from the start there was trouble with the Hubble.','Right from the start'],
    [61,'a great deal','很多；大量','a great deal 在本句作 tell 的内容，后接 about 说明相关话题。','The Hubble will tell us a great deal about the age and size of the universe.','a great deal'],
    [61,'by the time','到……的时候','by the time 引出时间界限；本句从句用现在时 read，主句用 will have sent 表示到那时已完成。',"By the time you read this, the Hubble's eagle eye will have sent us thousands and thousands of wonderful pictures.",'By the time'],
    [61,'thousands and thousands of','成千上万的','重复 thousands 强调数量很多，of 后接名词复数。',"By the time you read this, the Hubble's eagle eye will have sent us thousands and thousands of wonderful pictures.",'thousands and thousands of'],
    [93,'be made of','由……制成','be made of 后接材料；本句明确说铜是雕像主体的材料。','The actual figure was made of copper supported by a metal framework which had been especially constructed by Eiffel.','was made of'],
    [93,'at the entrance of','在……的入口处','entrance 表示入口；本句交代选定地点位于纽约港入口处。','The site chosen was an island at the entrance of New York Harbour.','at the entrance of'],
    [93,'take to pieces','拆开；拆成零件','本句 was taken to pieces 使用被动形式，说明雕像被拆开后运送。','The following year, it was taken to pieces and sent to America.','taken to pieces'],
    [93,'put together','把……组装起来','put together 表示组装；本句 had been put together 表示雕像到所述时间已被重新组装。','By the end of October 1886, the statue had been put together again and it was officially presented to the American people by Bartholdi.','put together'],
    [93,'ever since then','从那时起一直','ever 加强 since then，强调从过去那个时间持续到后面所述状态。','Ever since then, the great monument has been a symbol of liberty for the millions of people who have passed through New York Harbour to make their homes in America.','Ever since then']
  ];
  var api={version:'1.0.0',label:LABEL,report:null};
  function apply(lessons,glossary){
    var list=Array.isArray(lessons)?lessons:[],book2=list.filter(function(l){return l.book===2;}),report={targetLessons:[41,48,53,57,61,93],addedUsage:0,supplementedLessons:[],skippedExamples:[],vocabularyTotal:0,vocabularyMissingMeaning:0,vocabularyMeaningSupplemented:0,confirmedGlossaryMatches:0,missingMeaningByLesson:[],definitionPolicy:'本轮未用跨课同形词猜测词义。现有100词glossary对这批空释义无精确命中；保留待补。',label:LABEL};
    book2.forEach(function(lesson){
      if(!(lesson.usage||[]).length){
        var entries=ROWS.filter(function(row){return row[0]===lesson.number;}).flatMap(function(row,index){
          var paragraphIndex=(lesson.paragraphs||[]).findIndex(function(p){return String(p.en||'').includes(row[4]);});
          if(paragraphIndex<0||!row[4].includes(row[5])){report.skippedExamples.push({number:lesson.number,phrase:row[1],reason:'当前正文未精确匹配，未添加'});return [];}
          return [{id:lesson.id+'-support-'+(index+1),phrase:row[1],meaning:row[2],note:row[3],example:row[4],matchedForm:row[5],label:LABEL,source:LABEL,sourceLabel:LABEL,meaningSource:'根据本课正文语境自编整理的中文说明，非教材原译文',sourceType:'textbook-learning-support',sourceDocId:'30f1219bd738cfbf',sourceUrl:lesson.textbook&&lesson.textbook.sourceUrl||null,sourcePage:lesson.textbook&&lesson.textbook.sourcePdfPage||null,sourceParagraphIndex:paragraphIndex,reviewedExample:true,containsOriginalWorkbookExercise:false}];
        });
        if(entries.length){lesson.usage=entries;report.addedUsage+=entries.length;report.supplementedLessons.push(lesson.number);}
      }
      var missing=[];(lesson.vocabulary||[]).forEach(function(v){report.vocabularyTotal++;if(!String(v.meaning||'').trim()){report.vocabularyMissingMeaning++;missing.push(v.word);var g=glossary&&glossary[String(v.word||'').toLowerCase()];if(g&&g.meaning)report.confirmedGlossaryMatches++;}});
      if(missing.length)report.missingMeaningByLesson.push({number:lesson.number,words:missing});
    });
    report.lessonsWithUsage=book2.filter(function(l){return (l.usage||[]).length>0;}).length;
    api.report=report;return report;
  }
  api.apply=apply;root.Book2LearningSupport=api;apply(root.LESSONS,root.STUDY_GLOSSARY);
})(typeof window!=='undefined'?window:globalThis);
