'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

test('release descriptor agrees with the HTML version used by startup and automatic updates',()=>{
 const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const build=html.match(/<meta\s+name="study-build"\s+content="([^"]+)"/);
 assert(build,'the release must expose its build identifier');
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8')).build,build[1]);
});
