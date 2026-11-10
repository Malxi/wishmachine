# Wishmachine

许愿机（Wishmachine）是 Novelgen 的**确定性核心移植版**：

- 保留：book manage / ideas / check / skills / references / workflows
- 去掉：所有内置 AI 生成、LLM 调用、RPG 模拟
- 运行方式：纯 Node.js 源码，无二进制、无运行时下载

## 快速开始

```bash
node scripts/wishmachine.js version
node scripts/wishmachine.js book init "我的书" --dir my-book --parts 1 --volumes 3 --chapter 5
node scripts/wishmachine.js book status --dir my-book --json
node scripts/wishmachine.js ideas draw --type namecard --genre 科幻 --count 12 --seed 42
node scripts/wishmachine.js check --dir my-book --profile all --target outline
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
scripts/lib/                全部源码
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

## 范围

这不是完整 Novelgen。当前只移植确定性的项目管理和检查：

- `book init/status/read/write`
- `check quality/schema/custom`
- `ideas namecard/premise/resource/scenario`
- `gen workflow/reference/skill`

没有：

- setup/compose/craft/write/recap 的 AI pipeline
- RPG 模拟
- MCP server
- 任意二进制/下载器

这样整个工具就是可审阅的 Node 源码，可以直接放进 Skill 的 `scripts/`。
