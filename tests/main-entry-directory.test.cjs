'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Directory=require('../main-entry-directory.js');
const entries=[{key:'a',label:'Japanese',meaning:'日本人',category:'noun',sources:[{id:'one',book:1,number:1}]},{key:'b',label:'get up',meaning:'起床',category:'phrase',sources:[{id:'two',book:2,number:2}]}];
test('directory filters combine source, part of speech and Chinese/English search',()=>{
 assert.deepEqual(Directory.filter(entries,{book:'1',category:'noun',query:'日本'}).map(x=>x.key),['a']);
 assert.deepEqual(Directory.filter(entries,{book:'2',category:'phrase',query:'GET'}).map(x=>x.key),['b']);
 assert.equal(Directory.filter(entries,{book:'1',category:'phrase'}).length,0);
});
test('favorites retain saved words absent from the taught catalog without implying mastery',()=>{
 const saved=[{word:'Extra',meaning:'额外的',mastered:false},{word:'Japanese',meaning:'日本人'}];
 const rows=Directory.combine(entries,saved);
 assert.equal(rows.filter(x=>x.label==='Japanese').length,1);
 assert.deepEqual(Directory.filter(rows,{scope:'favorites'}).map(x=>x.label),['Japanese','Extra']);
 assert.equal(rows.find(x=>x.label==='Extra').category,'word');assert.equal(saved[0].mastered,false);
});
test('invalid fields and unsafe labels remain plain model text and filtering never mutates input',()=>{
 const source=JSON.stringify(entries);assert.equal(Directory.filter(entries,{query:'no matching term'}).length,0);
 assert.equal(Directory.combine(null,[{word:'<img>',meaning:'文字'},null]).length,1);assert.equal(JSON.stringify(entries),source);
});
test('manual favorites keep their explicitly stored part of speech and phrase category',()=>{
 const rows=Directory.combine([],[{word:'skip',pos:'v.'},{word:'on time',kind:'phrase'},{word:'often',pos:'adv.'}]);
 assert.deepEqual(rows.map(row=>row.category),['verb','phrase','adverb']);
});
