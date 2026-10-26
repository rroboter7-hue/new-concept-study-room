# 免费批量造句与豆包复制

用户批准零API费用方案：任意条数批量输入，本地初检，一键复制“原句＋转换句＋检查要求”到豆包，手动粘贴批改结果。继续使用当前GitHub Pages和现有HTML/CSS/JS，无密钥、后端或自动收费调用。现有五句草稿、课程进度、音频和复习安排保留。

## 交互

在“输出训练”增加“批量检查”。两个输入模式：自由造句（一行一句），四句型转换（每组标原句/肯定句、否定句、一般疑问句、特殊疑问句，可选综合句）。可插入模板，也可追加当前五句草稿。文本框不设固定条数或maxlength；长内容逐批本地检查并显示已处理/总数，支持取消。默认只渲染前50条结果，更多结果可继续展开，检查不因显示分页而漏掉输入。

没有发现已覆盖错误的句子标“待完整复核”，不宣布整句正确。豆包复制内容要求逐条定位错误、给出正确句和中文原因，核对原句与转换的人称、时态和事实，允许WH提问自然省略被询问信息；不得强改合法引用、未知结构或语义歧义。输入数量不人为限定，豆包自身上下文和免费额度仍适用；长内容自动生成多段可复制文本，每段保留对应原句与要求。提供“打开豆包”链接以及可选的批改结果笔记（保存原文本，不自动判分）。

## 文件/接口（固定契约）

`batch-sentence-core.js`：UMD，`window.StudySentenceBatch` / CommonJS。

- `sanitizeDraft(value)` → `{mode:'free'|'conversion',rawText:string,notes:string}`，只接受正确类型，保留完整字符串，不静默截断或丢弃多余句子。
- `parse(rawText,mode)` → `{rows,groups,notices}`。rows每条为 `{id,lineNumber,kind,text,groupId,sourceOriginal,context}`；kind为 `free/affirmative/negative/yesno/wh/combined`；context包含可选`target/oldWord/oldPhrase`字符串。每个非空自由行是一条；转换标签不猜位置分组，“原句/肯定句”开启新组；“目标词/旧词/旧用法”作为组上下文。未标行仍保留并按单句检查，缺原句、重复标签等明确提醒。id稳定为行号，不因同句重复而去重。groups为带`id/sourceOriginal/rows/context`的组；notices为可显示的中文字符串。
- `checkRow(row,{grammarCheck,sentenceCheck})` → `{id,lineNumber,kind,original,status,issues,notes}`；status只为`needs-work/review`，issues/notes是中文字符串数组。自由句调用真实StudyGrammar；转换句可调用StudySentences.check并选取对应row，带原句上下文。超出附加语法检查覆盖长度时明确说明，保留整条文本。
- `promptParts(parsed,{lessonTitle='',maxChars=10000})` → `[{text,rowIds}]`。每句恰好完整出现在一份数据中（作为其他句的原句引用可重复）；所有分段有相同批改要求和对应原句。尽量整组保留，过长组拆分时每段带原句，不截断单个超长句；超长句单独成段。输入只当数据，输出格式要求原句/修改/中文理由/转换对应核对/不确定项。空输入返回空数组。

`sentence-core.js`只增加可选`requireTarget:false`：默认行为不变；为批量转换允许未指定目标词时省略“请选择目标词”问题，不能据此免除明确指定目标词的覆盖检查。

`batch-sentence-practice.js`：`window.BatchSentencePractice`，构造参数：

```
{getLesson,getDraft,saveDraft,grammarCheck,sentenceCheck,
 getGuidedText,escapeHTML,toast,copyText,downloadText}
```

`getDraft(lessonId)`读取本课批量草稿；`saveDraft(lessonId,draft)`返回boolean；`getGuidedText()`返回可追加的标记文本或空串；`copyText(text)`返回Promise；`downloadText(name,text)`触发文本导出。公开方法：`render()`（自己的section `#batch-sentence-content`）、`flush()`、`cancel()`、`reloadFromStorage()`。事件仅作用于自己的section。每25条释放主线程，使用generation+课程身份处理取消/切课/编辑/迟到回调。输入/笔记450ms延迟保存，保存失败保留内存和明确状态。没有联网AI请求，恢复草稿不会发送任何请求。

root负责`app.js`数据`sentenceBatches`初始化、备份恢复、flush/cancel生命周期；`output-practice.js`接收可选batchPractice实例增加模式；脚本在output/app之前加载；样式独立。批量草稿独立于旧五句结构，旧数据不迁移覆盖。

## 验收

5句和超过100条输入可一次检查；全部行可复制/导出、取消不会丢文；转换组保留原句；复制失败有手动复制文本；保存失败、切课、刷新、恢复备份、HTML输入不会损坏进度或注入；手机390/320无横向溢出；不产生收费请求，不自动赋掌握分数。
