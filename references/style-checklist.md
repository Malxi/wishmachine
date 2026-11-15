# 风格 / 去 AI 味检查清单

`check --profile style` 是**确定性统计体检**：只报 low/medium，永不 blocking。
指标按千字归一化，按章节和全书汇总；阈值可在 `novel.json` 的 `style` 字段覆盖：

```json
{
  "style": {
    "chapter": { "compressedPredicatePer1k": { "warn": 2.0, "risk": 3.5 } },
    "setup": { "genreCount": { "warn": 3, "risk": 5 } }
  }
}
```

## 章节指标

| metric | 含义 | 默认健康带 |
|---|---|---|
| `compressedPredicatePer1k` | “会躁/没争/不响”式单字谓语 / 千字 | ≤2.0，>3.5 风险 |
| `negatedCompressedShare` | 其中“不/没/未/别”占比 | ≤50%，>70% 风险 |
| `compressedDistinctRatio` | 单字谓语类型多样性 | ≥0.85，<0.7 风险 |
| `sentenceOpeningReuse` | 首两字在全文出现 ≥3 次的句子占比 | ≤30%，>45% 风险 |
| `subjectOpeningShare` | 以 core_cast 人物名开头的句子占比 | ≤8%，>15% 风险 |
| `templateConnectorsPer1k` | 不是/并非…而是、不仅…还/而且、一方面…另一方面、与其说…不如说、首先其次最后 / 千字 | ≤0.8，>1.5 风险 |
| `similePer1k` | 像/仿佛/似乎/宛如/像是 / 千字 | ≤2.5，>4 风险 |
| `upliftPer1k` | 段尾抽象升华句 / 千字 | ≤0.3，>0.6 风险 |
| `dialogueRatio` | 引号内 CJK / 全章 CJK | 8%–35%，<5% 或 >50% 风险 |
| `sentenceCv` | 句长标准差/均值 | ≥0.45，<0.3 风险（太均匀；过高只提示长短过碎） |
| `paragraphCv` | 段长标准差/均值 | ≥0.5，<0.35 风险（太整齐） |
| `shortClauseRatio` | ≤4 字小句占比 | ≤0.2，>0.35 风险 |
| `fragmentSentenceRatio` | 叙述句里 ≤5 字碎片句占比（排除对话） | ≤0.04，>0.08 风险 |
| `enumerationPer1k` | “九把/两捆/三道”式数量短语 / 千字 | ≤15，>22 风险 |
| `countingPer1k` | 数/点/核对/清点等动词 / 千字 | ≤2，>3 风险 |
| `recountPer1k` | “又数一遍/再点一次”式重复点数 / 千字 | ≤0.5，>1.5 风险 |
| `paddingRatio` | 章节 CJK / target_chars | ≤1.1，>1.25 风险（注水） |
| `motifMaxPer1k` | `style.motifs` 配置的母题词最高密度 | ≤3，>6 风险 |
| `dialogueParagraphRatio` | 含对话的段落占比 | ≤0.75，>0.9 风险（过高；过低由 `dialogueRatio` 判） |
| `redundantParagraphRatio` | 相邻段落 2-gram 相似度 ≥0.5 的占比 | ≤0.1，>0.2 风险 |
| `duplicateSentenceCount` | 完全重复的句子数 | 0 |
| `translationesePer1k` | 对于…来说/在…背景下/随着…发展/与此同时/使得…得以 等西化连接 / 千字（叙述） | ≤1，>2.5 风险 |
| `nominalizationPer1k` | 进行讨论/作出判断/实现提升/性化度堆叠 等弱动词+抽象名词 / 千字（叙述） | ≤1.5，>3.5 风险 |
| `jargonPer1k` | 赋能/抓手/闭环/颗粒度/底层逻辑/重构/叙事 等黑话 / 千字（叙述） | ≤1，>2.5 风险 |
| `embodiedEmotionPer1k` | 瞳孔骤缩/呼吸一滞/心脏漏跳/空气凝固/五味杂陈 等身体表演式情绪 / 千字 | ≤1.5，>3 风险 |
| `emotionBodyShare` | 身体反应 /（身体反应 + 直接情绪词）；样本 <3 时为 0 | 仅作参考，不单独判 |
| `softAdverbPer1k` | 微微/缓缓/淡淡/轻轻/默默/不由得/下意识 / 千字（叙述） | ≤8，>15 风险 |
| `dialogueTagPer1k` | 淡淡道/低声道/冷冷道/薄唇轻启/嘴角勾起 等标签 / 千字 | ≤1.5，>3 风险 |
| `dialogueTagDiversity` | 不同对白标签 / 标签总数；标签 <4 个时不判 | ≥0.4，<0.2 风险 |
| `singleSentenceParagraphRatio` | 非对白/非系统单句段 / 叙述段 | ≤0.25，>0.4 风险 |
| `consecutiveSingleSentenceParagraphs` | 连续非对白单句段的最大长度 | ≤2，>5 风险（3–5 提示） |
| `punctuationTicPer1k` | 破折号 + 分号 + 冒号 / 千字 | ≤15，>25 风险（只有极高密度才判） |
| `lectureMarkerPer1k` | 本质上/真正重要的是/归根结底/这说明/这意味着 等抬升句 / 千字（叙述） | ≤0.8，>1.8 风险 |
| `qaRoundCount` | 连续“问句对白段 + 对白段”的轮数 | ≤2，>4 风险 |
| `oneLineDialogueRatio` | 单句对白段 / 对白段；对白段 <4 时不判 | ≤0.7，>0.85 风险 |

