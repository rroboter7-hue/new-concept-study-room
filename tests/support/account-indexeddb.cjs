'use strict';
// Small transactional IndexedDB double: requests are asynchronous, transactions
// serialize and commit atomically, and aborted writes never reach the database.
module.exports = function indexedDBFixture() {
 const databases = new Map();
 const fixture = {failNext: false, beforeCommit: null, blocked: false};
 const copy = value => value === undefined ? undefined : structuredClone(value);
 fixture.open = name => {
  const request = {};
  setImmediate(() => {
   if (fixture.blocked) { request.onblocked?.({target: request}); return; }
   const fresh = !databases.has(name);
   if (fresh) databases.set(name, {rows: new Map(), queue: [], busy: false});
   const state = databases.get(name);
   const db = {
    objectStoreNames: {contains: () => !fresh || state.created},
    createObjectStore() { state.created = true; }, close() {},
    transaction(_stores, mode) {
     const tx = {error: null}, tasks = [];
     let working, scheduled = false, finished = false;
     function schedule() { if (!scheduled) { scheduled = true; setImmediate(step); } }
     function step() {
      scheduled = false;
      if (finished) return;
      if (!working) return;
      if (tasks.length) {
       const {request, action} = tasks.shift();
       try { request.result = copy(action()); request.onsuccess?.({target: request}); }
       catch (error) { tx.error = error; finished = true; tx.onabort?.(); finish(); return; }
       schedule(); return;
      }
      if (mode === 'readwrite' && fixture.beforeCommit) {
       const hook = fixture.beforeCommit; fixture.beforeCommit = null; hook();
       if (tasks.length) { schedule(); return; }
      }
      finished = true;
      if (mode === 'readwrite' && fixture.failNext) {
       fixture.failNext = false; tx.error = new Error('IDB disk full'); tx.onabort?.();
      } else { if (mode === 'readwrite') state.rows = working; tx.oncomplete?.(); }
      finish();
     }
     function finish() { state.busy = false; state.queue.shift(); start(); }
     function start() {
      if (state.busy || !state.queue.length) return;
      state.busy = true; state.queue[0]();
     }
     const add = action => { const request = {}; tasks.push({request, action}); if (working) schedule(); return request; };
     tx.objectStore = () => ({
      get: key => add(() => working.get(key)),
      getAll: () => add(() => [...working.values()]),
      put: record => add(() => { working.set(record.name, copy(record)); return record.name; }),
      delete: key => add(() => working.delete(key)),
     });
     tx.abort = () => { if (!finished) { finished = true; tx.error = new Error('aborted'); tx.onabort?.(); finish(); } };
     state.queue.push(() => { working = new Map(state.rows); schedule(); }); start();
     return tx;
    }
   };
   request.result = db;
   if (fresh) request.onupgradeneeded?.({target: request});
   request.onsuccess?.({target: request});
  });
  return request;
 };
 return fixture;
};
