(function() {
  // 1. 自动插入 CSS 样式
  const style = document.createElement('style');
  style.innerHTML = `
    .rh-section { margin-top: 20px; background: #1e1e24; border-radius: 12px; padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .rh-section h3 { color: #fff; margin-bottom: 16px; font-size: 18px; }
    .rh-book h4 { color: #5cc9c9; margin-bottom: 8px; font-size: 15px; }
    .rh-lesson strong { color: #a0a0b0; font-size: 13px; }
    .rh-lesson ul { list-style: none; padding: 0; margin-top: 8px; }
    .rh-lesson li { background: #2a2a35; padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px; }
    .rh-en { color: #fff; font-weight: 500; line-height: 1.4; font-size: 15px; }
    .rh-zh { color: #8c8c9e; font-size: 14px; }
    .rh-add-review { align-self: flex-start; margin-top: 6px; background: transparent; border: 1px solid #5cc9c9; color: #5cc9c9; padding: 4px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: 0.2s; }
    .rh-add-review:active { background: rgba(92, 201, 201, 0.1); }
    .rh-add-review:disabled { border-color: #444; color: #666; cursor: default; }
    .rh-drill strong { color: #5cc9c9; font-size: 15px; }
    .rh-drill ul { list-style: none; padding: 0; }
    .rh-drill li { background: #2a2a35; padding: 12px; border-radius: 8px; margin-top: 8px; }
    .rh-q { color: #fff; margin-bottom: 8px; font-size: 14px; line-height: 1.4; }
    .rh-drill details summary { color: #5cc9c9; cursor: pointer; font-size: 13px; outline: none; }
    .rh-a { margin-top: 8px; color: #5cc9c9; font-weight: 500; font-size: 13px; border-top: 1px solid #333; padding-top: 8px;}
  `;
  document.head.appendChild(style);

  const handoutsData = [
    { book: "第一册", lessons: [{ lesson: "Lesson 1-2", patterns: [{ en: "Excuse me! Is this your handbag?", zh: "对不起！这是你的手提包吗？" }, { en: "Yes, it is. Thank you very much.", zh: "是的，它是。非常感谢。" }] }] },
    { book: "第二册", lessons: [{ lesson: "Lesson 1", patterns: [{ en: "It was Sunday. I never get up early on Sundays.", zh: "那是个星期天。在星期天我从不早起。" }] }] }
  ];

  const grammarDrills = [
    { title: "时态专项", questions: [{ q: "He ______ (go) to school by bike every day.", a: "goes（习惯性动作用一般现在时）" }] }
  ];

  function render() {
    // 防止重复插入
    if (document.getElementById('rh-container')) return;

    let targetContainer = document.createElement('div');
    targetContainer.id = 'rh-container';

    // 自动寻找“本次复习”所在的元素，并把我们的内容插在它后面
    const allElements = document.querySelectorAll('*');
    let inserted = false;
    for (let el of allElements) {
      if (el.textContent.includes('为你安排的一小组') || el.textContent.includes('本次复习')) {
        el.parentNode.insertBefore(targetContainer, el.nextSibling);
        inserted = true;
        break;
      }
    }

    if (inserted) {
      targetContainer.innerHTML = `
        <div class="rh-section">
          <h3>📖 句型替换与造句</h3>
          ${handoutsData.map(book => `
            <div class="rh-book">
              <h4>${book.book}</h4>
              ${book.lessons.map(lesson => `
                <div class="rh-lesson">
                  <strong>${lesson.lesson}</strong>
                  <ul>
                    ${lesson.patterns.map(p => `
                      <li>
                        <div class="rh-en">${p.en}</div>
                        <div class="rh-zh">${p.zh}</div>
                        <button class="rh-add-review" data-text="${p.en} | ${p.zh}">加入复习</button>
                      </li>
                    `).join('')}
                  </ul>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
        
        <div class="rh-section">
          <h3>📝 语法专项训练</h3>
          ${grammarDrills.map(drill => `
            <div class="rh-drill">
              <strong>${drill.title}</strong>
              <ul>
                ${drill.questions.map((q, i) => `
                  <li>
                    <div class="rh-q">${q.q}</div>
                    <details><summary>查看解析</summary><div class="rh-a">${q.a}</div></details>
                  </li>
                `).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      `;

      targetContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('rh-add-review')) {
          const text = e.target.getAttribute('data-text');
          let reviews = JSON.parse(localStorage.getItem('rh-review-v1') || '[]');
          if (!reviews.includes(text)) {
            reviews.push(text);
            localStorage.setItem('rh-review-v1', JSON.stringify(reviews));
            e.target.textContent = '✅ 已加入';
            e.target.disabled = true;
          }
        }
      });
    }
  }
  
  // 每半秒检查一次页面
  setInterval(render, 500); 
})();
