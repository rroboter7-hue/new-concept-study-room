'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),context={};context.window=context;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../grammar-check.js'),'utf8'),context);
const Grammar=context.StudyGrammar;
test('simple singular-past statements get a cautious was suggestion while irrealis and quotations remain unforced',()=>{
 const issue=Grammar.check('She were late yesterday.').find(row=>row.rule==='singular-past-be');
 assert(issue);assert.equal(issue.confidence,'medium');assert.match(issue.replacement,/She was/);
 for(const value of ['If she were here, she would help.','I wish she were here.','He spoke as if she were here.','As it were, the lesson had ended.','“She were late,” is the exact error quoted by the teacher.'])assert(!Grammar.check(value).some(row=>row.rule==='singular-past-be'),value);
});
