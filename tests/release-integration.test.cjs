const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),scripts=Array.from(html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g),m=>m[1].split('?')[0]);
const {harness}=require('./support/app-harness.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
async function exportedBackup(h){await h.click('[data-view="records"]');await h.click('#export-backup');const download=h.downloads.at(-1);assert.match(download.name,/学习备份\.json$/);return JSON.parse(await download.blob.text());}
async function previewBackup(h,raw){await h.click('#open-import');await h.input('#import-text',JSON.stringify(raw));await h.click('#confirm-import');assert(h.document.querySelector('#backup-apply'),'the actual import UI offers a backup preview before applying');}
async function openBatch(h){if(h.api.view!=='study')await h.click('[data-view="study"]');h.api.setTab('output');await h.click('[data-output-mode="batch"]');assert(h.document.querySelector('[data-batch-input="text"]'));}
test('live HTML loads batch and content dependencies before consumers',()=>{for(const [dependency,consumer] of [['reading-layout.js','book34-language-support.js'],['book3-lessons.js','book34-language-support.js'],['book4-lessons.js','book34-language-support.js'],['book34-language-support.js','audio.js'],['reading-view.js','app.js'],['reading-layout.js','audio.js'],['book2-reading-alignment.js','app.js'],['book2-later-question-expansion.js','knowledge-bootstrap.js'],['pilot-question-expansion.js','knowledge-bootstrap.js'],['sentence-core.js','batch-sentence-core.js'],['batch-sentence-core.js','batch-sentence-practice.js'],['batch-sentence-practice.js','app.js'],['knowledge-bootstrap.js','app.js']]){assert.ok(scripts.includes(dependency),dependency+' must load');assert.ok(scripts.indexOf(dependency)<scripts.indexOf(consumer));}for(const script of scripts){assert.ok(fs.existsSync(path.join(root,script)),script+' exists');assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(path.join(root,script),'utf8'),{filename:script}));}});
test('the backup UI round-trips independent raw legacy and current batch containers through merge and explicit replace',async()=>{
 const first='nce-b2-eef57c-l001',second='nce-b2-eef57c-l003';
 const sentenceBatch={[first]:{mode:'legacy-mode',rawText:'  Legacy <tag> text.\r\n',notes:' 原始笔记 \t',legacyExtra:{keep:true}},'legacy-only':{rawText:'An independent legacy draft.',futureField:['retain',7]}};
 const sentenceBatches={[first]:{mode:'conversion',rawText:'  Current text.\r\n',notes:' Current notes.\t',currentExtra:{keep:'exact'}},[second]:{mode:'free',rawText:'A second course draft.',notes:'Second notes.'}};
 const source=await harness({pilot:false,realOutput:true,loaded:{words:[],records:{},lastLesson:first,sentenceBatch,sentenceBatches}}),raw=await exportedBackup(source);
 assert.equal(raw.format,'zhixin-backup-v1');assert.deepEqual(raw.data.sentenceBatch,sentenceBatch);assert.deepEqual(raw.data.sentenceBatches,sentenceBatches);
 await openBatch(source);assert.equal(source.document.querySelector('[data-batch-input="text"]').value,sentenceBatches[first].rawText,'the current container takes precedence without changing the legacy entry');
 const localDraft={mode:'free',rawText:'Keep the local answer.',notes:'Keep the local notes.'},localOnly={mode:'free',rawText:'Local-only work.',notes:''};
 const target=await harness({pilot:false,loaded:{words:[],records:{},lastLesson:first,sentenceBatch:{'local-legacy':{rawText:'Keep local legacy.'}},sentenceBatches:{[first]:localDraft,'local-only':localOnly}}});
 const before=plain(target.stored);await previewBackup(target,raw);assert.deepEqual(plain(target.stored),before,'preview does not restore data');
 await target.click('#backup-apply');assert.deepEqual(plain(target.api.data.sentenceBatch),{...sentenceBatch,'local-legacy':{rawText:'Keep local legacy.'}});
 assert.deepEqual(plain(target.api.data.sentenceBatches[first]),{...sentenceBatches[first],...localDraft});assert.deepEqual(plain(target.api.data.sentenceBatches[second]),sentenceBatches[second]);assert.deepEqual(plain(target.api.data.sentenceBatches['local-only']),localOnly);
 await previewBackup(target,raw);await target.click('#backup-toggle');assert.match(target.document.querySelector('#dialog-root').innerHTML,/确认替换本地数据/);await target.click('#backup-apply');
 assert.deepEqual(plain(target.api.data.sentenceBatch),sentenceBatch);assert.deepEqual(plain(target.api.data.sentenceBatches),sentenceBatches);
 const again=await exportedBackup(target);assert.deepEqual(again.data.sentenceBatch,sentenceBatch);assert.deepEqual(again.data.sentenceBatches,sentenceBatches);
});

