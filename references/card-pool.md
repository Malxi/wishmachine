# 卡池：JSON 数据 + JS 引擎

`ideas draw --type combo` 使用独立的结构化卡池：**JSON 存数据，JS 引擎负责过滤、组合、打分、排序**。
数据在 `data/cards/`，引擎在 `scripts/ideas/cards.js`。

## 为什么不用单张随机

单卡随机只能给“元素”；组合抽卡给的是可写的**设定骨架**：

```
archetype（谁） × engine（被什么推着走） × setting（在哪）
× twist（中途怎么翻） × cost（付什么代价） × motif（母题）
```

引擎会按题材过滤、避开 `--avoid`、计算契合度/矛盾度/具体度/新颖度/凝聚力，
一次生成候选组合再排序，输出 top-N。抽卡结果仍是参考，不是 canon。

## 数据形状

每张卡至少：

```json
{
  "id": "arch-archivist",
  "name": "档案员",
  "summary": "以记录对抗遗忘的人……",
  "tags": ["秩序", "记忆"],
  "genres": ["悬疑", "科幻"],
  "want": "把被抽走的那一页放回卷宗",
  "fear": "那一页写的是自己家人的名字",
  "contradiction": "替所有人保存真相，却不敢查自己家旧案",
  "cost": "每核对一次，记忆少一小段",
  "requires": ["档案系统", "缺页"],
  "forbids": ["天选之子"],
  "specificity": 3,
  "source": "cmu-tvtropes:consummate_professional",
  "license": "CC BY-SA 4.0 (derived from CMU Movie Summary Corpus)"
}
```

`contradiction`、`cost`、`requires/forbids` 是组合有没有戏的关键；没有这几项，卡池就只是名词表。

## 卡包

| 包 | 内容 | 来源 |
|---|---|---|
| `archetypes.json` | 20 个角色原型 | CMU `tvtropes.clusters.txt` 归纳 + 本项目改写 |
| `engines.json` | 14 个冲突引擎 | CMU 剧情摘要高频模式归纳 |
| `settings.json` | 12 个场景/世界 | CMU 类型 + Gutenberg 公版小说空间 |
| `twists.json` | 12 个转折 | CMU 剧情反转模式 |
| `costs.json` | 10 种代价 | 公版小说/电影交易结构 |
| `motifs.json` | 10 个母题 | Gutenberg 公版小说 + CMU |
| `genres.json` | 16 个类型画像 | CMU `movie.metadata.tsv` 类型计数 |

数据来源与许可见 `data/cards/manifest.json`；不保存剧情摘要原文、人物名或小说段落。

## CLI

```bash
# 卡池体检
wishmachine ideas cards

# 组合抽卡（默认 balanced，3 组）
wishmachine ideas draw --type combo --genre 科幻 --count 3 --seed 88

# 策略：focused 更贴题材 / diverse 更多样 / wild 更反套路 / safe 更稳
wishmachine ideas draw --type combo --genre 悬疑 --strategy diverse --candidates 20 --count 5

# 避开已用过的卡/标签
wishmachine ideas draw --type combo --genre 科幻 --avoid arch-archivist,记忆
```

每条结果包含 `logline`、`score`、`why`（各项分数）、`components`（六张原卡）、
`sources`、`licenses`。`--save`/`--output` 与其他抽卡类型一致。

## 打分

默认权重：题材契合 0.25、矛盾 0.2、具体度 0.15、新颖度 0.2、凝聚力 0.2；
`focused/diverse/wild/safe` 会改变权重。打分是确定性的，方便同一 seed 复现；
它不是质量裁判，最终仍要 AI/人挑。

## 怎么继续扩卡

1. 先从公版/许可数据抽**模式**，人工改写成中文卡，登记 `source`/`license`。
2. 每张卡补 `contradiction/cost/requires/forbids`；缺这些字段的卡不进入组合池。
3. 跑 `wishmachine ideas cards` 看覆盖与缺失；再跑组合抽卡看碰撞率。
4. 记录采用/弃用（后续 `ideas feedback` 会接入）；不要盲目堆数量。

ROCStories 因需要申请数据访问，当前未纳入；拿到后可补 `causal-chains` 卡包。
