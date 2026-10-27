'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup(){
 const scope={URLSearchParams,location:{search:''}};scope.window=scope;vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(__dirname,'../mobile-learning-shell.js'),'utf8'),scope);
 const calls=[],ui=Object.create(scope.MobileLearningShell.prototype);
 Object.assign(ui,{enabled:true,mobile:true,destroyed:false,menu:{open:true},body:{classList:{remove:x=>calls.push('remove:'+x)}},options:{openOutputMode:mode=>calls.push('output:'+mode),openTab:tab=>calls.push('tab:'+tab)},closeCourses:()=>calls.push('close'),defer:fn=>fn(),focusReader:()=>calls.push('focus')});
 const click=dataset=>{const target={dataset};ui.click({target:{closest:()=>target}});};
 return {ui,calls,click};
}
test('direct dictation and retell entries close the menu and drawer before switching mode',()=>{
 for(const mode of ['write','retell']){
  const h=setup();h.click({mobileOutput:mode});
  assert.equal(h.ui.menu.open,false);
  assert.deepEqual(h.calls,['remove:mls-coach-open','close','output:'+mode,'focus']);
 }
});
test('four-form main tab selects sentence writing even after another output mode',()=>{
 const h=setup();h.ui.outputMode='retell';h.click({mobileTab:'output'});
 assert.equal(h.calls.includes('output:sentences'),true);assert.equal(h.calls.includes('tab:output'),false);
 const legacy=setup();delete legacy.ui.options.openOutputMode;legacy.click({mobileTab:'output'});assert.equal(legacy.calls.includes('tab:output'),true);
});
test('normal lesson tabs keep their existing routes and desktop ignores mobile shortcuts',()=>{
 const h=setup();h.click({mobileTab:'practice'});assert.equal(h.calls.includes('tab:practice'),true);
 h.calls.length=0;h.ui.mobile=false;h.click({mobileOutput:'write'});assert.deepEqual(h.calls,[]);
 h.ui.mobile=true;h.ui.destroyed=true;h.click({mobileOutput:'retell'});assert.deepEqual(h.calls,[]);
});
test('main tab and specific shortcut have unambiguous selected state',()=>{
 const h=setup(),button=dataset=>({dataset,attributes:{},setAttribute(k,v){this.attributes[k]=v;}});
 const tabs=['reading','output','practice'].map(mobileTab=>button({mobileTab})),shortcuts=['write','retell'].map(mobileOutput=>button({mobileOutput}));
 h.ui.body={classList:{toggle(){},remove(){},contains:()=>false},setAttribute(){}};
 h.ui.modeNav={querySelectorAll:()=>tabs};h.ui.quickNav={querySelectorAll:()=>shortcuts};h.ui.state={view:'study',tab:'output'};
 h.ui.setOutputMode('retell');
 assert.deepEqual(tabs.map(b=>b.attributes['aria-selected']),['false','false','false']);
 assert.deepEqual(shortcuts.map(b=>b.attributes['aria-pressed']),['false','true']);
 h.ui.setOutputMode('sentences');assert.deepEqual(shortcuts.map(b=>b.attributes['aria-pressed']),['false','false']);assert.deepEqual(tabs.map(b=>b.attributes['aria-selected']),['false','true','false']);
 h.ui.state.view='daily-review';h.ui.syncPresentation();assert.equal(tabs.some(b=>b.attributes['aria-selected']==='true'),false);
});
test('Escape dismisses the learning menu and returns keyboard focus to its trigger',()=>{
 const h=setup();let focused=0,prevented=0;h.ui.menu.querySelector=()=>({focus(){focused++;}});
 h.ui.keydown({key:'Escape',preventDefault(){prevented++;}});assert.equal(h.ui.menu.open,false);assert.equal(focused,1);assert.equal(prevented,1);
});
