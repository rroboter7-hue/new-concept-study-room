/* A container-scoped learning flow. Existing scores and source lessons are untouched. */
(function(root,factory){
  'use strict';
  const node=typeof module==='object'&&module.exports;
  const api=factory(root,node?require('./learning-pipeline-core.js'):root.StudyLearningPipeline,node?require('./free-writing-practice.js'):root.FreeWritingPractice);
  if(node)module.exports=api;else root.LearningPipeline=api;
})(typeof window!=='undefined'?window:globalThis,function(global,defaultCore,Writing){
  'use strict';
  const STAGES=['读课文','选择题','自由造句','复盘','重点'];
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const list=value=>Array.isArray(value)?value:[];
  const text=value=>typeof value==='string'?value:'';
  class LearningPipeline{
    constructor(options={}){
      this.options=options;this.core=options.core||defaultCore;this.e=options.escapeHTML||escape;
      if(!this.core)throw Error('StudyLearningPipeline is required');
      this.lesson=options.getLesson?.()||null;this.container=null;this.handlers=null;this.pending=[];this.lastSaved={};
      this.savePromise=null;this.saveTimer=null;this.status='idle';this.checking=false;this.writing=null;this.readingMounted=false;this.restoreTimer=null;this.destroyed=false;
      this.window=options.window||(typeof global.addEventListener==='function'?global:null);
    }
    baseState(){return this.core.sanitize(this.options.getState?.()||this.lastSaved);}
    state(){let state=this.baseState();for(const operation of this.pending)state=operation.apply(state)||state;return this.core.sanitize(state);}
    record(){const id=this.lesson?.id;if(!id)return {};return this.state().lessons[id]||this.core.sanitize({lessons:{[id]:{}}}).lessons[id];}
    ensureRecord(state,id){if(!state.lessons[id])state.lessons[id]=this.core.sanitize({lessons:{[id]:{}}}).lessons[id];return state.lessons[id];}
    queue(apply,key){
      if(key)this.pending=this.pending.filter(operation=>operation.key!==key);
      this.pending.push({apply,key});this.status='dirty';this.updateStatus();
      if(this.saveTimer!==null)clearTimeout(this.saveTimer);
      this.saveTimer=setTimeout(()=>{this.saveTimer=null;void this.flush();},this.options.saveDelay??300);this.saveTimer?.unref?.();
    }
    saveMessage(){return this.status==='error'?'保存失败，输入仍保留在本页；请重试，保存成功前不要关闭。':this.status==='saving'?'正在保存…':this.pending.length?'草稿待保存…':this.status==='saved'?'进度已保存':'进度与草稿会自动保存';}
    updateStatus(){
      const node=this.container?.querySelector?.('[data-pipeline-save-status]');if(node){node.textContent=this.saveMessage();node.dataset.state=this.status;}
      const retry=this.container?.querySelector?.('[data-pipeline-action="save"]');if(retry)retry.hidden=this.status!=='error';
      this.options.onStatus?.({status:this.status,message:this.saveMessage()});
    }
    flush(){
      if(this.saveTimer!==null){clearTimeout(this.saveTimer);this.saveTimer=null;}
      if(this.savePromise)return this.savePromise;
      this.savePromise=(async()=>{
        if(this.writing&&await this.writing.flush()!==true){this.status='error';this.updateStatus();return false;}
        while(this.pending.length){
          const operations=this.pending.slice(),next=this.baseState();let snapshot=next;
          for(const operation of operations)snapshot=operation.apply(snapshot)||snapshot;
          snapshot=this.core.sanitize(snapshot);this.status='saving';this.updateStatus();
          try{
            if(typeof this.options.saveState!=='function'||await this.options.saveState(snapshot)!==true)throw Error('State storage did not confirm saving');
            this.lastSaved=snapshot;
            const saved=new Set(operations);this.pending=this.pending.filter(operation=>!saved.has(operation));
            this.status=this.pending.length?'dirty':'saved';this.updateStatus();
          }catch(_){this.status='error';this.updateStatus();return false;}
        }
        return true;
      })().finally(()=>{this.savePromise=null;});
      return this.savePromise;
    }
    async setLesson(lesson,options={resume:true}){
      if(!lesson||typeof lesson.id!=='string')return false;
      if(!await this.flush())return false;
      this.detachStage();this.lesson=lesson;const id=lesson.id;
      this.queue(state=>{const record=this.ensureRecord(state,id);state.activeLessonId=id;if(options.resume===false)record.stage=0;return state;},'active-lesson');
      if(this.record().stage===1)this.prepareQuiz(false);
      const saved=await this.flush();this.refresh();return saved;
    }
    prepareQuiz(force){
      if(!this.lesson)return;
      const id=this.lesson.id,record=this.record();
      if(!force&&(record.quiz.planned===true||record.quiz.questions.length))return;
      const round=force?(record.round||0)+1:record.round||0;
      const plan=this.core.planQuiz({lesson:this.lesson,lessons:this.options.getLessons?.()||[],records:this.options.getRecords?.()||{},round,questionsForLesson:this.options.questionsForLesson,count:10});
      this.queue(state=>{const record=this.ensureRecord(state,id);if(!force&&(record.quiz.planned===true||record.quiz.questions.length))return state;record.round=round;record.quiz={questions:plan.questions,answers:{},index:0,submitted:false,checked:{},results:{},planned:true,plan};return state;},'quiz-plan:'+id);
    }
    async goStage(stage){
      if(!this.lesson||!Number.isInteger(stage)||stage<0||stage>4)return false;
      this.captureScroll();if(!await this.flush())return false;
      const id=this.lesson.id;
      this.queue(state=>{this.ensureRecord(state,id).stage=stage;state.activeLessonId=id;return state;},'stage:'+id);
      if(stage===1)this.prepareQuiz(false);
      if(!await this.flush())return false;
      this.refresh();this.options.onRoute?.({lessonId:id,stage});return true;
    }
    question(){const quiz=this.record().quiz;return quiz?.questions[Math.min(quiz.index,Math.max(0,quiz.questions.length-1))]||null;}
    quizSnapshot(state=this.state()){
      const record=state.lessons[this.lesson?.id],quiz=record?.quiz;
      if(record?.stage!==1||!quiz)return null;
      const question=quiz.questions[Math.min(quiz.index,Math.max(0,quiz.questions.length-1))];if(!question)return null;
      return {lessonId:this.lesson.id,questionId:question.id,round:record.round||0,signature:JSON.stringify([question.question||question.prompt,question.options,question.answer])};
    }
    matchesQuiz(expected,state=this.state()){
      const latest=this.quizSnapshot(state);
      return !!expected&&!!latest&&expected.lessonId===latest.lessonId&&expected.questionId===latest.questionId&&Number(expected.round)===latest.round&&(expected.signature===undefined||expected.signature===latest.signature);
    }
    guardQuiz(expected=this.visibleQuiz){
      if(this.matchesQuiz(expected))return {...expected};
      this.refresh();this.options.toast?.('题目已在其他页面更新，已显示最新题目；请重新选择或检查。');return null;
    }
    chooseAnswer(index,expected){
      const snapshot=this.guardQuiz(expected);if(!snapshot)return false;
      const question=this.question(),record=this.record();if(!question||record.quiz.submitted||!Number.isInteger(index)||index<0||index>=question.options.length)return false;
      const id=this.lesson.id,qid=question.id;this.queue(state=>{if(!this.matchesQuiz(snapshot,state)||state.lessons[id].quiz.submitted)return state;this.ensureRecord(state,id).quiz.answers[qid]=index;return state;},'answer:'+id+':'+qid);this.refresh();return true;
    }
    async checkAnswer(expected){
      const snapshot=this.guardQuiz(expected);if(!snapshot)return false;
      const question=this.question(),record=this.record(),answer=record.quiz?.answers[question?.id];
      if(!question||record.quiz.submitted||this.checking)return false;
      if(!Number.isInteger(answer)){this.options.toast?.('先选择一个答案，再检查。');return false;}
      this.checking=true;const id=this.lesson.id,now=Date.now();
      this.queue(state=>{if(!this.matchesQuiz(snapshot,state)||state.lessons[id].quiz.submitted)return state;const result=this.core.captureAttempt(state,{lessonId:id,question,answerIndex:answer,now});if(!result.accepted)return state;const quiz=result.state.lessons[id].quiz;quiz.submitted=true;quiz.checked={...quiz.checked,[question.id]:true};return result.state;});
      this.refresh();try{return await this.flush();}finally{this.checking=false;}
    }
    async retryQuestion(expected){
      const snapshot=this.guardQuiz(expected);if(!snapshot)return false;
      const question=this.question();if(!question)return false;const id=this.lesson.id;
      this.queue(state=>{if(!this.matchesQuiz(snapshot,state))return state;const quiz=this.ensureRecord(state,id).quiz;quiz.submitted=false;quiz.checked={...quiz.checked,[question.id]:false};return state;});
      const saved=await this.flush();this.refresh();return saved;
    }
    async nextQuestion(expected){
      const snapshot=this.guardQuiz(expected);if(!snapshot)return false;
      const record=this.record();if(!record.quiz.submitted)return false;
      const id=this.lesson.id;
      this.captureScroll();
      this.queue(state=>{if(!this.matchesQuiz(snapshot,state))return state;const row=this.ensureRecord(state,id),quiz=row.quiz;if(!quiz.submitted)return state;if(quiz.index>=quiz.questions.length-1){row.stage=2;return state;}quiz.index=Math.min(quiz.index+1,quiz.questions.length-1);quiz.submitted=quiz.checked?.[quiz.questions[quiz.index]?.id]===true;return state;});
      const saved=await this.flush();this.refresh();return saved;
    }
    async newQuizRound(){
      if(!await this.flush())return false;this.prepareQuiz(true);const saved=await this.flush();this.refresh();return saved;
    }
    setRecapText(value){
      if(!this.lesson)return;const id=this.lesson.id,content=text(value);
      this.queue(state=>{const record=this.ensureRecord(state,id);record.recapText=content;record.reflection={...record.reflection,notes:content};return state;},'recap:'+id);
    }
    captureScroll(){
      if(!this.container||!this.lesson)return;const id=this.lesson.id,stage=this.visibleStage??this.record().stage;
      const position={windowY:Number(this.window?.scrollY)||0,containerY:Number(this.container.scrollTop)||0};
      this.queue(state=>{const record=this.ensureRecord(state,id);record.scrollPositions={...record.scrollPositions,[stage]:position};return state;},'scroll:'+id+':'+stage);
    }
    restoreScroll(){
      if(this.restoreTimer!==null)clearTimeout(this.restoreTimer);
      const position=this.record().scrollPositions?.[this.record().stage]||{windowY:0,containerY:0};
      this.restoreTimer=setTimeout(()=>{this.restoreTimer=null;if(!this.container)return;this.container.scrollTop=Number(position.containerY)||0;this.window?.scrollTo?.({top:Number(position.windowY)||0,behavior:'instant'});},0);this.restoreTimer?.unref?.();
    }
    sourceHTML(question){
      const e=this.e,source=question?.pipeline?.sourceLesson||{},label=text(question?.sourceLabel)||text(question?.origin?.label)||text(question?.source?.label)||'已有课程练习资料';
      const page=question?.sourcePage||question?.sourcePdfPage||question?.origin?.page;
      return '<p class="pipeline-source">来源：'+e(label)+(source.id?' · 第'+e(source.book)+'册第'+e(source.number)+'课 '+e(source.title):'')+(page?' · 第'+e(page)+'页':'')+'</p>';
    }
    readingHTML(){
      const body=this.options.renderReading?.(this.lesson)||list(this.lesson.paragraphs).map(paragraph=>'<p lang="en">'+this.e(paragraph.en)+'</p><p>'+this.e(paragraph.zh)+'</p>').join('');
      return '<div class="pipeline-reading-intro"><h2>先读课文</h2><p>可先听本课音频，或直接开始选择题；熟悉程度由你决定。</p><button type="button" class="button subtle" data-pipeline-action="play">播放本课音频</button><span class="pipeline-source" data-pipeline-audio-progress></span></div><div data-pipeline-reading>'+body+'</div><div class="pipeline-footer"><button class="button primary" data-pipeline-action="stage" data-stage="1">开始选择题</button></div>';
    }
    quizHTML(){
      const e=this.e,record=this.record(),quiz=record.quiz,question=this.question(),counts=quiz.plan?.actualCounts||{current:quiz.questions.filter(q=>q.isCurrent).length,review:quiz.questions.filter(q=>q.isReview).length,total:quiz.questions.length};
      const snapshot=this.quizSnapshot(),binding=snapshot?' data-pipeline-lesson-id="'+e(snapshot.lessonId)+'" data-pipeline-question-id="'+e(snapshot.questionId)+'" data-pipeline-round="'+e(snapshot.round)+'" data-pipeline-question-signature="'+e(snapshot.signature)+'"':'';
      const summary='<p class="pipeline-task-note">目标10题 · 本课 '+e(counts.current)+' 题 + 前课 '+e(counts.review)+' 题 · 本次实际 '+e(counts.total)+' 题</p>'+(quiz.plan?.shortfall?.total?'<p class="pipeline-notice">当前可用题量不足，尚缺 '+e(quiz.plan.shortfall.total)+' 题；本次按实际题量练习。</p>':'');
      if(!question)return '<h2>选择题</h2>'+summary+'<p>本课暂无可用的客观语法题，可以继续自由造句。</p><button class="button primary" data-pipeline-action="stage" data-stage="2">开始自由造句</button>';
      const answer=quiz.answers[question.id],result=quiz.results?.[question.id],explanation=text(question.explanation)||text(question.rule);
      return '<div class="pipeline-task-heading"><h2>选择题</h2><span>第 '+e(quiz.index+1)+' / '+e(quiz.questions.length)+' 题</span></div>'+summary+'<article class="pipeline-question"><p class="pipeline-question-source">'+(question.isReview?'前课回顾':'本课练习')+'</p><h3>'+e(question.question||question.prompt)+'</h3><div class="pipeline-options" role="group" aria-label="本题选项">'+question.options.map((option,index)=>'<button type="button" data-pipeline-answer="'+index+'"'+binding+' class="pipeline-option'+(answer===index?' selected':'')+'" aria-pressed="'+(answer===index)+'"'+(quiz.submitted?' disabled':'')+'><span>'+e(String.fromCharCode(65+index))+'</span>'+e(option)+'</button>').join('')+'</div>'+(quiz.submitted?'<section class="pipeline-answer-feedback" role="status"><strong>'+(result?.correct?'本题答案一致':'这题再看一下')+'</strong><p>参考答案：'+e(question.options[question.answer])+'</p><p>'+e(explanation)+'</p>'+this.sourceHTML(question)+'</section>':'')+'</article><div class="pipeline-footer">'+(quiz.submitted?'<button class="button primary" data-pipeline-action="next"'+binding+'>'+(quiz.index===quiz.questions.length-1?'开始自由造句':'下一题')+'</button><button class="button subtle" data-pipeline-action="retry"'+binding+'>重试本题</button>':'<button class="button primary" data-pipeline-action="check"'+binding+'>检查答案</button>')+'<button class="button subtle" data-pipeline-action="new-round">换一组</button></div>';
    }
    sentences(){
      const collected=[];const drafts=this.options.getFreeDrafts?.()||{};
      for(const draft of Object.values(drafts))if(draft?.lessonId===this.lesson?.id){
        for(const [key,row] of Object.entries(draft.targets||{}))for(const [index,answer] of list(row?.answers).entries())if(typeof answer==='string'&&answer.trim()){
          const feedback=row.feedback?.[index];
          collected.push({answer,target:key,index,feedback:feedback?.sentence===answer?feedback:null});
        }
      }
      for(const row of list(this.options.getSentences?.(this.lesson)))if(row?.answer||typeof row==='string')collected.push(typeof row==='string'?{answer:row}:{...row,feedback:row.feedback?.sentence===row.answer?row.feedback:null});
      return collected;
    }
    recapTargets(){
      const fallback={words:list(this.lesson.vocabulary),phrases:list(this.lesson.usage)};
      if(typeof this.options.getWritingTargets!=='function')return fallback;
      try{
        const supplied=this.options.getWritingTargets(this.lesson),api=this.options.FreeWritingPractice||Writing;
        if(!supplied||!Array.isArray(supplied)&&!Array.isArray(supplied.words)&&!Array.isArray(supplied.phrases))return fallback;
        if(typeof api?.buildTargets==='function'){
          const targets=api.buildTargets({lesson:this.lesson,targets:supplied,lessons:this.options.getLessons?.()||[]}).filter(row=>!row.prior);
          return {words:targets.filter(row=>row.kind==='word'),phrases:targets.filter(row=>row.kind==='phrase')};
        }
        return Array.isArray(supplied)?{words:supplied.filter(row=>!row.prior&&!row.phrase&&row.kind!=='phrase'),phrases:supplied.filter(row=>!row.prior&&(row.phrase||row.kind==='phrase'))}:{words:list(supplied.words).filter(row=>!row.prior),phrases:list(supplied.phrases).filter(row=>!row.prior)};
      }catch(_){return fallback;}
    }
    recapHTML(){
      const e=this.e,record=this.record(),mistakes=Object.values(record.mistakes||{}),sentences=this.sentences(),targets=this.recapTargets();
      const corrections=sentences.filter(row=>row.feedback&&(list(row.feedback.issues).length>0||row.feedback.incomplete===true));
      const labels=Writing?.TYPE_LABELS||{spelling:'拼写',grammar:'语法',tense:'时态与动词形式',collocation:'固定搭配',capitalization:'大小写',punctuation:'标点',target:'目标表达',completeness:'句意完整性',review:'需复核'};
      const correctionHTML=corrections.map(row=>{
        const feedback=row.feedback;
        return '<article class="pipeline-recap-card"><p class="pipeline-saved-sentence" lang="en">'+e(row.answer)+'</p>'+list(feedback.issues).map(issue=>'<p><strong>'+e(labels[issue?.type]||'需复核')+'</strong> · '+e(typeof issue==='string'?issue:issue?.message)+'</p>'+(issue?.replacement?'<p>局部修改参考：'+(issue.original?'<del lang="en">'+e(issue.original)+'</del> → ':'')+'<span lang="en">'+e(issue.replacement)+'</span></p>':'')).join('')+(feedback.incomplete?'<p>本句检查未完成，请复核尚未覆盖的部分。</p>':'')+(feedback.reference?'<p>局部修改参考（整句仍需复核）：<span lang="en">'+e(feedback.reference)+'</span></p>':'')+list(feedback.reviewNeeded).map(note=>'<p class="pipeline-source">'+e(note)+'</p>').join('')+'<small>以上为已有检查提示；整句仍需复核，不记为客观错题或学习成绩。</small></article>';
      }).join('');
      const mistakeHTML=mistakes.length?mistakes.map(mistake=>{const question=mistake.question||{};return '<article class="pipeline-recap-card"><h3>'+e(question.question||question.prompt)+'</h3><p>连错 '+e(mistake.consecutiveWrong||0)+' 次 · 历史最多连错 '+e(mistake.maxConsecutiveWrong||0)+' 次 · 累计错误 '+e(mistake.wrongCount||0)+' 次</p><p>参考答案：'+e(question.options?.[question.answer]||'')+'</p><p>'+e(question.explanation||question.rule||'')+'</p>'+this.sourceHTML(question)+'<small>保留 '+e(list(mistake.history).length)+' 次真实检查记录；之后答对也保留历史。</small></article>';}).join(''):'<p>本课暂未记录客观错题；可以回顾自己的造句和表达。</p>';
      return '<h2>本课复盘</h2><p class="pipeline-task-note">先看卡住的地方，再写下自己的发现。</p><details class="pipeline-disclosure" open><summary>自动整理的错题（'+e(mistakes.length)+'）</summary>'+mistakeHTML+'</details><details class="pipeline-disclosure"><summary>造句待订正（'+e(corrections.length)+'）</summary>'+(correctionHTML||'<p>暂无已有检查提示需要集中订正；未检查或只有一般复核提醒的句子不计为错误。</p>')+'</details><label class="pipeline-recap-label">我的回顾<textarea rows="5" data-pipeline-recap placeholder="哪一处还不确定？下次想怎样表达？">'+e(record.recapText??record.reflection?.notes??'')+'</textarea></label><details class="pipeline-disclosure"><summary>所有已写造句（'+e(sentences.length)+'）</summary>'+(sentences.length?sentences.map(row=>'<p class="pipeline-saved-sentence" lang="en">'+e(row.answer)+'</p>').join(''):'<p>暂未写入造句；随时可以回到自由造句补写。</p>')+'</details><details class="pipeline-disclosure"><summary>课文回顾</summary>'+list(this.lesson.paragraphs).map(paragraph=>'<p lang="en">'+e(paragraph.en)+'</p><p>'+e(paragraph.zh)+'</p>').join('')+'</details><details class="pipeline-disclosure"><summary>本课词汇与用法</summary>'+targets.words.map(row=>'<p><strong lang="en">'+e(row.word||row.label)+'</strong> · '+e(row.meaning)+'</p>').join('')+targets.phrases.map(row=>'<p><strong lang="en">'+e(row.phrase||row.label)+'</strong> · '+e(row.meaning||row.note)+'</p>').join('')+'</details><div class="pipeline-footer"><button class="button primary" data-pipeline-action="stage" data-stage="4">查看本课重点</button><button class="button subtle" data-pipeline-action="stage" data-stage="2">返回自由造句</button></div>';
    }
    keyPointsHTML(){
      const e=this.e,raw=this.options.getKeyPoints?.(this.lesson)||{},items=list(Array.isArray(raw)?raw:raw.items).slice(0,5);
      return '<h2>带走这些重点</h2><p class="pipeline-task-note">'+e(raw.notice||'根据本课已有资料进行本地整理，非实时在线 AI。')+'</p><div class="pipeline-key-points">'+items.map((item,index)=>'<article class="pipeline-point"><span>'+e(index+1)+'</span><div><h3>'+e(item.title)+'</h3><p>'+e(item.summary||item.note)+'</p>'+(item.example?'<blockquote lang="en">'+e(item.example)+'</blockquote><small>'+e(item.exampleSourceLabel||'本课已有资料例句')+'</small>':'<p class="pipeline-notice">当前资料未附可展示的完整例句。</p>')+'<details><summary>来源与完整说明</summary><p>'+e(item.sourceLabel||'本课已有学习资料')+'</p><p>'+e(item.details||item.summary)+'</p>'+(item.exampleDetails&&item.exampleDetails!==item.example?'<p lang="en">'+e(item.exampleDetails)+'</p>':'')+(item.sourceReference?.page?'<p>来源第 '+e(item.sourceReference.page)+' 页</p>':'')+'</details></div></article>').join('')+'</div>'+(!items.length?'<p>本课重点资料尚未整理，可以先保留自己的回顾。</p>':'')+'<div class="pipeline-footer"><button class="button primary" data-pipeline-action="finish">完成本轮，回书架</button>'+(this.nextLesson()?'<button class="button subtle" data-pipeline-action="next-lesson">下一课</button>':'')+'</div>';
    }
    render(){
      if(!this.lesson)return '<section class="learning-pipeline"><p>请从书架选择一课。</p></section>';
      const e=this.e,stage=this.record().stage;
      this.visibleQuiz=stage===1?this.quizSnapshot():null;
      let body=stage===0?this.readingHTML():stage===1?this.quizHTML():stage===2?'<div data-pipeline-writing></div><div class="pipeline-footer"><button class="button subtle" data-pipeline-action="stage" data-stage="3">进入复盘</button><button class="button subtle" data-pipeline-action="shelf">稍后继续</button></div>':stage===3?this.recapHTML():this.keyPointsHTML();
      return '<section class="learning-pipeline" aria-label="逐课学习"><header class="pipeline-topbar"><button type="button" class="pipeline-shelf" data-pipeline-action="shelf">← 书架</button><div><small>第 '+e(this.lesson.book)+' 册 · 第 '+e(this.lesson.number)+' 课</small><h1>'+e(this.lesson.title)+'</h1></div></header><nav class="pipeline-steps" aria-label="本课学习步骤">'+STAGES.map((label,index)=>'<button type="button" data-pipeline-stage="'+index+'"'+(index===stage?' aria-current="step"':'')+'><span>'+index+'</span>'+e(label)+'</button>').join('')+'</nav><main class="pipeline-current-task" data-pipeline-current-stage="'+stage+'">'+body+'</main><div class="pipeline-save-line"><span data-pipeline-save-status data-state="'+this.status+'" role="status" aria-live="polite">'+e(this.saveMessage())+'</span><button class="button subtle" data-pipeline-action="save"'+(this.status==='error'?'':' hidden')+'>重试保存</button></div></section>';
    }
    ensureWriting(){
      if(this.writing)return this.writing;
      const Class=this.options.FreeWritingPractice||Writing;if(!Class)return null;
      this.writing=new Class({getLesson:()=>this.lesson,getLessons:this.options.getLessons,getTargets:this.options.getWritingTargets,getDrafts:this.options.getFreeDrafts,saveDraft:this.options.saveFreeDraft,checkSentence:this.options.checkSentence,getLearnedLessonIds:this.options.getLearnedLessonIds});return this.writing;
    }
    detachStage(){
      if(this.readingMounted){this.options.stopReading?.();this.readingMounted=false;}
      this.writing?.unmount();
    }
    refresh(){
      if(this.destroyed)return;
      if(!this.container){this.render();return;}
      this.detachStage();this.visibleStage=this.record().stage;this.container.innerHTML=this.render();
      if(this.visibleStage===0){const reading=this.container.querySelector?.('[data-pipeline-reading]');if(reading){this.options.mountReading?.(reading,this.lesson);this.readingMounted=true;}}
      if(this.visibleStage===2){const area=this.container.querySelector?.('[data-pipeline-writing]'),writing=this.ensureWriting();if(area&&writing){writing.setLesson(this.lesson);writing.mount(area);}}
      this.restoreScroll();this.options.changed?.({lessonId:this.lesson?.id,stage:this.visibleStage});
    }
    nextLesson(){return (this.options.getLessons?.()||[]).filter(lesson=>lesson.book>this.lesson.book||lesson.book===this.lesson.book&&lesson.number>this.lesson.number).sort((a,b)=>a.book-b.book||a.number-b.number)[0]||null;}
    async finish(){if(!this.lesson)return false;const id=this.lesson.id;this.queue(state=>{this.ensureRecord(state,id).finishedAt=Date.now();return state;});if(!await this.flush())return false;this.options.onShelf?.();return true;}
    async shelf(){this.captureScroll();if(!await this.flush())return false;this.detachStage();this.options.onShelf?.();return true;}
    async selectNextLesson(){const next=this.nextLesson();if(!next||!await this.flush())return false;this.detachStage();this.options.onSelectLesson?.(next.id);return true;}
    mount(container){
      this.unmount();if(!container||typeof container.addEventListener!=='function')return false;this.destroyed=false;this.container=container;
      const click=event=>{
        const target=event.target?.closest?.('[data-pipeline-action],[data-pipeline-stage],[data-pipeline-answer]');if(!target||container.contains&&!container.contains(target))return;
        event.preventDefault();const data=target.dataset;
        const expected=data.pipelineQuestionId!==undefined?{lessonId:data.pipelineLessonId,questionId:data.pipelineQuestionId,round:Number(data.pipelineRound),signature:data.pipelineQuestionSignature}:undefined;
        if(data.pipelineStage!==undefined){void this.goStage(Number(data.pipelineStage));return;}
        if(data.pipelineAnswer!==undefined){this.chooseAnswer(Number(data.pipelineAnswer),expected);return;}
        const actions={stage:()=>this.goStage(Number(data.stage)),play:()=>this.options.playLesson?.(this.lesson),check:()=>this.checkAnswer(expected),retry:()=>this.retryQuestion(expected),next:()=>this.nextQuestion(expected),'new-round':()=>this.newQuizRound(),save:()=>this.flush(),shelf:()=>this.shelf(),finish:()=>this.finish(),'next-lesson':()=>this.selectNextLesson()};
        void actions[data.pipelineAction]?.();
      };
      const input=event=>{if(event.target?.dataset?.pipelineRecap!==undefined)this.setRecapText(event.target.value);};
      const scroll=()=>this.captureScroll(),pagehide=()=>{this.captureScroll();void this.flush();};
      this.handlers={click,input,scroll};for(const [name,handler]of Object.entries(this.handlers))container.addEventListener(name,handler);
      this.windowHandlers={scroll,pagehide};for(const [name,handler]of Object.entries(this.windowHandlers))this.window?.addEventListener(name,handler);
      this.refresh();return true;
    }
    unmount(){
      this.detachStage();if(this.restoreTimer!==null){clearTimeout(this.restoreTimer);this.restoreTimer=null;}
      if(this.container&&this.handlers)for(const [name,handler]of Object.entries(this.handlers))this.container.removeEventListener?.(name,handler);
      if(this.windowHandlers)for(const [name,handler]of Object.entries(this.windowHandlers))this.window?.removeEventListener?.(name,handler);
      this.container=null;this.handlers=null;this.windowHandlers=null;
    }
    destroy(){this.unmount();this.destroyed=true;if(this.saveTimer!==null){clearTimeout(this.saveTimer);this.saveTimer=null;}void this.flush();}
  }
  return LearningPipeline;
});
