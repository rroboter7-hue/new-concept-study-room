/* Reviewed, self-authored practice built from canonical lessons. Not workbook exercises.
 * Each scene below was checked against its quoted passage. Transformations are
 * hypothetical language exercises, not assertions that negated events occurred.
 * Generation is deterministic and leaves lesson text and original quizzes alone.
 */
(function (global) {
  'use strict';
  const entries = [], unsupportedLessons = [], lessonId = n => 'nce-b2-eef57c-l' + String(n).padStart(3, '0');
  if (!global.StudyKnowledge || !global.BOOK2_QUESTION_REVIEWS || !Array.isArray(global.LESSONS)) {
    global.BOOK2_LATER_QUESTION_EXPANSION = { schemaVersion: 1, book: 2, entries, unsupportedLessons: [{ reason: 'canonical-sources-unavailable' }] };
    return;
  }
  const bank = global.StudyKnowledge.create(global.LESSONS, { grammarAudit: global.BOOK2_QUESTION_REVIEWS });
  const lessons = new Map(global.LESSONS.filter(l => Number(l.book) === 2).map(l => [Number(l.number), l]));
  const cap = value => value.charAt(0).toUpperCase() + value.slice(1);
  // number, exact passage evidence, reading question, four reviewed answers (first
  // correct before deterministic rotation), source-based self-authored sentence frame.
  // aux frames: [aux, subject, auxiliary, complement]; lexical: [past/present, subject, finite verb, base verb, complement].
  const scenes = [
    [11, 'I was having dinner at a restaurant', '遇到 Tony Steele 时，叙述者正在做什么？', ['在餐馆吃晚饭', '在银行办理业务', '在律师事务所工作', '在剧院看戏'], ['aux','I','was','having dinner at a restaurant'], ['lawyer','salary','immediately']],
    [12, 'will sail from Portsmouth tomorrow', 'Charles Alison 船长计划何时从 Portsmouth 启航？', ['明天', '昨天早晨', '两个月以后才出发', '去年'], ['aux','Captain Charles Alison','will','sail from Portsmouth tomorrow']],
    [13, 'The Greenwood Boys are a group of pop singers.', 'The Greenwood Boys 是什么团体？', ['流行歌手组合', '足球运动队', '铁路工程队', '侦探小组'], ['aux','the Greenwood Boys','are','a group of pop singers']],
    [14, 'On the way, a young man waved to me.', '路上的年轻人先用什么动作引起叙述者注意？', ['向叙述者挥手', '在路边跳舞', '摔碎一扇车窗', '递来一封信'], ['past','a young man','waved','wave','to me']],
    [15, 'I felt very nervous when I went into his office.', '走进 Mr. Harmsworth 的办公室时，叙述者感觉如何？', ['非常紧张', '十分愤怒', '毫无兴趣', '困得睡着了'], ['aux','I','was','very nervous']],
    [16, 'Traffic police are sometimes very polite.', '该句说明交通警察有时怎样？', ['很有礼貌', '从不出现在街上', '总是拒绝交流', '都是游客'], ['aux','traffic police','are','very polite in this example']],
    [17, 'My aunt Jennifer is an actress.', 'Jennifer 的职业是什么？', ['演员', '银行职员', '医生', '船长'], ['aux','my aunt Jennifer','is','an actress']],
    [18, 'My dog had taken it into the garden.', '酒馆老板解释包为什么不在原处？', ['小狗把包拿进了花园', '一位旅客把包带上了火车', '老板把包卖掉了', '叙述者把包落在了家里'], ['aux','the dog','had','taken the bag into the garden']],
    [19, "they’re for next Wednesday's performance", '最后可买到的两张票属于哪场演出？', ['下周三的演出', '当天已经开演的那场', '上周三已经结束的演出', '下个月的首场演出'], ['aux','the tickets','are',"for next Wednesday's performance"]],
    [20, 'Fishing is my favourite sport.', '叙述者开头称自己最喜欢哪项活动？', ['钓鱼', '踢足球', '打网球', '爬山'], ['aux','fishing','is','my favourite sport']],
    [21, 'I live near an airport', '叙述者住在哪里附近？', ['机场', '火车站', '海港', '煤矿'], ['present','I','live','live','near an airport']],
    [22, 'She threw the bottle into the sea.', 'Jane 把瓶子扔到了哪里？', ['海里', '花园里', '火车上', '壁炉里'], ['past','Jane','threw','throw','the bottle into the sea']],
    [23, 'She lives in Nigeria.', '叙述者的姐姐住在哪个国家？', ['尼日利亚', '瑞典', '法国', '日本'], ['present','she','lives','live','in Nigeria']],
    [24, 'I had just lost £50', '走进经理办公室之前，叙述者刚丢失了什么？', ['五十英镑', '一张火车票', '一枚钻戒', '一本护照'], ['aux','I','had','just lost fifty pounds']],
    [25, 'I arrived in London at last.', '叙述者终于到达了哪座城市？', ['伦敦', '巴黎', '罗马', '纽约'], ['past','I','arrived','arrive','in London']],
    [26, 'I am an art student', '叙述者介绍自己是什么学生？', ['美术学生', '医学生', '法律学生', '音乐学生'], ['aux','I','am','an art student']],
    [27, 'they cooked a meal over an open fire', '搭好帐篷后，男孩们如何准备饭食？', ['在明火上做饭', '在餐馆订餐', '用微波炉热饭', '直接吃冷食，没有烹饪'], ['past','the boys','cooked','cook','a meal over an open fire']],
    [28, 'He has just bought a new house in the city', 'Jasper White 最近买了什么？', ['城里的一所新房子', '乡下的一片森林', '一架小型飞机', '一家电影院'], ['aux','Jasper White','has','just bought a new house in the city']],
    [29, 'This wonderful plane can carry seven passengers.', '这架飞机可以搭载多少位乘客？', ['七位', '三位', '十七位', '七十位'], ['aux','this wonderful plane','can','carry seven passengers'], ['land','roof','plough']],
    [30, 'It was warm last Sunday', '上个星期天天气怎样？', ['温暖', '严寒', '大雪纷飞', '结冰'], ['aux','it','was','warm last Sunday'], ['row','kick','towards']],
    [31, 'he used to work fourteen hours a day', '年轻时 Frank 每天曾工作多长时间？', ['十四小时', '四小时', '七小时', '二十四小时'], ['past','Frank','worked','work','fourteen hours a day as a boy']],
    [32, 'a well-dressed woman who always went into a large store on Monday mornings', '侦探注意到那位穿着讲究的女士通常何时进商店？', ['星期一早晨', '星期五夜里', '星期六中午', '每天傍晚'], ['past','the woman','visited','visit','the store on Monday mornings']],
    [33, 'One afternoon she set out from the coast in a small boat', '姑娘那天下午乘什么离开海岸？', ['一条小船', '一架直升机', '一辆出租车', '一列火车'], ['past','the girl','set','set','out from the coast in a small boat']],
    [34, 'Last Tuesday he received a letter from the local police.', 'Dan 上周二收到了谁的来信？', ['当地警方', '他的姐姐', '一位律师', '一家银行'], ['past','Dan','received','receive','a letter from the local police last Tuesday']],
    [35, 'he became a bus driver', 'Roy Trenton 后来改做什么工作？', ['公共汽车司机', '出租车调度员', '火车司机', '警察'], ['past','Roy Trenton','became','become','a bus driver'], ['regret','rush','fright']],
    [36, 'Debbie Hart is going to swim across the English Channel tomorrow.', 'Debbie 明天计划做什么？', ['游泳横渡英吉利海峡', '驾驶飞机飞越北极', '参加自行车比赛', '乘火车去伦敦'], ['aux','Debbie Hart','is','going to swim across the English Channel tomorrow']],
    [37, 'The Olympic Games will be held in our country in four years’ time.', '文中说奥运会将在多久后于本国举行？', ['四年后', '四天后', '下个月', '十年后'], ['aux','the Olympic Games','will',"be held in our country in four years' time"]],
    [38, 'he began to complain about the weather', 'Harrison 回到英国不久开始抱怨什么？', ['天气', '房屋太大', '火车太快', '食物太便宜'], ['past','Harrison','began','begin','to complain about the weather']],
    [39, 'the patient asked for a bedside telephone', '第二天，病人要求得到什么？', ['一部床边电话', '一架照相机', '一份地图', '一台收音机'], ['past','the patient','asked','ask','for a bedside telephone']],
    [40, 'the hostess asked me to sit next to Mrs. Rumbold', '晚宴上女主人安排叙述者坐在谁旁边？', ['Mrs. Rumbold', 'Mr. Harmsworth', 'Captain Alison', 'Doctor Millington'], ['past','the hostess','asked','ask','me to sit next to Mrs. Rumbold']],
    [41, 'We had been in the hat shop for half an hour', '当时夫妻俩已经在帽子店里待了多久？', ['半小时', '五分钟', '两小时', '一整天'], ['aux','we','had','been in the hat shop for half an hour']],
    [42, 'we stopped at a square to have a rest', '走过市场后，叙述者一行在哪里停下来休息？', ['一个广场', '一座机场', '一家银行', '一所学校'], ['past','we','stopped','stop','at a square to have a rest']],
    [43, 'In 1929, three years after his flight over the North Pole, the American explorer, R.E. Byrd, successfully flew over the South Pole for the first time.', 'Byrd 首次成功飞越南极是在何年？', ['1929 年', '1926 年', '1939 年', '1949 年'], ['past','Byrd','flew','fly','over the South Pole in 1929'], ['flight','explorer','aircraft']],
    [44, 'she was having a picnic at the edge of a forest with her children', '两名男子靠近时，Anne Sterling 正在做什么？', ['和孩子们在森林边野餐', '独自在海里游泳', '在火车上睡觉', '在办公室打字'], ['aux','Anne Sterling','was','having a picnic with her children']],
    [45, 'had lost his wallet while taking his savings to the post office', 'Sam 在前往邮局的途中丢失了什么？', ['钱包', '手表', '自行车', '手提箱'], ['aux','Sam Benton','had','lost his wallet']],
    [46, 'one of the boxes was extremely heavy', '其中一个木箱有什么异常？', ['特别沉重', '完全透明', '小得装不下衣服', '正在漂浮'], ['aux','one of the boxes','was','extremely heavy']],
    [47, 'Mr. Thompson is going to sell it because it is haunted.', 'Thompson 为什么打算卖掉酒馆？', ['因为据说酒馆闹鬼', '因为酒馆已被改成学校', '因为他要送给朋友', '因为它已被洪水冲走'], ['aux','Mr. Thompson','is','going to sell the public house']],
    [48, 'my mouth was full of cotton wool', '叙述者为什么很难立即回答牙医？', ['嘴里塞满了药棉', '牙医不允许他开口', '他听不见问题', '他已经睡着了'], ['aux','my mouth','was','full of cotton wool']],
    [49, 'he carried the bed on to the roof of his house', '由于天气炎热，年轻人把床搬到了哪里？', ['屋顶', '地下室', '街道中央', '花园池塘里'], ['past','the young man','carried','carry','the bed onto the roof of his house'], ['owner','mattress','spring']],
    [50, "I'm going to Woodford Green", '叙述者告诉售票员自己要去哪里？', ['Woodford Green', 'Portsmouth', 'New York', 'Old Delhi'], ['aux','I','am','going to Woodford Green']],
    [51, 'He began his diet a week ago.', 'Hugh 是什么时候开始节食的？', ['一周前', '一天前', '一个月前', '一年前'], ['past','Hugh','began','begin','his diet a week ago']],
    [52, 'I own over a thousand books', '整理房间困难的一个原因是什么？', ['叙述者有一千多本书', '房间里没有窗户', '所有家具都损坏了', '书已经被全部卖掉了'], ['present','I','own','own','over a thousand books']],
    [53, 'firemen have put out a big forest fire in California', '消防员最终扑灭的是哪里的森林大火？', ['加利福尼亚', '苏格兰', '日本', '瑞典'], ['aux','firemen','have','put out a big forest fire in California'], ['fireman','examine','mystery']],
    [54, 'The children were at school', '母亲回到家时，孩子们在哪里？', ['学校', '办公室', '厨房', '花园'], ['aux','the children','were','at school']],
    [55, 'A new machine called ‘The Revealer’ has been invented', 'The Revealer 是什么？', ['一种新发明的机器', '一艘古老的帆船', '一座新建的电影院', '一只受训的警犬'], ['aux','a new machine','has','been invented']],
    [56, 'Once a year, a race is held for old cars.', '老爷车比赛多久举办一次？', ['每年一次', '每月一次', '每天一次', '每十年一次'], ['aux','a race for old cars','is','held once a year'], ['wheel','rival','course']],
    [57, 'A woman in jeans stood at the window of an expensive shop.', '女士起初穿着什么站在商店橱窗外？', ['牛仔裤', '晚礼服', '制服', '泳衣'], ['past','a woman in jeans','stood','stand','at the shop window']],
    [58, 'The tree was planted near the church fifty years ago', '那棵树五十年前种在什么地方附近？', ['教堂', '机场', '港口', '工厂'], ['aux','the tree','was','planted near the church fifty years ago']],
    [59, 'my husband spent weeks training him to press his paw on the latch', '丈夫训练 Rex 用什么按门闩？', ['爪子', '尾巴', '鼻子', '后背'], ['past','my husband','trained','train','Rex to press his paw on the latch']],
    [60, 'a fortune-teller called Madam Bellinsky', 'Madam Bellinsky 在故事中从事什么？', ['算命', '牙科治疗', '经营铁路', '驾驶飞机'], ['aux','Madam Bellinsky','is','a fortune-teller']],
    [61, 'its main mirror was faulty', 'Hubble 起初传回的照片为什么令人失望？', ['主镜有故障', '没有安装任何镜子', '地面没有人接收', '它一直没有进入太空'], ['aux','its main mirror','was','faulty'], ['launch','astronaut','faulty']],
    [62, 'Firemen had been fighting the forest fire for nearly three weeks', '控制住火势前，消防员已奋战了多久？', ['将近三周', '三个小时', '整整三个月', '不到一天'], ['aux','firemen','had','been fighting the forest fire for nearly three weeks']],
    [63, 'except his six-year-old daughter, Jenny', '谁不像其他人那样欣赏 Jeremy 的幽默感？', ['六岁的女儿 Jenny', '他的所有朋友', '婚礼上的新郎', '他的父亲'], ['aux','Jenny','is','six years old']],
    [64, 'a twenty-one-mile tunnel under the English Channel', '工程师提出的隧道计划位于何处？', ['英吉利海峡下方', '地中海中央上方', '阿尔卑斯山顶', '伦敦市中心街道上方'], ['aux','the planned tunnel','is','twenty-one miles long']],
    [65, 'decided to take some presents to a children’s hospital', 'Jimmy Gates 决定把礼物送到哪里？', ['儿童医院', '火车站', '警察学校', '一家银行'], ['past','Jimmy Gates','decided','decide',"to take presents to a children's hospital"], ['circus','accompany','weigh']],
    [66, 'In 1963 a Lancaster bomber crashed on Wallis Island', 'Lancaster 轰炸机在何年坠落？', ['1963 年', '1989 年', '1929 年', '1999 年'], ['past','a Lancaster bomber','crashed','crash','on Wallis Island in 1963']],
    [67, 'the Polish scientist', '按本课对人物的称呼，Haroun Tazieff 被介绍为哪国科学家？', ['波兰', '法国', '日本', '加拿大'], ['aux','Haroun Tazieff','is','a Polish scientist']],
    [68, 'I crossed the street to avoid meeting him', '叙述者起初为什么穿过街道？', ['为了避开 Nigel', '为了买报纸', '为了迎接 Nigel', '为了乘飞机'], ['past','I','crossed','cross','the street']],
    [69, 'I was being tested for a driving licence for the third time.', '这是叙述者第几次参加驾驶执照考试？', ['第三次', '第一次', '第二次', '第五次'], ['aux','I','was','being tested for a driving licence for the third time']],
    [70, 'a drunk suddenly wandered into the middle of the ring', '斗牛期间，谁突然走进场地中央？', ['一个醉汉', '一名邮递员', '一位医生', '一个婴儿'], ['past','a drunk','wandered','wander','into the middle of the ring']],
    [71, 'Big Ben takes its name from Sir Benjamin Hall', 'Big Ben 的名字来源于谁？', ['Sir Benjamin Hall', 'Sir Malcolm Campbell', 'Captain Charles Alison', 'Haroun Tazieff'], ['present','Big Ben','takes','take','its name from Sir Benjamin Hall'], ['accurate','tower','microphone']],
    [72, 'He set up a new world record in September 1935', 'Campbell 创下文中所说世界纪录是在何时？', ['1935 年 9 月', '1929 年 1 月', '1963 年 12 月', '1989 年 6 月'], ['past','Campbell','set','set','a new world record in September 1935'], ['racing','horsepower','average']],
    [73, 'travelled 1,600 miles', '文中那位逃学男孩旅行了多远？', ['一千六百英里', '十六英里', '一百六十英里', '六千英里'], ['past','the boy','travelled','travel','1600 miles']],
    [74, 'Dressed in dark glasses and old clothes', '演员们采取了怎样的伪装？', ['戴墨镜、穿旧衣服', '穿制服、戴军帽', '穿婚纱、拿鲜花', '穿泳衣、戴潜水镜'], ['past','the actors','wore','wear','dark glasses and old clothes']],
    [75, 'The only passengers, a young woman and her two baby daughters, were unhurt.', '失事飞机上没有受伤的乘客是谁？', ['一名年轻女子和她的两个小女儿', '飞行员和两名警察', '三个成年男子', '一名医生和两名护士'], ['aux','the passengers','were','unhurt']],
    [76, 'Macaroni has been grown in this area for over six hundred years.', '电视公告开玩笑地声称当地种植通心粉多久了？', ['六百多年', '六个月', '十年', '一百天'], ['aux','the announcer','is','describing macaroni fields']],
    [77, 'Shepenmut who was once a singer in the Temple of Thebes', 'Shepenmut 生前曾是什么人？', ['神庙歌手', '皇家医生', '现代考古学家', '飞行员'], ['aux','Shepenmut','was','a singer in the Temple of Thebes']],
    [78, 'For a whole week I did not smoke at all', '叙述者曾连续多久完全没有吸烟？', ['一整周', '整整一年', '两天', '三个月'], ['past','I','stopped','stop','smoking for a whole week'], ['nerve','concentration','appetite']],
    [79, 'My parents used to live in South America', '叙述者的父母过去住在哪里？', ['南美洲', '北极', '日本', '澳大利亚'], ['past','my parents','lived','live','in South America']],
    [80, 'it was made of iron and glass', '水晶宫主要用什么材料建造？', ['铁和玻璃', '木头和纸', '铜和黄金', '石头和泥土'], ['aux','the Crystal Palace','was','made of iron and glass']],
    [81, 'he soon changed into the dead man’s clothes', '逃跑时，战俘换上了谁的衣服？', ['被杀守卫的衣服', '一位医生的衣服', '一名乘务员的衣服', '一名游客的衣服'], ['past','the prisoner','changed','change',"into the dead guard's clothes"]],
    [82, 'Fishermen and sailors sometimes claim to have seen monsters in the sea.', '渔民和水手有时声称在海里看见什么？', ['怪物', '沙漠', '火车', '城市街道'], ['present','fishermen and sailors','claim','claim','to have seen monsters in the sea']],
    [83, 'was defeated in the recent elections', '前首相在最近的选举中结果如何？', ['落败', '再次获胜', '主动取消选举', '完全没有参选机会的信息'], ['aux','the former Prime Minister','was','defeated in the recent elections']],
    [84, 'The strike is due to begin on Tuesday.', '罢工预定在哪天开始？', ['星期二', '星期一', '星期五', '星期日'], ['aux','the strike','is','due to begin on Tuesday']],
    [85, 'Mr. Stuart Page, will be retiring next week', 'Stuart Page 校长将在什么时候退休？', ['下周', '明天一早', '下个月', '十年后'], ['aux','Mr. Stuart Page','will','be retiring next week']],
    [86, 'the steering wheel came away in his hands', '男子想让快艇转弯时发生了什么故障？', ['方向盘脱落了', '发动机立即爆炸了', '船底出现了大洞', '所有汽油都已漏光'], ['past','the steering wheel','came','come','away in his hands']],
    [87, 'I was travelling on the 8 o’clock train to London', '男子声称案发时自己乘火车去哪里？', ['伦敦', '巴黎', '纽约', '悉尼'], ['aux','the man','was','travelling on the eight o\'clock train to London']],
    [88, 'Six men have been trapped in a mine for seventeen hours.', '被困矿井的人有几位？', ['六位', '十七位', '三位', '十二位'], ['aux','six men','have','been trapped in a mine for seventeen hours']],
    [89, 'We had to queue for hours to get in', '人们为入场做了什么？', ['排了几个小时的队', '只等了几秒钟', '先参加了演出', '先去公司上班'], ['past','we','queued','queue','for hours to get in'], ['comedy','queue','dull']],
    [90, 'giant fish are terrifying the divers on North Sea oil rigs', '巨大的鱼类给北海油井上的潜水员带来什么影响？', ['巨大鱼类使潜水员感到害怕', '潜水员因为缺少照明而停止了所有维修', '潜水员只在海面工作，从不下水', '油井附近的鱼已经全部被捕捞完毕'], ['aux','giant fish','are','terrifying the divers'], ['diver','cage','shark']],
    [91, 'A pilot noticed a balloon', '飞行员发现了什么飞行物？', ['气球', '火箭', '风筝', '战斗机'], ['past','a pilot','noticed','notice','a balloon']],
    [92, "I've forgotten my key.", '叙述者为什么试图爬窗回家？', ['他忘了带钥匙', '他要清洗窗户作为工作', '他奉命修理屋顶', '他想去邻居家吃饭'], ['aux','I','have','forgotten my key'], ['ladder','shed','tone']],
    [93, 'The actual figure was made of copper', '自由女神像主体由什么材料制成？', ['铜', '木头', '纯金', '塑料'], ['aux','the actual figure','was','made of copper']],
    [94, 'children become expert at holding their breath under water even before they can walk', '特殊泳池中的孩子在学会走路之前已擅长什么？', ['在水下屏住呼吸', '驾驶汽车', '攀登雪山', '修理飞机'], ['present','the children','practise','practise','holding their breath under water']],
    [95, 'University students set the Embassy on fire this morning.', '谁在当天早上放火烧了大使馆？', ['大学生', '一群渔民', '消防队员', '机场工人'], ['past','university students','set','set','the Embassy on fire that morning']],
    [96, 'A Festival for the Dead is held once a year in Japan.', '日本文中所述的祭亡节多久举行一次？', ['每年一次', '每天一次', '每月两次', '每十年一次'], ['aux','a Festival for the Dead','is','held once a year in Japan'], ['festival','lantern','moving']]
  ];

  function evidence(source, fragment) {
    const index = source.paragraphs.findIndex(p => p.en.includes(fragment));
    return index < 0 ? null : { sourceParagraphIndex: index, sourceText: fragment };
  }
  function forms(frame) {
    const [kind, subject, finite, fourth, fifth] = frame;
    // These reviewed present-tense frames explicitly provide both the finite and
    // base forms; matching forms take do, and third-person -s forms take does.
    const auxiliary = kind === 'aux' ? finite : kind === 'past' ? 'did' : finite === fourth ? 'do' : 'does';
    const rest = kind === 'aux' ? fourth : fourth + (fifth ? ' ' + fifth : '');
    const original = cap(subject) + ' ' + finite + (kind === 'aux' ? ' ' + fourth : fifth ? ' ' + fifth : '') + '.';
    const negative = cap(subject) + ' ' + auxiliary + ' not ' + rest + '.';
    const yesno = cap(auxiliary) + ' ' + subject + ' ' + rest + '?';
    const wrongTense = auxiliary === 'was' ? 'is' : auxiliary === 'were' ? 'are' : auxiliary === 'is' ? 'was' : auxiliary === 'are' ? 'were' : auxiliary === 'did' ? 'does' : auxiliary === 'will' ? 'would' : auxiliary === 'had' ? 'has' : auxiliary === 'has' ? 'had' : auxiliary === 'have' ? 'had' : auxiliary === 'am' ? 'was' : auxiliary === 'can' ? 'could' : 'did';
    return { kind, subject, finite, rest, original, negative, yesno, auxiliary, wrongTense,
      changed: cap(subject) + ' ' + wrongTense + ' not ' + rest + '.',
      changedQuestion: cap(wrongTense) + ' ' + subject + ' ' + rest + '?' };
  }
  function make(destination, source, key, category, prompt, answer, wrong, rule, examples, sourceEvidence, sourceConceptIds) {
    const choices = [answer].concat(wrong.map(item => item[0]));
    const offset = (Number(destination.number) + key.length) % choices.length;
    const options = choices.slice(offset).concat(choices.slice(0, offset));
    const q = {
      id: destination.id + '-expansion-' + key, lessonId: destination.id, number: Number(destination.number),
      conceptId: global.StudyKnowledge.conceptId(destination.id, 'grammar', 'expansion-' + key),
      type: 'grammar', category, question: prompt, options, answer: options.indexOf(answer), rule,
      wrongReasons: Object.fromEntries(wrong), contrastExamples: examples,
      sourceLessonId: source.id, sourceConceptIds, sourceEvidence,
      reviewStatus: 'self-reviewed', sourceType: 'self-authored-reviewed-expansion',
      sourceLabel: '自编练习 · 非教材原配习题', containsOriginalWorkbookExercise: false
    };
    return q;
  }
  const allWords = Array.from(lessons.values()).flatMap(l => bank.vocabularyForLesson(l.id));
  // Exclude contextual senses already identified as unsuitable for this task.
  const excludedWords = new Set(['turn','spectacle','flat','tired','hot','wayle','hubble','kivu','mediterranean','utah','ex-','most']);
  const vocabularyPool = source => bank.vocabularyForLesson(source.id).filter(w => !excludedWords.has(w.word.toLowerCase()));
  function wordQuestion(destination, source, word, key) {
    const options = [word], seenWords = new Set([word.word.toLowerCase()]), seenMeanings = new Set([word.meaning]);
    // Restrict distractors to earlier/current lessons and avoid shared sense fragments
    // as well as exact duplicate definitions. A lesson-qualified exact definition is asked.
    for (const other of allWords) {
      const otherLesson = global.LESSONS.find(l => l.id === other.sourceLessonId);
      const fragments = value => value.split(/[；;、（）()：:]/).map(x => x.trim()).filter(x => x.length > 1);
      if (otherLesson.number > destination.number || excludedWords.has(other.word.toLowerCase()) || seenWords.has(other.word.toLowerCase()) || seenMeanings.has(other.meaning) || options.some(item => fragments(item.meaning).some(a => fragments(other.meaning).some(b => a.includes(b) || b.includes(a))))) continue;
      options.push(other); seenWords.add(other.word.toLowerCase()); seenMeanings.add(other.meaning);
      if (options.length === 4) break;
    }
    if (options.length !== 4) throw new Error('Not enough distinct confirmed vocabulary options');
    const reason = other => '该来源课已确认词义为“' + other.meaning + '”，不对应题干限定的“' + word.meaning + '”。';
    const proof = { sourceParagraphIndex: 0, sourceText: source.paragraphs[0].en };
    const q = make(destination, source, key, 'vocabulary', '【自编词义反向提取】按第二册第 ' + source.number + ' 课已确认词表，哪一个词的确切释义是“' + word.meaning + '”？', word.word, options.slice(1).map(other => [other.word, reason(other)]),
      '本题只匹配指定来源课已确认的词形和确切中文释义，不把其他语境的义项混入；' + word.word + '：' + word.meaning + '。',
      ['Confirmed word: ' + word.word + '. Meaning in this lesson: ' + word.meaning + '.', 'Compare with ' + options[1].word + ': ' + options[1].meaning + '.'], proof, [word.conceptId]);
    const optionByWord = new Map(options.map(item => [item.word, item]));
    Object.assign(q, { type: 'vocabulary', direction: 'meaning-to-word', word: word.word, meaning: word.meaning,
      conceptId: global.StudyKnowledge.conceptId(destination.id, 'word', 'expansion-' + key),
      optionConceptIds: q.options.map(option => optionByWord.get(option).conceptId) });
    return q;
  }

  function earlierGrammar(destination, sceneForms) {
    // Retrieve an actually approved earlier auxiliary concept and use this lesson's
    // unique subject/event in a clearly labelled self-authored transformation.
    const requested = sceneForms.auxiliary === 'did' ? ['auxiliary-past'] : sceneForms.auxiliary === 'do' || sceneForms.auxiliary === 'does' ? ['auxiliary-present'] :
      sceneForms.auxiliary === 'was' || sceneForms.auxiliary === 'were' ? ['be-past','past-continuous-agreement'] :
      sceneForms.auxiliary === 'will' ? ['future-simple'] : sceneForms.auxiliary === 'has' || sceneForms.auxiliary === 'have' ? ['auxiliary-perfect','present-perfect'] :
      sceneForms.auxiliary === 'had' ? ['auxiliary-pastperfect','past-perfect'] : sceneForms.auxiliary === 'can' ? ['modal-can-question'] : ['be-present'];
    let source, concept;
    for (let n = destination.number - 1; n >= 1 && !concept; n--) {
      const candidate = lessons.get(n);
      if (!candidate) continue;
      const match = bank.quizForLesson(candidate.id).find(q => q.type === 'grammar' && requested.some(key => q.conceptId.endsWith(':' + key)));
      if (match) { source = candidate; concept = match.conceptId; }
    }
    if (!concept) {
      // Lesson 12 introduces will before a confirmed earlier will record exists.
      // Review a true earlier present-be concept in an explicitly new scenario.
      source = lessons.get(10); concept = bank.quizForLesson(source.id).find(q => q.conceptId.endsWith(':be-present')).conceptId;
      return make(destination, source, 'earlier-grammar', 'grammar', '【旧知提取 · 自编新情境】复习第10课的 be 现在式；此句说明船长现在就在港口，不是叙述课文原句：The captain ___ at the harbour right now.', 'is',
        [['are','The captain 是第三人称单数，当前状态不用 are。'],['was','was 是过去式，与题目明确的现在状态不符。'],['were','were 是过去式，也不与 The captain 这一单数主语一致。']],
        '当前单数主语 the captain 与 is 连用；这里将已审核的 be 现在式知识用于新的港口情境。', ['The captain is at the harbour now.','The sailors are at the harbour now.'],
        { sourceParagraphIndex: 0, sourceText: source.paragraphs[0].en }, [concept]);
    }
    const f = sceneForms;
    return make(destination, source, 'earlier-grammar', 'grammar', '【旧知提取 · 自编迁移】复习第二册第 ' + source.number + ' 课已审核的助动词知识。把“' + f.original + '”变成一般疑问句，保持主语、时态和内容；只填句首：___ ' + f.subject + ' ' + f.rest + '?', cap(f.auxiliary),
      [[cap(f.wrongTense),'该形式改变了原句给定的时态或情态，不能用于保持原意的转换。'],['Being','Being 不能独自在此构成所要求的有限动词一般疑问句。'],['To','To 是不定式标记，不能替代这里的一般疑问句助动词。']],
      '按给定原句转换时，保留原来的时态、人称和情态。be、完成时助动词或情态动词前移；实义动词的一般过去时问句用 did，一般现在时用 do / does，并还原主要动词。',
      [f.original + ' → ' + f.yesno, f.original + ' → ' + f.negative],
      { sourceParagraphIndex: 0, sourceText: source.paragraphs[0].en }, [concept]);
  }

  for (const scene of scenes) {
    const [number, fragment, reading, answers, frame, preferredWords] = scene;
    const destination = lessons.get(number), sourceEvidence = destination && evidence(destination, fragment);
    if (!destination || !sourceEvidence) { unsupportedLessons.push({ number, reason: 'source-fragment-not-found', fragment }); continue; }
    const need = Math.max(0, 12 - bank.quizForLesson(destination.id).length);
    if (!need) continue;
    const f = forms(frame), result = [], currentWords = vocabularyPool(destination);
    const words = preferredWords ? preferredWords.map(word => currentWords.find(item => item.word.toLowerCase() === word.toLowerCase())).filter(Boolean) : currentWords;
    const currentIds = [];
    result.push(make(destination, destination, 'reading', 'comprehension', '【自编课文理解】根据第二册第 ' + number + ' 课的这一片段：“' + fragment + '”。' + reading, answers[0],
      answers.slice(1).map(option => [option, '该选项不符合题干所引原文；片段直接支持“' + answers[0] + '”，不能用其他人物、数量、时间或地点替换。']),
      '按所引片段提取明确事实，不把其他课文情节或未出现的推测当成答案；本题的直接信息为“' + answers[0] + '”。',
      ['Scene-based statement: ' + f.original, 'Negative grammar contrast only (not a claim about the story): ' + f.negative], sourceEvidence, currentIds));
    const negative = make(destination, destination, 'negative', 'conversion', '【自编句型转换】以课文情境改写的练习原句为准（否定句仅作语法练习）：' + f.original + ' 保持主语、时态和其余内容，把整句改为否定句。', f.negative,
      [[f.original,'这是给定肯定句，未完成要求的否定转换。'],[f.changed,'该选项改变了给定原句的时态或情态，不能作为保持其余条件的否定转换。'],[f.yesno,'这是一般疑问句，未完成要求的否定陈述句转换。']],
      '保留给定原句的主语、时态和补足信息。be、完成时助动词或情态动词后加 not；实义动词过去式改为 did not + 原形，现在式用 do / does not + 原形。', [f.original,f.negative], sourceEvidence, currentIds);
    negative.originalSentence = f.original; result.push(negative);
    result.push(make(destination, destination, 'yesno', 'conversion', '【自编句型转换】练习原句：' + f.original + ' 保持主语、时态、情态和宾语／补语不变，选择对应的一般疑问句。', f.yesno,
      [[f.original,'该句仍是肯定陈述句，语序与句末标点均未完成疑问转换。'],[f.changedQuestion,'这个问句改变了给定时态或情态，不符合转换必须保持原句条件的要求。'],[f.negative,'该句是否定陈述句，不是要求的一般疑问句。']],
      '一般疑问句把原有 be、完成时助动词或情态动词移到主语前；实义动词句使用 do / does / did 并保留其后的动词原形。不要替换主语或改变时间信息。', [f.original,f.yesno], sourceEvidence, currentIds));
    const previous = lessons.get(number - 1), earlierWords = vocabularyPool(previous);
    result.push(wordQuestion(destination, destination, words[0], 'current-word-1'));
    result.push(wordQuestion(destination, words[1] ? destination : previous, words[1] || earlierWords[0], 'current-word-2'));
    result.push(wordQuestion(destination, previous, earlierWords[(number * 7) % earlierWords.length], 'earlier-word'));
    result.push(earlierGrammar(destination, f));
    if (need >= 8) {
      const grammarChoices = [f.auxiliary,f.wrongTense,'being','to'];
      result.push(make(destination, destination, 'current-grammar', 'grammar', '【自编结构辨析】给定练习原句：' + f.original + ' 为了保持这句话的主语、时态和内容，在否定结构中只填指定空格：' + cap(f.subject) + ' ___ not ' + f.rest + '.', grammarChoices[0],
        [[grammarChoices[1],'该形式会改变原句已经给定的时态或情态，不能用于本次否定转换。'],['being','being 是非限定形式，不能独自在此承担该句的有限助动词。'],['to','to 不能作为这里否定结构的有限助动词。']],
        '否定结构需要与给定原句匹配的有限动词；实义动词句由 do / does / did 承担时态，其后主要动词用原形，其余句保留已有 be、情态或完成时助动词。', [f.original,f.negative], sourceEvidence, currentIds));
    }
    if (need >= 9) result.push(make(destination, destination, 'restore', 'conversion', '【自编反向转换】把下面的一般疑问句还原为肯定陈述句；保持主语、时态和所有情境信息：' + f.yesno, f.original,
      [[f.negative,'这是否定陈述句，题目要求还原成肯定陈述句。'],[f.yesno,'这仍是原来的问句，未还原为肯定陈述句。'],[f.changed,'该句既改变了原句时态或情态，也是否定句，不满足还原要求。']],
      '还原肯定陈述句时恢复主语在前的语序；do / does / did 助动词删除后，主要动词要恢复相应人称和时态，不能只是改标点。', [f.yesno,f.original], sourceEvidence, currentIds));
    if (need >= 10) result.push(wordQuestion(destination, destination, words[2], 'current-word-3'));
    if (result.length !== need) { unsupportedLessons.push({ number, reason: 'reviewed-count-mismatch', required: need, available: result.length }); continue; }
    entries.push(...result);
  }
  global.BOOK2_LATER_QUESTION_EXPANSION = { schemaVersion: 1, book: 2, entries, unsupportedLessons,
    sourceLabel: '自编练习 · 非教材原配习题', reviewedLessons: scenes.map(scene => scene[0]),
    reviewScope: '课文片段事实核对、受控句型转换和已确认词表的反向匹配；自编情境不冒充教材原配练习。' };
})(window);