`style.motifs` 是项目级母题词表（如 `["数","手指","六","第七垄","纸边"]`）；
`audit --profile style` 还会跨章检测重复的 4–6 字短语（`style.book.repeated_motif`）。
场景焦点与母题预算的写法见 `references/scene-guide.md`。

同时输出 `dashPer1k` / `semicolonPer1k` / `colonPer1k` 作为参考；`punctuationTicPer1k`
是三者合计，只有密度极高时才给提示。

### 中文句法 pass 怎么用

这些指标是**密度信号**，不是禁词表：

- 单次出现通常不是问题；同一句式/词族在相邻段落反复出现，才值得改。
- 先改最显眼的一种，最多 2 轮；不要为了把指标降到 0 把句子改机械。
- 对白里的“翻译腔/黑话/标签”可能是人物声口；先看是不是这个人物会说的话，不要一律删。
- 保留事实、条件、否定、情态、归属、数字和术语；不要为了“自然”补写原文没有的经历、因果或细节。
- `evidence` 只列命中句；改哪句由人/主 AI 判断，CLI 不自动改写。

## setup 指标

| metric | 含义 | 默认健康带 |
|---|---|---|
| `genreCount` | 题材数量 | ≤3，>5 风险 |
| `abstractPer1k` | premise/theme/rules 抽象词 / 千字 | ≤8，>15 风险 |
| `themeAphorism` | theme 是否是格言句 | 0（是则风险） |
| `concreteRulesRatio` | 含数量/上限/代价/后果的规则占比 | ≥0.5，<0.3 风险 |
| `nameSurnameConcentration` | 同一姓氏占比 | ≤40%，>60% 风险 |
| `nameDescriptorRatio` | 老X/阿X/收成人/XX那位式名字占比 | ≤20%，>40% 风险 |
| `nameSingleCharGivenRatio` | 双字姓名中的单字名占比 | ≤50%，>75% 风险 |
| `nameSourceCoverage` | `name_source=draw`（带 `namecard_id`）的占比；旧式 `name-` 前缀 namecard_id 也计入 | ≥60%，<30% 风险 |
| `nameStyleDiversity` | 不同 naming_style / 有风格记录的角色数 | ≥0.5，<0.25 风险 |
| `nameDuplicateCount` | 重复姓名数 | 0 |

## 全书结构检查

`audit --profile style` 会给每章一个 `shape`：

```json
{
  "opening": "dialogue|question|summary|short|narration",
  "ending": "dialogue|question|ellipsis|reflection|short|narration",
  "dialogueBand": "low|mid|high",
  "emotionBand": "body|balanced"
}
```

