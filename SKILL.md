---
name: wishmachine
display_name: 小说许愿机
display_name_en: Novel Wish Machine
description: 这是一台许愿机，将你的奇思妙想变成小说：项目状态、确定性检查、参考抽卡与 artifact 原子写入
description_zh: 这是一台许愿机，将你的奇思妙想变成小说：项目状态、确定性检查、参考抽卡与 artifact 原子写入
description_en: A wish machine that turns ideas into a novel: project state, deterministic checks, idea draws and atomic artifact writes.
examples_zh:
  - "创建一个 3 卷 × 5 章的科幻小说项目"
version: 0.3.0
author: Malxi
---

# 小说许愿机

Wishmachine 是纯 Node.js CLI（>= 18，无运行时依赖）：负责项目状态、确定性检查、参考抽卡和
artifact 写入。它**不调用模型、不生成 setup/outline/正文**；创作由你完成。

## 约定

- `WM="node scripts/wishmachine.js"`；全局安装后可直接用 `wishmachine`。
- 项目命令一律带 `--dir <project>`，且必须指向含 `novel.json` 的项目根（不会向上查找）。
- stdout 是 JSON；失败时 stdout 也是 `{"ok":false,"error":{...}}`，stderr 一行摘要。
- 退出码：`0` 成功 / `1` 用法或系统错误 / `2` 有 high|critical blocking findings。
- 写操作默认 dry-run，只有 `--apply` 才落盘。

## 0. 三条最小路径

创作流：`init → ideas draw（可选）→ setup → outline → 逐章（正文→check→recap）→ audit → refresh → export`。

### 路径 A：快路（推荐，空目录 → 合法 setup + outline）

```bash
WM="node scripts/wishmachine.js"
$WM book init "我的书" --dir my-book --parts 1 --volumes 1 --chapter 3 --genre 科幻
$WM ideas draw --type outlinepack --genre 科幻 --volumes 1 --chapters-per-volume 3 --count 1 --seed 7 --dir my-book --save
# → saved.id（如 outlinepack-7-20261113_122909），替换下文 <saved.id>
$WM book write setup   --dir my-book --from-idea <saved.id> --mode replace --apply
$WM book write outline --dir my-book --from-idea <saved.id> --mode replace --apply
$WM state --dir my-book --view brief
```

### 路径 B：手写 setup + outline（需要自行创作时）

```bash
$WM gen reference read setup-schema
$WM book write setup --dir my-book --mode replace < setup.json          # dry-run：看 check
$WM book write setup --dir my-book --mode replace --apply < setup.json
$WM gen reference read outline-schema
$WM book write outline --dir my-book --mode replace < outline.json      # dry-run
$WM book write outline --dir my-book --mode replace --apply < outline.json
$WM check --dir my-book --profile all --target outline --max-findings 20
```

### 路径 C：写一章 + recap

```bash
$WM state --dir my-book --view brief
$WM book read outline --dir my-book --id P1-V1-C1
# 把本章正文写入 chapter.md，CJK 字数需达到 novel.json 的 chapter_config.min_chars
$WM book write chapter --dir my-book --id P1-V1-C1 --mode replace < chapter.md        # dry-run
$WM book write chapter --dir my-book --id P1-V1-C1 --mode replace --apply < chapter.md
$WM check --dir my-book --profile all --target chapter --id P1-V1-C1
# 从正文（不是大纲）整理 recap.json，字段见 references/book-write.md
$WM book write recap --dir my-book --id P1-V1-C1 --mode replace --apply < recap.json
```

## 写入与风险

- 默认 dry-run 并返回 `check`；`--apply` 才写盘，写前把旧文件复制到同目录 `checkpoints/`。
- `--mode replace` 整块覆盖，`patch` 只合并改动字段；setup/outline/craft/recap 支持
  `replace|patch`，chapter 支持 `replace|append`。`--target` 只用于 outline 的 patch
  （`volume|chapter`）和 craft（`character|item|location|organization`）。
- apply 时有 blocking 则**不写盘**（`ok:false, applied:false`，退出 2）；写后检查才出现
  blocking 则返回 `ok:false, applied:true, warning`：文件已写，先 `check` 修复再继续。
- 不要手改项目 JSON 绕过 `book write`；`refresh` 会重建并覆盖 md 伴生文件。

## 检查

| profile | 内容 |
|---|---|
| quality | 结构、引用、ID、章节数量、谜题/线程一致性 |
| schema | setup/outline/craft/recap 的 JSON 形状 |
| custom | `references/builtin-rules.json` + 项目 `.wishmachine/rules/*.json` |
| all | quality + schema + custom（默认） |

```bash
$WM check --dir my-book --profile all --target outline --max-findings 20
$WM audit --dir my-book --view brief                 # 全项目审计
$WM doctor --dir my-book                             # 目录/配置/JSON 完整性；加 --fix 修复
```

- blocking = `severity` 为 `high` 或 `critical`；check/audit/doctor/write 此时退出码 2；
  `--no-strict` 让 check/audit/doctor 强制退出 0（脚本容错用）。
- `--min-severity low|medium|high|critical` 只过滤展示，`summary` 仍统计全量；
  `--max-findings all|<n>`；findings 带稳定 `id`（`finding-xxxxxxxx`），已去重排序。
- 枚举写错或未知 flag/缺值都会 JSON 报错并退出 1，不再静默回退。

## 抽卡

```bash
$WM ideas draw --type namecard --genre 科幻 --count 12 --seed 42
$WM ideas draw --type worldpack --genre 悬疑 --cast-count auto --seed 7 --output world.json
$WM ideas draw --type outlinepack --genre 科幻 --count 1 --seed 7 --dir my-book --save
$WM book read idea --dir my-book --id <saved.id>     # 默认 summary；--view full 才读全量
$WM ideas validate --dir my-book --all
```

| 参数 | 说明 |
|---|---|
| `--type` | 默认 namecard，共 21 种；`ideas types` 列出 |
| `--count` | composite（worldpack/plotpack/outlinepack）默认 1、上限 10；其他默认 5、上限 50；超限降级并 warning |
| `--seed` | 确定性复现；省略则随机 |
| `--save` | 写入 `story/ideas/`，只回 `{query,count,result_ids,saved}`，不回完整结果 |
| `--output <file>` | 完整 draw 写文件（大结果用这个，别打到 stdout） |
| `--cast-count` | `4`（默认）或 `auto`（按题材 archetype 配比） |
| `--volumes` / `--chapters-per-volume` | outlinepack 多卷装配 |

抽卡是参考不是 canon；写进 setup/outline 前要改写并过 `check`。

## 文档路由

- artifact 格式、写入与输出契约：`references/stage-contracts.md`
- setup/outline 字段与 `book write` 细节：`setup-schema.md`、`outline-schema.md`、`book-write.md`
- profile/规则/findings：`references/check-profiles.md`
- 流程与编辑性审查：`references/workflow-*.md`、`references/review-checklist.md`

读取：`$WM gen reference read <name>`、`$WM gen workflow read <name>`。

## 边界

- 不生成 setup/outline/正文，不调用 LLM，不做 RPG 模拟或 MCP。
- `ideas search/discover` 需要外网；联网考究按 `workflow-research` 由人或主 AI 完成。
- 破坏性 registry 操作前先 `book registry backup`；备份、undo/redo、日志都在 `book registry` 族里。
