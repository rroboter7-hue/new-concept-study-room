(function(global){
 'use strict';
 if(!global.StudyKnowledge||!global.BOOK2_QUESTION_REVIEWS)throw new Error('已审核题库未正确加载，请刷新后重试。');
 global.StudyKnowledge.install(global.LESSONS,{grammarAudit:global.BOOK2_QUESTION_REVIEWS,extraQuestions:[global.BOOK2_QUESTION_EXPANSION,global.BOOK2_LATER_QUESTION_EXPANSION].filter(Boolean)});
})(window);
