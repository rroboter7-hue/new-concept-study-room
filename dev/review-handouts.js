(function() {
  const handoutsData = [
    {
      book: "第一册",
      lessons: [
        { lesson: "Lesson 1-2", patterns: [{ en: "Excuse me! Is this your handbag?", zh: "对不起！这是你的手提包吗？" }, { en: "Yes, it is. Thank you very much.", zh: "是的，它是。非常感谢。" }] },
        { lesson: "Lesson 5-6", patterns: [{ en: "Good morning. This is Miss Sophie Dupont.", zh: "早上好。这位是索菲娅·杜邦小姐。" }] }
      ]
    },
    {
      book: "第二册",
      lessons: [
        { lesson: "Lesson 1", patterns: [{ en: "It was Sunday. I never get up early on Sundays.", zh: "那是个星期天。在星期天我从不早起。" }, { en: "I sometimes stay in bed until lunchtime.", zh: "我有时在床上一直躺到吃午饭的时间。" }] }
      ]
    },
    {
      book: "第三册",
      lessons: [
        { lesson: "Lesson 1", patterns: [{ en: "A puma at large.", zh: "逃遁的美洲狮。" }] }
      ]
    }
  ];

  const grammarDrills = [
    {
      title: "时态专项",
      questions: [
        { q: "He ______ (go) to school by bike every day.", a: "goes（习惯性动作用一般现在时）" },
        { q: "Look! The boy ______ (run).", a: "is running（Look!提示现在进行时）" }
      ]
    }
  ];

  function render() {
    let targetContainer = document.getElementById('rh-container');
    if (!targetContainer || targetContainer.innerHTML.trim() !== '') return; 

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
  setInterval(render, 500); 
})();
