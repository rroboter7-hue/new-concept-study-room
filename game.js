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

    bookLessons(book) {
      const available = this.lessons.filter(lesson => Number(lesson.book) === Number(book) && (lesson.source === 'provided' || !lesson.source)).sort((a,b) => a.number - b.number).filter(lesson => this.questions(lesson).length === 5);
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
      const bookBadge = lessons.length > 0 && passed === lessons.length;
      const nodes = lessons.map((lesson,index) => {
        const record = data.levels[lesson.id] || {};
        const locked = !record.passed && index > 0 && !data.levels[lessons[index-1].id]?.passed;
        const current = !locked && !record.passed;
        return `<button type="button" class="game-node ${locked?'locked':record.passed?'passed':current?'current':''}" data-game-action="start" data-game-lesson="${e(lesson.id)}" aria-label="第${index+1}关 ${e(lesson.title)}，${locked?'尚未解锁':record.passed?'已通关':'可挑战'}" ${locked?'aria-disabled="true"':''}><span class="game-node-orb">${record.passed?this.icon('check'):locked?'🔒':String(index+1).padStart(2,'0')}</span><span class="game-node-title">${e(lesson.title)}</span><span class="game-node-subtitle">${locked?'通过上一关解锁':record.passed?`最佳 ${numeric(record.best)} / 5`:'本课知识 · 5 题'}</span><span class="game-stars" aria-label="${numeric(record.stars)}星">${[1,2,3].map(star=>`<span class="${numeric(record.stars)>=star?'earned':''}">${numeric(record.stars)>=star?'★':'☆'}</span>`).join('')}</span></button>`;
      }).join('');
      return `<section class="game-header"><div><p class="eyebrow">LEARNING QUEST · 第 ${this.book} 册</p><h2>把学会的，变成闯过的关</h2><p>每关 5 题，答对 4 题通关。一步一步，点亮你的英语地图。</p></div><div class="game-stat"><strong>Lv.${level}</strong><span>${data.xp} XP · 距下一级 ${200-data.xp%200} XP</span></div></section><div class="game-stats"><div class="game-stat"><strong>${passed} / ${lessons.length}</strong><span>本册已通关</span></div><div class="game-stat"><strong>${numeric(day.completed)}</strong><span>今日通关关卡 · 不重复计数</span></div><div class="game-stat"><strong>${numeric(day.correct)}</strong><span>今日答对题目</span></div></div><div class="game-daily"><h3>今天的小目标</h3><p class="${numeric(day.completed)>=1?'completed':''}">${numeric(day.completed)>=1?'✓':'○'} 通关 1 关 <small>${Math.min(1,numeric(day.completed))} / 1</small></p><p class="${vocabBadge?'completed':''}">${vocabBadge?'✓':'○'} 答对 5 道词汇题 <small>${Math.min(5,numeric(day.vocabularyCorrect))} / 5</small></p></div><div class="game-badges"><span class="game-badge ${vocabBadge?'earned':''}">✦ 词汇星章 · ${vocabBadge?'今日已获得':'今日答对5道词汇题解锁'}</span><span class="game-badge ${bookBadge?'earned':''}">${this.icon('star')} 第${this.book}册探索徽章 · ${bookBadge?'已获得':lessons.length?`通关本册${lessons.length}关解锁`:'本册关卡开放后解锁'}</span></div><div class="game-map">${nodes||'<div class="text-empty">本册资料尚未接入。补齐真实教材资料后再开放闯关。</div>'}</div><p class="game-rule">挑战规则：每关从本课题库和已有中文词义中选取 5 题，词义补充题为自编配套训练（非教材原配练习）。答对 4 题得两星，全部答对得三星。首通奖励 50 + 正确题数 × 10 XP；再次通关每日本关最多获得 10 XP。关卡解锁仅用于闯关，课文可以自由学习。进度保存在当前浏览器。</p>`;
    }

    questionPool(lesson) {
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
      if (!this.questionPools.has(lesson)) this.questionPools.set(lesson,this.questionPool(lesson));
      const pool = this.questionPools.get(lesson), grammar = pool.find(question=>question.type==='grammar');
      if (pool.length < 5) return [];
      return grammar?shuffle([grammar,...shuffle(pool.filter(question=>question!==grammar)).slice(0,4)]):shuffle(pool).slice(0,5);
    }

    start(id) {
      const lesson = this.lessons.find(item=>item.id===id);
      if (!lesson) return;
      const levels = this.bookLessons(lesson.book), index = levels.findIndex(item=>item.id===id), data = this.data();
      if (index < 0) return;
      if (!data.levels[id]?.passed && index > 0 && !data.levels[levels[index-1].id]?.passed) { this.options.toast?.('先通过上一关，就能解锁这里。课文仍然可以自由学习。'); return; }
      const questions = this.questions(lesson);
      if (questions.length !== 5) { this.options.toast?.('本关题库还在准备中，请先学习课文。'); return; }
      this.session = {lesson, questions, index:0, answers:[], correct:0, wrong:0, finished:false, reward:0};
      this.options.openDialog(`第${lesson.book}册 · 第${index+1}关`,this.challengeHTML(),'');
    }

    challengeHTML() {
      const session = this.session;
      if (!session) return '';
      if (session.finished) return this.resultHTML();
      const question = session.questions[session.index], answered = Object.hasOwn(session.answers,session.index), answer = session.answers[session.index], e = this.escape;
      return `<div class="game-challenge"><div class="game-progress"><span>第 ${session.index+1} / 5 题 · ${question.type==='grammar'?'语法运用':'词汇巩固'}</span><span class="game-hearts" aria-label="剩余 ${5-session.wrong} 颗心">${Array.from({length:5},(_,i)=>`<span class="${i<5-session.wrong?'active':'lost'}">${i<5-session.wrong?'♥':'♡'}</span>`).join('')}</span></div><p class="game-node-subtitle">${e(session.lesson.title)}${question.sourceLabel?'<br>'+e(question.sourceLabel):''}</p><h3 class="game-question">${e(question.question)}</h3><div class="game-options">${question.options.map((option,index)=>`<button type="button" class="game-option ${answered?(index===question.answer?'correct':index===answer?'incorrect':''):''} ${answer===index?'selected':''}" data-game-action="answer" data-game-answer="${index}" ${answered?'disabled':''}><span>${String.fromCharCode(65+index)}</span>${e(option)}</button>`).join('')}</div>${answered?`<div class="game-feedback ${answer===question.answer?'correct':'incorrect'}" role="status"><strong>${answer===question.answer?'✓ 答对了！':'再记住这个知识点'}</strong><p>${answer===question.answer?'':`正确答案：${e(question.options[question.answer])}。`}${e(question.explanation || '')}</p></div><button type="button" class="button primary game-next" data-game-action="next">${session.index===4?'查看挑战结果':'下一题 →'}</button>`:'<p class="game-rule">选择后立即显示解析；每题只能作答一次。</p>'}</div>`;
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
      if (session.index<4) { session.index++; this.paint(); return; }
      this.finish();
    }

    finish() {
      const session = this.session;
      if (!session || session.finished || session.answers.length !== 5) return;
      session.finished = true;
      const data = this.data(), old = data.levels[session.lesson.id] || {}, passed = session.correct>=4, stars = session.correct===5?3:passed?2:0, day = this.day(true);
      if (!Array.isArray(day.passedLevels)) day.passedLevels = [];
      if (!day.replayRewards || typeof day.replayRewards !== 'object') day.replayRewards = {};
      if (passed && !old.passed) session.reward = 50 + session.correct * 10;
      else if (passed && !day.replayRewards[session.lesson.id]) { session.reward = 10; day.replayRewards[session.lesson.id] = true; }
      data.xp += session.reward;
      data.levels[session.lesson.id] = {passed:!!old.passed || passed, stars:Math.max(numeric(old.stars),stars), best:Math.max(numeric(old.best),session.correct), attempts:numeric(old.attempts)+1, lastAt:Date.now()};
      day.attempts = numeric(day.attempts)+1;
      day.correct = numeric(day.correct)+session.correct;
      day.answered = numeric(day.answered)+5;
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
      const session = this.session, passed = session.correct>=4, stars = session.correct===5?3:passed?2:0, e = this.escape;
      return `<div class="game-result"><div class="game-result-icon">${this.icon(passed?'star':'notebook')}</div><h3>${passed?'挑战成功！':'差一点，再来一次'}</h3><p>${e(session.lesson.title)}</p><div class="game-stars">${[1,2,3].map(star=>`<span class="${star<=stars?'earned':''}">${star<=stars?'★':'☆'}</span>`).join('')}</div><strong class="game-score">${session.correct} / 5</strong><p>${passed?'新知识又牢固了一点。':'答对4题即可通关，回顾课文后再挑战。'}</p><p class="game-reward">${session.reward?`+${session.reward} XP`:'本次未增加 XP'}${passed&&!session.reward?' · 今日重玩奖励已领取':''}</p><div class="game-result-actions"><button type="button" class="button primary" data-game-action="retry">再挑战一次</button><button type="button" class="button" data-game-action="study" data-lesson="${e(session.lesson.id)}">学习本课</button><button type="button" class="button subtle" data-game-action="close">返回关卡地图</button></div></div>`;
    }

    destroy() { document.removeEventListener('click',this.listener); this.session = null; }
  }

  global.StudyGame = StudyGame;
})(window);
