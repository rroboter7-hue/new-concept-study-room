/* Literal word/ordinal boundaries shared by display and offline lexical catalogs. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyLexicalWords=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const source=value=>String(value==null?'':value);
 function scan(value){const text=source(value),out=[],pattern=/\d+(?:st|nd|rd|th)(?![A-Za-z0-9])|[A-Za-z]+(?:[’'-][A-Za-z]+)*/gi;for(const match of text.matchAll(pattern))out.push({kind:/^\d/.test(match[0])?'ordinal':'word',surface:match[0],start:match.index,end:match.index+match[0].length});return out;}
 function isDottedSt(text,token){return !!token&&token.kind==='word'&&token.surface==='St'&&source(text)[token.end]==='.';}
 function sequenceWords(value){return source(value).match(/\d+(?:st|nd|rd|th)(?![A-Za-z0-9])|[A-Za-z]+(?:[’'-][A-Za-z]+)*|\d+(?:[.:]\d+)*/gi)||[];}
 return Object.freeze({version:'1.0.0',scan,isDottedSt,sequenceWords});
});
