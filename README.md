# 小说许愿机 Wishmachine

把奇思妙想变成小说：纯 Node.js CLI（>= 18，无运行时依赖）。它不调用模型、不生成正文，只负责
**项目状态、确定性检查、参考抽卡和原子写入**；正文与创作判断由使用它的 AI 或作者完成。

## 快速开始

从空目录到一份合法的 setup + outline（把 `<saved.id>` 换成命令返回的 `saved.id`）：

```bash
WM="node scripts/wishmachine.js"
$WM book init "我的书" --dir my-book --parts 1 --volumes 1 --chapter 3 --genre 科幻
$WM ideas draw --type outlinepack --genre 科幻 --volumes 1 --chapters-per-volume 3 --count 1 --seed 7 --dir my-book --save
$WM book write setup   --dir my-book --from-idea <saved.id> --mode replace --apply
$WM book write outline --dir my-book --from-idea <saved.id> --mode replace --apply
$WM state --dir my-book --view brief
```

之后 `state` 的 `state.next.command` 给出下一步。完整最小路径（含写一章 + recap、手写
setup/outline、写入风险）见 [SKILL.md](SKILL.md)。

## 安装

需要 Node.js >= 18：`npm install -g .` 后可直接用 `wishmachine <command>`；或在仓库根目录
使用 `node scripts/wishmachine.js`。

## 项目格式

项目是一个目录：`novel.json` 是配置，其余 JSON/Markdown 是 artifact。

```text
my-book/
  novel.json                项目配置（structure、chapter_config）
  story/setup/story_setup.json
  story/compose/outline.json
  story/craft/*.json
  story/recaps/<chapter-id>.json
  story/ideas/*.json        抽卡结果（--save）
  chapters/<chapter-id>.md
  drafts/                   export 输出
  logs/                     registry 日志与备份
```

`structure` 形如 `{"target_parts":1,"target_volumes":3,"target_chapters":5}`，其中
`target_chapters` 是**每卷**章数。

## 命令一览

| 组 | 命令 | 用途 |
|---|---|---|
| 项目 | `book init`、`book status`、`state` | 初始化、状态快照与下一步 |
| 阅读/写入 | `book read`、`book write` | 读 artifact；dry-run → `--apply` 写 |
| 检查 | `check`、`audit`、`doctor` | 确定性检查、全项目审计、目录/配置修复 |
| 抽卡 | `ideas draw/import/search/discover/validate/types` | 确定性参考卡 |
| 导出 | `export`、`refresh` | 导出正文、刷新 md 伴生文件 |
| 指导 | `gen <workflow\|reference\|skill> <list\|read>` | 读 references 与 SKILL.md |
| 维护 | `book registry …` | registry 状态/清理/日志/备份/undo/redo |

完整参数与输出契约：`node scripts/wishmachine.js help`。

## 输出与退出码

- 成功：stdout 是 JSON；`version`、`help`、不带 `--json` 的 `book status` 是纯文本。
- 失败：stdout 是 `{"ok":false,"error":{"code","message","hint?","fix_command?"}}`，stderr 一行摘要。
- 退出码：`0` 成功 · `1` 用法/系统错误 · `2` 有 blocking findings（`check`/`audit`/`doctor`/
  `book write`）。`--no-strict` 可让 `check`/`audit`/`doctor` 强制退出 0。写操作默认
  dry-run，`--apply` 才落盘。

## 边界

- 不生成 setup/outline/正文，不调用 LLM，不做 RPG 模拟、MCP server、二进制下载器。
- 只移植确定性的项目管理、检查与参考抽卡；编辑质量由人或主 AI 判断，`ideas search/discover` 需要外网。

## 文档

[SKILL.md](SKILL.md) 是 AI 入口（三条最小路径、写入风险、检查、抽卡约定）。
[references/stage-contracts.md](references/stage-contracts.md) 是 artifact 与输出契约总览；
`setup-schema.md`、`outline-schema.md` 是字段形状；`book-write.md` 是 write 细节；
`check-profiles.md` 是 profile/findings；`workflow-*.md` 是流程；
[references/review-checklist.md](references/review-checklist.md) 是编辑性审查。

## 开发

```bash
npm test           # node:test（node --test）
npm run lint       # eslint（需先 npm install）
npm run lint:modules  # 模块分层/循环依赖/门面边界检查
npm run pack       # 构建 dist/wishmachine-skill-{,-flat-}v<version>.zip（先校验 SKILL.md 的 YAML frontmatter）
```

模块分层、目录所有权与并发编辑规则见 [docs/MODULES.md](docs/MODULES.md)。

CI：`.github/workflows/ci.yml`，Node 18/20/22 跑 `npm test` 与 `npm run lint`。
