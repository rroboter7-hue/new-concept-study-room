# 五句造句与四句型转换

用户已确认：每个单词总共5句，分别为肯定句、否定句、一般疑问句、特殊疑问句、旧知综合造句。四句型按以上定义。前四句保持同一原句的情境，第五句用目标词、一个已选旧词和一个已选习惯用法写新句子。

## 实现范围与选择

沿用原生HTML/CSS/JS，在现有“输出训练”增加“五句造句”模式；不新增主导航，不接外部AI服务，不把用户造句上传。独立源码副本分支codex/five-sentence-practice，基于公开仓库b2d1a83；不改其他对话的源码，不自动发布。

考虑过单独新页面、外部AI批改和复用输出训练。采用复用：现有输出训练已有课堂上下文、本地语法规则和记录入口，手机入口较少。外部AI批改需要后端、费用与用户句子传输，本轮不引入。

## 学习规则

- 目标词可来自本课或已记录学过的早期课程；有来源册号、课次。
- 旧词、旧用法仅从当前课之前且有completed/attempts记录的课程提取。学习记录空时，用户可明确选择以前学过的课程作为本轮复习来源；不能把所有早期课程默认为学过，也不修改原课程完成状态。
- 第五句要求目标词、一个不同的旧词、一个旧用法；缺旧知资料时给出明确引导，不伪造材料。
- 已选词形支持常见规则和已知不规则形式；边界匹配避免he误匹配the。
- 肯定/否定/一般疑问/特殊疑问分别做可解释结构检查，复用现有StudyGrammar。常见do/does/did后恢复原形、be/助动词一致性要有回归；特殊疑问词作主语（Who plays…?）不可强制要求助动词。
- 可为确定支持的简短原句提供有限转换参考；不支持的句子保留草稿并提示核对，不能编造参考或判错。不能以只含目标词或规则未报错宣称整句正确。
- 用户输入的自由造句只给基本要求、句型和已覆盖语法反馈，不自动判语义/自然度、不赋100分、不自动标记掌握。
- 第五句不能逐字重复前四句；允许缩写和正常词形变化。每句最多400字符。

## 手机交互与保存

一次突出一个句子，五个步骤可切换，下一步保留输入；显示当前目标词、旧词/用法来源、每步具体要求、对原句的提醒。示例标明教学示例而非教材原文。

每个课程/单词独立保存五句草稿、当前步骤和旧知选择。输入后短延迟保存，切课/切词先保存；失败时保留屏幕输入并提示未保存。沿用主学习数据备份，不清空任何已有记录。

## 文件与接口

`sentence-core.js`（UMD，window.StudySentences / module.exports）：

- `KINDS`: 固定顺序字符串数组 `['affirmative','negative','yesno','wh','combined']`。
- `context({lessons,currentLesson,records,sourceLessonIds=[]})` → `{targets,oldWords,oldPhrases,earlierLessons}`。词对象 `{key,word,meaning,source:{id,book,number,title}}`；短语对象 `{key,phrase,meaning,source}`。earlierLessons为 `{id,book,number,title}`。
- `sanitizeDraft(value)` → `{step,targetKey,sourceLessonIds,oldWordKey,oldPhraseKey,answers,checkedAt}`；answers键同KINDS，所有字段安全限长。
- `draftKey(lessonId,targetKey)` → 安全稳定键。
- `matchesExpression(sentence,expression)` → boolean；仅识别受支持词形。
- `check({answers,target,oldWord,oldPhrase,grammarCheck})` → `{rows,writtenCount,readyForReview,rulesOnly:true}`；每行 `{kind,label,status,issues,notes}`，status为`empty / needs-work / review / ready`。ready仅表示已完成有限检查，不表示语言完全正确。

`sentence-practice.js`：window.SentencePractice，构造参数 `{getLesson,getLessons,getRecords,getDrafts,saveDraft,grammarCheck,escapeHTML,toast}`，对外 `render()`、`flush()`。saveDraft(key,draft)返回boolean；getDrafts返回主数据的sentencePractice对象。render可在输出训练重新渲染时调用，事件委托仅作用于`#sentence-practice-content`。

`output-practice.js`：接收可选sentencePractice实例，工具栏加模式；其他模式行为保持原状。`app.js`创建实例及本地数据回调，`index.html`按core→practice→output→app加载。样式独立`sentence-practice.css`。

## 验收

以book＋旧词sister＋旧用法look at为演示，5句草稿可保存并切换；能练do/does/did及be类四句型；不正确扩展到未来课程；无记录有可操作引导；复查不改变原完成/最高分；390px与320px无横向溢出，输入区及提交可见；刷新保留草稿；HTML输入不注入；造句不调用外部服务；公开站点未被修改。

## 点词自动在线查询（用户追加要求）

点单词一次即显示本地中文释义并自动查询在线词典，不要求再按查询。在线查询使用 Free Dictionary API，仅发送所点英文单词，返回英文释义并明确标注语言和来源；不伪称中文译义。无本地词义时以在线结果补充；失败保留已有内容，提供可选重试和有道中英词典链接。切换单词或关闭弹窗取消旧查询，过期响应不得覆盖新词。在线结果需限长和转义，查询等待中收藏也要在结果到达后补全释义。常见弯引号转为直引号查询，保留原文显示。
