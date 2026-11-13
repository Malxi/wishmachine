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
| `templateConnectorsPer1k` | 不是…而是/不仅…还/首先其次最后 / 千字 | ≤0.8，>1.5 风险 |
| `similePer1k` | 像/仿佛/似乎/宛如/像是 / 千字 | ≤2.5，>4 风险 |
| `upliftPer1k` | 段尾抽象升华句 / 千字 | ≤0.3，>0.6 风险 |
| `dialogueRatio` | 引号内 CJK / 全章 CJK | 8%–35%，<5% 或 >50% 风险 |
| `sentenceCv` | 句长标准差/均值 | 0.45–0.9，<0.3 风险（太均匀） |
| `paragraphCv` | 段长标准差/均值 | ≥0.5，<0.35 风险（太整齐） |
| `shortClauseRatio` | ≤4 字小句占比 | ≤0.2，>0.35 风险 |
| `paddingRatio` | 章节 CJK / target_chars | ≤1.1，>1.25 风险（注水） |
| `motifMaxPer1k` | `style.motifs` 配置的母题词最高密度 | ≤3，>6 风险 |
| `dialogueParagraphRatio` | 含对话的段落占比 | ≥0.2，<0.1 风险 |
| `redundantParagraphRatio` | 相邻段落 2-gram 相似度 ≥0.5 的占比 | ≤0.1，>0.2 风险 |
| `duplicateSentenceCount` | 完全重复的句子数 | 0 |

`style.motifs` 是项目级母题词表（如 `["数","手指","六","第七垄","纸边"]`）；
`audit --profile style` 还会跨章检测重复的 4–6 字短语（`style.book.repeated_motif`）。
场景焦点与母题预算的写法见 `references/scene-guide.md`。

同时输出 `dashPer1k` / `semicolonPer1k` / `colonPer1k` 作为参考，默认只报不判。

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
| `nameSourceCoverage` | core_cast 有 namecard_id/name_source 的占比 | ≥60%，<30% 风险 |
| `nameStyleDiversity` | 不同 naming_style / 有风格记录的角色数 | ≥0.5，<0.25 风险 |
| `nameDuplicateCount` | 重复姓名数 | 0 |

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
