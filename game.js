(function (global) {
  'use strict';

  const numeric = value => Math.max(0, Number(value) || 0);
  const text = value => typeof value === 'string' ? value.trim() : '';
  const normalized = value => text(value).normalize('NFKC').replace(/\s+/g,' ').toLowerCase();
  const hasChineseMeaning = word => text(word?.word) && /[\u3400-\u9fff]/.test(text(word?.meaning));
  const shuffle = values => {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const at = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[at]] = [copy[at], copy[i]];
    }
    return copy;
  };
  const fallbackEscape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());

  class StudyGame {
    constructor(options) {
      this.options = options || {};
      this.lessons = Array.isArray(this.options.lessons) ? this.options.lessons : [];
      this.escape = this.options.escapeHTML || fallbackEscape;
      this.icon = this.options.icon || (() => '');
      this.book = 1;
      this.session = null;
      this.questionPools = new Map();
      this.listener = event => {
        const button = event.target.closest && event.target.closest('[data-game-action]');
        if (!button) return;
        try {
          switch (button.dataset.gameAction) {
            case 'start': this.start(button.dataset.gameLesson); break;
            case 'answer': this.answer(Number(button.dataset.gameAnswer)); break;
            case 'next': this.next(); break;
            case 'retry': if (this.session) this.start(this.session.lesson.id); break;
            case 'retry-wrong': this.startWrongPractice(); break;
            case 'remedial-answer': this.answerRemediation(Number(button.dataset.gameMistake),Number(button.dataset.gameAnswer)); break;
            case 'practice-answer': this.answerWrongPractice(Number(button.dataset.gameAnswer)); break;
            case 'practice-next': this.nextWrongPractice(); break;
            case 'back-result': this.backToResult(); break;
            case 'knowledge': this.studyKnowledge(Number(button.dataset.gameMistake)); break;
            case 'study': this.session = null; this.options.closeDialog?.(); break;
            case 'close': this.session = null; this.options.closeDialog?.(); break;
          }
        } catch (error) {
          this.options.toast?.(error.message || '挑战暂时无法继续，请重新打开本关。');
        }
      };
      document.addEventListener('click', this.listener);
    }

    data() {
      const data = this.options.getData();
      data.xp = numeric(data.xp);
      if (!data.levels || typeof data.levels !== 'object') data.levels = {};
      if (!data.daily || typeof data.daily !== 'object') data.daily = {};
      return data;
    }

    minimumQuestionCount(lesson) { return global.StudyKnowledge?.bank?.hasLesson(lesson.id)?3:5; }

    passMark(count=this.session?.questions.length||5) { return Math.ceil(count*0.8); }

    bookLessons(book) {
      const bank=global.StudyKnowledge?.bank;
      const available = this.lessons.filter(lesson => Number(lesson.book) === Number(book) && (lesson.source === 'provided' || !lesson.source)).sort((a,b) => a.number - b.number).filter(lesson => bank?.hasLesson(lesson.id)||this.questions(lesson).length === 5);
      return Number(book) === 2 ? available : available.slice(0,8);
    }

    day(create) {
      const data = this.data(), key = today();
      if (!data.daily[key] && create) data.daily[key] = {attempts:0, completed:0, correct:0, answered:0, vocabularyCorrect:0, vocabularyAnswered:0, passedLevels:[], replayRewards:{}};
      return data.daily[key] || {attempts:0, completed:0, correct:0, answered:0, vocabularyCorrect:0, vocabularyAnswered:0, passedLevels:[], replayRewards:{}};
    }

    render(book) {
      this.book = Math.min(4, Math.max(1, Number(book) || 1));
      const data = this.data(), lessons = this.bookLessons(this.book), day = this.day(false), e = this.escape;
      const passed = lessons.filter(lesson => data.levels[lesson.id]?.passed).length;
      const level = Math.floor(data.xp / 200) + 1;
      const vocabBadge = numeric(day.vocabularyCorrect) >= 5;
      const bookBadge = lessons.length > 0 && passed === lessons.length && lessons.every(lesson=>this.questions(lesson).length>0);
      const adaptive=lessons.some(lesson=>global.StudyKnowledge?.bank?.hasLesson(lesson.id));
      const nodes = lessons.map((lesson,index) => {
        const record = data.levels[lesson.id] || {};
        const count=this.questions(lesson).length,ready=count>0,confirmed=this.questionPools.get(lesson)?.length||0,needed=this.passMark(count),minimum=this.minimumQuestionCount(lesson);
        const locked = !ready || !record.passed && index > 0 && !data.levels[lessons[index-1].id]?.passed;
        const current = !locked && !record.passed;
        const requirement=ready?`${count} 题 · 答对 ${needed} 题通关`:'';
        return `<button type="button" class="game-node ${!ready?'pending locked':locked?'locked':record.passed?'passed':current?'current':''}" data-game-action="start" data-game-lesson="${e(lesson.id)}" aria-label="第${index+1}关 ${e(lesson.title)}，${!ready?'题库复核中':locked?'尚未解锁':record.passed?'已通关':'可挑战'}${ready?'，'+requirement:''}" ${locked?'aria-disabled="true"':''}><span class="game-node-orb">${record.passed?this.icon('check'):locked?'🔒':String(index+1).padStart(2,'0')}</span><span class="game-node-title">${e(lesson.title)}</span><span class="game-node-subtitle">${!ready?`题库复核中 · 已确认 ${confirmed} 个，至少 ${minimum} 个开放`:locked?`通过上一关解锁 · ${requirement}`:record.passed?`最佳 ${numeric(record.best)} / ${numeric(record.bestTotal)||5} · 本关 ${requirement}`:`本课知识 · ${requirement}`}</span><span class="game-stars" aria-label="${numeric(record.stars)}星">${[1,2,3].map(star=>`<span class="${numeric(record.stars)>=star?'earned':''}">${numeric(record.stars)>=star?'★':'☆'}</span>`).join('')}</span></button>`;
      }).join('');
      return `<section class="game-header"><div><p class="eyebrow">LEARNING QUEST · 第 ${this.book} 册</p><h2>把学会的，变成闯过的关</h2><p>${adaptive?'每关 3–5 个已确认的独立知识点，答对至少 80%（向上取整）通关。节点标明题数与所需正确数。':'每关 5 题，答对 4 题通关。一步一步，点亮你的英语地图。'}</p></div><div class="game-stat"><strong>Lv.${level}</strong><span>${data.xp} XP · 距下一级 ${200-data.xp%200} XP</span></div></section><div class="game-stats"><div class="game-stat"><strong>${passed} / ${lessons.length}</strong><span>本册已通关</span></div><div class="game-stat"><strong>${numeric(day.completed)}</strong><span>今日通关关卡 · 不重复计数</span></div><div class="game-stat"><strong>${numeric(day.correct)}</strong><span>今日答对题目</span></div></div><div class="game-daily"><h3>今天的小目标</h3><p class="${numeric(day.completed)>=1?'completed':''}">${numeric(day.completed)>=1?'✓':'○'} 通关 1 关 <small>${Math.min(1,numeric(day.completed))} / 1</small></p><p class="${vocabBadge?'completed':''}">${vocabBadge?'✓':'○'} 答对 5 道词汇题 <small>${Math.min(5,numeric(day.vocabularyCorrect))} / 5</small></p></div><div class="game-badges"><span class="game-badge ${vocabBadge?'earned':''}">✦ 词汇星章 · ${vocabBadge?'今日已获得':'今日答对5道词汇题解锁'}</span><span class="game-badge ${bookBadge?'earned':''}">${this.icon('star')} 第${this.book}册探索徽章 · ${bookBadge?'已获得':lessons.length?`通关本册${lessons.length}关解锁`:'本册关卡开放后解锁'}</span></div><div class="game-map">${nodes||'<div class="text-empty">本册资料尚未接入。补齐真实教材资料后再开放闯关。</div>'}</div><p class="game-rule">挑战规则：${adaptive?'每关使用 3–5 个本课已确认的独立知识点，不重复凑题；达到 80%（向上取整）且未满分得两星，全部答对得三星。':'每关从本课题库和已有中文词义中选取 5 题，答对 4 题得两星，全部答对得三星。'}词义补充题为自编配套训练（非教材原配练习）。首通奖励 50 + 实际正确题数 × 10 XP；再次通关每日本关最多获得 10 XP。关卡解锁仅用于闯关，课文可以自由学习。进度保存在当前浏览器。</p>`;
    }

    questionPool(lesson) {
      const bank=global.StudyKnowledge?.bank;
      if(bank?.hasLesson(lesson.id)){const seen=new Set();return bank.questionsForLesson(lesson.id).filter(q=>{const skill=q.gameConceptId||q.conceptId;if(!q.graded||!skill||seen.has(skill))return false;seen.add(skill);return true;});}
      const base = (lesson.quiz || []).filter(question => text(question?.question) && Array.isArray(question.options) && question.options.length >= 2 && question.options.every(option=>text(option)) && new Set(question.options.map(normalized)).size===question.options.length && Number.isInteger(question.answer) && question.answer>=0 && question.answer<question.options.length).map(question => ({...question, options:question.options.slice(), type:question.type === 'vocabulary'?'vocabulary':'grammar'}));
      const seenWords = new Set();
      const vocabulary = (lesson.vocabulary || []).filter(word=>{if(!hasChineseMeaning(word)||seenWords.has(normalized(word.word)))return false;seenWords.add(normalized(word.word));return true;});
      const meaningBank = this.lessons.filter(item=>Number(item.book)===Number(lesson.book)).flatMap(item=>item.vocabulary || []).filter(hasChineseMeaning);
      const wordQuestions = vocabulary.map(word => {
        const meaning = text(word.meaning), seenMeanings = new Set([normalized(meaning)]);
        const acceptedMeanings = new Set(meaningBank.filter(item=>normalized(item.word)===normalized(word.word)).map(item=>normalized(item.meaning)));
        const wrong = meaningBank.filter(item=>!acceptedMeanings.has(normalized(item.meaning))).map(item=>text(item.meaning)).filter(value=>{const key=normalized(value);if(seenMeanings.has(key))return false;seenMeanings.add(key);return true;});
        const options = shuffle([meaning,...shuffle(wrong).slice(0,3)]);
        return {type:'vocabulary', question:`“${text(word.word)}” 在本课中是什么意思？`, options, answer:options.indexOf(meaning), explanation:`${text(word.word)}：${meaning}。${word.example || ''}`,sourceWord:word.word,sourceLessonId:lesson.id,sourceType:'self-authored-companion-practice',sourceLabel:'自编配套训练（非教材原配练习）'};
      }).filter(question=>question.options.length>=2);
      const seenQuestions = new Set();
      return base.concat(wordQuestions).filter(question=>{const key=normalized(question.question);if(seenQuestions.has(key))return false;seenQuestions.add(key);return true;});
    }

    questions(lesson) {
      const bank=global.StudyKnowledge?.bank;if(this.knowledgeBank!==bank){this.knowledgeBank=bank;this.questionPools.clear();}
      if (!this.questionPools.has(lesson)) this.questionPools.set(lesson,this.questionPool(lesson));
      const pool = this.questionPools.get(lesson), grammar = pool.find(question=>question.type==='grammar');
      if (pool.length < this.minimumQuestionCount(lesson)) return [];
      const count=Math.min(5,pool.length);
      return grammar?shuffle([grammar,...shuffle(pool.filter(question=>question!==grammar)).slice(0,count-1)]):shuffle(pool).slice(0,count);
    }

    start(id) {
      const lesson = this.lessons.find(item=>item.id===id);
      if (!lesson) return;
      const levels = this.bookLessons(lesson.book), index = levels.findIndex(item=>item.id===id), data = this.data();
      if (index < 0) return;
      const questions = this.questions(lesson);
      if (questions.length < this.minimumQuestionCount(lesson)) { this.options.toast?.('本关题库复核中，已确认 '+(this.questionPools.get(lesson)?.length||0)+' 个独立知识点，至少 '+this.minimumQuestionCount(lesson)+' 个才开放挑战。'); return; }
      if (!data.levels[id]?.passed && index > 0 && !data.levels[levels[index-1].id]?.passed) { this.options.toast?.('先通过上一关，就能解锁这里。课文仍然可以自由学习。'); return; }
      this.session = {lesson, questions, requiredCorrect:this.passMark(questions.length), index:0, answers:[], correct:0, wrong:0, finished:false, reward:0};
      this.options.openDialog(`第${lesson.book}册 · 第${index+1}关`,this.challengeHTML(),'');
    }

    isPilot(lesson=this.session?.lesson) {
      return !!lesson && Number(lesson.book)===2 && Number(lesson.number)>=1 && Number(lesson.number)<=10 && /(?:^|[?&])pilot=1(?:&|$)/.test(global.location?.search||'') && !!global.StudyKnowledge?.bank?.hasLesson(lesson.id) && typeof global.StudyRemediation?.describe==='function';
    }

    pilotFailure() { return !!this.session?.finished && this.session.correct<this.passMark() && this.isPilot(); }

    mistakes() {
      if(!this.pilotFailure())return [];
      const session=this.session,bank=global.StudyKnowledge.bank,seen=new Set(),result=[];
      session.questions.forEach((question,index)=>{
        if(!Object.hasOwn(session.answers,index)||session.answers[index]===question.answer||!question.conceptId||seen.has(question.conceptId)||!bank.get(question.conceptId))return;
        seen.add(question.conceptId);
        result.push({index,question,chosenIndex:session.answers[index],remediation:global.StudyRemediation.describe(question,session.answers[index],{bank,lesson:session.lesson})});
      });
      return result;
    }

    remediationDetailsHTML(remediation) {
      const e=this.escape;
      const examples=(remediation.contrastExamples||[]).map(example=>`<li><p lang="en">${e(example.en)}</p>${example.zh?`<p>${e(example.zh)}</p>`:''}<small>${e(example.sourceLabel)}</small></li>`).join('');
      return `${remediation.rule?`<p><strong>规则：</strong>${e(remediation.rule)}</p>`:''}<p><strong>为什么：</strong>${e(remediation.reason)}</p>${examples?`<div class="game-remediation-examples"><strong>对比例句</strong><ul>${examples}</ul></div>`:remediation.contrastMessage?`<p>${e(remediation.contrastMessage)}</p>`:''}`;
    }

    pilotQuestionFeedback(question,answer) {
      const e=this.escape,remediation=global.StudyRemediation.describe(question,answer,{bank:global.StudyKnowledge.bank,lesson:this.session.lesson}),correct=answer===question.answer;
      return `<div class="game-feedback ${correct?'correct':'incorrect'}" role="status"><strong>${correct?'✓ 答对了！':'✕ 答错了'}</strong><p>${correct?'✓ 你的答案':'✕ 你的答案'}：${e(question.options[answer])}</p><p>✓ 正确答案：${e(remediation.correctAnswer||'已确认答案暂不可用，请查看对应讲解。')}</p>${this.remediationDetailsHTML(remediation)}</div>`;
    }

    remedialQuestionHTML(mistake) {
      const question=mistake.remediation.followUp,e=this.escape;
      if(!question||question.graded!==false||question.countsTowardProgress!==false||question.conceptId!==mistake.question.conceptId)return `<p class="game-remediation-empty">${e(mistake.remediation.followUpMessage||'暂无已审核的同知识点新题。')}</p>`;
      const answers=this.session.remedialAnswers||{},answered=Object.hasOwn(answers,mistake.index),answer=answers[mistake.index],feedback=answered?global.StudyRemediation.describe(question,answer,{bank:global.StudyKnowledge.bank,lesson:this.session.lesson}):null;
      return `<section class="game-remediation-followup"><h5>再做一道同知识点新题</h5><p class="game-remediation-label">${e(question.sourceLabel)} · 补救练习，不计入本关成绩或 XP。</p><p class="game-remediation-question">${e(question.question)}</p><div class="game-options">${question.options.map((option,index)=>`<button type="button" class="game-option ${answered?(index===question.answer?'correct':index===answer?'incorrect':''):''}" data-game-action="remedial-answer" data-game-mistake="${mistake.index}" data-game-answer="${index}" ${answered?'disabled':''}><span>${String.fromCharCode(65+index)}</span>${e(option)}${answered&&index===question.answer?' · ✓ 正确答案':answered&&index===answer?' · ✕ 你的答案':''}</button>`).join('')}</div>${answered?`<div class="game-feedback ${feedback.isCorrect?'correct':'incorrect'}" role="status"><strong>${feedback.isCorrect?'✓ 答对了！':'✕ 答错了'}</strong><p>✓ 正确答案：${e(feedback.correctAnswer)}</p>${this.remediationDetailsHTML(feedback)}</div>`:''}</section>`;
    }

    answerRemediation(mistakeIndex,answer) {
      if(!this.pilotFailure()||this.session.practice)return;
      const mistake=this.mistakes().find(x=>x.index===mistakeIndex),question=mistake?.remediation.followUp;
      if(!question||question.graded!==false||question.countsTowardProgress!==false||question.conceptId!==mistake.question.conceptId||!Number.isInteger(answer)||answer<0||answer>=question.options.length||Object.hasOwn(this.session.remedialAnswers||{},mistakeIndex))return;
      if(!this.session.remedialAnswers)this.session.remedialAnswers={};
      this.session.remedialAnswers[mistakeIndex]=answer;
      this.paint();
    }

    startWrongPractice() {
      if(!this.pilotFailure())return;
      const mistakes=this.mistakes();if(!mistakes.length)return;
      this.session.practice={index:0,answers:[],complete:false,questions:mistakes.map(m=>{
        const followUp=m.remediation.followUp,usable=followUp?.graded===false&&followUp.countsTowardProgress===false&&followUp.conceptId===m.question.conceptId;
        return {index:m.index,question:usable?followUp:{...m.question,graded:false,countsTowardProgress:false,sourceLabel:'重做已确认的原错题 · 暂无可靠新题'},reusedOriginal:!usable};
      })};
      this.paint();
    }

    answerWrongPractice(answer) {
      const practice=this.session?.practice;
      if(!this.pilotFailure()||!practice||practice.complete||Object.hasOwn(practice.answers,practice.index))return;
      const question=practice.questions[practice.index].question;
      if(!Number.isInteger(answer)||answer<0||answer>=question.options.length)return;
      practice.answers[practice.index]=answer;this.paint();
    }

    nextWrongPractice() {
      const practice=this.session?.practice;
      if(!this.pilotFailure()||!practice||practice.complete||!Object.hasOwn(practice.answers,practice.index))return;
      if(practice.index<practice.questions.length-1)practice.index++;else practice.complete=true;
      this.paint();
    }

    backToResult() { if(!this.pilotFailure()||!this.session.practice)return;delete this.session.practice;this.paint(); }

    studyKnowledge(mistakeIndex) {
      const mistake=this.mistakes().find(x=>x.index===mistakeIndex);if(!mistake)return;
      if(typeof this.options.onStudyKnowledge!=='function'){this.options.toast?.('请打开本课知识讲解，复习这个知识点。');return;}
      const lessonId=mistake.remediation.sourceLesson?.id||this.session.lesson.id,conceptId=mistake.question.conceptId;
      this.session=null;this.options.closeDialog?.();this.options.onStudyKnowledge(lessonId,conceptId);
    }

    wrongPracticeHTML() {
      const session=this.session,practice=session.practice,e=this.escape;
      if(practice.complete){const correct=practice.questions.filter((item,index)=>item.question.answer===practice.answers[index]).length;return `<div class="game-result game-remediation-practice"><h3>✓ 错题练习完成</h3><p>本轮答对 ${correct} / ${practice.questions.length} 题。正式挑战成绩仍为 ${session.correct} / ${session.questions.length}；本练习不计 XP，不改变星级或关卡成绩。</p><div class="game-result-actions"><button type="button" class="button primary" data-game-action="back-result">返回错题订正</button><button type="button" class="button" data-game-action="retry-wrong">再练错题</button></div></div>`;}
      const item=practice.questions[practice.index],question=item.question,answered=Object.hasOwn(practice.answers,practice.index),answer=practice.answers[practice.index],feedback=answered?global.StudyRemediation.describe(question,answer,{bank:global.StudyKnowledge.bank,lesson:session.lesson}):null;
      return `<div class="game-challenge game-remediation-practice"><div class="game-progress"><span>错题补救练习 · 第 ${practice.index+1} / ${practice.questions.length} 题</span></div><p class="game-remediation-label">仅练本次答错的知识点，不计关卡分数或 XP。${item.reusedOriginal?'本题重做原错题，暂无可靠新题。':e(question.sourceLabel)}</p><h3 class="game-question">${e(question.question)}</h3><div class="game-options">${question.options.map((option,index)=>`<button type="button" class="game-option ${answered?(index===question.answer?'correct':index===answer?'incorrect':''):''}" data-game-action="practice-answer" data-game-answer="${index}" ${answered?'disabled':''}><span>${String.fromCharCode(65+index)}</span>${e(option)}${answered&&index===question.answer?' · ✓ 正确答案':answered&&index===answer?' · ✕ 你的答案':''}</button>`).join('')}</div>${answered?`<div class="game-feedback ${feedback.isCorrect?'correct':'incorrect'}" role="status"><strong>${feedback.isCorrect?'✓ 答对了！':'✕ 答错了'}</strong><p>你的答案：${e(question.options[answer])}</p><p>✓ 正确答案：${e(feedback.correctAnswer)}</p>${this.remediationDetailsHTML(feedback)}</div><button type="button" class="button primary game-next" data-game-action="practice-next">${practice.index===practice.questions.length-1?'完成错题练习':'下一道错题 →'}</button>`:''}<div class="game-result-actions"><button type="button" class="button" data-game-action="knowledge" data-game-mistake="${item.index}">查看对应讲解</button><button type="button" class="button subtle" data-game-action="back-result">返回错题订正</button></div></div>`;
    }

    pilotResultHTML() {
      const session=this.session,e=this.escape,mistakes=this.mistakes();
      const cards=mistakes.map(m=>`<article class="game-remediation-card"><h4>✕ 第 ${m.index+1} 题 · ${m.question.type==='grammar'?'语法运用':'词义巩固'}</h4><p class="game-remediation-question">${e(m.question.question)}</p><p class="game-remediation-wrong">✕ 你的答案：${e(m.question.options[m.chosenIndex])}</p><p class="game-remediation-correct">✓ 正确答案：${e(m.remediation.correctAnswer||'已确认答案暂不可用，请查看对应讲解。')}</p>${this.remediationDetailsHTML(m.remediation)}<button type="button" class="button" data-game-action="knowledge" data-game-mistake="${m.index}">查看对应讲解</button>${this.remedialQuestionHTML(m)}</article>`).join('');
      return `<div class="game-result game-remediation-result"><h3>✕ 本次未通关，先订正再挑战</h3><p>${e(session.lesson.title)}</p><strong class="game-score">${session.correct} / ${session.questions.length}</strong><p>本关 ${session.questions.length} 题，答对 ${this.passMark()} 题即可通关。本次答错 ${session.wrong} 题，下面按 ${mistakes.length} 个独立知识点订正。</p><p class="game-reward">本次未增加 XP</p><div class="game-result-actions"><button type="button" class="button primary" data-game-action="retry-wrong">只练错题</button><button type="button" class="button" data-game-action="retry">重新挑战整关</button><button type="button" class="button" data-game-action="study" data-lesson="${e(session.lesson.id)}">学习本课</button><button type="button" class="button subtle" data-game-action="close">返回关卡地图</button></div><div class="game-remediation-list">${cards}</div></div>`;
    }

    challengeHTML() {
      const session = this.session;
      if (!session) return '';
      if (session.finished) return session.practice&&this.pilotFailure()?this.wrongPracticeHTML():this.resultHTML();
      const question = session.questions[session.index], answered = Object.hasOwn(session.answers,session.index), answer = session.answers[session.index], e = this.escape,total=session.questions.length;
      const feedback=answered?(this.isPilot()?this.pilotQuestionFeedback(question,answer):`<div class="game-feedback ${answer===question.answer?'correct':'incorrect'}" role="status"><strong>${answer===question.answer?'✓ 答对了！':'再记住这个知识点'}</strong><p>${answer===question.answer?'':`正确答案：${e(question.options[question.answer])}。`}${e(question.explanation || '')}</p></div>`)+`<button type="button" class="button primary game-next" data-game-action="next">${session.index===total-1?'查看挑战结果':'下一题 →'}</button>`:'<p class="game-rule">选择后立即显示解析；每题只能作答一次。</p>';
      return `<div class="game-challenge"><div class="game-progress"><span>第 ${session.index+1} / ${total} 题 · 需答对 ${this.passMark(total)} 题 · ${question.type==='grammar'?'语法运用':'词汇巩固'}</span><span class="game-hearts" aria-label="剩余 ${total-session.wrong} 颗心">${Array.from({length:total},(_,i)=>`<span class="${i<total-session.wrong?'active':'lost'}">${i<total-session.wrong?'♥':'♡'}</span>`).join('')}</span></div><p class="game-node-subtitle">${e(session.lesson.title)}${question.sourceLabel?'<br>'+e(question.sourceLabel):''}</p><h3 class="game-question">${e(question.question)}</h3><div class="game-options">${question.options.map((option,index)=>`<button type="button" class="game-option ${answered?(index===question.answer?'correct':index===answer?'incorrect':''):''} ${answer===index?'selected':''}" data-game-action="answer" data-game-answer="${index}" ${answered?'disabled':''}><span>${String.fromCharCode(65+index)}</span>${e(option)}</button>`).join('')}</div>${feedback}</div>`;
    }

    paint() {
      const body = document.querySelector('.dialog-body');
      if (body) body.innerHTML = this.challengeHTML();
    }

    answer(index) {
      const session = this.session;
      if (!session || session.finished || Object.hasOwn(session.answers,session.index)) return;
      const question = session.questions[session.index];
      if (!Number.isInteger(index) || index<0 || index>=question.options.length) return;
      session.answers[session.index] = index;
      if (index===question.answer) session.correct++; else session.wrong++;
      this.paint();
    }

    next() {
      const session = this.session;
      if (!session || session.finished || !Object.hasOwn(session.answers,session.index)) return;
      if (session.index<session.questions.length-1) { session.index++; this.paint(); return; }
      this.finish();
    }

    finish() {
      const session = this.session;
      if (!session || session.finished || session.answers.length !== session.questions.length || !session.questions.every((_,i)=>Object.hasOwn(session.answers,i))) return;
      session.finished = true;
      const total=session.questions.length,data = this.data(), old = data.levels[session.lesson.id] || {}, passed = session.correct>=this.passMark(total), stars = session.correct===total?3:passed?2:0, day = this.day(true);
      if (!Array.isArray(day.passedLevels)) day.passedLevels = [];
      if (!day.replayRewards || typeof day.replayRewards !== 'object') day.replayRewards = {};
      if (passed && !old.passed) session.reward = 50 + session.correct * 10;
      else if (passed && !day.replayRewards[session.lesson.id]) { session.reward = 10; day.replayRewards[session.lesson.id] = true; }
      data.xp += session.reward;
      const oldBest=numeric(old.best),oldBestTotal=numeric(old.bestTotal)||5,newBest=!Object.hasOwn(old,'best')||session.correct>oldBest||session.correct===oldBest&&session.correct/total>=oldBest/oldBestTotal;
      data.levels[session.lesson.id] = {passed:!!old.passed || passed, stars:Math.max(numeric(old.stars),stars), best:Math.max(oldBest,session.correct),bestTotal:newBest?total:oldBestTotal,lastTotal:total, attempts:numeric(old.attempts)+1, lastAt:Date.now()};
      day.attempts = numeric(day.attempts)+1;
      day.correct = numeric(day.correct)+session.correct;
      day.answered = numeric(day.answered)+total;
      day.vocabularyAnswered = numeric(day.vocabularyAnswered)+session.questions.filter(question=>question.type==='vocabulary').length;
      day.vocabularyCorrect = numeric(day.vocabularyCorrect)+session.questions.filter((question,index)=>question.type==='vocabulary' && question.answer===session.answers[index]).length;
      if (passed && !day.passedLevels.includes(session.lesson.id)) day.passedLevels.push(session.lesson.id);
      day.completed = day.passedLevels.length;
      try {
        if (this.options.save()===false) this.options.toast?.('本次进度尚未保存，请检查浏览器存储空间。');
      } catch (_) { this.options.toast?.('本次进度尚未保存，请检查浏览器存储空间。'); }
      this.options.onChange?.();
      this.paint();
    }

    resultHTML() {
      const session = this.session,total=session.questions.length,needed=this.passMark(total), passed = session.correct>=needed, stars = session.correct===total?3:passed?2:0, e = this.escape;
      if(this.pilotFailure())return this.pilotResultHTML();
      return `<div class="game-result"><div class="game-result-icon">${this.icon(passed?'star':'notebook')}</div><h3>${passed?'挑战成功！':'差一点，再来一次'}</h3><p>${e(session.lesson.title)}</p><div class="game-stars">${[1,2,3].map(star=>`<span class="${star<=stars?'earned':''}">${star<=stars?'★':'☆'}</span>`).join('')}</div><strong class="game-score">${session.correct} / ${total}</strong><p>本关 ${total} 题，答对 ${needed} 题即可通关。${passed?'新知识又牢固了一点。':'回顾课文后再挑战。'}</p><p class="game-reward">${session.reward?`+${session.reward} XP`:'本次未增加 XP'}${passed&&!session.reward?' · 今日重玩奖励已领取':''}</p><div class="game-result-actions"><button type="button" class="button primary" data-game-action="retry">再挑战一次</button><button type="button" class="button" data-game-action="study" data-lesson="${e(session.lesson.id)}">学习本课</button><button type="button" class="button subtle" data-game-action="close">返回关卡地图</button></div></div>`;
    }

    destroy() { document.removeEventListener('click',this.listener); this.session = null; }
  }

  global.StudyGame = StudyGame;
})(window);
