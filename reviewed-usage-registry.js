/* Shared access to independently source-bound lesson-note batches. */
(function(global){
 'use strict';
 const groups=[{from:21,to:25,key:'usage21To25ReviewId',name:'StudyReviewedUsage21To25'},{from:26,to:30,key:'usage26To30ReviewId',name:'StudyReviewedUsage26To30'}];
 const copy=x=>JSON.parse(JSON.stringify(x));
 function groupFor(lesson){return lesson?.book===2&&Number.isInteger(lesson.number)?groups.find(g=>lesson.number>=g.from&&lesson.number<=g.to):undefined;}
 function provider(group){return group&&global[group.name];}
 function statusForLesson(lesson){const group=groupFor(lesson),api=provider(group);if(!group)return {bound:false,reason:'out-of-scope'};if(typeof api?.statusForLesson!=='function')return {bound:false,reason:'missing-provider'};try{const s=api.statusForLesson(lesson);return s&&typeof s.bound==='boolean'&&typeof s.reason==='string'?copy(s):{bound:false,reason:'invalid-provider-status'};}catch{return {bound:false,reason:'provider-error'};}}
 function rowsFor(lesson,method){if(!statusForLesson(lesson).bound)return [];try{const value=provider(groupFor(lesson))?.[method]?.(lesson);return Array.isArray(value)?copy(value):[];}catch{return [];}}
 function ownerKeys(item){const keys=new Set();for(let node=item;node&&typeof node==='object';node=Object.getPrototypeOf(node))for(const key of Object.getOwnPropertyNames(node))if(/^usage\d+To\d+ReviewId$/.test(key))keys.add(key);return [...keys];}
 function ownerFor(item){const keys=ownerKeys(item);if(keys.length!==1)return undefined;const group=groups.find(g=>g.key===keys[0]),field=group&&Object.getOwnPropertyDescriptor(item,group.key);return field&&Object.prototype.hasOwnProperty.call(field,'value')&&typeof field.value==='string'&&field.value.trim()?group:undefined;}
 function isUsageCurrent(item,lesson){const group=ownerFor(item),api=provider(group);if(!group||typeof api?.isUsageCurrent!=='function')return false;if(lesson&&(groupFor(lesson)!==group||!statusForLesson(lesson).bound))return false;try{return api.isUsageCurrent(item,lesson)===true;}catch{return false;}}
 function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const keys=Object.keys(b);if(Object.keys(a).length!==keys.length||Array.isArray(a)&&a.length!==b.length)return false;return keys.every(k=>{const p=Object.getOwnPropertyDescriptor(a,k);return p&&Object.prototype.hasOwnProperty.call(p,'value')&&same(p.value,b[k]);});}
 function isPatternCurrent(item,lesson){const group=ownerFor(item),api=provider(group);if(!group||typeof api?.isPatternCurrent!=='function')return false;if(lesson&&(groupFor(lesson)!==group||!rowsFor(lesson,'patternNotesFor').some(row=>same(item,row))))return false;try{return api.isPatternCurrent(item,lesson)===true;}catch{return false;}}
 function sourceFragmentFor(input,lesson){const candidates=lesson?[groupFor(lesson)].filter(Boolean):groups;for(const group of candidates){const api=provider(group);if(typeof api?.sourceFragmentFor!=='function')continue;if(lesson&&!statusForLesson(lesson).bound)continue;try{const value=api.sourceFragmentFor(input,lesson);if(value&&typeof value==='object'&&(!lesson||value.lessonId===lesson.id))return copy(value);}catch{}}
 return null;}
 global.StudyReviewedUsage=Object.freeze({version:1,statusForLesson,grammarNotesFor:l=>rowsFor(l,'grammarNotesFor'),grammarReviewFor:l=>rowsFor(l,'grammarReviewFor'),patternNotesFor:l=>rowsFor(l,'patternNotesFor'),requiresApproval:p=>ownerKeys(p).length>0,isUsageCurrent,isPatternCurrent,sourceFragmentFor});
})(window);
