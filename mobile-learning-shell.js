/* Optional mobile presentation shell. App state and audio remain owned by app.js. */
(function (global) {
  'use strict';
  const MOBILE_QUERY = '(max-width: 760px)';
  const FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const EDITABLE_EXCLUSIONS = new Set(['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'hidden', 'color', 'file']);
  const NAV = [
    ['study', '学习', 'M3 5c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1zM12 6v15'],
    ['daily-review', '复习', 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
    ['words', '生词', 'M7 3h12v18H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM7 3v15m-3 0h15M11 7h4m-4 4h4'],
    ['records', '我的', 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2']
  ];
  const icon = path => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + path + '"></path></svg>';
  function element(tag, className, html) {
    const node = document.createElement(tag);
    node.className = className;
    if (html) node.innerHTML = html;
    return node;
  }
  function editable(node) {
    if (!node || node.nodeType !== 1) return false;
    return node.isContentEditable || node.tagName === 'TEXTAREA' || (node.tagName === 'INPUT' && !EDITABLE_EXCLUSIONS.has(node.type));
  }
  function visible(node) {
    return Boolean(node && node.isConnected && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
  }

  class MobileLearningShell {
    constructor(options = {}) {
      this.options = options;
      this.enabled = new URLSearchParams(global.location.search).get('pilot') === '1';
      this.destroyed = false;
      this.mobile = false;
      this.drawerOpen = false;
      this.playerCollapsed = true;
      this.cleanups = [];
      this.inertBefore = new Map();
      this.frames = new Set();
      if (!this.enabled) return;
      this.state = {view: 'study', tab: 'reading', lesson: options.getLesson?.() || null};
      this.body = document.body;
      this.main = document.querySelector('.app-main');
      this.coursePanel = document.querySelector('.course-panel');
      this.reader = document.querySelector('.reader-panel');
      this.player = document.querySelector('.player');
      this.tabs = document.querySelector('.reader-tabs');
      this.media = global.matchMedia(MOBILE_QUERY);
      this.baselineHeight = global.innerHeight;
      this.originalBodyView = this.body.getAttribute('data-mls-view');
      this.originalReaderTabindex = this.reader?.getAttribute('tabindex');
      this.originalVariables = new Map(['--mls-nav-space', '--mls-player-space', '--mls-viewport-height', '--mls-viewport-top'].map(key => [key, this.body.style.getPropertyValue(key)]));
      this.body.classList.add('mls-pilot');
      this.mount();
      this.listen(document, 'click', event => this.captureLesson(event), true);
      this.listen(document, 'click', event => this.click(event));
      this.listen(document, 'keydown', event => this.keydown(event), true);
      this.listen(document, 'focusin', event => {
        if (this.drawerOpen && !this.dialog.contains(event.target)) this.closeButton.focus();
        this.syncViewport();
      });
      this.listen(document, 'focusout', () => this.defer(() => this.syncViewport()));
      this.listen(global, 'resize', () => this.syncViewport());
      if (this.media.addEventListener) this.listen(this.media, 'change', () => this.syncMobile());
      else {
        this.mediaListener = () => this.syncMobile();
        this.media.addListener(this.mediaListener);
        this.cleanups.push(() => this.media.removeListener(this.mediaListener));
      }
      if (global.visualViewport) {
        this.listen(global.visualViewport, 'resize', () => this.syncViewport());
        this.listen(global.visualViewport, 'scroll', () => this.syncViewport());
      }
      if (global.ResizeObserver && this.player) {
        this.playerObserver = new ResizeObserver(() => this.syncInsets());
        this.playerObserver.observe(this.player);
      }
      this.syncMobile();
      this.update(this.state);
    }

    listen(target, name, callback, capture = false) {
      target.addEventListener(name, callback, capture);
      this.cleanups.push(() => target.removeEventListener(name, callback, capture));
    }

    defer(callback) {
      const frame = global.requestAnimationFrame(() => {
        this.frames.delete(frame);
        if (!this.destroyed) callback();
      });
      this.frames.add(frame);
    }

    mount() {
      this.header = element('header', 'mls-header', '<div class="mls-brand"><strong>知新</strong><span>第二册 · 1–10课试学</span></div><button type="button" class="mls-course-button" data-mobile-action="open-courses" aria-haspopup="dialog" aria-expanded="false" aria-controls="mls-course-drawer">选课 ' + icon('M9 6h12M9 12h12M9 18h12M3 6h1m-1 6h1m-1 6h1') + '</button>');
      this.home = element('section', 'mls-learning-home', '<p class="mls-home-kicker">从一段课文开始</p><button type="button" class="mls-continue-button" data-mobile-action="continue"><span class="mls-continue-label"></span>' + icon('m9 5 7 7-7 7') + '</button><p class="mls-current-title"></p><div class="mls-home-footer"><span class="mls-lesson-status"></span><button type="button" class="mls-game-link" data-mobile-action="game">闯关挑战 <span aria-hidden="true">→</span></button></div>');
      this.home.setAttribute('aria-label', '继续学习');
      if (this.main) {
        this.main.insertBefore(this.header, this.main.firstChild);
        const study = document.getElementById('study-view');
        this.main.insertBefore(this.home, study || this.header.nextSibling);
      }
      this.nav = element('nav', 'mls-bottom-nav', NAV.map(([view, label, path]) => '<button type="button" class="mls-nav-item" data-mobile-view="' + view + '">' + icon(path) + '<span>' + label + '</span></button>').join(''));
      this.nav.setAttribute('aria-label', '底部导航');
      this.body.appendChild(this.nav);
      this.overlay = element('div', 'mls-course-overlay');
      this.overlay.hidden = true;
      this.backdrop = element('div', 'mls-course-backdrop');
      this.backdrop.setAttribute('aria-hidden', 'true');
      this.dialog = element('section', 'mls-course-dialog', '<div class="mls-drawer-heading"><div><h2 id="mls-drawer-title">选择课程</h2><p>第二册 · 前10课试学</p></div><button type="button" class="mls-close-button" data-mobile-action="close-courses" aria-label="关闭课程目录">' + icon('m6 6 12 12M6 18 18 6') + '</button></div>');
      this.dialog.id = 'mls-course-drawer';
      this.dialog.setAttribute('role', 'dialog');
      this.dialog.setAttribute('aria-modal', 'true');
      this.dialog.setAttribute('aria-labelledby', 'mls-drawer-title');
      this.dialog.tabIndex = -1;
      this.closeButton = this.dialog.querySelector('[data-mobile-action="close-courses"]');
      this.overlay.append(this.backdrop, this.dialog);
      this.body.appendChild(this.overlay);
      if (this.coursePanel) {
        this.coursePlaceholder = document.createComment('mobile course panel position');
        this.coursePanel.parentNode.insertBefore(this.coursePlaceholder, this.coursePanel);
      }
      if (this.player) {
        this.playerButton = element('button', 'mls-player-toggle');
        this.playerButton.type = 'button';
        this.playerButton.dataset.mobileAction = 'toggle-player';
        this.playerButton.setAttribute('aria-expanded', 'false');
        this.player.appendChild(this.playerButton);
      }
    }

    syncMobile() {
      if (!this.enabled || this.destroyed) return;
      const mobile = this.media.matches;
      if (mobile !== this.mobile) {
        this.closeCourses({restoreFocus: false});
        this.mobile = mobile;
        this.body.classList.toggle('mls-mobile', mobile);
        if (mobile && this.coursePanel) this.dialog.appendChild(this.coursePanel);
        else this.restoreCoursePanel();
      }
      this.syncPresentation();
      this.syncViewport();
    }

    restoreCoursePanel() {
      if (this.coursePanel && this.coursePlaceholder?.parentNode) this.coursePlaceholder.parentNode.insertBefore(this.coursePanel, this.coursePlaceholder.nextSibling);
    }

    update(next = {}) {
      if (!this.enabled || this.destroyed) return;
      if (new URLSearchParams(global.location.search).get('pilot') !== '1') {
        this.destroy();
        return;
      }
      const previous = this.state;
      this.state = {...this.state, ...next};
      const lesson = Object.prototype.hasOwnProperty.call(next, 'lesson') ? next.lesson : (this.options.getLesson?.() || this.state.lesson);
      this.state.lesson = lesson;
      const number = lesson?.book === 2 && lesson.number >= 1 && lesson.number <= 10 ? lesson.number : 1;
      this.home.querySelector('.mls-continue-label').textContent = '继续学习第二册第' + number + '课';
      this.home.querySelector('.mls-current-title').textContent = lesson?.book === 2 && lesson.number <= 10 ? String(lesson.title || '').replace(/^第\d+课\s*[·・]\s*/, '') : '从第一课开始，读懂一个故事';
      const status = this.options.getStatus?.(lesson?.id);
      this.home.querySelector('.mls-lesson-status').textContent = typeof status === 'string' ? status : status?.completed ? '已学完 · 可以再读一遍' : '按自己的节奏，接着读';
      this.body.setAttribute('data-mls-view', this.state.view || 'study');
      const activeView = this.state.view === 'game' ? 'study' : this.state.view;
      for (const button of this.nav.querySelectorAll('[data-mobile-view]')) {
        const active = button.dataset.mobileView === activeView;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      }
      if ((this.state.tab === 'practice' || this.state.tab === 'output') && (previous.tab !== this.state.tab || previous.view !== this.state.view)) this.playerCollapsed = true;
      this.syncPresentation();
      this.defer(() => this.syncInsets());
    }

    syncPresentation() {
      this.body.classList.toggle('mls-player-collapsed', this.mobile && this.playerCollapsed);
      if (this.playerButton) {
        this.playerButton.textContent = this.playerCollapsed ? '展开音频' : '收起音频';
        this.playerButton.setAttribute('aria-expanded', String(!this.playerCollapsed));
      }
    }

    click(event) {
      if (!this.mobile || this.destroyed) return;
      const target = event.target.closest?.('[data-mobile-action],[data-mobile-view]');
      if (event.target === this.overlay || event.target === this.backdrop) {
        this.closeCourses();
        return;
      }
      if (!target) return;
      if (target.dataset.mobileView) {
        this.closeCourses({restoreFocus: false});
        this.options.navigate?.(target.dataset.mobileView);
        return;
      }
      switch (target.dataset.mobileAction) {
        case 'open-courses': this.openCourses(target); break;
        case 'close-courses': this.closeCourses(); break;
        case 'continue':
          this.closeCourses({restoreFocus: false});
          this.options.continueLesson?.();
          this.defer(() => this.focusReader());
          break;
        case 'game': this.options.navigate?.('game'); break;
        case 'toggle-player':
          this.playerCollapsed = !this.playerCollapsed;
          this.syncPresentation();
          this.defer(() => this.syncInsets());
          break;
      }
    }

    captureLesson(event) {
      if (!this.mobile || this.destroyed) return;
      const button = event.target.closest?.('[data-lesson]');
      if (!button) return;
      const id = button.dataset.lesson;
      this.closeCourses({restoreFocus: false});
      // app.js receives the original event and selects the lesson in bubble phase.
      // Defer the notification until its synchronous DOM replacement has finished.
      this.defer(() => {
        if (this.options.onSelect) this.options.onSelect(id);
        else this.focusReader();
      });
    }

    openCourses(opener) {
      if (!this.enabled || !this.mobile || this.destroyed || this.drawerOpen) return;
      this.returnFocus = opener || document.activeElement;
      this.drawerOpen = true;
      this.overlay.hidden = false;
      this.body.classList.add('mls-drawer-open');
      this.header.querySelector('[data-mobile-action="open-courses"]').setAttribute('aria-expanded', 'true');
      for (const node of [this.main, this.nav, this.player, document.querySelector('.app-sidebar')].filter(Boolean)) {
        this.inertBefore.set(node, node.inert);
        node.inert = true;
      }
      this.closeButton.focus({preventScroll: true});
      this.defer(() => {
        const active = this.dialog.querySelector('.lesson-row.active,[data-lesson][aria-current="true"]');
        active?.scrollIntoView({block: 'nearest'});
      });
    }

    closeCourses({restoreFocus = true} = {}) {
      if (!this.enabled || !this.drawerOpen) return;
      this.drawerOpen = false;
      this.overlay.hidden = true;
      this.body.classList.remove('mls-drawer-open');
      this.header.querySelector('[data-mobile-action="open-courses"]').setAttribute('aria-expanded', 'false');
      for (const [node, before] of this.inertBefore) node.inert = before;
      this.inertBefore.clear();
      if (restoreFocus && visible(this.returnFocus)) this.returnFocus.focus({preventScroll: true});
    }

    keydown(event) {
      if (!this.drawerOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeCourses();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...this.dialog.querySelectorAll(FOCUSABLE)].filter(visible);
      const first = items[0] || this.dialog, last = items[items.length - 1] || this.dialog;
      if (event.shiftKey && (document.activeElement === first || !this.dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !this.dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }

    focusReader() {
      if (!this.enabled || !this.mobile || this.destroyed || !visible(this.reader)) return;
      this.reader.tabIndex = -1;
      this.reader.focus({preventScroll: true});
      this.reader.scrollIntoView({block: 'start', behavior: global.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    }

    syncViewport() {
      if (!this.enabled || this.destroyed) return;
      const viewport = global.visualViewport;
      const height = viewport?.height || global.innerHeight;
      const top = viewport?.offsetTop || 0;
      const active = document.activeElement;
      if (!editable(active)) this.baselineHeight = global.innerHeight;
      const overlap = Math.max(global.innerHeight, this.baselineHeight) - height - top;
      const keyboard = this.mobile && editable(active) && overlap > 120;
      const changed = this.body.classList.contains('mls-keyboard-open') !== Boolean(keyboard);
      this.body.classList.toggle('mls-keyboard-open', Boolean(keyboard));
      this.body.style.setProperty('--mls-viewport-height', height + 'px');
      this.body.style.setProperty('--mls-viewport-top', top + 'px');
      this.syncInsets();
      if (keyboard && changed) this.defer(() => {
        if (editable(document.activeElement)) document.activeElement.scrollIntoView({block: 'center', behavior: 'auto'});
      });
    }

    syncInsets() {
      if (!this.enabled || this.destroyed) return;
      const chromeVisible = this.mobile && !this.body.classList.contains('mls-keyboard-open');
      const nav = chromeVisible && visible(this.nav) ? this.nav.getBoundingClientRect().height : 0;
      const player = chromeVisible && this.state.view === 'study' && visible(this.player) ? this.player.getBoundingClientRect().height : 0;
      this.body.style.setProperty('--mls-nav-space', nav + 'px');
      this.body.style.setProperty('--mls-player-space', player + 'px');
    }

    destroy() {
      if (!this.enabled || this.destroyed) return;
      this.closeCourses({restoreFocus: false});
      this.destroyed = true;
      this.cleanups.forEach(cleanup => cleanup());
      this.frames.forEach(frame => global.cancelAnimationFrame(frame));
      this.frames.clear();
      this.playerObserver?.disconnect();
      this.restoreCoursePanel();
      this.coursePlaceholder?.remove();
      for (const node of [this.header, this.home, this.nav, this.overlay, this.playerButton]) node?.remove();
      this.body.classList.remove('mls-pilot', 'mls-mobile', 'mls-drawer-open', 'mls-player-collapsed', 'mls-keyboard-open');
      if (this.originalBodyView === null) this.body.removeAttribute('data-mls-view');
      else this.body.setAttribute('data-mls-view', this.originalBodyView);
      if (this.reader) {
        if (this.originalReaderTabindex === null) this.reader.removeAttribute('tabindex');
        else this.reader.setAttribute('tabindex', this.originalReaderTabindex);
      }
      for (const [key, value] of this.originalVariables) {
        if (value) this.body.style.setProperty(key, value);
        else this.body.style.removeProperty(key);
      }
    }
  }
  global.MobileLearningShell = MobileLearningShell;
})(window);
