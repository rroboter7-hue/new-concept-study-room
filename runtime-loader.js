/* The published page embeds this small ES5 bootstrap, so recovery does not
   depend on downloading another file. It never opens browser study storage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.StudyStartup = factory(root);
}(typeof window === 'object' ? window : this, function (root) {
  'use strict';
  var doc = root.document, manifest, current = 0, cssLeft = 0, started = false;
  var done = {}, executed = {}, failed = [], fatal = false, finished = false;
  var loading = [], activeSource = '', sourceError = null;
  var versionChecked = false;
  var intent = '', readyTimer = null, readyObserver = null, readyChecks = 0;
  function el(id) { return doc.getElementById('study-startup' + (id ? '-' + id : '')); }
  function text(id, value) { var target = el(id); if (target) target.textContent = value; }
  function show(id, visible) { var target = el(id); if (target) target.hidden = !visible; }
  function removeNode(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
    else if (node && typeof node.remove === 'function') node.remove();
  }
  function unbind(task) {
    root.clearTimeout(task.timer); root.clearTimeout(task.delay);
    if (task.node) { task.node.onload = task.node.onerror = null; }
  }
  function clearReadyWait() {
    root.clearTimeout(readyTimer); readyTimer = null;
    if (readyObserver) { readyObserver.disconnect(); readyObserver = null; }
  }
  function chooseIntent(value) {
    if (fatal || finished) return;
    intent = value;
    var names = ['','第一册','第二册','第三册','第四册'];
    text('intent', value === 'continue' ? '正在准备继续学习，准备好后将自动打开…' : '正在准备' + names[Number(value)] + '课程，准备好后将自动打开…');
    ['1','2','3','4','continue'].forEach(function (key) {
      var button = el(key === 'continue' ? 'continue' : 'book-' + key);
      if (button) button.setAttribute('aria-pressed', String(value === key));
    });
  }
  function handoff() {
    if (fatal || finished || failed.length) return;
    // app.js starts the real shelf asynchronously after flushing the route.
    // Its visible DOM is the public readiness signal; never inspect study data.
    var needsShelf = manifest.scripts.some(function (asset) { return asset.files.indexOf('app.js') !== -1; }) && manifest.scripts.some(function (asset) { return asset.files.indexOf('bookshelf-home.js') !== -1; });
    var shelf = needsShelf && doc.querySelector('.bookshelf-home');
    if (needsShelf && (!shelf || shelf.hidden)) {
      if (readyTimer !== null) return;
      if (typeof root.MutationObserver === 'function') {
        readyObserver = new root.MutationObserver(function () {
          if (fatal || finished) return;
          var visibleShelf = doc.querySelector('.bookshelf-home');
          if (visibleShelf && !visibleShelf.hidden) { clearReadyWait(); handoff(); }
        });
        readyObserver.observe(doc.body, {childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
        readyTimer = root.setTimeout(function () { stopForExecution('书架未能完成准备'); }, 30000);
      } else {
        readyTimer = root.setTimeout(function () {
          readyTimer = null; readyChecks += 1;
          if (readyChecks >= 600) { stopForExecution('书架未能完成准备'); return; }
          handoff();
        }, 50);
      }
      return;
    }
    var target = intent && shelf && shelf.querySelector(intent === 'continue' ? '[data-shelf-continue]' : '[data-shelf-book="' + intent + '"]');
    if (intent && !target) { stopForExecution('书架控件未能完成准备'); return; }
    clearReadyWait(); finished = true; show('', false);
    doc.body.className = (doc.body.className || '').replace(/\bstudy-booting\b/g, '').replace(/^\s+|\s+$/g, '');
    root.removeEventListener('error', onError);
    // Clear before dispatch so reentrant or duplicate deliveries cannot navigate twice.
    intent = ''; if (target) target.click();
  }
  function update() {
    if (fatal || failed.length || finished) return;
    var total = manifest.scripts.length + manifest.styles.length;
    var loaded = current + manifest.styles.length - cssLeft;
    var progress = el('progress'); if (progress) { progress.max = total; progress.value = loaded; }
    text('message', '准备课程文件（' + loaded + '/' + total + '）');
    if (current === manifest.scripts.length && cssLeft === 0) {
      text('message', '课程文件已就绪，正在准备书架…'); handoff();
    }
  }
  function stopForExecution(name) {
    fatal = true; clearReadyWait(); loading.forEach(unbind); failed = [];
    text('message', '课程未能完成初始化');
    text('error', '文件初始化失败：' + name + '。请重新加载；若仍失败，请更新浏览器，或用系统浏览器打开。');
    show('error', true); show('retry', false); show('reload', true);
  }
  function onError(event) {
    if (activeSource) { sourceError = event.error || new Error(event.message || 'Script failed'); return; }
    var task = loading.filter(function (item) { return item.kind === 'script' && !item.complete && item.node && event.filename && event.filename.indexOf(item.asset.src) !== -1; })[0];
    if (task) stopForExecution(task.asset.src);
  }
  function reloadPage(automatic) {
    var parts = root.location.href.split('#'), base = parts.shift().replace(/([?&])refresh=[^&]*&?/g, '$1').replace(/[?&]$/, '');
    var nextURL = base + (base.indexOf('?') === -1 ? '?' : '&') + 'refresh=' + new Date().getTime() + (automatic ? '&startup-reloaded=1' : '') + (parts.length ? '#' + parts.join('#') : '');
    if (automatic && typeof root.location.replace === 'function') root.location.replace(nextURL);
    else root.location.assign(nextURL);
  }
  function packageKey(config) {
    if (!config || config.version !== 1 || !Array.isArray(config.scripts) || !config.scripts.length || !Array.isArray(config.styles)) return null;
    var keys = [], valid = true;
    [['scripts', config.scripts, 'js'], ['styles', config.styles, 'css']].forEach(function (group) {
      group[1].forEach(function (asset) {
        if (!asset || typeof asset.src !== 'string' || !(new RegExp('^runtime-' + group[0] + '-[a-f0-9]{20}\\.' + group[2] + '$')).test(asset.src) || typeof asset.integrity !== 'string' || !/^sha384-[A-Za-z0-9+/]+={0,2}$/.test(asset.integrity) || group[0] === 'scripts' && (typeof asset.id !== 'string' || !/^[a-f0-9]{64}$/.test(asset.id))) valid = false;
        else keys.push(group[0] + ':' + asset.src + ':' + (asset.id || '') + ':' + asset.integrity);
      });
    });
    return valid ? keys.join('\n') : null;
  }
  function checkForStalePage() {
    if (versionChecked || typeof root.fetch !== 'function' || /(?:\?|&)startup-reloaded=1(?:&|$)/.test(root.location.href.split('#')[0])) return;
    var currentKey = packageKey(manifest), path = root.location.href.split('#')[0].split('?')[0];
    if (!currentKey || !/^https?:\/\//i.test(path)) return;
    versionChecked = true;
    var closed = false, origin = path.match(/^https?:\/\/[^/]+/i)[0].toLowerCase();
    var controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var options = {cache:'no-store', credentials:'same-origin', mode:'same-origin', redirect:'error'};
    if (controller) options.signal = controller.signal;
    var timer = root.setTimeout(function () { closed = true; if (controller) controller.abort(); }, 5000);
    function complete() { root.clearTimeout(timer); closed = true; }
    try {
      root.fetch(path + '?startup-check=' + new Date().getTime(), options).then(function (response) {
        if (closed || !response || !response.ok || response.url && (!/^https?:\/\/[^/]+/i.test(response.url) || response.url.match(/^https?:\/\/[^/]+/i)[0].toLowerCase() !== origin)) return null;
        return response.text();
      }).then(function (html) {
        if (closed) return; complete();
        if (typeof html !== 'string' || fatal || finished || !failed.length) return;
        var marker = '\nwindow.StudyStartup.start(', at = html.lastIndexOf(marker), latest;
        if (at === -1) return;
        var tail = html.slice(at + marker.length), end = tail.indexOf('</script>');
        if (end === -1) return; tail = tail.slice(0, end).replace(/^\s+|\s+$/g, '');
        if (tail.slice(-2) !== ');') return;
        try { latest = JSON.parse(tail.slice(0, -2)); } catch (error) { return; }
        var latestKey = packageKey(latest);
        if (latestKey && latestKey !== currentKey) { text('message', '课程已更新，正在重新载入…'); reloadPage(true); }
      }, complete);
    } catch (error) { complete(); }
  }
  function networkFailure(task) {
    if (task.complete || fatal || finished) return;
    unbind(task); removeNode(task.node);
    if (task.attempt < 2) {
      task.attempt += 1;
      text('message', '连接较慢，正在重试课程文件…');
      task.delay = root.setTimeout(function () { request(task); }, 600 * task.attempt);
      return;
    }
    if (failed.indexOf(task) === -1) failed.push(task);
    text('message', '还有文件未能加载');
    text('error', (root.navigator && root.navigator.onLine === false ? '网络已断开。' : '网络连接中断或缓存版本已更新。') + '请重试；仍失败时重新加载页面。学习记录与已保存草稿会保留。');
    show('error', true); show('retry', true); show('reload', true);
    checkForStalePage();
  }
  function request(task) {
    if (fatal || finished || task.complete) return;
    var node = doc.createElement(task.kind === 'script' ? 'script' : 'link');
    var url = task.asset.src + (task.attempt ? (task.asset.src.indexOf('?') === -1 ? '?' : '&') + 'retry=' + task.attempt : '');
    task.node = node;
    if (task.asset.integrity) { node.integrity = task.asset.integrity; node.crossOrigin = 'anonymous'; }
    if (task.kind === 'script') { node.async = true; node.src = url; }
    else { node.rel = 'stylesheet'; node.href = url; }
    node.onerror = function () { if (task.node === node) networkFailure(task); };
    node.onload = function () {
      if (task.node !== node || task.complete || fatal) return;
      if (task.kind === 'script') { stopForExecution(task.asset.src); return; }
      task.complete = true; unbind(task); cssLeft -= 1; update();
    };
    task.timer = root.setTimeout(function () { if (task.node === node) networkFailure(task); }, 30000);
    doc.head.appendChild(node);
  }
  function next() {
    update(); if (fatal || finished || current >= manifest.scripts.length) return;
    var task = {kind:'script', asset:manifest.scripts[current], attempt:0, complete:false};
    loading.push(task); request(task);
  }
  function install(id, entries) {
    if (!started || finished || fatal || done[id]) return;
    var asset = manifest.scripts[current];
    if (!asset || asset.id !== id) return;
    if (!Array.isArray(entries) || entries.length !== asset.files.length || entries.some(function (entry, i) { return entry.name !== asset.files[i] || typeof entry.source !== 'string'; })) {
      stopForExecution(asset.src); return;
    }
    // A timed-out request may finish after its replacement. Only the currently
    // expected, content-addressed group may execute, and each source runs once.
    var task = loading.filter(function (item) { return item.kind === 'script' && item.asset.id === id; })[0];
    if (!task) return;
    task.complete = true; unbind(task);
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i]; if (executed[entry.name]) continue;
      if (entry.name === 'app.js' && manifest.lessonCounts) {
        var catalog = Array.isArray(root.LESSONS) ? root.LESSONS : [];
        var incomplete = Object.keys(manifest.lessonCounts).some(function (book) {
          var seen = {};
          return catalog.filter(function (lesson) {
            if (!lesson || typeof lesson.id !== 'string' || !lesson.id || seen[lesson.id] || String(lesson.book) !== book || !lesson.textbook || !Array.isArray(lesson.paragraphs) || !lesson.paragraphs.some(function (paragraph) { return paragraph && typeof paragraph.en === 'string' && /\S/.test(paragraph.en); })) return false;
            seen[lesson.id] = true; return true;
          }).length < manifest.lessonCounts[book];
        });
        if (incomplete) { stopForExecution('课程正文未完整加载'); return; }
      }
      activeSource = entry.name; sourceError = null;
      var script = doc.createElement('script');
      script.text = entry.source + '\n//# sourceURL=' + entry.name.replace(/[\r\n]/g, '');
      try { doc.head.appendChild(script); } catch (error) { sourceError = error; }
      removeNode(script); activeSource = '';
      if (sourceError) { stopForExecution(entry.name); return; }
      executed[entry.name] = true;
    }
    done[id] = true; current += 1;
    failed = failed.filter(function (item) { return item !== task; });
    if (!failed.length) { show('error', false); show('retry', false); show('reload', false); }
    next();
  }
  function start(config) {
    if (started) return; started = true; manifest = config;
    doc.body.className = (doc.body.className || '') + ' study-booting';
    show('', true); show('error', false); show('retry', false); show('reload', false);
    ['1','2','3','4','continue'].forEach(function (key) {
      var button = el(key === 'continue' ? 'continue' : 'book-' + key);
      if (button) button.onclick = function () { chooseIntent(key); };
    });
    el('retry').onclick = function () {
      if (fatal || finished) return;
      var tasks = failed.slice(); failed = []; show('error', false); show('retry', false); show('reload', false);
      tasks.forEach(function (task) { task.attempt = 0; request(task); }); update();
    };
    el('reload').onclick = function () {
      reloadPage(false);
    };
    root.addEventListener('error', onError);
    cssLeft = config.styles.length;
    config.styles.forEach(function (asset) { var task = {kind:'style',asset:asset,attempt:0,complete:false}; loading.push(task); request(task); });
    next();
  }
  return {start:start,install:install};
}));

if (typeof module === 'object' && module.exports) module.exports.renderHTML = function (manifest, loaderSource) {
  var encoded = JSON.stringify(manifest).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  var attr = function (value) { return String(value).replace(/[&"<>]/g, function (ch) { return {'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[ch]; }); };
  var preload = function (asset, kind) { return '<link rel="preload" as="' + kind + '" href="' + attr(asset.src) + '"' + (asset.integrity ? ' integrity="' + attr(asset.integrity) + '" crossorigin="anonymous"' : '') + '>'; };
  var books = ['第一册','第二册','第三册','第四册'], levels = ['基础','进阶','提升','拓展'];
  var shelf = '<section id="study-startup" aria-label="知新学习书架"><div class="startup-page"><header><strong>知新</strong><span>· 新概念英语学习室</span></header><h1>选一本，<br>继续进步<span>。</span></h1><div class="startup-books" aria-label="选择分册">' + books.map(function (book, i) { return '<button id="study-startup-book-' + (i + 1) + '" type="button" aria-label="打开' + book + '，' + levels[i] + '" aria-pressed="false"><img src="images/books/book-' + (i + 1) + '.webp" alt="' + book + ' · ' + levels[i] + '" width="400" height="384" decoding="async"></button>'; }).join('') + '</div><section class="startup-resume" aria-label="继续学习"><p>每一天，进步一点</p><h2>接着上次的进度学习</h2><button id="study-startup-continue" type="button" aria-pressed="false">继续学习 <span aria-hidden="true">→</span></button></section><div class="startup-status" role="status" aria-live="polite"><p id="study-startup-intent">可以先选一本，课程正在后台准备。</p><p id="study-startup-message">正在准备课程文件…</p><progress id="study-startup-progress" aria-label="课程加载进度"></progress><p id="study-startup-error" hidden></p><button id="study-startup-retry" type="button" hidden>重试未完成文件</button><button id="study-startup-reload" type="button" hidden>重新加载页面</button></div></div></section><noscript>请启用浏览器 JavaScript 后打开学习室。</noscript>';
  var css = 'html,body{overscroll-behavior-y:none}body.study-booting{margin:0;background:#fff;color:#080f27}body.study-booting>:not(#study-startup):not(script):not(noscript){visibility:hidden}#study-startup[hidden],#study-startup [hidden]{display:none!important}#study-startup{position:fixed;z-index:99999;inset:0;overflow:auto;background:#fff;color:#080f27;font:16px/1.6 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}#study-startup *{box-sizing:border-box}#study-startup .startup-page{width:100%;max-width:570px;margin:auto;padding:23px 17px max(24px,env(safe-area-inset-bottom))}#study-startup header{display:flex;align-items:center;gap:8px;min-height:32px;margin-bottom:24px}#study-startup header strong{font-size:26px;line-height:1;color:#0873ff;letter-spacing:-1px}#study-startup header span{color:#6b7484;font-size:14px;font-weight:600}#study-startup h1{font-size:46px;font-weight:850;line-height:1.15;letter-spacing:-2.3px;margin:0 0 18px}#study-startup h1 span{color:#0873ff}#study-startup .startup-books{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 11px;margin-bottom:13px}#study-startup button{font:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}#study-startup button:focus-visible{outline:3px solid #006dff;outline-offset:3px}#study-startup .startup-books button{display:block;min-width:0;border:0;border-radius:12px;padding:0;background:#f0f6fd;aspect-ratio:400/384;overflow:hidden}#study-startup .startup-books img{display:block;width:100%;height:100%;object-fit:cover}#study-startup .startup-books [aria-pressed="true"]{outline:3px solid #0873ff;outline-offset:0}#study-startup .startup-resume{border-radius:15px;padding:16px;background:#f0f6fd;margin-bottom:10px}#study-startup .startup-resume p{font-size:14px;color:#68758a;margin:0 0 7px}#study-startup h2{font-size:21px;line-height:1.35;margin:0 0 18px;letter-spacing:-.8px}#study-startup-continue{display:flex;align-items:center;justify-content:center;gap:14px;width:100%;min-height:46px;border:0;border-radius:12px;background:#0873ff;color:#fff;font-size:18px;font-weight:650;letter-spacing:2px}#study-startup-continue[aria-pressed="true"]{background:#005bc9}#study-startup .startup-status{border:1px solid #dbe5f0;border-radius:15px;padding:14px 16px;color:#5b7083;font-size:14px;overflow-wrap:anywhere}#study-startup .startup-status p{margin:0 0 8px}#study-startup-intent{color:#18334b;font-weight:600}#study-startup progress{display:block;width:100%;accent-color:#0873ff;height:8px}#study-startup-error{margin-top:12px!important;color:#9c2828}#study-startup .startup-status button{min-height:44px;padding:9px 12px;margin:12px 8px 0 0;border:1px solid #b7d6ff;border-radius:8px;background:#edf5ff;color:#075ec9}@media(min-width:761px){#study-startup .startup-page{max-width:1120px;padding:35px 44px 40px;display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:0 32px;align-items:start}#study-startup header{grid-column:1/-1;margin-bottom:38px}#study-startup header strong{font-size:30px}#study-startup header span{font-size:16px}#study-startup h1{grid-column:1/-1;font-size:62px;margin-bottom:32px}#study-startup .startup-books{grid-column:1;grid-row:3/6;gap:16px;margin:0}#study-startup .startup-resume{grid-column:2;padding:25px;margin-bottom:16px}#study-startup .startup-status{grid-column:2}#study-startup h2{font-size:24px;margin-bottom:24px}}@media(max-width:359px){#study-startup header span{font-size:12px}#study-startup h1{font-size:42px}#study-startup h2{font-size:18px}}';
  return {
    head:'<style id="study-startup-style">' + css + '</style>' + manifest.styles.map(function (asset) { return preload(asset, 'style'); }).join('') + manifest.scripts.map(function (asset) { return preload(asset, 'script'); }).join(''),
    bodyStart:shelf,
    bodyEnd:'<script>\n' + loaderSource.replace(/<\/script/gi, '<\\/script') + '\nwindow.StudyStartup.start(' + encoded + ');\n</script>'
  };
};
