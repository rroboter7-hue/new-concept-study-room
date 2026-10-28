'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup(){
 const scope={URLSearchParams,location:{search:''},document:{querySelector:()=>null}};scope.window=scope;vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(__dirname,'../mobile-learning-shell.js'),'utf8'),scope);
 const calls=[],ui=Object.create(scope.MobileLearningShell.prototype);
 Object.assign(ui,{enabled:true,mobile:true,destroyed:false,menu:{open:true},body:{classList:{remove:x=>calls.push('remove:'+x)}},options:{openOutputMode:mode=>calls.push('output:'+mode),openTab:tab=>calls.push('tab:'+tab)},closeCourses:()=>calls.push('close'),defer:fn=>fn(),focusReader:()=>calls.push('focus')});
 const click=dataset=>{const target={dataset};ui.click({target:{closest:()=>target}});};
 return {ui,calls,click};
}
test('legacy output callbacks still preserve existing write and retell modes without menu duplication',()=>{
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
test('four primary modes distinguish reading, notes, sentence writing and retelling',()=>{
 const h=setup(),button=dataset=>({dataset,attributes:{},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k]??null;}});
 const tabs=[button({mobileTab:'reading'}),button({mobileTab:'usage'}),button({mobileOutput:'sentences'}),button({mobileOutput:'retell'})];
 h.ui.body={classList:{toggle(){},remove(){},contains:()=>false},setAttribute(){}};
 h.ui.modeNav={querySelectorAll:()=>tabs};h.ui.quickNav=null;h.ui.state={view:'study',tab:'output'};
 h.ui.setOutputMode('retell');assert.deepEqual(tabs.map(b=>b.attributes['aria-selected']),['false','false','false','true']);assert.deepEqual(tabs.map(b=>b.tabIndex),[-1,-1,-1,0]);
 h.ui.setOutputMode('sentences');assert.deepEqual(tabs.map(b=>b.attributes['aria-selected']),['false','false','true','false']);
 h.ui.state.tab='usage';h.ui.syncPresentation();assert.deepEqual(tabs.map(b=>b.attributes['aria-selected']),['false','true','false','false']);
 h.ui.state.tab='reading';h.ui.syncPresentation();assert.deepEqual(tabs.map(b=>b.attributes['aria-selected']),['true','false','false','false']);
 h.ui.state.view='daily-review';h.ui.syncPresentation();assert.equal(tabs.some(b=>b.attributes['aria-selected']==='true'),false);
});

test('arrow keys switch between primary modes and keep keyboard focus on the activated tab',()=>{
 const h=setup(),tabs=[{mobileTab:'reading'},{mobileTab:'usage'},{mobileOutput:'sentences'},{mobileOutput:'retell'}].map(dataset=>({dataset,focus(){h.calls.push('focus:'+Object.values(dataset)[0]);},closest(){return this;}}));
 h.ui.modeNav={contains:node=>tabs.includes(node),querySelectorAll:()=>tabs};
 let prevented=0;
 h.ui.keydown({target:tabs[2],key:'ArrowRight',preventDefault(){prevented++;}});
 assert.equal(prevented,1);assert.ok(h.calls.includes('output:retell'));assert.ok(h.calls.includes('focus:retell'));
 h.calls.length=0;h.ui.keydown({target:tabs[0],key:'ArrowLeft',preventDefault(){}});assert.ok(h.calls.includes('output:retell'));
 h.calls.length=0;h.ui.keydown({target:tabs[3],key:'Home',preventDefault(){}});assert.ok(h.calls.includes('tab:reading'));
});

test('menu exposes four main destinations and keeps other tools collapsed without dictation links',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../mobile-learning-shell.js'),'utf8');
 const primary=source.match(/<div class="mls-menu-primary">(.*?)<\/div>/)[1];
 assert.equal((primary.match(/<button/g)||[]).length,4);
 assert.match(primary,/data-mobile-action="open-courses"/);for(const view of ['daily-review','words','records'])assert.ok(primary.includes('data-mobile-view="'+view+'"'));
 assert.match(source,/<details class="mls-menu-more"><summary>更多<\/summary>/);
 assert.doesNotMatch(source,/data-mobile-output="write"|课文默写/);
 assert.match(source,/this\.quickNav=null/);
 const header=source.slice(source.indexOf("this.header = element('header'"),source.indexOf("this.header.querySelector('.mls-brand')"));assert.doesNotMatch(header,/select|open-courses/);
 const drawer=source.slice(source.indexOf("this.dialog = element('section'"),source.indexOf('this.dialog.id ='));assert.match(drawer,/data-mobile-book/);
});

test('Escape dismisses the learning menu and returns keyboard focus to its trigger',()=>{
 const h=setup();let focused=0,prevented=0;h.ui.menu.querySelector=()=>({focus(){focused++;}});
 h.ui.keydown({key:'Escape',preventDefault(){prevented++;}});assert.equal(h.ui.menu.open,false);assert.equal(focused,1);assert.equal(prevented,1);
});


test('worksheet chrome is scoped to the actual mobile sentence worksheet and clears on other routes',()=>{
 const h=setup(),classes=new Set();
 h.ui.body={classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name),remove:name=>classes.delete(name)},setAttribute(){}};
 h.ui.state={view:'study',tab:'output'};
 h.ui.setOutputMode('sentences',{sentenceWorksheet:true});assert.equal(classes.has('mls-sentence-sheet'),true);
 h.ui.setOutputMode('batch',{sentenceWorksheet:false});assert.equal(classes.has('mls-sentence-sheet'),false);
 h.ui.setOutputMode('sentences',{sentenceWorksheet:false});assert.equal(classes.has('mls-sentence-sheet'),false,'legacy sentence practice keeps its normal navigation');
 h.ui.setOutputMode('sentences',{sentenceWorksheet:true});h.ui.state.tab='reading';h.ui.syncPresentation();assert.equal(classes.has('mls-sentence-sheet'),false);
 h.ui.state={view:'daily-review',tab:'output',sentenceWorksheet:true};h.ui.syncPresentation();assert.equal(classes.has('mls-sentence-sheet'),false);
 h.ui.state={view:'study',tab:'output',sentenceWorksheet:true};h.ui.mobile=false;h.ui.syncPresentation();assert.equal(classes.has('mls-sentence-sheet'),false);
});


test('opening the course dialog from the folded menu restores focus to the visible menu trigger',()=>{
 const h=setup(),trigger={},opener={},attributes={};
 h.ui.enabled=true;h.ui.drawerOpen=false;h.ui.inertBefore=new Map();h.ui.overlay={hidden:true};h.ui.closeButton={focus(){}};
 h.ui.body={classList:{add(){},remove(){}}};h.ui.menu={open:true,contains:node=>node===opener,querySelector:()=>trigger};
 h.ui.header={querySelector:()=>({setAttribute:(key,value)=>attributes[key]=value})};h.ui.dialog={querySelector:()=>null};
 h.ui.openCourses(opener);assert.equal(h.ui.menu.open,false);assert.equal(h.ui.returnFocus,trigger);assert.equal(h.ui.drawerOpen,true);assert.equal(h.ui.overlay.hidden,false);assert.equal(attributes['aria-expanded'],'true');
});

test('clicking the lesson outside its menu dismisses the popup without navigating',()=>{
 const h=setup();h.ui.menu.contains=()=>false;h.ui.click({target:{closest:()=>null}});assert.equal(h.ui.menu.open,false);assert.deepEqual(h.calls,[]);
});
