/* Tiny, self-contained covers: no network, fonts, canvas or image codec required. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.StudyBookCovers=factory();
}(typeof window==='object'?window:this,function(){
 'use strict';
 var names=['第一册','第二册','第三册','第四册'],levels=['基础','进阶','提升','拓展'];
 var colors=[['#fff4b8','#ffd65a','#b87900'],['#e5f3ff','#9dcbff','#0873ff'],['#dcfaee','#7ad9b4','#008968'],['#eee8ff','#c5b2ff','#7852d5']];
 function src(book){
  var n=Number(book);if(!isFinite(n)||n%1||n<1||n>4)return '';
  var c=colors[n-1],svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 384"><rect width="400" height="384" fill="'+c[0]+'"/><circle cx="365" cy="95" r="145" fill="'+c[1]+'"/><path d="M190 384a210 210 0 0 1 210-210v210" fill="'+c[2]+'" opacity=".16"/><g fill="#122b43" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"><text x="28" y="55" font-size="25">'+names[n-1]+'</text><text x="26" y="114" font-size="48" font-weight="700">'+levels[n-1]+'</text><text x="28" y="306" font-size="13" letter-spacing="2">NEW CONCEPT</text><text x="28" y="325" font-size="13" letter-spacing="2">ENGLISH</text></g><text x="376" y="370" text-anchor="end" font-family="sans-serif" font-weight="700" font-size="155" fill="'+c[2]+'" opacity=".55">'+n+'</text></svg>';
  return 'data:image/svg+xml,'+encodeURIComponent(svg);
 }
 return {src:src};
}));
