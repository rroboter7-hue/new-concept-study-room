(function (global) {
  'use strict';

  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const words = text => String(text || '').normalize('NFKC').match(/[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+)*|\d+/g) || [];
  const canonical = text => words(text).map(word=>word.toLowerCase().replace(/’/g,"'")).join(' ');
  const stopWords = new Set('this that with from have been were they them what when which where your there then into just does will would could should about their these those some also very more because after before'.split(' '));
  const retellStopWords = new Set([...stopWords,...'a an the and or but for to of in on at by as is am are was be being has had do did not no it its i me my we us our he him his she her you so than can may must'.split(' ')]);
  const draftModes=['write','spell','retell'], outputModes=[...draftModes,'sentences','batch'];
  const safeLessonId=id=>typeof id==='string'&&/^[\w-]{1,160}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  function sanitizeDrafts(raw) {
    const result={version:1,lessons:{}}, source=object(object(raw).lessons);let remaining=2000000;
    const text=(value,max)=>{const clean=typeof value==='string'?value.slice(0,Math.min(max,remaining)):'';remaining-=clean.length;return clean;};
    for(const id of Object.keys(source).slice(0,600)){
      if(!safeLessonId(id)||Object.keys(result.lessons).length>=300||remaining<=0)continue;
      const lesson=object(source[id]), entry={mode:outputModes.includes(lesson.mode)?lesson.mode:'write',assisted:lesson.assisted===true,roundKey:text(lesson.roundKey,1000),modes:{}};
      for(const mode of draftModes){
        if(!Object.prototype.hasOwnProperty.call(object(lesson.modes),mode))continue;
        const saved=object(lesson.modes[mode]),draft={assisted:saved.assisted===true,roundKey:text(saved.roundKey,1000)};
        if(mode==='write'){
          draft.paragraphIndex=Number.isInteger(saved.paragraphIndex)?Math.max(0,Math.min(199,saved.paragraphIndex)):0;draft.answers={};
          for(const index of Object.keys(object(saved.answers)).slice(0,200))if(/^(?:0|[1-9]\d{0,2})$/.test(index)&&Number(index)<200)draft.answers[index]=text(saved.answers[index],30000);
        }else if(mode==='spell'){
          draft.spellAnswers={};for(let i=0;i<8;i++)if(Object.prototype.hasOwnProperty.call(object(saved.spellAnswers),i))draft.spellAnswers[i]=text(saved.spellAnswers[i],200);
        }else draft.answer=text(saved.answer,30000);
        entry.modes[mode]=draft;
      }
      result.lessons[id]=entry;
    }
    return result;
  }

  // Whole, consecutive tokens only: neither substrings nor punctuation can
  // manufacture a phrase. This measures lexical coverage, not story meaning.
  function containsExpression(text, expression) {
    const source=String(text||'').normalize('NFKC').replace(/’/g,"'").toLowerCase(), target=words(expression).map(canonical);
    if(!target.length)return false;
    const tokens=[...source.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+)*|\d+/g)];
    return tokens.some((token,index)=>target.every((part,offset)=>{
      const next=tokens[index+offset];
      return next&&canonical(next[0])===part&&(!offset||/^[\s‘’“”"']*$/.test(source.slice(tokens[index+offset-1].index+tokens[index+offset-1][0].length,next.index)));
    }));
  }
  function finiteHeadForms(head,pos) {
    const forms=new Set([head]),verb=/^(?:v(?:t|i)?\b|verb\b)/i.test(pos||''),noun=/^(?:n\b|noun\b)/i.test(pos||'');
    if(verb)for(const form of global.StudyRecurrence?.finiteForms?.[head]||[])forms.add(canonical(form));
    if(!/^[a-z]{3,}$/.test(head)||!verb&&!noun)return forms;
    forms.add(/[^aeiou]y$/.test(head)?head.slice(0,-1)+'ies':/(?:s|x|z|ch|sh)$/.test(head)?head+'es':head+'s');
    if(verb){
      forms.add(/e$/.test(head)?head+'d':/[^aeiou]y$/.test(head)?head.slice(0,-1)+'ied':head+'ed');
      forms.add(/ie$/.test(head)?head.slice(0,-2)+'ying':/[^e]e$/.test(head)?head.slice(0,-1)+'ing':head+'ing');
      if(/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(head)&&head.length<=4){forms.add(head+head.at(-1)+'ed');forms.add(head+head.at(-1)+'ing');}
    }
    return forms;
  }

  function compareWords(expected, actual) {
    const original = words(expected), entered = words(actual);
    if (entered.length>1000) throw new Error('一次最多校对 1000 个英文单词，请分段练习。');
    const target = original.slice(0,1000), a = target.map(canonical), b = entered.map(canonical), n=a.length, m=b.length;
    const table = Array.from({length:n+1},()=>new Uint16Array(m+1));
    for (let i=0;i<=n;i++) table[i][0]=i;
    for (let j=0;j<=m;j++) table[0][j]=j;
    for (let i=1;i<=n;i++) for (let j=1;j<=m;j++) table[i][j]=Math.min(table[i-1][j]+1,table[i][j-1]+1,table[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    let i=n,j=m,correct=0,missing=0,extra=0,substitutions=0;
    const operations=[];
    while (i>0 || j>0) {
      if (i>0 && j>0 && a[i-1]===b[j-1] && table[i][j]===table[i-1][j-1]) {
        operations.push({type:'correct',expected:target[i-1],actual:entered[j-1]});correct++;i--;j--;
      } else if (i>0 && j>0 && table[i][j]===table[i-1][j-1]+1) {
        operations.push({type:'substitute',expected:target[i-1],actual:entered[j-1]});substitutions++;i--;j--;
      } else if (i>0 && table[i][j]===table[i-1][j]+1) {
        operations.push({type:'missing',expected:target[i-1]});missing++;i--;
      } else {
        operations.push({type:'extra',actual:entered[j-1]});extra++;j--;
      }
    }
    return {score:n?Math.max(0,Math.round((1-table[n][m]/n)*100)):0,correct,missing,extra,substitutions,expectedWords:n,actualWords:m,edits:table[n][m],truncated:original.length>1000,operations:operations.reverse()};
  }

  class OutputPractice {
    constructor(options) {
      this.options=options || {};
      this.escape=this.options.escapeHTML || escapeText;
      this.icon=this.options.icon || (()=>'');
      this.current=null;
      this.drafts=sanitizeDrafts(this.options.getState?.());this.draftSaveState=Object.keys(this.drafts.lessons).length?'saved':'new';
      this.reset();
      this.click=event=>{
        const button=event.target.closest && event.target.closest('[data-output-action]');
        if (!button || !button.closest('#output-content')) return;
        try {
          switch(button.dataset.outputAction) {
            case 'mode':this.switchMode(button.dataset.outputMode);break;
            case 'original':if(!this.showOriginal)this.assisted=true;this.showOriginal=!this.showOriginal;this.flush();this.redraw();break;
            case 'submit':this.submit();break;case 'grammar-check':this.checkGrammar();break;case 'grammar-apply':this.applyGrammar(Number(button.dataset.grammarIndex));break;case 'grammar-all':this.applyGrammar(-1);break;
            case 'retry':if(this.result)this.assisted=true;this.result=null;this.pendingEvidence=null;this.answer='';this.spellAnswers={};this.showOriginal=false;this.grammarIssues=null;this.grammarText='';this.flush();this.redraw();break;
            case 'draft-save':this.flush();this.redraw();break;
            case 'evidence-retry':this.retryEvidence();break;
            case 'speak':{
              const word=this.spellWords()[Number(button.dataset.outputIndex)]?.word;
              if (word && this.options.speak) Promise.resolve(this.options.speak(word)).catch(()=>this.notify('暂时无法播放发音，请稍后重试。'));
              break;
            }
          }
        } catch(error) {this.notify(error.message || '练习暂时无法提交，请检查输入。');}
      };
      this.input=event=>{
        const input=event.target;
        if (!input.closest || !input.closest('#output-content')) return;
        if (input.dataset.outputInput==='answer') {
          this.answer=String(input.value||'').slice(0,30000);this.grammarIssues=null;this.grammarText='';const feedback=document.querySelector('#output-content .grammar-feedback');if(feedback)feedback.innerHTML='<p class="small-note">输入已改变，请重新检查。</p>';
          const count=document.querySelector('#output-content .output-counter');
          if (count) count.textContent=`${words(this.answer).length} 个英文单词`;
        }
        if (/^[0-7]$/.test(input.dataset.outputSpell||'')) this.spellAnswers[input.dataset.outputSpell]=String(input.value||'').slice(0,200);
        if(input.dataset.outputInput==='answer'||/^[0-7]$/.test(input.dataset.outputSpell||''))this.flush();
      };
      this.change=event=>{
        const select=event.target;
        if (select.dataset.outputParagraph===undefined || !select.closest('#output-content')) return;
        this.flush();this.paragraphIndex=Math.max(0,Math.min(199,Number(select.value)||0));this.answer=this.drafts.lessons[this.current?.id]?.modes.write?.answers[this.paragraphIndex]||'';this.result=null;this.pendingEvidence=null;this.showOriginal=false;this.grammarIssues=null;this.grammarText='';this.flush();this.redraw();
      };
      document.addEventListener('click',this.click);
      document.addEventListener('input',this.input);
      document.addEventListener('change',this.change);
    }

    static compareWords(expected,actual) {return compareWords(expected,actual);}
    static countWords(text) {return words(text).length;}
    static sanitizeDrafts(raw) {return sanitizeDrafts(raw);}
    reset() {this.grammarIssues=null;this.grammarText='';this.mode=this.options.defaultMode?.()||'write';this.paragraphIndex=0;this.answer='';this.spellAnswers={};this.result=null;this.showOriginal=false;this.scrambles={};this.assisted=false;this.roundKey='';this.roundLessonId='';this.pendingEvidence=null;}
    loadMode(mode) {
      this.reset();this.mode=outputModes.includes(mode)?mode:'write';
      const entry=this.drafts.lessons[this.current?.id],draft=entry?.modes[this.mode];
      // Seeing lesson references or feedback also supports the other output
      // modes. Switching editors must not erase that lesson's exposure history.
      this.assisted=entry?.assisted===true||draft?.assisted===true;this.roundKey=draft?.roundKey||entry?.roundKey||'';this.roundLessonId=this.roundKey?this.current.id:'';
      if(!draft)return;
      if(this.mode==='write'){this.paragraphIndex=Math.min(draft.paragraphIndex,Math.max(0,(this.current?.paragraphs||[]).filter(p=>p&&typeof p.en==='string'&&p.en.trim()).length-1));this.answer=draft.answers[this.paragraphIndex]||'';}
      else if(this.mode==='spell')this.spellAnswers={...draft.spellAnswers};else this.answer=draft.answer;
    }
    captureDraft() {
      const id=this.current?.id;if(!safeLessonId(id))return;
      const entry=this.drafts.lessons[id]||(this.drafts.lessons[id]={mode:this.mode,assisted:false,roundKey:'',modes:{}});entry.mode=this.mode;entry.assisted=this.assisted===true;entry.roundKey=String(this.roundKey||'').slice(0,1000);
      if(this.assisted)for(const draft of Object.values(entry.modes))draft.assisted=true;
      if(!draftModes.includes(this.mode))return;
      const draft={assisted:this.assisted===true,roundKey:String(this.roundKey||'').slice(0,1000)};
      if(this.mode==='write'){draft.paragraphIndex=this.paragraphIndex;draft.answers={...entry.modes.write?.answers,[this.paragraphIndex]:this.answer};}
      else if(this.mode==='spell')draft.spellAnswers={...this.spellAnswers};else draft.answer=this.answer;
      entry.modes[this.mode]=draft;
      entry.modes=Object.fromEntries(draftModes.filter(mode=>entry.modes[mode]).map(mode=>[mode,entry.modes[mode]]));
    }
    flush() {
      this.captureDraft();if(!this.current)return true;
      const snapshot=sanitizeDrafts(this.drafts);let saved=false;
      // Imported data is bounded, and an over-capacity live draft stays in
      // memory with an unsaved status instead of silently discarding answers.
      try{if(JSON.stringify(snapshot)===JSON.stringify(this.drafts))saved=this.options.saveState?.(snapshot)===true;}catch{}
      this.draftSaveState=saved?'saved':'failed';this.updateDraftStatus();return saved;
    }
    draftStatusText() {return this.draftSaveState==='saved'?'草稿已保存到此设备；未提交内容不计入成绩。':this.draftSaveState==='failed'?'草稿未保存；当前输入仍在本页，请重试保存后再刷新。':'输入后自动保存草稿，未提交内容不计入成绩。';}
    updateDraftStatus() {const status=document.querySelector('#output-content [data-output-draft-status]');if(status)status.textContent=this.draftStatusText();const retry=document.querySelector('#output-content [data-output-draft-retry]');if(retry)retry.textContent=this.draftSaveState==='failed'?'重试保存草稿':'保存草稿';}
    draftStatusHTML() {return `<p class="small-note" role="status" aria-live="polite" data-output-draft-status>${this.escape(this.draftStatusText())}</p><button type="button" class="button subtle" data-output-action="draft-save" data-output-draft-retry>${this.draftSaveState==='failed'?'重试保存草稿':'保存草稿'}</button>`;}
    snapshot() {this.captureDraft();return sanitizeDrafts(this.drafts);}
    reloadFromStorage() {this.drafts=sanitizeDrafts(this.options.getState?.());this.draftSaveState=Object.keys(this.drafts.lessons).length?'saved':'new';this.loadMode(this.drafts.lessons[this.current?.id]?.mode||this.options.defaultMode?.()||'write');this.redraw();}
    switchMode(mode) {if(!outputModes.includes(mode))return;this.lesson();this.flush();this.options.sentencePractice?.flush();this.options.batchPractice?.flush();this.options.batchPractice?.cancel(false);this.loadMode(mode);this.flush();this.redraw();}
    setLesson(lesson) {if (lesson?.id!==this.current?.id) {if(this.current)this.flush();this.options.sentencePractice?.flush();this.options.batchPractice?.flush();this.options.batchPractice?.cancel(false);this.current=lesson||null;this.loadMode(this.drafts.lessons[lesson?.id]?.mode||this.options.defaultMode?.()||'write');}else this.current=lesson||null;}
    lesson() {const lesson=this.options.getLesson?.() || this.current;if (lesson?.id!==this.current?.id)this.setLesson(lesson);else this.current=lesson;return lesson;}
    startTask({lessonId,mode='write',roundKey}={}) {
      const lesson=this.lesson(),normalized={dictation:'write',spelling:'spell',write:'write',spell:'spell',retell:'retell'}[mode];
      if(!lesson||lesson.id!==lessonId||!normalized||typeof roundKey!=='string'||!roundKey.trim())return false;
      const key=roundKey.trim().slice(0,1000);
      // Entering the same task keeps its draft and exposure history. Only an
      // explicit new round hides references and clears answers together.
      if(this.mode===normalized&&this.roundKey===key&&this.roundLessonId===lessonId)return true;
      this.flush();this.loadMode(normalized);
      if(this.roundKey===key&&this.roundLessonId===lessonId){this.flush();this.redraw();return true;}
      this.options.sentencePractice?.flush();this.options.batchPractice?.flush();this.options.batchPractice?.cancel(false);
      if(this.drafts.lessons[lessonId])delete this.drafts.lessons[lessonId].modes[normalized];
      this.reset();this.mode=normalized;this.roundKey=key;this.roundLessonId=lessonId;this.flush();this.redraw();return true;
    }
    paragraphs() {return (this.lesson()?.paragraphs || []).filter(paragraph=>paragraph && typeof paragraph.en==='string' && paragraph.en.trim());}
    notify(message) {this.options.toast?.(message);}
    redraw() {const content=document.querySelector('#output-content');if(content){content.innerHTML=this.render();if(this.options.isMobileWorkspace?.())content.querySelector?.('[data-output-mode="'+this.mode+'"]')?.focus?.({preventScroll:true});}}

    spellWords() {
      const lesson=this.lesson(),bank=global.StudyKnowledge?.bank,registered=bank?.hasLesson(lesson?.id);
      const vocabulary=(registered?bank.vocabularyForLesson(lesson.id):lesson?.vocabulary || []).filter(item=>item?.word);
      if (registered || vocabulary.length) return vocabulary.slice(0,8).map(item=>({word:String(item.word),meaning:String(item.meaning || '')}));
      const all=words(this.paragraphs().map(paragraph=>paragraph.en).join(' '));
      return [...new Set(all.map(word=>word.toLowerCase()))].filter(word=>word.length>=4 && !stopWords.has(word)).slice(0,8).map(word=>({word,meaning:''}));
    }

    scramble(word) {
      if(this.scrambles[word])return this.scrambles[word];
      const letters=[...word];
      for(let i=letters.length-1;i>0;i--){const at=Math.floor(Math.random()*(i+1));[letters[i],letters[at]]=[letters[at],letters[i]];}
      let result=letters.join('');
      if(result.toLowerCase()===word.toLowerCase())result=word.slice(1)+word[0];
      if(result.toLowerCase()===word.toLowerCase())result=`（${letters.length}个字母，请听发音）`;
      this.scrambles[word]=result;return result;
    }

    legacyKeywords() {
      const lesson=this.lesson(), list=this.spellWords().slice(0,8).map(item=>item.word);
      (lesson?.usage || []).slice(0,3).forEach(item=>{if(item?.phrase && words(item.phrase).length<=6 && !list.some(word=>canonical(word)===canonical(item.phrase)))list.push(item.phrase);});
      return list.slice(0,10);
    }

    retellTargets() {
      const lesson=this.lesson();
      if(lesson?.textbook?.verified!==true)return this.legacyKeywords().map(label=>({label,forms:[canonical(label)]}));
      const paragraphs=this.paragraphs(),bank=global.StudyKnowledge?.bank,vocabulary=bank?.hasLesson(lesson.id)?bank.vocabularyForLesson(lesson.id):lesson.vocabulary||[];
      const targetFor=(item,kind)=>{
        const label=String(kind==='usage'?item?.phrase||'':item?.word||'').trim(),base=words(label).map(canonical);
        if(!base.length||base.length>6)return null;
        const head=base[0],known=vocabulary.find(word=>canonical(word.word)===head),pos=kind==='usage'?(known?.pos||((global.StudyRecurrence?.finiteForms?.[head])?'v.':'')):item.pos;
        const heads=finiteHeadForms(head,pos),forms=new Set([...heads].map(form=>[form,...base.slice(1)].join(' ')));
        for(const variant of [item.matchedForm,...(Array.isArray(item.variants)?item.variants:[])]){
          if(typeof variant!=='string')continue;const parts=words(variant).map(canonical);
          // Explicit single-word vocabulary variants are recorded aliases;
          // phrase variants must retain every particle, negation and token order.
          if(parts.length===base.length&&parts.slice(1).every((part,index)=>part===base[index+1])&&(kind!=='usage'&&base.length===1||heads.has(parts[0])))forms.add(parts.join(' '));
        }
        const observed=[...forms].filter(form=>paragraphs.some(paragraph=>containsExpression(paragraph.en,form)));
        return observed.length?{label,forms:[...new Set([canonical(label),...observed])]}:null;
      };
      let targets=vocabulary.map(item=>targetFor(item,'vocabulary')).filter(Boolean);
      if(!targets.length)targets=[...new Set(words(paragraphs.map(paragraph=>paragraph.en).join(' ')).map(canonical))].filter(word=>word.length>=4&&!retellStopWords.has(word)).map(label=>({label,forms:[label]}));
      const result=[],seen=new Set();
      const add=target=>{const key=canonical(target.label);if(!seen.has(key)){seen.add(key);result.push(target);}};
      targets.slice(0,8).forEach(add);
      (lesson.usage||[]).map(item=>targetFor(item,'usage')).filter(Boolean).slice(0,3).forEach(add);
      return result.slice(0,10);
    }

    keywords() {return this.retellTargets().map(target=>target.label);}

    render() {
      const lesson=this.lesson();
      if(!lesson)return '<div class="empty-state">请选择一篇课文后开始输出练习。</div>';
      const sentenceAvailable=Boolean(this.options.sentencePractice)&&(typeof this.options.canPracticeSentences!=='function'||this.options.canPracticeSentences(lesson)!==false);
      if(!sentenceAvailable&&this.mode==='sentences'){
        this.options.sentencePractice?.flush();this.mode='write';this.result=null;this.showOriginal=false;
      }
      const modes=[['write','分段默写'],['spell','单词拼写'],['retell','英文复述']];
      if(sentenceAvailable)modes.push(['sentences','五句造句']);
      if(this.options.batchPractice)modes.push(['batch','批量检查']);
      this.options.onModeChange?.(this.mode);
      const mobile=this.options.isMobileWorkspace?.()===true;
      const modeHTML=([mode,label])=>'<button type="button" class="output-tab '+(this.mode===mode?'active':'')+'" data-output-action="mode" data-output-mode="'+mode+'" aria-pressed="'+(this.mode===mode)+'">'+label+'</button>';
      const primary=['sentences','batch'].includes(this.mode);
      const tabs='<div class="output-tabs" aria-label="输出练习模式">'+(mobile?modes.filter(([mode])=>['sentences','batch'].includes(mode)):modes).map(modeHTML).join('')+'</div>';
      const more=mobile?'<details class="mls-output-more"'+(!primary?' open':'')+'><summary>其他练习</summary><div class="output-tabs">'+modes.filter(([mode])=>!['sentences','batch'].includes(mode)).map(modeHTML).join('')+'</div></details>':'';
      const content=this.mode==='sentences'&&sentenceAvailable?this.options.sentencePractice.render():this.mode==='batch'&&this.options.batchPractice?this.options.batchPractice.render():(this.mode==='spell'?this.renderSpell():this.mode==='retell'?this.renderRetell():this.renderWrite())+(this.mode!=='spell'?this.grammarHTML():'');
      return tabs+(!primary?more:'')+content+(!primary?this.draftStatusHTML():'')+(primary?more:'');
    }

    checkGrammar(redraw=true){if(!this.answer.trim()){this.notify('先写一段英文，再检查。');return;}if(!global.StudyGrammar){this.grammarText='';this.grammarIssues=null;this.notify('语法规则正在加载，请刷新后再试。');return;}if(redraw)this.assisted=true;this.grammarText=this.answer;this.grammarIssues=global.StudyGrammar.check(this.answer);if(redraw){this.flush();this.redraw();}}
    applyGrammar(index){if(this.grammarText!==this.answer){this.notify('输入已改变，请重新检查。');return;}this.assisted=true;this.answer=index<0?global.StudyGrammar.applyAll(this.answer,this.grammarIssues||[]):global.StudyGrammar.apply(this.answer,(this.grammarIssues||[])[index]);this.result=null;this.grammarText=this.answer;this.grammarIssues=global.StudyGrammar.check(this.answer);this.flush();this.redraw();this.notify('建议已填回输入框，请结合句意确认。');}
    grammarHTML(){const e=this.escape,issues=this.grammarIssues;return `<section class="grammar-helper"><h3>基础语法检查与修改建议</h3><p>提交默写或复述后，会自动检查主谓一致、助动词、冠词和常见搭配，并在这里显示修改建议。全部在本地处理，最多检查前10000个字符；这是常见规则检查，复杂语法和句意仍需结合原文确认。</p><button class="button" data-output-action="grammar-check">${issues?'重新检查语法':'单独检查语法'}</button><div class="grammar-feedback">${issues?issues.length?`<h4>发现 ${issues.length} 处可检查的问题</h4>${issues.map((issue,i)=>`<article class="grammar-issue"><div><del>${e(issue.original)}</del><span> → </span><ins>${e(issue.replacement)}</ins></div><p>${e(issue.message)}</p><button class="button subtle" data-output-action="grammar-apply" data-grammar-index="${i}">采用此建议</button></article>`).join('')}<button class="button subtle" data-output-action="grammar-all">应用当前全部建议</button>`:'<p class="grammar-ok">已完成本地常见规则检查，未发现已覆盖类型的问题。可对照原文继续检查时态、句意和遗漏。</p>':''}</div></section>`;}

    originalHTML(paragraphs) {return this.showOriginal?`<div class="output-target">${paragraphs.map(paragraph=>`<p class="english">${this.escape(paragraph.en)}</p>`).join('')}</div>`:'';}
    originalButton() {return `<button type="button" class="button subtle" data-output-action="original">${this.showOriginal?'隐藏原文':'查看原文'}</button>`;}
    textarea(placeholder) {return `<label><span class="sr-only">${this.escape(placeholder)}</span><textarea class="output-textarea" data-output-input="answer" rows="7" maxlength="30000" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="${this.escape(placeholder)}" ${this.result?'readonly':''}>${this.escape(this.answer)}</textarea></label><p class="output-counter">${words(this.answer).length} 个英文单词</p>`;}
    actions() {const pending=this.pendingEvidence,failed=pending?.result===this.result&&pending.failed;return `<div class="output-actions">${this.result?'<button type="button" class="button primary" data-output-action="retry">重新练习</button>':'<button type="button" class="button primary" data-output-action="submit">提交并查看反馈</button>'}${failed?`<button type="button" class="button" data-output-action="evidence-retry">${pending.saved?'重试保存任务状态':'重试保存练习记录'}</button>`:''}</div>${failed?`<p role="status" class="small-note">${pending.saved?'输出已保存，任务状态未保存，可直接重试保存，无需重新输入。':'反馈已生成，练习记录未保存，可直接重试保存。'}</p>`:''}`;}

    renderWrite() {
      const paragraphs=this.paragraphs(), e=this.escape;
      if(!paragraphs.length)return '<p class="output-intro">当前资料没有可用于默写的英文内容。</p>';
      this.paragraphIndex=Math.min(this.paragraphIndex,paragraphs.length-1);
      const target=paragraphs[this.paragraphIndex];
      return `<div class="output-intro"><h3>记住一段，再亲手写下来</h3><p>先看原文，再隐藏默写。提交后同时给出原文对照和常见语法修改建议；对照忽略大小写与标点，按词显示漏词、多词和拼写／替换差异。</p></div><label>选择段落 <select class="output-select" data-output-paragraph="true">${paragraphs.map((paragraph,index)=>`<option value="${index}" ${index===this.paragraphIndex?'selected':''}>第 ${index+1} 段 · ${words(paragraph.en).length} 词</option>`).join('')}</select></label><p class="output-prompt">${e(target.zh || '本段暂无中文提示。先查看原文，记住内容后隐藏，再尝试默写。')}</p><div class="output-actions">${this.originalButton()}</div>${this.originalHTML([target])}${words(target.en).length>1000?'<p class="output-intro">本段较长，本次仅比较原文前1000词。建议选择较短段落。</p>':''}${this.textarea('在这里默写本段英文……')}${this.result?this.writeResultHTML():''}${this.actions()}`;
    }

    writeResultHTML() {
      const result=this.result, e=this.escape;
      return `<section class="output-result"><h3>原文对照准确率：${result.score}%</h3><p>正确 ${result.correct} 词 · 漏写 ${result.missing} 词 · 多写 ${result.extra} 词 · 拼写／替换差异 ${result.substitutions} 处</p><p class="small-note">按词编辑距离计算：准确率 = max(0, 1 − 编辑次数 ÷ 原文词数)。原文对照准确率与基础语法建议分别显示，语法建议见下方。</p><div class="output-diff">${result.operations.map(operation=>operation.type==='correct'?`<span class="diff-correct">${e(operation.actual)}</span>`:operation.type==='missing'?`<span class="diff-missing" title="漏写">[漏] ${e(operation.expected)}</span>`:operation.type==='extra'?`<span class="diff-extra" title="多写">[多] ${e(operation.actual)}</span>`:`<span class="diff-extra" title="你的输入">${e(operation.actual)}</span><span class="diff-missing" title="原文对应词">→ ${e(operation.expected)}</span>`).join(' ')}</div></section>`;
    }

    renderSpell() {
      const items=this.spellWords(), e=this.escape;
      if(!items.length)return '<p class="output-intro">'+(global.StudyKnowledge?.bank?.hasLesson(this.lesson()?.id)?'本课暂无已核对词表，词表复核后再开放单词拼写。':'当前资料尚未提取到可拼写的英文单词。')+'</p>';
      return `<div class="output-intro"><h3>听一听，再把单词拼出来</h3><p>根据释义填写英文；没有释义时，用打乱的字母做提示。忽略大小写，提交后显示真实答案。</p></div>${items.map((item,index)=>{const checked=this.result?.items?.[index];return `<div class="output-spell-row"><label><strong>${index+1}. ${e(item.meaning || '字母提示：'+this.scramble(item.word))}</strong><input type="text" class="output-spell-input ${checked?(checked.correct?'correct':'incorrect'):''}" data-output-spell="${index}" value="${e(this.spellAnswers[index] || '')}" placeholder="填写英文单词" autocomplete="off" autocapitalize="off" spellcheck="false" ${this.result?'readonly':''}></label><button type="button" class="icon-button" data-output-action="speak" data-output-index="${index}" aria-label="播放第${index+1}个单词发音">${this.icon('volume')}</button>${checked?`<p>${checked.correct?'✓ 正确':'正确答案：'+e(item.word)}${item.meaning?' · '+e(item.meaning):''}</p>`:''}</div>`;}).join('')}${this.result?`<section class="output-result"><h3>拼写正确 ${this.result.correct} / ${items.length}</h3><p>本次得分 ${this.result.score}% · 空白项按未答计。</p></section>`:''}${this.actions()}`;
    }

    renderRetell() {
      const lesson=this.lesson(), keywords=this.keywords(), e=this.escape;
      const outlines=(Array.isArray(lesson.keyPoints)?lesson.keyPoints:typeof lesson.keyPoints==='string'?[lesson.keyPoints]:[]).filter(Boolean).slice(0,5);
      const verified=lesson.textbook?.verified===true,noteHeading=verified&&lesson.source==='provided'?'学习笔记要点（不计入课文复述覆盖）':'已有内容要点';
      return `<div class="output-intro"><h3>用自己的英文，把内容讲一遍</h3><p>${e(lesson.title)} · 参考关键词，用自己的话写至少5个英文单词。提交后会检查常见语法并给出修改建议；内容覆盖率单独按所列关键词和短语计算。</p>${verified?'<p class="small-note">关键词均有教材正文依据，接受所列原形及正文出现的词形；仅统计词语覆盖，不判断情节准确性或语义一致性。</p>':''}</div><div class="retell-keywords">${keywords.map(keyword=>`<span class="keyword ${this.result?(this.result.covered.includes(keyword)?'covered':'missing'):''}">${e(keyword)}</span>`).join('')}</div>${outlines.length?`<div class="output-intro"><strong>${noteHeading}</strong>${outlines.map(point=>`<p>${e(typeof point==='string'?point:point.en || point.text || point.title || '')}</p>`).join('')}</div>`:''}<div class="output-actions">${this.originalButton()}</div>${this.originalHTML(this.paragraphs())}${this.textarea('试着用自己的英文复述主要内容……')}${this.result?`<section class="output-result"><h3>内容覆盖率（关键词）${this.result.score}%</h3><p>已覆盖：${e(this.result.covered.join('、') || '暂无')}</p><p>未覆盖：${e(this.result.missing.join('、') || '全部覆盖')}</p><p class="small-note">共写 ${this.result.wordCount} 词。此分数只衡量关键词覆盖，语法问题与修改建议在下方单独显示。可展开原文自行对照。</p></section>`:''}${this.actions()}`;
    }

    record(score,details) {
      const mode=this.mode,lesson=this.lesson(),answer=mode==='spell'?this.spellWords().map((_,index)=>String(this.spellAnswers[index]||'')).join('\n'):this.answer;
      const complete=mode==='spell'?this.spellWords().every((_,index)=>String(this.spellAnswers[index]||'').trim()):mode==='retell'?words(answer).length>=5:words(answer).length>=Math.min(5,words(this.paragraphs()[this.paragraphIndex]?.en).length);
      const evidence={type:{write:'dictation',spell:'spelling',retell:'retell'}[mode],lessonId:lesson?.id,assisted:this.assisted,answer,complete,score,at:Date.now(),roundKey:this.roundKey};
      const payload={mode,score,details:{...details,assisted:this.assisted,roundKey:this.roundKey,evidenceVersion:1,complete}};
      const pending={evidence,payload,result:this.result,saved:false,failed:false,busy:false};this.pendingEvidence=pending;
      // Subsequent attempts have access to this submission's comparison and
      // grammar feedback. The captured first-attempt evidence stays unchanged.
      this.assisted=true;
      this.flush();
      this.persistOutput(pending);
    }
    evidenceSaved(pending) {
      const finish=accepted=>{pending.busy=false;pending.failed=accepted===false;if(pending.failed)this.notify('输出已保存，任务状态未保存，可直接重试保存。');if(this.pendingEvidence===pending)this.redraw();};
      try{const accepted=this.options.onEvidence?.({...pending.evidence});if(accepted&&typeof accepted.then==='function')Promise.resolve(accepted).then(finish,()=>finish(false));else finish(accepted);}catch{finish(false);}
    }
    persistOutput(pending) {
      if(pending.busy)return;pending.busy=true;pending.failed=false;
      const finish=saved=>{if(saved!==true){pending.busy=false;pending.failed=true;this.notify('反馈已生成，但练习记录暂时未能保存。');if(this.pendingEvidence===pending)this.redraw();return;}pending.saved=true;this.evidenceSaved(pending);};
      try{const saved=this.options.saveRecord?.(pending.payload);if(saved&&typeof saved.then==='function')Promise.resolve(saved).then(finish,()=>finish(false));else finish(saved);}catch{finish(false);}
    }
    retryEvidence() {const pending=this.pendingEvidence;if(!pending||pending.busy||!pending.failed)return;if(pending.saved){pending.busy=true;this.evidenceSaved(pending);}else this.persistOutput(pending);}

    submit() {
      if(this.result)return;
      if(this.mode==='write'){
        if(!words(this.answer).length){this.notify('先写下英文内容，再提交校对。');return;}
        const paragraph=this.paragraphs()[this.paragraphIndex];
        if(!paragraph)return;
        this.result=compareWords(paragraph.en,this.answer);
        this.checkGrammar(false);
        this.record(this.result.score,{paragraph:this.paragraphIndex+1,answer:this.answer,...this.result,grammarIssues:this.grammarIssues,grammarChecked:!!global.StudyGrammar});
      }else if(this.mode==='spell'){
        const items=this.spellWords();
        if(!items.length || !items.some((_,index)=>String(this.spellAnswers[index] || '').trim())){this.notify('至少填写一个单词，再提交答案。');return;}
        const results=items.map((item,index)=>({word:item.word,answer:String(this.spellAnswers[index] || ''),correct:canonical(this.spellAnswers[index])===canonical(item.word)}));
        const correct=results.filter(item=>item.correct).length;
        this.result={items:results,correct,score:Math.round(correct/items.length*100)};
        this.record(this.result.score,this.result);
      }else{
        const wordCount=words(this.answer).length;
        if(wordCount<5){this.notify('再多写一点，至少用5个英文单词复述。');return;}
        const targets=this.retellTargets(), text=' '+canonical(this.answer)+' ', verified=this.lesson()?.textbook?.verified===true,covered=targets.filter(target=>target.forms.some(form=>verified?containsExpression(this.answer,form):text.includes(' '+form+' '))).map(target=>target.label), missing=targets.filter(target=>!covered.includes(target.label)).map(target=>target.label);
        this.result={covered,missing,wordCount,score:targets.length?Math.round(covered.length/targets.length*100):0};
        this.checkGrammar(false);
        this.record(this.result.score,{...this.result,feedbackType:'keyword-coverage',answer:this.answer,grammarIssues:this.grammarIssues,grammarChecked:!!global.StudyGrammar});
      }
      this.redraw();
    }

    destroy(){document.removeEventListener('click',this.click);document.removeEventListener('input',this.input);document.removeEventListener('change',this.change);}
  }

  global.OutputPractice=OutputPractice;
})(window);
