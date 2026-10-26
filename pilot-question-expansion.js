/* Self-authored practice; passage excerpts below are provenance, not workbook questions. */
(function (global) {
 'use strict';
 const entries=[], lessonId=n=>'nce-b2-eef57c-l'+String(n).padStart(3,'0');
 const cid=(n,kind,key)=>'knowledge:'+lessonId(n)+':'+kind+':'+encodeURIComponent(key);
 const sourceLesson=n=>global.LESSONS.find(l=>l.id===lessonId(n));
 const labels={comprehension:'课文理解',grammar:'语法运用',conversion:'句型转换',vocabulary:'词汇辨义'};
 function grammar(n,key,category,sourceN,sourceKey,anchor,question,options,answer,rule,reasons,examples,paragraphIndex=0){
  const wrongReasons={};options.forEach((option,i)=>{if(i!==answer)wrongReasons[option]=reasons[i];});
  entries.push({id:lessonId(n)+'-expansion-'+key,lessonId:lessonId(n),number:n,conceptId:cid(n,'grammar','expansion-'+key),type:'grammar',category,question:'【自编练习 · '+labels[category]+'】'+question,options,answer,rule,wrongReasons,contrastExamples:examples,sourceLessonId:lessonId(sourceN),sourceConceptIds:sourceKey?[cid(sourceN,...sourceKey.split(':'))]:[],sourceEvidence:{sourceParagraphIndex:paragraphIndex,sourceText:anchor},reviewStatus:'self-reviewed',sourceType:'self-authored-reviewed-expansion',sourceLabel:'自编练习 · 非教材原配习题',containsOriginalWorkbookExercise:false});
 }
 const vocabularyExamples={
  bear:['I cannot bear this noise.','She can bear the cold.'],private:['This is a private room.','Please keep our conversation private.'],ring:['The telephone is ringing.','The bell rang at noon.'],repeat:['Please repeat the question.','He repeated the same word.'],postcard:['I sent her a postcard.','This postcard shows a garden.'],decision:['We made a decision yesterday.','It was a difficult decision.'],whole:['I stayed there the whole day.','She read the whole book.'],centre:['The museum is in the centre of town.','A pool stands in the centre of the garden.'],pigeon:['A pigeon landed on the roof.','We saw two pigeons in the garden.'],message:['Please leave a message.','He sent me a short message.'],cover:['We covered ten miles on foot.','The train covered the distance in an hour.'],request:['He made a request for help.','We received three requests yesterday.'],beggar:['A beggar asked for a meal.','The beggar stood outside the house.'],pocket:['She put the key in her pocket.','My coat has two pockets.'],detective:['The detective opened the parcel.','Two detectives waited at the airport.'],valuable:['This is a valuable painting.','She keeps her valuable watch here.'],neat:['Her desk is neat.','They made neat paths in the garden.'],wooden:['We crossed a wooden bridge.','He sat on a wooden chair.'],pool:['There is a pool in the garden.','A bridge crosses the small pool.'],hand:['The minute hand has stopped.','This clock has two hands.'],refuse:['They refused to leave.','She refuses to answer the question.'],laugh:['The children began to laugh.','We laughed at the funny story.'],key:['Do not strike the piano keys too hard.','Two keys on this piano are broken.'],string:['One string on the violin broke.','The instrument has four strings.']
 };
 function vocabulary(n,key,sourceN,word,otherWords){
  const target=sourceLesson(sourceN).vocabulary.find(v=>v.word===word),values=[[sourceN,word],...otherWords];
  const answer=Array.from(key).reduce((sum,c)=>sum+c.charCodeAt(0),n)%values.length;
  values.splice(0,1);values.splice(answer,0,[sourceN,word]);
  const optionRows=values.map(([number,w])=>({number,...sourceLesson(number).vocabulary.find(v=>v.word===w)})),wrongReasons={};
  optionRows.forEach((v,i)=>{if(i!==answer)wrongReasons[v.word]=v.word+' 在第'+v.number+'课已确认的词义是“'+v.meaning+'”，与题目指定的“'+target.meaning+'”不同。';});
  const sourceForm=word==='ring'?'rang':word,paragraphIndex=sourceLesson(sourceN).paragraphs.findIndex(p=>p.en.toLowerCase().includes(sourceForm.toLowerCase()));
  entries.push({id:lessonId(n)+'-expansion-'+key,lessonId:lessonId(n),number:n,conceptId:cid(n,'word','expansion-'+key),type:'vocabulary',category:'vocabulary',direction:'meaning-to-word',word,meaning:target.meaning,question:'【自编练习 · '+(n!==sourceN?'回忆第'+sourceN+'课':'本课词汇')+'】按第'+sourceN+'课已确认词义，哪个英文词表示“'+target.meaning+'”？',options:optionRows.map(v=>v.word),optionConceptIds:optionRows.map(v=>cid(v.number,'word',v.word)),answer,rule:'第'+sourceN+'课词表确认：'+word+'＝'+target.meaning+'。本题按这一课内词义选择。',wrongReasons,contrastExamples:vocabularyExamples[word],sourceLessonId:lessonId(sourceN),sourceConceptIds:[cid(sourceN,'word',word)],sourceEvidence:{sourceParagraphIndex:paragraphIndex,sourceText:sourceLesson(sourceN).paragraphs[paragraphIndex].en.match(new RegExp(sourceForm,'i'))[0]},reviewStatus:'self-reviewed',sourceType:'self-authored-reviewed-expansion',sourceLabel:'自编练习 · 非教材原配习题',containsOriginalWorkbookExercise:false});
 }

 // Lesson 1: retain the nine previously graded questions and append three.
 grammar(1,'story-interruption','comprehension',1,'word:bear','I could not hear the actors.',
  '根据第1课，作者为什么没能欣赏演出？',['因为后排两个人大声交谈，他听不见演员','因为戏剧很无聊','因为他没有座位','因为演员没有到场'],0,
  '课文说戏很有趣，但后排两人不断大声交谈，导致作者听不见演员。这是作者未能欣赏演出的原因。',
  ['', '正文明确说戏很有趣，不能把未能欣赏归因于无聊。','作者有一个很好的座位，并非没有座位。','正文描述作者听不见演员，没有说演员缺席。'],['The play was interesting, but the audience was noisy.','I could not hear the actors because people were talking.']);
 grammar(1,'convert-could-question','conversion',1,'grammar:modal-base-verb','I could not hear the actors.',
  '保持 could 和原来的时间含义，将 She could hear the actors. 改成一般疑问句，哪项正确？',['Did she could hear the actors?','Could she hear the actors?','Could she heard the actors?','Does she could hear the actors?'],1,
  '情态动词 could 的一般疑问句将 could 放到主语前，后面的实义动词仍用原形。',
  ['含情态动词 could 时直接倒装，不再加入 did。','','could 后仍接原形 hear，不能用 heard。','含 could 的句子不再借助 does 提问。'],['She could hear me. → Could she hear me?','They could wait. → Could they wait?']);
 vocabulary(1,'word-bear',1,'bear',[[1,'seat'],[1,'theatre'],[1,'conversation']]);

 // Lesson 2: present actions, passage understanding and two retrieval questions.
 grammar(2,'story-breakfast-time','comprehension',2,'','It’s one o’clock!',
  '第2课结尾，Lucy 阿姨说当时几点？',['七点','九点','一点','十二点'],2,
  '结尾的 one o’clock 是一点；作者还在吃早饭，阿姨对此感到惊讶。',
  ['正文没有说七点。','正文没有说九点。','','正文没有说午夜十二点。'],['It is one o’clock, and he is still having breakfast.','At seven o’clock, I usually have breakfast.'],4);
 grammar(2,'story-lucy-arrival','comprehension',2,'','I’ve just arrived by train',
  '第2课中 Lucy 阿姨说她刚乘什么交通工具到达？',['飞机','火车','汽车','轮船'],1,
  'Lucy 说自己刚乘火车到达；by train 表示乘火车。',
  ['她说的是 by train，并没有说乘飞机。','','课文没有说她乘汽车到达。','课文没有说她乘轮船到达。'],['She arrived by train this morning.','He arrived by car yesterday.']);
 grammar(2,'current-be-question','conversion',2,'grammar:be-present',"I'm having breakfast",
  '保持现在进行时，将 You are having breakfast. 改成一般疑问句：___ you having breakfast?',['Are','Is','Do','Did'],0,
  '现在进行时的结构是 am/is/are + 动词-ing；一般疑问句将 be 放到主语前，you 对应 are。',
  ['','you 与 are 搭配，不与 is 搭配。','do 不能代替现在进行时中已有的 are。','did 是一般过去时助动词，不能组成题目要求的现在进行时。'],['You are eating. → Are you eating?','She is eating. → Is she eating?'],3);
 grammar(2,'current-be-negative','grammar',2,'grammar:be-present','It’s raining again.',
  '明确描述现在正在发生的动作，填入 be 的现在式：It ___ raining outside right now.',['are','were','is','was'],2,
  'it 是第三人称单数，当前正在发生的动作用 is + 现在分词。',
  ['are 不与第三人称单数 it 一致。','were 是过去式，且不与这里的 it 一致。','','was 是过去式，不符合 right now 和指定的现在式。'],['It is raining now.','It was raining at this time yesterday.']);
 vocabulary(2,'word-repeat',2,'repeat',[[1,'theatre'],[1,'seat'],[1,'conversation']]);
 grammar(2,'retrieve-can-base','grammar',1,'grammar:modal-base-verb','I could not hear the actors.',
  '回忆第1课的情态动词结构：Lucy could not ___ the noisy actors.',['hearing','to hear','heard','hear'],3,
  '第1课的 could not hear 展示了情态动词后接原形的结构；否定词 not 不改变这一要求。',
  ['hearing 是现在分词，不能直接接在 could not 后。','could 后的原形不带 to。','heard 是过去式或过去分词，不是这里所需的原形。',''],['Lucy could not hear the bell.','Lucy heard the bell yesterday.']);
 vocabulary(2,'retrieve-private',1,'private',[[1,'theatre'],[1,'seat'],[1,'conversation']]);

 // Lesson 3.
 grammar(3,'story-no-card','comprehension',3,'word:postcard','I did not write a single card!',
  '第3课中，作者在房间里待了一整天，最后写了多少张明信片？',['三十七张','一张','零张','几张，数量不明'],2,
  'not ... a single card 强调一张也没有写；三十七张是他买下的数量。',
  ['三十七是买的数量，不是写好的数量。','not a single card 表明连一张也没写。','','正文给出了明确的零张结果，不是数量不明。'],['I bought ten cards, but I wrote none.','She wrote a single card, so she wrote one.']);
 grammar(3,'convert-past-question','conversion',3,'grammar:auxiliary-past','I did not send cards to my friends.',
  '保持一般过去时，将 You sent a card yesterday. 改成一般疑问句：Did you ___ a card yesterday?',['sent','send','sending','to send'],1,
  '一般过去时的一般疑问句用 did + 主语 + 动词原形，过去时间由 did 表达。',
  ['did 后的实义动词恢复原形，不能继续用过去式 sent。','','sending 是现在分词，不能直接接在 did you 后。','did 构成的疑问句后接不带 to 的原形。'],['You sent a card. → Did you send a card?','She bought a book. → Did she buy a book?']);
 vocabulary(3,'word-decision',3,'decision',[[1,'seat'],[1,'theatre'],[3,'museum']]);
 vocabulary(3,'word-whole',3,'whole',[[1,'private'],[3,'public'],[3,'friendly']]);
 grammar(3,'retrieve-present-be','grammar',2,'grammar:be-present',"I'm having breakfast",
  '回忆第2课的现在进行时：Right now, the waiter ___ having breakfast.',['are','was','is','were'],2,
  '现在进行时用 am/is/are + 现在分词；the waiter 是第三人称单数，用 is。',
  ['are 不与单数主语 the waiter 一致。','was 是过去式，不符合 right now。','','were 是过去式，且不与单数主语一致。'],['The waiter is eating now.','The waiters are eating now.'],3);
 vocabulary(3,'retrieve-ring',2,'ring',[[1,'seat'],[1,'theatre'],[1,'conversation']]);

 // Lesson 4.
 grammar(4,'story-tim-location','comprehension',4,'','He is in Australia.',
  '第4课中，Tim 当时在哪个国家？',['意大利','德国','英国','澳大利亚'],3,
  '正文直接说明 Tim 在 Australia，即澳大利亚。',
  ['意大利是第3课的旅行地点，不是本课 Tim 所在地。','正文没有说 Tim 当时在德国。','正文没有说 Tim 当时在英国。',''],['Tim is in Australia.','Last summer, another traveller went to Italy.']);
 grammar(4,'story-next-darwin','comprehension',4,'','He will soon visit Darwin.',
  '按第4课行程，Tim 很快将先去 Darwin，接着从那里飞往哪里？',['Perth','Alice Springs','Silbury','Pinhurst'],0,
  '正文先说将游览 Darwin，下一句 From there, he will fly to Perth. 指从 Darwin 飞往 Perth。',
  ['','Alice Springs 是他已经去的地方，不是从 Darwin 飞往的目的地。','Silbury 是第5课的地名，不在本课这段行程中。','Pinhurst 是第5课的地名，不是本课所说的下一站。'],['He will visit Darwin, then fly to Perth.','He has already gone to Alice Springs.']);
 grammar(4,'convert-perfect-question','conversion',4,'grammar:auxiliary-perfect','he has already visited',
  '保持现在完成时，将 Tim has visited Perth. 改成一般疑问句：___ Tim visited Perth?',['Did','Has','Does','Is'],1,
  '现在完成时的一般疑问句把 have/has 放到主语前；Tim 是第三人称单数，用 has。',
  ['did 后需要原形 visit，也会改变指定的现在完成时。','','does 后需要原形 visit，不能接 visited 构成现在完成时。','is + visited 不是题目要求的主动现在完成时。'],['Tim has visited Perth. → Has Tim visited Perth?','They have visited Perth. → Have they visited Perth?']);
 vocabulary(4,'word-centre',4,'centre',[[3,'museum'],[1,'seat'],[3,'postcard']]);
 grammar(4,'retrieve-past-question','grammar',3,'grammar:auxiliary-past','I did not send cards to my friends.',
  '回忆第3课 did 后的动词形式：Did your brother ___ a postcard yesterday?',['sent','sending','send','to send'],2,
  'did 已表达一般过去时，后面的实义动词使用原形 send。',
  ['sent 是过去式，did 后不再使用过去式。','sending 是现在分词，不符合 did + 主语 + 原形。','','did 后的原形不带 to。'],['Did he send a card?','He sent a card yesterday.']);
 vocabulary(4,'retrieve-postcard',3,'postcard',[[3,'museum'],[1,'seat'],[1,'conversation']]);

 // Lesson 5.
 grammar(5,'story-pigeon-reason','comprehension',5,'word:pigeon','Mr. Scott cannot get a telephone for his new garage',
  '第5课中，Scott 为什么给新修理厂买鸽子？',['为了参加花园比赛','因为装不上电话，要传递信息','因为他需要一位工程师','因为要寄旅游明信片'],1,
  '新修理厂装不上电话，因此 Scott 用鸽子在两家修理厂之间传递信息。',
  ['花园比赛属于第8课的内容，不是买鸽子的原因。','','正文没有说用鸽子寻找工程师。','这里传递的是修理业务信息，不是旅游明信片。'],['He cannot get a telephone, so he uses pigeons.','The pigeons carry messages between the garages.']);
 grammar(5,'story-flight-time','comprehension',5,'word:cover','The bird covered the distance in three minutes.',
  '第5课中，第一只信鸽飞完两家修理厂之间的距离用了多久？',['三小时','五分钟','三分钟','十二分钟'],2,
  '正文的 in three minutes 表示用三分钟；five miles 是距离，twelve 是鸽子的数量。',
  ['minutes 表示分钟，并不是小时。','five 是英里数，不是分钟数。','','twelve 是买下的鸽子数量，不是飞行时间。'],['The bird covered five miles in three minutes.','The car covered the distance in ten minutes.']);
 grammar(5,'current-perfect-agreement','grammar',5,'grammar:auxiliary-perfect','he has just bought twelve pigeons',
  '指定用现在完成时：Mr. Scott ___ just bought twelve pigeons.',['have','did','is','has'],3,
  '现在完成时用 have/has + 过去分词；单数第三人称 Mr. Scott 用 has。',
  ['Mr. Scott 是第三人称单数，这里应使用 has。','did 后需要原形 buy，不能接 bought 构成现在完成时。','is 不能和 bought 在此构成主动现在完成时。',''],['Mr. Scott has bought pigeons.','The workers have bought tools.']);
 grammar(5,'current-perfect-sent','grammar',5,'grammar:auxiliary-perfect','Mr. Scott has sent a great many requests',
  '指定用主动语态的现在完成时：Up to now, Mr. Scott has ___ many messages.',['send','sent','sending','to send'],1,
  '主动现在完成时由 have/has + 过去分词构成；send 的过去分词是 sent。',
  ['send 是原形，has 后需要过去分词。','','sending 是现在分词，不能直接接在 has 后组成现在完成时。','to send 是不定式，不符合 has + 过去分词结构。'],['He has sent the message.','He sends a message every day.']);
 grammar(5,'convert-past-negative','conversion',5,'grammar:auxiliary-past','Yesterday, a pigeon carried the first message',
  '保持一般过去时，将 A pigeon carried the message yesterday. 改成否定句：A pigeon did not ___ the message yesterday.',['carried','carrying','carry','to carry'],2,
  '实义动词的一般过去时否定句用 did not + 动词原形，carried 恢复为 carry。',
  ['did not 后不再用过去式 carried。','carrying 是现在分词，不符合 did not 后的形式要求。','','did not 后接不带 to 的动词原形。'],['The pigeon carried it. → The pigeon did not carry it.','He sent it. → He did not send it.']);
 vocabulary(5,'word-message',5,'message',[[5,'pigeon'],[1,'seat'],[3,'museum']]);
 vocabulary(5,'word-cover',5,'cover',[[1,'seat'],[5,'pigeon'],[3,'museum']]);
 vocabulary(5,'word-request',5,'request',[[5,'pigeon'],[1,'theatre'],[3,'postcard']]);
 grammar(5,'retrieve-perfect-have','grammar',4,'grammar:auxiliary-perfect','he has already visited',
  '回忆第4课 have/has 的选择。指定用现在完成时：The engineers ___ already visited Perth.',['has','are','have','did'],2,
  '现在完成时的助动词随主语选择；复数主语 the engineers 使用 have。',
  ['has 用于第三人称单数，不与 engineers 一致。','are + visited 不能构成指定的主动现在完成时。','','did 构成一般过去时疑问或强调等结构，此处不是现在完成时。'],['The engineer has visited Perth.','The engineers have visited Perth.']);
 vocabulary(5,'retrieve-centre',4,'centre',[[1,'seat'],[3,'museum'],[5,'pigeon']]);

 // Lesson 6.
 grammar(6,'story-beggar-payment','comprehension',6,'word:beggar','the beggar stood on his head and sang songs',
  '第6课中，乞丐做了什么来回报一顿饭和一杯啤酒？',['倒立并唱歌','修理汽车','写明信片','送一包钻石'],0,
  'In return for this 后的内容是 stood on his head and sang songs，即倒立并唱歌。',
  ['','本课没有说乞丐修理汽车。','本课没有说乞丐写明信片作为回报。','本课没有说乞丐送钻石。'],['He sang songs in return for a meal.','She thanked me for the food.']);
 grammar(6,'story-monthly-visit','comprehension',6,'word:call','once a month',
  '第6课中，Percy 多久到这条街上的每家去一次？',['每天一次','每周一次','每年一次','每月一次'],3,
  'once a month 的意思是每月一次；它描述 Percy 登门的习惯频率。',
  ['每天一次应为 once a day，正文不是这个频率。','每周一次应为 once a week。','每年一次应为 once a year。',''],['He calls once a month.','She visits her friend once a week.']);
 grammar(6,'current-present-agreement','grammar',6,'grammar:auxiliary-present','He calls at every house',
  '描述 Percy 现在的习惯，用一般现在时：He ___ at every house once a month.',['call','calls','calling','called'],1,
  '一般现在时肯定句中，第三人称单数 he 后的实义动词 call 加 -s。',
  ['原形 call 不符合本题 he 作主语的一般现在时肯定句。','','calling 需要 be 等结构支持，不能独自作本句谓语。','called 是过去式，不符合题目指定的当前习惯。'],['He calls here every month.','They call here every month.']);
 grammar(6,'current-can-food','grammar',6,'grammar:modal-can-question','He asked me for a meal',
  '只检查情态动词后面的形式：We can ___ the beggar some food.',['giving','gave','give','to give'],2,
  '情态动词 can 后接不带 to 的动词原形；give 为本题所需形式。',
  ['giving 是现在分词，不能直接接在 can 后。','gave 是过去式，不能直接接在 can 后。','','can 后的动词原形不带 to。'],['We can give him food.','We gave him food yesterday.']);
 grammar(6,'convert-does-question','conversion',6,'grammar:auxiliary-present','He calls at every house',
  '保持一般现在时，将 Percy calls here once a month. 改成一般疑问句：Does Percy ___ here once a month?',['call','calls','called','calling'],0,
  '第三人称单数的一般现在时疑问句使用 does，实义动词恢复原形 call。',
  ['','does 已体现第三人称单数，后面不再加 -s。','called 是过去式，does 后应接原形。','calling 是现在分词，does 后应接原形。'],['Percy calls here. → Does Percy call here?','They call here. → Do they call here?']);
 vocabulary(6,'word-beggar',6,'beggar',[[5,'pigeon'],[1,'seat'],[3,'museum']]);
 vocabulary(6,'word-pocket',6,'pocket',[[5,'pigeon'],[3,'postcard'],[1,'theatre']]);
 grammar(6,'retrieve-past-auxiliary','grammar',5,'grammar:auxiliary-past','Yesterday, a pigeon carried the first message',
  '回忆第5课的过去时间表达。指定一般过去时：___ the pigeon carry the message yesterday?',['Does','Is','Has','Did'],3,
  '询问已经结束的昨天的动作，一般过去时用 Did + 主语 + 动词原形。',
  ['does 表达一般现在时，不符合题目指定的一般过去时。','is 后不能直接接 carry 构成本题结构。','has 构成完成时需接过去分词 carried，本题却给出 carry。',''],['Did the pigeon carry a message?','Does the pigeon carry messages every day?']);
 vocabulary(6,'retrieve-pigeon',5,'pigeon',[[1,'seat'],[3,'museum'],[3,'postcard']]);

 // Lesson 7.
 grammar(7,'story-parcel-content','comprehension',7,'word:parcel','the precious parcel was full of stones and sand',
  '第7课中，侦探打开包裹后实际发现了什么？',['钻石','石头和沙子','食物和啤酒','明信片'],1,
  '侦探原本期待钻石，打开后发现实际装的是 stones and sand。需要区分期待与实际结果。',
  ['钻石是侦探期待的物品，不是打开后看到的实际内容。','','食物和啤酒属于第6课，不是这个包裹的内容。','明信片属于第3课，不是这个包裹的内容。'],['They expected diamonds but found stones.','The box was full of sand, not jewels.']);
 grammar(7,'story-guard-location','comprehension',7,'word:guard','two detectives were keeping guard at the door',
  '第7课中，两名侦探打开包裹时，另两名侦探在哪里警戒？',['花园里','修理厂里','门口','火车上'],2,
  'While 引导的分句说明另两名侦探当时正在 at the door，即门口警戒。',
  ['正文说 at the door，没有说在花园里。','修理厂是第5课的地点，不是本题警戒地点。','','正文没有说他们在火车上警戒。'],['Two detectives kept guard at the door.','The others opened the parcel inside.']);
 grammar(7,'current-past-continuous','grammar',7,'grammar:be-past','detectives were waiting at the airport',
  '描述昨日上午十点正在发生的动作：The detectives ___ waiting at the airport at ten yesterday morning.',['was','are','were','is'],2,
  '过去进行时用 was/were + 现在分词；detectives 为复数，使用 were。',
  ['was 不与复数主语 detectives 一致。','are 是现在式，不符合 yesterday morning 的过去参照。','','is 是现在式，且不与复数主语一致。'],['The detectives were waiting then.','One detective was waiting then.']);
 grammar(7,'convert-were-question','conversion',7,'grammar:be-past','They were expecting a valuable parcel',
  '保持过去进行时，将 They were expecting a parcel. 改成一般疑问句，哪项正确？',['Did they expecting a parcel?','Were they expecting a parcel?','Was they expecting a parcel?','Were they expect a parcel?'],1,
  '过去进行时的一般疑问句把 was/were 放到主语前，保留现在分词；they 对应 were。',
  ['已有 were 时直接倒装；did 后也不能直接用 expecting。','','was 不与 they 一致。','were 后缺少本题过去进行时所需的现在分词 expecting。'],['They were waiting. → Were they waiting?','He was waiting. → Was he waiting?']);
 vocabulary(7,'word-detective',7,'detective',[[3,'museum'],[5,'pigeon'],[1,'seat']]);
 vocabulary(7,'word-valuable',7,'valuable',[[1,'private'],[3,'friendly'],[3,'public']]);
 grammar(7,'retrieve-does-base','grammar',6,'grammar:auxiliary-present','He calls at every house',
  '回忆第6课第三人称单数的提问方式：Does Percy ___ for a meal every month?',['asks','asked','asking','ask'],3,
  '一般现在时疑问句中 does 后的实义动词使用原形 ask。',
  ['does 后不再使用第三人称单数 asks。','asked 是过去式，does 后应使用原形。','asking 是现在分词，不能直接接在 does Percy 后。',''],['Does Percy ask for food?','Percy asks for food every month.']);
 vocabulary(7,'retrieve-pocket',6,'pocket',[[5,'pigeon'],[3,'museum'],[1,'theatre']]);

 // Lesson 8: comparisons are anchored to the actual passage, not an invented audit row.
 grammar(8,'story-joe-winner','comprehension',8,'word:competition','Joe wins every time',
  '第8课中，谁每次都赢得最佳花园竞赛？',['作者','Bill Frith','Joe Sanders','Percy Buttons'],2,
  '正文指出 Joe wins every time；Bill 的花园更大不等于他赢得竞赛。',
  ['作者获的是最差花园的小奖，不能据此说他赢得最佳花园竞赛。','Bill 的花园虽更大，正文仍明确说 Joe 每次获胜。','','Percy Buttons 是第6课的人物，不是本课竞赛赢家。'],['Joe wins the garden competition.','Bill has a larger garden, but Joe wins.']);
 grammar(8,'story-worst-prize','comprehension',8,'word:competition','I always win a little prize for the worst garden',
  '第8课中，作者总因为什么获得一个小奖？',['拥有镇上最差的花园','种出最多的蔬菜','拥有最大的花园','修建最漂亮的木桥'],0,
  '作者自嘲每年因镇上最差的花园获小奖，不能把奖理解成最佳花园奖。',
  ['','种更多花和蔬菜的是 Bill，正文没有说作者因此获奖。','正文没有说作者拥有最大的花园。','正文没有说作者修建了最漂亮的木桥。'],['He won a prize for the worst garden.','She won a prize for the best garden.']);
 grammar(8,'current-comparative-larger','grammar',8,'','Bill Frith’s garden is larger than Joe',
  '比较两个花园的大小，按 large 的比较级填空：Bill’s garden is ___ than Joe’s.',['large','largest','larger','more larger'],2,
  '比较两者并与 than 连用时，large 的比较级是 larger；不再叠加 more。',
  ['large 是原级，不符合题目明确要求的比较级。','largest 是最高级，不符合此处两者比较。','','more larger 重复标记比较级，标准形式为 larger。'],['This garden is larger than that one.','This is the largest garden in our town.']);
 grammar(8,'current-superlative-beautiful','grammar',8,'','the most beautiful garden in our town',
  '在全镇所有花园中比较，补全 beautiful 的最高级：Joe has the ___ beautiful garden in our town.',['more','most','much','many'],1,
  'beautiful 的最高级形式是 most beautiful；the 与明确的全镇比较范围对应。',
  ['more beautiful 是比较级，不是题目指定的最高级。','','much beautiful 不能组成 beautiful 的最高级。','many 用于可数复数数量，不能组成 beautiful 的最高级。'],['His garden is more beautiful than mine.','His garden is the most beautiful in town.']);
 grammar(8,'convert-comparison-question','conversion',8,'','Bill Frith’s garden is larger than Joe',
  '保持一般现在时和比较关系，将 Bill’s garden is larger than Joe’s. 改成一般疑问句：___ Bill’s garden larger than Joe’s?',['Does','Did','Is','Are'],2,
  '原句已有 be 动词 is，一般疑问句将 is 放到主语前；单数主语 Bill’s garden 对应 is。',
  ['原句已有 is，不能用 does 代替并省略 be。','did 不符合原句一般现在时，且不能替代这里的 is。','','are 不与单数主语 garden 一致。'],['His garden is larger. → Is his garden larger?','Their gardens are larger. → Are their gardens larger?']);
 vocabulary(8,'word-neat',8,'neat',[[1,'private'],[3,'friendly'],[7,'valuable']]);
 vocabulary(8,'word-wooden',8,'wooden',[[1,'private'],[3,'public'],[7,'valuable']]);
 vocabulary(8,'word-pool',8,'pool',[[5,'pigeon'],[3,'museum'],[1,'seat']]);
 grammar(8,'retrieve-past-were','grammar',7,'grammar:be-past','detectives were waiting at the airport',
  '回忆第7课。指定过去进行时：The detectives ___ guarding the parcel at noon yesterday.',['were','was','are','is'],0,
  '过去进行时需要 was/were + 现在分词；复数主语 detectives 使用 were。',
  ['','was 不与复数主语 detectives 一致。','are 是现在式，不符合指定的过去时间。','is 是现在式，且不与 detectives 一致。'],['They were guarding the door then.','He was guarding the door then.']);
 vocabulary(8,'retrieve-detective',7,'detective',[[5,'pigeon'],[1,'seat'],[3,'museum']]);

 // Lesson 9.
 grammar(9,'story-clock-stop','comprehension',9,'word:hand','at five to twelve, the clock stopped',
  '第9课中，大钟是在什么时间停止的？',['11:55','12:00','12:02','11:40'],0,
  'five to twelve 表示差五分到十二点，即 11:55；12:02 是后来有人喊出的实际时间。',
  ['','钟停在差五分十二点，并未走到十二点。','12:02 是后来人们发现时间已过午夜的时刻，不是钟停止的时刻。','11:40 对应再过二十分钟到十二点的初始时间，不是停止时刻。'],['Five to twelve means 11:55.','Two minutes past twelve means 12:02.']);
 grammar(9,'story-crowd-response','comprehension',9,'word:laugh','everybody began to laugh and sing',
  '第9课结尾，大家意识到钟停了后做了什么？',['愤怒地离开','开始笑和唱歌','去修理厂买鸽子','打开贵重包裹'],1,
  '结尾明确写大家 began to laugh and sing，即开始笑和唱歌。',
  ['结尾没有写大家愤怒离开。','','买鸽子是第5课的事件，不是本课结尾。','打开包裹是第7课的事件，不是本课结尾。'],['Everybody began to laugh and sing.','Nobody left at that moment.']);
 grammar(9,'current-be-workers','grammar',9,'grammar:be-present','The big minute hand did not move.',
  '明确描述此刻正在发生的动作：The workers ___ fixing the clock right now.',['is','was','were','are'],3,
  '当前正在发生的动作用 am/is/are + 现在分词；workers 是复数，使用 are。',
  ['is 不与复数主语 workers 一致。','was 是过去式，且不与复数主语一致。','were 是过去式，不符合 right now。',''],['The workers are fixing the clock now.','The worker is fixing the clock now.']);
 grammar(9,'current-be-hand','grammar',9,'grammar:be-present','The big minute hand did not move.',
  '指定 be 的现在式：The minute hand ___ not moving right now.',['is','are','was','were'],0,
  'minute hand 是单数，描述当前正在发生的情况时，be 使用 is；not 位于 is 后。',
  ['','are 不与单数主语 minute hand 一致。','was 是过去式，不符合 right now 和指定的现在式。','were 是过去式，且不与此处单数主语一致。'],['The minute hand is not moving now.','The hands are not moving now.']);
 grammar(9,'convert-current-question','conversion',9,'grammar:be-present','The big minute hand did not move.',
  '保持现在进行时，将 They are repairing the clock. 改成一般疑问句，哪项正确？',['Do they repairing the clock?','Is they repairing the clock?','Are they repairing the clock?','Are they repair the clock?'],2,
  '现在进行时的一般疑问句把 are 放到 they 前，保留现在分词 repairing。',
  ['do 不能代替原句中构成进行时的 are。','is 不与 they 一致。','','进行时中 are 后需要 repairing，而不是原形 repair。'],['They are working. → Are they working?','He is working. → Is he working?']);
 vocabulary(9,'word-hand',9,'hand',[[5,'pigeon'],[3,'museum'],[8,'pool']]);
 vocabulary(9,'word-refuse',9,'refuse',[[1,'seat'],[8,'pool'],[3,'museum']]);
 vocabulary(9,'word-laugh',9,'laugh',[[3,'museum'],[8,'pool'],[5,'pigeon']]);
 grammar(9,'retrieve-garden-past-question','grammar',8,'grammar:auxiliary-past','Every year I enter for the garden competition too',
  '回忆第8课已审核的过去时疑问句。指定一般过去时：___ you enter the garden competition last year?',['Do','Does','Did','Are'],2,
  'last year 是已经结束的过去时间，实义动词疑问句用 Did + 主语 + 原形。',
  ['do 是一般现在时助动词，不符合题目指定的一般过去时。','does 是第三人称单数一般现在时助动词，且不与 you 一致。','','are 不能直接接 enter 构成本题的实义动词疑问句。'],['Did you enter last year?','Do you enter every year?']);
 vocabulary(9,'retrieve-neat',8,'neat',[[1,'private'],[3,'public'],[7,'valuable']]);

 // Lesson 10.
 grammar(10,'story-damage-cause','comprehension',10,'word:damage','She struck the keys too hard and two of the strings were broken.',
  '根据第10课，访客怎样损坏了乐器？',['把乐器搬到了室外','敲键过重，弄断了两根弦','把乐器卖给了祖父','在琴上放了一袋沙子'],1,
  '正文说访客弹爵士乐时敲击琴键过重，结果两根琴弦断了。',
  ['正文没有说她把乐器搬到室外。','','祖父是多年前的购买者，不是这次损坏的原因。','沙子属于第7课的包裹内容，不是本课损坏原因。'],['She struck the keys too hard.','Two strings broke after she played it.']);
 grammar(10,'story-current-repair','comprehension',10,'word:clavichord','It is being repaired by a friend of my father',
  '第10课结尾，谁正在修理古钢琴？',['作者的祖父','那位弹爵士乐的访客','作者父亲的一位朋友','机场的侦探'],2,
  'a friend of my father’s 指作者父亲的一位朋友；by 引出当前修理者。',
  ['祖父多年前买了这件乐器，正文没有说他当前在修。','访客是损坏乐器的人，正文没有说她在修理。','','侦探是第7课的人物，与本课修理者无关。'],['A friend of my father is repairing it.','My grandfather bought it many years ago.']);
 grammar(10,'current-passive-be','grammar',10,'grammar:be-present','Now we are not allowed to touch it.',
  '按当前规则，指定 be 的现在式：The children ___ not allowed to touch the instrument now.',['is','are','was','were'],1,
  'children 是复数；当前被允许或不被允许的状态用 are allowed / are not allowed。',
  ['is 不与复数主语 children 一致。','','was 是过去式，也不与复数主语一致。','were 是过去式，不符合题目指定的现在式。'],['The children are not allowed to touch it now.','The child is not allowed to touch it now.']);
 grammar(10,'current-past-be','grammar',10,'grammar:be-past','My father was shocked.',
  '只描述那天看到损坏时的状态，用 be 的一般过去式：My father ___ shocked that day.',['are','were','is','was'],3,
  'my father 是单数，题目明确描述过去状态，be 的一般过去式使用 was。',
  ['are 是现在式，且不与单数主语一致。','were 是过去式，但不与本题单数主语 father 一致。','is 是现在式，不符合指定的过去状态。',''],['My father was shocked that day.','My parents were shocked that day.']);
 grammar(10,'convert-passive-question','conversion',10,'grammar:be-present','Now we are not allowed to touch it.',
  '保持现在时，将 We are allowed to touch it. 改成一般疑问句：___ we allowed to touch it?',['Do','Did','Is','Are'],3,
  '原句已有 be 动词 are，疑问句把 are 放到主语 we 前，保留 allowed to touch。',
  ['原句已有 are，不用 do 代替 be 构成疑问句。','did 会改变时间且不能取代这里的 are。','is 不与主语 we 一致。',''],['We are allowed in. → Are we allowed in?','He is allowed in. → Is he allowed in?']);
 vocabulary(10,'word-key',10,'key',[[5,'pigeon'],[3,'museum'],[8,'pool']]);
 vocabulary(10,'word-string',10,'string',[[1,'seat'],[8,'pool'],[3,'postcard']]);
 grammar(10,'retrieve-current-be','grammar',9,'grammar:be-present','The big minute hand did not move.',
  '回忆第9课的 be 现在式。描述此刻：The two men ___ repairing the clock right now.',['are','is','was','were'],0,
  '当前正在进行的动作由 am/is/are + 现在分词构成；two men 是复数，使用 are。',
  ['','is 不与复数主语 two men 一致。','was 是过去式，且不与复数主语一致。','were 是过去式，不符合 right now。'],['The two men are repairing it now.','The man is repairing it now.']);
 vocabulary(10,'retrieve-hand',9,'hand',[[5,'pigeon'],[3,'museum'],[8,'pool']]);

 global.BOOK2_QUESTION_EXPANSION={schemaVersion:1,book:2,label:'第1–10课自编扩展练习',entries};
})(window);
