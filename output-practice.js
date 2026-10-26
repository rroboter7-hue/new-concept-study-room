(function (global) {
  'use strict';

  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const words = text => String(text || '').normalize('NFKC').match(/[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+)*|\d+/g) || [];
  const canonical = text => words(text).map(word=>word.toLowerCase().replace(/’/g,"'")).join(' ');
  const stopWords = new Set('this that with from have been were they them what when which where your there then into just does will would could should about their these those some also very more because after before'.split(' '));

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
      this.reset();
      this.click=event=>{
        const button=event.target.closest && event.target.closest('[data-output-action]');
        if (!button || !button.closest('#output-content')) return;
        try {
          switch(button.dataset.outputAction) {
            case 'mode':this.options.sentencePractice?.flush();this.options.batchPractice?.flush();this.options.batchPractice?.cancelCheck(false);this.mode=button.dataset.outputMode;this.result=null;this.showOriginal=false;this.redraw();break;
            case 'original':this.showOriginal=!this.showOriginal;this.redraw();break;
            case 'submit':this.submit();break;case 'grammar-check':this.checkGrammar();break;case 'grammar-apply':this.applyGrammar(Number(button.dataset.grammarIndex));break;case 'grammar-all':this.applyGrammar(-1);break;
            case 'retry':this.result=null;this.answer='';this.spellAnswers={};this.showOriginal=false;this.grammarIssues=null;this.grammarText='';this.redraw();break;
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
          this.answer=input.value;this.grammarIssues=null;this.grammarText='';const feedback=document.querySelector('#output-content .grammar-feedback');if(feedback)feedback.innerHTML='<p class="small-note">输入已改变，请重新检查。</p>';
          const count=document.querySelector('#output-content .output-counter');
          if (count) count.textContent=`${words(this.answer).length} 个英文单词`;
        }
        if (input.dataset.outputSpell!==undefined) this.spellAnswers[input.dataset.outputSpell]=input.value;
      };
      this.change=event=>{
        const select=event.target;
        if (select.dataset.outputParagraph===undefined || !select.closest('#output-content')) return;
        this.paragraphIndex=Math.max(0,Number(select.value)||0);this.answer='';this.result=null;this.showOriginal=false;this.grammarIssues=null;this.grammarText='';this.redraw();
      };
      document.addEventListener('click',this.click);
      document.addEventListener('input',this.input);
      document.addEventListener('change',this.change);
    }

    static compareWords(expected,actual) {return compareWords(expected,actual);}
    static countWords(text) {return words(text).length;}
    reset() {this.grammarIssues=null;this.grammarText='';this.mode='write';this.paragraphIndex=0;this.answer='';this.spellAnswers={};this.result=null;this.showOriginal=false;this.scrambles={};}
    setLesson(lesson) {if (lesson?.id!==this.current?.id) {this.options.sentencePractice?.flush();this.options.batchPractice?.flush();this.options.batchPractice?.cancelCheck(false);this.reset();}this.current=lesson || null;}
    lesson() {const lesson=this.options.getLesson?.() || this.current;if (lesson?.id!==this.current?.id)this.setLesson(lesson);else this.current=lesson;return lesson;}
    paragraphs() {return (this.lesson()?.paragraphs || []).filter(paragraph=>paragraph && typeof paragraph.en==='string' && paragraph.en.trim());}
    notify(message) {this.options.toast?.(message);}
    redraw() {const content=document.querySelector('#output-content');if(content)content.innerHTML=this.render();}

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

    keywords() {
      const lesson=this.lesson(), list=this.spellWords().slice(0,8).map(item=>item.word);
      (lesson?.usage || []).slice(0,3).forEach(item=>{if(item?.phrase && words(item.phrase).length<=6 && !list.some(word=>canonical(word)===canonical(item.phrase)))list.push(item.phrase);});
      return list.slice(0,10);
    }

    render() {
      const lesson=this.lesson();
      if(!lesson)return '<div class="empty-state">请选择一篇课文后开始输出练习。</div>';
      const sentenceAvailable=Boolean(this.options.sentencePractice)&&(typeof this.options.canPracticeSentences!=='function'||this.options.canPracticeSentences(lesson)!==false);
      if(!sentenceAvailable&&(this.mode==='sentences'||this.mode==='batch')){
        this.options.sentencePractice?.flush();this.mode='write';this.result=null;this.showOriginal=false;
      }
      const modes=[['write','分段默写'],['spell','单词拼写'],['retell','英文复述']];
      if(sentenceAvailable)modes.push(['sentences','五句造句']);
      if(sentenceAvailable&&this.options.batchPractice)modes.push(['batch','批量检查']);
      const tabs=modes.map(([mode,label])=>'<button type="button" class="output-tab '+(this.mode===mode?'active':'')+'" data-output-action="mode" data-output-mode="'+mode+'" aria-pressed="'+(this.mode===mode)+'">'+label+'</button>').join('');
      if(this.mode==='sentences'&&sentenceAvailable)return '<div class="output-tabs" aria-label="输出练习模式">'+tabs+'</div>'+this.options.sentencePractice.render();
      if(this.mode==='batch'&&sentenceAvailable&&this.options.batchPractice)return '<div class="output-tabs" aria-label="输出练习模式">'+tabs+'</div>'+this.options.batchPractice.render();
      return '<div class="output-tabs" aria-label="输出练习模式">'+tabs+'</div>'+(this.mode==='spell'?this.renderSpell():this.mode==='retell'?this.renderRetell():this.renderWrite())+(this.mode!=='spell'?this.grammarHTML():'');
    }

    checkGrammar(redraw=true){if(!this.answer.trim()){this.notify('先写一段英文，再检查。');return;}if(!global.StudyGrammar){this.grammarText='';this.grammarIssues=null;this.notify('语法规则正在加载，请刷新后再试。');return;}this.grammarText=this.answer;this.grammarIssues=global.StudyGrammar.check(this.answer);if(redraw)this.redraw();}
    applyGrammar(index){if(this.grammarText!==this.answer){this.notify('输入已改变，请重新检查。');return;}this.answer=index<0?global.StudyGrammar.applyAll(this.answer,this.grammarIssues||[]):global.StudyGrammar.apply(this.answer,(this.grammarIssues||[])[index]);this.result=null;this.grammarText=this.answer;this.grammarIssues=global.StudyGrammar.check(this.answer);this.redraw();this.notify('建议已填回输入框，请结合句意确认。');}
    grammarHTML(){const e=this.escape,issues=this.grammarIssues;return `<section class="grammar-helper"><h3>基础语法检查与修改建议</h3><p>提交默写或复述后，会自动检查主谓一致、助动词、冠词和常见搭配，并在这里显示修改建议。全部在本地处理，最多检查前10000个字符；这是常见规则检查，复杂语法和句意仍需结合原文确认。</p><button class="button" data-output-action="grammar-check">${issues?'重新检查语法':'单独检查语法'}</button><div class="grammar-feedback">${issues?issues.length?`<h4>发现 ${issues.length} 处可检查的问题</h4>${issues.map((issue,i)=>`<article class="grammar-issue"><div><del>${e(issue.original)}</del><span> → </span><ins>${e(issue.replacement)}</ins></div><p>${e(issue.message)}</p><button class="button subtle" data-output-action="grammar-apply" data-grammar-index="${i}">采用此建议</button></article>`).join('')}<button class="button subtle" data-output-action="grammar-all">应用当前全部建议</button>`:'<p class="grammar-ok">已完成本地常见规则检查，未发现已覆盖类型的问题。可对照原文继续检查时态、句意和遗漏。</p>':''}</div></section>`;}

    originalHTML(paragraphs) {return this.showOriginal?`<div class="output-target">${paragraphs.map(paragraph=>`<p class="english">${this.escape(paragraph.en)}</p>`).join('')}</div>`:'';}
    originalButton() {return `<button type="button" class="button subtle" data-output-action="original">${this.showOriginal?'隐藏原文':'查看原文'}</button>`;}
    textarea(placeholder) {return `<label><span class="sr-only">${this.escape(placeholder)}</span><textarea class="output-textarea" data-output-input="answer" rows="7" maxlength="30000" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="${this.escape(placeholder)}" ${this.result?'readonly':''}>${this.escape(this.answer)}</textarea></label><p class="output-counter">${words(this.answer).length} 个英文单词</p>`;}
    actions() {return `<div class="output-actions">${this.result?'<button type="button" class="button primary" data-output-action="retry">重新练习</button>':'<button type="button" class="button primary" data-output-action="submit">提交并查看反馈</button>'}</div>`;}

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
      return `<div class="output-intro"><h3>用自己的英文，把内容讲一遍</h3><p>${e(lesson.title)} · 参考关键词，用自己的话写至少5个英文单词。提交后会检查常见语法并给出修改建议；内容覆盖率单独按所列关键词和短语计算。</p></div><div class="retell-keywords">${keywords.map(keyword=>`<span class="keyword ${this.result?(this.result.covered.includes(keyword)?'covered':'missing'):''}">${e(keyword)}</span>`).join('')}</div>${outlines.length?`<div class="output-intro"><strong>已有内容要点</strong>${outlines.map(point=>`<p>${e(typeof point==='string'?point:point.en || point.text || point.title || '')}</p>`).join('')}</div>`:''}<div class="output-actions">${this.originalButton()}</div>${this.originalHTML(this.paragraphs())}${this.textarea('试着用自己的英文复述主要内容……')}${this.result?`<section class="output-result"><h3>内容覆盖率（关键词）${this.result.score}%</h3><p>已覆盖：${e(this.result.covered.join('、') || '暂无')}</p><p>未覆盖：${e(this.result.missing.join('、') || '全部覆盖')}</p><p class="small-note">共写 ${this.result.wordCount} 词。此分数只衡量关键词覆盖，语法问题与修改建议在下方单独显示。可展开原文自行对照。</p></section>`:''}${this.actions()}`;
    }

    record(score,details) {
      try {
        const saved=this.options.saveRecord?.({mode:this.mode,score,details});
        if(saved && typeof saved.catch==='function')saved.catch(()=>this.notify('反馈已生成，但练习记录暂时未能保存。'));
      }catch(_){this.notify('反馈已生成，但练习记录暂时未能保存。');}
    }

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
        const keywords=this.keywords(), text=' '+canonical(this.answer)+' ', covered=keywords.filter(keyword=>text.includes(' '+canonical(keyword)+' ')), missing=keywords.filter(keyword=>!covered.includes(keyword));
        this.result={covered,missing,wordCount,score:keywords.length?Math.round(covered.length/keywords.length*100):0};
        this.checkGrammar(false);
        this.record(this.result.score,{...this.result,feedbackType:'keyword-coverage',answer:this.answer,grammarIssues:this.grammarIssues,grammarChecked:!!global.StudyGrammar});
      }
      this.redraw();
    }

    destroy(){document.removeEventListener('click',this.click);document.removeEventListener('input',this.input);document.removeEventListener('change',this.change);}
  }

  global.OutputPractice=OutputPractice;
})(window);
