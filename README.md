# 小说许愿机 Wishmachine

小说许愿机是一台把你的奇思妙想变成小说的工具，包含完整的小说创作流程、确定性检查、丰富的创作参考和工作流指导。

- 保留：book manage / ideas / check / skills / references / workflows
- 去掉：所有内置 AI 生成、LLM 调用、RPG 模拟
- 运行方式：纯 Node.js 源码，无二进制、无运行时下载

## 快速开始

```bash
node scripts/wishmachine.js version
node scripts/wishmachine.js book init "我的书" --dir my-book --parts 1 --volumes 3 --chapter 5 --chapter-chars 3000 --min-chars 1800
node scripts/wishmachine.js state --dir my-book --view brief
node scripts/wishmachine.js audit --dir my-book --view brief
node scripts/wishmachine.js book status --dir my-book --json
node scripts/wishmachine.js ideas draw --type namecard --genre 科幻 --count 12 --seed 42
node scripts/wishmachine.js check --dir my-book --profile all --target outline
node scripts/wishmachine.js refresh --dir my-book
node scripts/wishmachine.js gen workflow read outline
```

也可以：

```bash
npm install -g .
wishmachine version
```

## 目录

```text
SKILL.md                    WorkBuddy Skill 入口
scripts/wishmachine.js      CLI 入口
scripts/                全部源码
references/                 schema、检查说明、workflow
tests/                      node:test
```

## 项目格式

兼容 Novelgen 的基本项目布局：

```text
novel.json
story/setup/
story/compose/
story/craft/
story/reviews/
chapters/
drafts/
logs/
```

`novel.json` 的 `structure` 使用：

```json
{"target_parts":1,"target_volumes":3,"target_chapters":5}
```

旧项目的顶层 `target_parts` / `target_volumes` / `target_chapters` 也会被读取并规范化。

## 范围

这不是完整 Novelgen。当前只移植确定性的项目管理和检查：

- `book init/status/state/read/write/refresh/audit`
- `check quality/schema/custom`
- `state` / `status` 会报告不在 outline 中的 orphan chapters 和 orphan recaps
- `audit` 全项目审计，包括不在 outline 中的章节文件
- `refresh` 重建 setup/outline markdown
- `export` 将已写章节导出为带目录、人物和规则的阅读版（`--format plain` 输出纯章节拼接）
- `doctor` 检查项目目录、配置、setup/outline/craft/recap JSON 有效性、缺失 JSON 和 orphan 文件；`--fix` 会创建缺失目录并写入规范化 structure
- `ideas namecard/premise/resource/equipment/scenario/provocation/law/event/engine/storyline/location/faction/motif/worldpack`
- `ideas draw --save` 持久化到 `story/ideas/`，可用 `book read ideas` / `book read idea` 读取
- `ideas import` 将联网考究/人工整理的卡片写入同一卡池
- `ideas ingest --url` 抓取网页标题、描述、关键词和短摘录，保存为 source card
- `ideas discover --topic` 从内置历史/神话/小说来源目录批量抓取 source cards
- `book write research` / `book read research` 持久化考究报告
- `skills/wishmachine-research` 联网考究抽卡实体与关系
- `gen workflow/reference/skill`

没有：

- setup/compose/craft/write/recap 的 AI pipeline
- RPG 模拟
- MCP server
- 任意二进制/下载器

这样整个工具就是可审阅的 Node 源码，可以直接放进 Skill 的 `scripts/`。
