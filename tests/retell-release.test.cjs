'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {harness}=require('./support/app-harness.cjs');
test('release account policy matches configuration and disabled mode opens guest drafts without cloud requests',async()=>{
 const config={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../account-config.js'),'utf8'),{window:config});
 const release=JSON.parse(fs.readFileSync(path.join(__dirname,'../release.json'),'utf8'));
 assert.equal(config.STUDY_ACCOUNT_CONFIG.enabled,release.accountSyncEnabled,'account rollout must agree with the explicit release policy');
 let contacts=0;const id='nce-b2-eef57c-l002',source='A guest retelling kept on this device.';
 const h=await harness({realPipeline:true,pilot:false,loaded:{words:[],learningPipeline:{version:2,lessons:{[id]:{retellText:source,stage:4}}}},accounts:{config:{...config.STUDY_ACCOUNT_CONFIG,enabled:false,endpoint:''},fetcher:async()=>{contacts++;throw Error('No cloud expected');}}});
 assert.equal(contacts,0);assert.equal(h.api.data.learningPipeline.lessons[id].retellText,source);assert.equal(h.api.storageKey,'zhixin-study-v1');
 await h.click('[data-main-entry="records"]');
 assert.doesNotMatch(h.document.querySelector('#records-view').innerHTML,/登录账号后可同步|立即同步进度|账号与进度/);
 assert(h.document.querySelector('#export-backup'));assert.equal(contacts,0);
});
