# Research workflow

考究是主 `wishmachine` skill 的一部分，没有单独的 research skill。抽到的卡涉及真实历史、
文化、科学主张或公版故事，且可能与目标题材冲突时使用。`ideas search` / `ideas discover`
需要外网；无网络时跳过联网步骤，只做本地核验并标注 `unsupported`。

## Rules

1. 读真实卡片，不要凭记忆研究标题。
2. 联网检索历史、文化、科学或公版来源。
3. 记录打开过的来源标题与 URL。
4. 不要编造引用；找不到可用来源就标 `unsupported`。
5. 区分有意的幻想改写（`inspired_by`）与历史事实。
6. 检查关系，不只检查实体：核验过的地点也可能配上不可能的派系或时代错误的装备。
7. 不要静默改写 canon。返回报告与 `safe_prompt`，由主 skill 决定是否应用。

## 1. 载入卡片

```bash
node scripts/wishmachine.js book read ideas --dir my-book
node scripts/wishmachine.js book read idea --dir my-book --id <saved-id> --view full
```

`book read idea` 默认只回 summary；要读完整 draw 必须加 `--view full`（结果可达数百 KB，
不要打给模型上下文）。未保存的卡先抽：

```bash
node scripts/wishmachine.js ideas draw --type worldpack --genre 修仙 --count 1 --seed 42 --dir my-book --save
```

## 2. 检索

内置来源目录可起一个历史/神话/小说检索：

```bash
node scripts/wishmachine.js ideas discover --dir my-book --topic history --limit 3
node scripts/wishmachine.js ideas discover --dir my-book --topic myth --limit 3
node scripts/wishmachine.js ideas discover --dir my-book --topic novel --limit 3
```

开放查询：

```bash
node scripts/wishmachine.js ideas search --dir my-book --provider wikipedia --query "Mary Celeste" --limit 3
node scripts/wishmachine.js ideas search --dir my-book --provider gutenberg --query "Frankenstein" --limit 3
```

搜索结果会保存 source cards；`--ingest` 会抓取 Wikipedia 页面做标题/meta/摘要抽取。
Gutenberg 结果保存元数据与链接，需要具体段落时再打开原文。

来源卡带小图：

```text
work --authored_by--> author
work --has_subject--> subject
```

保存后查看合并图（含 dangling relation 与 entity-id 冲突）：

```bash
node scripts/wishmachine.js book read graph --dir my-book
```

## 3. 兼容性判定

逐实体分类：

```text
verified      来源支持该用法
plausible     无直接矛盾，但未被证明
anachronism   时代、地域、技术或社会形态错误
unsupported   没有可用来源
rejected      与目标题材或前提冲突
```

再检查关系：派系手段是否匹配资源？装备代价是否匹配前提规则？地点危险度是否匹配场景？
cast 角色功能是否匹配 storyline？

## 4. 输出

返回紧凑报告：

```json
{
  "pack_id": "worldpack-42-01",
  "entities": [
    {"id": "...", "status": "verified", "source": "...", "note": "..."}
  ],
  "relations": [
    {"from": "...", "to": "...", "status": "plausible", "issue": "..."}
  ],
  "rejected": [
    {"entity": "...", "reason": "anachronism"}
  ],
  "safe_prompt": "..."
}
```

`anachronism`、`unsupported`、`rejected` 实体不得作为 canon 呈现；换成已核验的替代或把
整包标为 experimental。

## 5. 持久化

抽卡结果保存在 `story/ideas/<type>-<seed>-<stamp>.json`；用 `book read ideas --dir my-book`
列出，用 `book read idea --id <id> --view full` 读单份。

保存考究报告（默认只预览，加 `--apply` 才落盘）：

```bash
node scripts/wishmachine.js book write research --dir my-book --id <pack-id> < report.json
node scripts/wishmachine.js book write research --dir my-book --id <pack-id> --apply < report.json
node scripts/wishmachine.js book read research --dir my-book --id <pack-id>
```

考究产出的替换卡可以导入同一卡池：

```bash
node scripts/wishmachine.js ideas import --dir my-book --type motif --source "web research" --file replacement-cards.json
```

不要把未核验的说法写进 `story/setup` 或 `story/compose` 当事实。
