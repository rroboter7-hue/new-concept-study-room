'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'../book-covers.js'),covers=fs.existsSync(file)?require(file):{};
test('all four shelf covers are self-contained small SVG images with correct book names',()=>{
 assert.equal(typeof covers.src,'function');let bytes=0;
 for(const [index,name] of ['第一册','第二册','第三册','第四册'].entries()){
  const src=covers.src(index+1);assert(src.startsWith('data:image/svg+xml,'));const svg=decodeURIComponent(src.slice(src.indexOf(',')+1));
  assert(svg.includes(name));assert(svg.includes('>'+String(index+1)+'</text>'));assert(!/<(?:script|image|foreignObject)\b|https?:\/\/(?!www\.w3\.org)/.test(svg));
  bytes+=Buffer.byteLength(src);assert(src.length<2400);
 }
 assert(bytes<9000,'four covers must not add megabytes to initial navigation');
 for(const invalid of [0,5,-1,'<img>',null])assert.equal(covers.src(invalid),'');
});
test('published startup covers need no external image request',()=>{
 const loader=require('../runtime-loader.js'),render=loader.renderHTML({version:1,scripts:[],styles:[]},'');
 assert.equal((render.bodyStart.match(/<img src="data:image\/svg\+xml,/g)||[]).length,4);
 assert(!render.bodyStart.includes('images/books/'));
});

test('the real shelf, drawer and animation use the same inline cover without changing study records',async()=>{
 const {harness}=require('./support/app-harness.cjs');const h=await harness({realPipeline:true,pilot:false,realOutput:true});
 const before=JSON.stringify(h.api.data.records),buttons=h.document.querySelectorAll('[data-shelf-book]');assert.equal(buttons.length,4);
 for(const button of buttons)assert.equal(button.querySelector('img').getAttribute('src'),covers.src(Number(button.dataset.shelfBook)));
 assert.equal(h.document.querySelector('.shelf-drawer-cover').getAttribute('src'),covers.src(2),'even the hidden drawer must not fetch a legacy cover');
 await h.click('[data-shelf-book="2"]');assert.equal(h.document.querySelector('.shelf-drawer-cover').src,covers.src(2));
 assert.equal(JSON.stringify(h.api.data.records),before);
});
