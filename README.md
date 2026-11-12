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
- `ideas namecard/premise/resource/equipment/scenario/provocation/law/event/engine/storyline/location/faction/motif/worldpack/plotpack/outlinepack`
- `worldpack` cast 按题材和 protagonist / antagonist / support 选择原型
- `worldpack` cast 关系图：protagonist / antagonist / support 之间带 `opposes`、`supports`、`drives`、`blocks` 等边
- `worldpack` 输出 `prompt_pack`（positive/negative/style/keywords）和可选 `motif`
- `plotpack` 把 worldpack、cast 关系、六个章节 beat（setup/inciting/midpoint/crisis/climax/resolution）打包
- `outlinepack --chapters --scenes --target-chars` 展开为带 scenes、字数目标和 draft_outline 的章节骨架
- `outlinepack --volumes --chapters-per-volume` 全局分布 6 个 beat，并生成多卷 opening/closing、mysteries、timeline
- thread resolved_mysteries / abandoned_mysteries 去重后按 chapter/id 排序
- thread resolved_mysteries / abandoned_mysteries 也按 chapter/id 排序
- `doctor --fix` 重排 setup/outline 的 thread/mystery registry
- setup mystery_registry 与 thread_registry 也有排序校验
- mystery_registry 使用自然章序排序（C2 在 C10 前）
- check 校验 mystery_registry 排序，doctor 重建后保持稳定顺序
- registry version 升级到 v2，doctor 自动迁移旧版本
- mystery_registry/thread_registry 带版本号，并按 chapter/id 稳定排序
- `doctor --fix` 清理 stale mystery_registry；check 报 resolved/dropped 未挂到 thread
- check 报 stale mystery、final status 不一致、resolved mystery 未挂到 thread
- mystery_registry status 必须出现在章节 status 集合中；dropped 带 reason
- `doctor --fix` 重建缺失/过期的 mystery_registry
- mystery_registry 去重保存 mystery 对象，并进入 setup/outline
- check 校验 thread.resolved_mysteries / abandoned_mysteries 是否指向有效 mystery
- thread_registry 带 resolved_chapters、resolved_mysteries、abandoned_history、abandoned_mysteries
- thread_registry 带 resolved_in、resolved_chapters、abandoned_history
- `doctor --fix` 双向修复 thread status：active->resolved，resolved 无回收->active
- `doctor --fix` 根据 resolved mystery 修复 thread status，并补齐 abandoned_threads
- check 校验 resolved thread 是否有对应 resolved mystery，以及 abandoned thread 是否登记
- `doctor --fix` 按章节文本匹配 thread_id，并保留 outline 的 resolved 状态
- `doctor --fix` 补齐 thread_registry、chapter thread_id，并修复 setup/outline drift
- `doctor --fix` 为旧项目补齐 thread_registry 与 storyline thread_id
- `check` 检查 setup/outline thread registry 漂移与 unknown chapter thread id
- thread_registry 持久化到 setup/outline
- `ideas validate --id` 检查 thread 状态、resolved_in 章节与 beat 一致性
- `outlinepack.thread_registry` 与 setup_draft.storylines.thread_id 对齐
- `outlinepack` mysteries 带 thread_id/related_cast_ids，被裁剪的进入 abandoned_threads
- `outlinepack` scene mystery 可以进入 chapter pending
- `outlinepack` pending mysteries 跨章/跨卷传递，在 climax/resolution 回收
- `outlinepack` entry_from_previous 会进入 chapter.obstacle/conflict/mysteries.carried
- `outlinepack` entry_from_previous 会进入 chapter.conflict、chapter_payoff.pressure 和上一章 hook
- `outlinepack` 章间通过 entry_from_previous / exit_consequence 传递，跨卷继续
- `outlinepack` scene 之间通过 consequence -> goal 传递，章节带 `scene_chain`
- `outlinepack` 每个 scene 带 scene mysteries 与 consequence/result
- `outlinepack` 每章带 obstacle、mysteries.planted/resolved 与 volume.beat_map
- `outlinepack` 同时带 `setup_draft` 和 `draft_outline`
- `book write outline --from-idea <id>` 把 outlinepack 的 draft_outline 送入正常候选检查
- `book write setup --from-idea <id>` 把 outlinepack 的 setup_draft 送入正常候选检查
- `ideas` 题材牌堆：科幻默认 / 修仙 / 悬疑 / 都市 / 历史
- `ideas draw --save` 持久化到 `story/ideas/`，可用 `book read ideas` / `book read idea` 读取
- `ideas import` 将联网考究/人工整理的卡片写入同一卡池
- `ideas search --provider wikipedia|gutenberg` 联网搜索来源并保存 source cards
- `ideas discover --topic` 从内置历史/神话/小说来源目录批量抓取 source cards
- `book read graph` 聚合所有已保存卡片的 entity / relation / keyword 图
- `book write research` / `book read research` 持久化考究报告
- 主 skill 内置 `research` workflow：联网搜索、来源卡、实体图与考究报告
- `gen workflow/reference/skill`

没有：

- setup/compose/craft/write/recap 的 AI pipeline
- RPG 模拟
- MCP server
- 任意二进制/下载器

这样整个工具就是可审阅的 Node 源码，可以直接放进 Skill 的 `scripts/`。