- `style.book.shape_convergence`（medium）：至少 3 章、且 60% 以上章节共享同一开头/收尾/结构签名。
  换一种进入方式或落点，不要每章同一套节拍。
- `style.book.theme_explicitness`（medium）：至少 3 章、且 60% 以上章节以主题总结/抽象抬升收尾。
  把主题留给情节和代价；至少让一章停在具体动作、物件或未解释的细节上。
- `style.book.repeated_motif`（medium）：跨章重复的描写/动作短语；每次重复都应升级代价或认知。

结构检查看的是“章与章之间像不像同一个模板”，不是单章好坏；不要为了打散结构而随机换开头。

## style 文件来源检查

- `style.setup.writing_style_deprecated`：setup 里还有旧 `writing_style`，应移到
  `story/style/writing-style.json`（medium）。
- `style.writing_style.missing`：缺少 `story/style/writing-style.json`（low）。
- `style.writing_style.invalid`：references 为空 / 来源不是 human|public-domain|licensed /
  公版样本缺 `sample_id` 或 text 不逐字匹配 / human 样本缺 `license` 或 `user_confirmed` /
  principles 写成“每章报数/换壳”节拍表（medium）。
- `style.voice.sample_source`：voice card 的正样本缺少人类来源、`sample_id` 不存在或 text
  不逐字匹配（medium）。

内置人类样本：`data/style/human-samples.json`（逐字使用，不要改写）；公版状态、授权与
`sample_id` 规则见 `data/style/README.md`。AI 文本只能放进 `negative_samples`。

## 用法

```bash
# 单章
wishmachine check --dir <project> --profile style --target chapter --id P1-V1-C1
# 设定
wishmachine check --dir <project> --profile style --target setup
# 全书汇总（含每章 metrics）
wishmachine audit --dir <project> --profile style --view summary
# 只看 medium 及以上
wishmachine check ... --min-severity medium
# 忽略某条规则
wishmachine check ... --ignore style.chapter.simile_density
```

## 读 findings

每条 finding 带：

- `rule_id`：如 `style.chapter.compressed_predicate`
- `severity`：`low`（warning 带）或 `medium`（risk 带）
- `metrics`：`{ name, value, band, threshold }`
- `evidence`：最多 8 条命中句（压缩谓语/句首复用/升华句）
- `suggestion`：定点改写方向

## 人工复核（检查器查不了的）

- 细节是否**只有这个人物/地方**才会有？
- 重复是否带来了新信息/新代价？
- 对话是否像这个人会说的话（而不是机翻）？
- 设定规则是否可操作、会出错、有代价？
- 读出来是否顺口？有没有“每段都收圆”的感觉？

## 四类高发句子病（改写前先对照）

`workflow-deai.md` §5b 有完整反例/正例。改写时按这四条排序，前两条硬删、后两条限量：

1. **段尾判断句**（每段末尾都落抽象总结）→ 全章这类收束**不超过 2 处**，其余收在动作/对话/物件上。
2. **模板连接句**（不是…而是 / 不仅…还 / 首先其次）→ 删连接壳，写两个并列事实。
3. **忽然 / 突然** → 区分用处：替代因果就删（改用动作次序），给动作开闸可留，但后面必须紧跟具体动作；同章不出现第二处。
4. **计数罗列**（一段里三组以上"第几/几X"）→ 同段清点式写法全章**不超过 2 处**。

注意：这四条的命中**不代表那句话坏**（"机器只认字""封条是贴给人看的"都会被扣），它们测的是密度和指纹；
别为了指标把全章最硬的句子删光。

**别拿指标审样本**：公版样本是校准基准，不是待检对象。指标命中样本里的词，先怀疑阈值
（实测《药》片段"忽然"密度 2.68 次/千字 > 生成正文 0.00–0.65）。样本只禁整句搬运。

**反向警戒**：压缩/单字谓语不要清零——全章保留 2–4 处（`predicate_variety` healthy ≥ 0.85），
短句比例落在 0.2 附近即可。实测出现过四类病全清、但压缩谓语归零，被 `predicate_variety` 反咬一口。