test('real batch input flushes on lesson and view navigation while legacy and other lesson drafts remain independent',async()=>{
 const first='nce-b2-eef57c-l001',second='nce-b2-eef57c-l003',legacy={mode:'free',rawText:'Legacy text before editing.',notes:'Legacy notes.',extra:'keep this raw legacy field'};
 const h=await harness({pilot:false,realOutput:true,loaded:{words:[],records:{},lastLesson:first,sentenceBatch:{[first]:legacy}}});
 await openBatch(h);assert.equal(h.document.querySelector('[data-batch-input="text"]').value,legacy.rawText);
 await h.input('[data-batch-input="text"]','First lesson unfinished answer.');await h.input('[data-batch-input="notes"]','First lesson notes.');assert.equal(h.stored.sentenceBatches[first],undefined,'the pending debounce has not written the draft yet');
 await h.api.selectLesson(second);assert.deepEqual(h.stored.sentenceBatches[first],{mode:'free',rawText:'First lesson unfinished answer.',notes:'First lesson notes.'});assert.deepEqual(h.stored.sentenceBatch[first],legacy);
 await openBatch(h);await h.input('[data-batch-input="text"]','Second lesson unfinished answer.');await h.click('[data-view="words"]');assert.equal(h.stored.sentenceBatches[second].rawText,'Second lesson unfinished answer.');assert.equal(h.stored.sentenceBatches[first].rawText,'First lesson unfinished answer.');
 await h.api.selectLesson(first);await openBatch(h);assert.equal(h.document.querySelector('[data-batch-input="text"]').value,'First lesson unfinished answer.');assert.equal(h.document.querySelector('[data-batch-input="notes"]').value,'First lesson notes.');
 const backup=await exportedBackup(h);assert.deepEqual(backup.data.sentenceBatch[first],legacy);assert.equal(backup.data.sentenceBatches[second].rawText,'Second lesson unfinished answer.');
});

test('failed batch restores keep live and stored drafts available for retry, then reload the restored editor',async()=>{
 const first='nce-b2-eef57c-l001',h=await harness({pilot:false,realOutput:true,loaded:{words:[],records:{},lastLesson:first,sentenceBatch:{[first]:{rawText:'Independent legacy text.',legacyExtra:true}},sentenceBatches:{[first]:{mode:'free',rawText:'The local answer.',notes:'Local notes.'}}}});
 await openBatch(h);const raw={format:'zhixin-backup-v1',data:{words:[],records:{},sentenceBatch:{[first]:{rawText:'Restored legacy text.',legacyExtra:'preserved'}},sentenceBatches:{[first]:{mode:'conversion',rawText:'The restored answer.',notes:'Restored notes.'}}}};
 await previewBackup(h,raw);await h.click('#backup-toggle');const before=plain(h.stored),live=plain(h.api.data);h.setStorageWritable(false);await h.click('#backup-apply');
 assert.deepEqual(plain(h.stored),before);assert.deepEqual(plain(h.api.data),live);assert.equal(h.document.querySelector('[data-batch-input="text"]').value,'The local answer.');assert(h.document.querySelector('#backup-apply'),'the failed preview remains available for retry');assert.match(h.document.querySelector('#backup-error').textContent,/原数据已保留/);assert.equal(h.document.querySelector('#backup-error').classList.contains('hidden'),false);
 h.setStorageWritable(true);await h.click('#backup-apply');assert.equal(h.document.querySelector('#dialog-root').innerHTML,'');await openBatch(h);
 assert.equal(h.document.querySelector('[data-batch-input="text"]').value,'The restored answer.');assert.equal(h.document.querySelector('[data-batch-input="notes"]').value,'Restored notes.');assert.deepEqual(h.stored.sentenceBatch,raw.data.sentenceBatch);assert.deepEqual(h.stored.sentenceBatches,raw.data.sentenceBatches);
});
