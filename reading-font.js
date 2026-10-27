(function (global, factory) {
  'use strict';
  const Controls = factory();
  if (typeof module === 'object' && module.exports) module.exports = Controls;
  else global.ReadingFontControls = Controls;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function normalize(value) {
    if (!['number','string'].includes(typeof value) || value === '') return 100;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(80, Math.min(160, Math.round(number / 10) * 10)) : 100;
  }
  class ReadingFontControls {
    constructor({container,getValue=()=>100,saveValue=()=>false,style,preserve=fn=>fn(),toast=()=>{}} = {}) {
      this.container = container;
      this.getValue = getValue;
      this.saveValue = saveValue;
      this.style = style;
      this.preserve = preserve;
      this.toast = toast;
      this.percent = 100;
      if (container) {
        container.classList.add('reading-font-tools');
        container.setAttribute('role','group');
        container.setAttribute('aria-label','课文字号');
        container.innerHTML = '<span class="reading-font-label">课文字号</span>' +
          '<button type="button" class="button subtle" data-reading-font="decrease" aria-label="减小课文字号">A−</button>' +
          '<output class="reading-font-value" data-reading-font="value" aria-label="当前课文字号">100%</output>' +
          '<button type="button" class="button subtle" data-reading-font="increase" aria-label="增大课文字号">A+</button>' +
          '<button type="button" class="button subtle" data-reading-font="reset" aria-label="恢复默认字号">默认</button>' +
          '<span class="reading-font-status" data-reading-font="status" role="status" aria-live="polite"></span>';
        this.decrease = container.querySelector('[data-reading-font="decrease"]');
        this.increase = container.querySelector('[data-reading-font="increase"]');
        this.reset = container.querySelector('[data-reading-font="reset"]');
        this.output = container.querySelector('[data-reading-font="value"]');
        this.status = container.querySelector('[data-reading-font="status"]');
        container.addEventListener('click',event=>{
          const button = event.target?.closest?.('[data-reading-font]');
          if (!button || button.tagName !== 'BUTTON' || button.disabled || !container.contains(button)) return;
          const action = button.dataset.readingFont;
          if (!['decrease','increase','reset'].includes(action)) return;
          const next = normalize(action === 'reset' ? 100 : this.percent + (action === 'increase' ? 10 : -10));
          if (next === this.percent) return;
          this.apply(next);
          let saved = false;
          try { saved = this.saveValue(next) === true; } catch (_) { /* Retain the temporary readable size. */ }
          if (this.status) this.status.textContent = saved ? '已保存' : '仅本次有效，未保存';
          if (!saved) this.toast('课文字号已调整，仅本次有效；本地存储失败，设置未保存。');
        });
      }
      this.reload();
    }
    apply(value) {
      this.percent = normalize(value);
      this.preserve(()=>{
        this.style?.setProperty('--reading-font-scale',String(this.percent / 100));
        if (this.output) this.output.textContent = this.percent + '%';
        if (this.decrease) this.decrease.disabled = this.percent <= 80;
        if (this.increase) this.increase.disabled = this.percent >= 160;
        if (this.reset) this.reset.disabled = this.percent === 100;
      });
      return this;
    }
    reload() {
      let value;
      try { value = this.getValue(); } catch (_) { value = 100; }
      this.apply(value);
      if (this.status) this.status.textContent = '';
      return this;
    }
  }
  return ReadingFontControls;
});
