const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scope = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','grammar-check.js'),'utf8'),scope);
const grammar = scope.window.StudyGrammar;

test('flags missing be before common progressive forms in a complete pronoun clause',()=>{
  for(const [text,expected] of [
    ['She reading a private book.','She is reading a private book.'],
    ['I watching the birds.','I am watching the birds.'],
    ['They writing letters.','They are writing letters.']
  ]) {
    const issues=grammar.check(text);
    assert.ok(issues.some(i=>i.rule==='progressive-missing-be'),text);
    assert.equal(grammar.applyAll(text,issues),expected);
  }
});

test('does not rewrite reported fragments, object pronouns, or quoted discussion',()=>{
  for(const text of [
    'I saw her reading a book.', 'I watched them swimming.',
    'She is reading a private book.', 'The title is "She reading a book".',
    'The example "I is" is deliberately incorrect.',
    'The phrase "a apple" contains an error.',
    'The teacher explained why "he don’t" is wrong.',
    'The teacher asked, "Are they ready?"', 'She reading?'
  ]) assert.equal(grammar.check(text).length,0,text);
});
