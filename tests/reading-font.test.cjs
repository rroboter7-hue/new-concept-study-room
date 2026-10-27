'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const target = path.join(__dirname,'..','reading-font.js');
const ReadingFontControls = fs.existsSync(target) ? require(target) : null;
function harness(initial = 100, save = () => true) {
  assert.equal(typeof ReadingFontControls,'function','reading font controls must be available');
  const elements = new Map(), listeners = {}, attributes = {}, styles = {}, saved = [], notices = [], preserved = [];
  let html = '', replacements = 0, value = initial;
  const container = {
    classList:{add(){}},setAttribute(name,value){attributes[name]=value;},
    set innerHTML(value){html=value;replacements++;for(const match of value.matchAll(/<(button|output|span)\b([^>]*data-reading-font="([^"]+)"[^>]*)>/g)) {
      const attrs = Object.fromEntries([...match[2].matchAll(/([a-z-]+)="([^"]*)"/g)].map(item=>[item[1],item[2]]));
      const element={tagName:match[1].toUpperCase(),attrs,dataset:{readingFont:match[3]},disabled:false,textContent:'',setAttribute(name,value){attrs[name]=value;},closest(selector){return selector==='[data-reading-font]'?this:null;}};
      elements.set(match[3],element);
    }},get innerHTML(){return html;},
    querySelector(selector){return elements.get(/data-reading-font="([^"]+)"/.exec(selector)?.[1]) || null;},
    addEventListener(name,listener){listeners[name]=listener;},contains(element){return [...elements.values()].includes(element);}
  };
  const control = new ReadingFontControls({container,getValue:()=>value,saveValue:percent=>{saved.push(percent);return save(percent);},style:{setProperty(name,value){styles[name]=value;}},preserve:fn=>{preserved.push('before');const result=fn();preserved.push('after');return result;},toast:notice=>notices.push(notice)});
  return {control,container,elements,styles,saved,notices,preserved,attributes,get replacements(){return replacements;},setSaved(valueToLoad){value=valueToLoad;},click(action){const element=elements.get(action);assert.ok(element,action+' control exists');listeners.click({target:element});}};
}
test('loads saved percentage and renders native keyboard reachable labelled controls',()=>{
  const h=harness(120);
  assert.equal(h.styles['--reading-font-scale'],'1.2');
  assert.equal(h.control.percent,120); assert.equal(h.elements.get('value').textContent,'120%');
  assert.equal(h.attributes.role,'group'); assert.equal(h.attributes['aria-label'],'课文字号');
  for(const [action,label]of [['decrease','减小课文字号'],['increase','增大课文字号'],['reset','恢复默认字号']]){
    const element=h.elements.get(action);
    assert.equal(element.tagName,'BUTTON');assert.equal(element.attrs.type,'button');assert.equal(element.attrs['aria-label'],label);
    assert.notEqual(element.attrs.tabindex,'-1');
  }
  assert.equal(h.saved.length,0,'loading preferences must not claim a new save');
});
test('font changes preserve reading position, save each new value, and keep button nodes stable',()=>{
  const h=harness(),button=h.elements.get('increase'); h.click('increase');h.click('increase');h.click('decrease');
  assert.deepEqual(h.saved,[110,120,110]);assert.equal(h.styles['--reading-font-scale'],'1.1');
  assert.equal(h.elements.get('value').textContent,'110%');
  assert.match(h.elements.get('status').textContent,/已保存/);
  assert.equal(h.elements.get('increase'),button);assert.equal(h.replacements,1,'replacing controls would lose keyboard focus');
  assert.deepEqual(h.preserved,['before','after','before','after','before','after','before','after']);
});
test('limits changes to 80..160 percent and reset returns to 100',()=>{
  const h=harness();for(let i=0;i<10;i++)h.click('decrease');
  assert.equal(h.control.percent,80);assert.equal(h.elements.get('decrease').disabled,true);assert.deepEqual(h.saved,[90,80]);
  for(let i=0;i<15;i++)h.click('increase');
  assert.equal(h.control.percent,160);assert.equal(h.elements.get('increase').disabled,true);assert.equal(h.saved.at(-1),160);
  h.click('reset');assert.equal(h.control.percent,100);assert.equal(h.styles['--reading-font-scale'],'1');assert.equal(h.saved.at(-1),100);
});
test('normalizes corrupt or out of range backup settings on reload without overwriting them',()=>{
  const h=harness();
  for(const [input,want]of [[1000,160],[-3,80],[114,110],['130',130],[null,100],[undefined,100],['',100],['garbage',100],[Infinity,100],[true,100]]) {
    h.setSaved(input);h.control.reload();assert.equal(h.control.percent,want,String(input));assert.equal(h.styles['--reading-font-scale'],String(want/100));
  }
  assert.deepEqual(h.saved,[]);
});
test('failed or throwing storage keeps temporary size and reports that it was not saved',()=>{
  for(const save of [()=>false,()=>{throw Error('quota');}]){
    const h=harness(100,save);h.click('increase');
    assert.equal(h.styles['--reading-font-scale'],'1.1');assert.equal(h.control.percent,110);
    assert.match(h.elements.get('status').textContent,/未保存|仅本次/);
    assert.doesNotMatch(h.elements.get('status').textContent,/已保存/);
    assert.match(h.notices.at(-1),/未保存|仅本次/);
    h.setSaved(100);h.control.reload();assert.equal(h.control.percent,100);
  }
});
test('loads directly as a static browser script',()=>{
  assert.ok(fs.existsSync(target));const scope={};scope.window=scope;vm.createContext(scope);vm.runInContext(fs.readFileSync(target,'utf8'),scope);
  assert.equal(typeof scope.ReadingFontControls,'function');
});
