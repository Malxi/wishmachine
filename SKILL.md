---
name: wishmachine
display_name: 小说许愿机
display_name_en: Novel Wish Machine
description: 这是一台许愿机，将你的奇思妙想变成小说，包含完整的小说创作流程，创作检查，丰富的创作参考等
description_zh: 这是一台许愿机，将你的奇思妙想变成小说，包含完整的小说创作流程，创作检查，丰富的创作参考等
description_en: A wish machine that turns your ideas into a novel, with a complete writing workflow, deterministic checks, and rich creative references.
examples_zh:
  - "创建一个 3 卷 × 5 章的科幻小说项目"
  - "检查大纲的阻塞问题"
  - "抽 12 个科幻角色名卡"
examples_en:
  - "Create a 3-volume × 5-chapter science-fiction project"
  - "Check the outline for blocking findings"
  - "Draw 12 science-fiction name cards"
version: 0.2.7
author: Malxi
---

# 小说许愿机

WorkBuddy 是创作者。小说许愿机只负责项目状态、确定性检查和参考抽卡，不调用
任何模型，也不生成正文。

在 Skill 根目录执行：

```bash
node scripts/wishmachine.js version
```

或安装 npm 包后使用 `wishmachine`。

## 1. 管理小说

```bash
node scripts/wishmachine.js book init "我的书" --dir my-book --parts 1 --volumes 3 --chapter 5 --chapter-chars 3000 --min-chars 1800 --genre 科幻
node scripts/wishmachine.js state --dir my-book --view brief
node scripts/wishmachine.js audit --dir my-book
node scripts/wishmachine.js refresh --dir my-book
node scripts/wishmachine.js export --dir my-book
node scripts/wishmachine.js export --dir my-book --format plain
node scripts/wishmachine.js doctor --dir my-book
node scripts/wishmachine.js doctor --dir my-book --fix
node scripts/wishmachine.js book status --dir my-book --json
node scripts/wishmachine.js book read outline --dir my-book --view index
node scripts/wishmachine.js book read setup --dir my-book
```

`state` is the one-call project snapshot: setup summary, outline index,
chapters, craft files, recaps and the next step. Use `--view full` only when
you explicitly need the raw setup and outline JSON.

写入完整 artifact：

```bash
node scripts/wishmachine.js book write setup --dir my-book --mode replace --apply < setup.json
node scripts/wishmachine.js book write outline --dir my-book --mode replace --apply < outline.json
node scripts/wishmachine.js book write chapter --dir my-book --id P1-V1-C1 --mode replace --apply < chapter.md
```

默认 dry-run；只有 `--apply` 写盘。写入前会运行确定性检查。

## 创作流

```text
book init
  -> ideas draw / worldpack（可选参考）
  -> 写 setup -> check setup
  -> 写 outline -> check outline
  -> 逐章：读上一章 recap + 本章 outline
          -> WorkBuddy 写正文
          -> book write chapter（先 dry-run）
          -> book write chapter --apply
          -> check chapter
          -> 从正文写 recap -> book write recap
  -> audit
  -> 设定/大纲编辑性审查（review-checklist）
  -> 可选：research skill 联网考究抽卡实体
  -> refresh
  -> export --format book
```

Wishmachine 只负责项目状态、确定性检查、参考抽卡和写入；正文始终由
WorkBuddy 创作。

## 2. 检查

```bash
node scripts/wishmachine.js check --dir my-book --profile all --target outline --max-findings 20
node scripts/wishmachine.js check --dir my-book --profile schema --target setup
```

`custom` includes the built-in rules in `references/builtin-rules.json` plus
project rules under `.wishmachine/rules` or `.novelgen/rules`.

Profile：

```text
quality   结构/引用/ID/章节数量等确定性规则
schema    setup/outline 的 JSON 形状
custom    .wishmachine/rules/*.json（兼容 .novelgen/rules）
all       quality + schema
```

输出 `findings`，每条包含 `rule_id`、`severity`、`target_id`、`issue`、
`suggestion`。

## 3. 抽卡

```bash
node scripts/wishmachine.js ideas draw --type namecard --genre 科幻 --count 12 --seed 42
node scripts/wishmachine.js ideas draw --type premise --genre 修仙 --count 3 --seed 7
node scripts/wishmachine.js ideas draw --type premise --genre 悬疑 --count 3 --seed 7
node scripts/wishmachine.js ideas draw --type premise --genre 都市 --count 3 --seed 7
node scripts/wishmachine.js ideas draw --type premise --genre 历史 --count 3 --seed 7
node scripts/wishmachine.js ideas draw --type provocation --count 4 --seed 9
node scripts/wishmachine.js ideas draw --type law --count 4 --seed 9
node scripts/wishmachine.js ideas draw --type event --count 4 --seed 9
node scripts/wishmachine.js ideas draw --type engine --count 4 --seed 9
node scripts/wishmachine.js ideas draw --type storyline --count 4 --seed 9
node scripts/wishmachine.js ideas draw --type location --count 4 --seed 9
node scripts/wishmachine.js ideas draw --type faction --count 4 --seed 9
node scripts/wishmachine.js ideas draw --type equipment --count 4 --seed 9
node scripts/wishmachine.js ideas draw --type motif --count 4 --seed 9
node scripts/wishmachine.js ideas draw --type worldpack --genre 科幻 --count 1 --seed 42
node scripts/wishmachine.js ideas draw --type plotpack --genre 悬疑 --count 1 --seed 42
node scripts/wishmachine.js ideas draw --type outlinepack --genre 悬疑 --chapters 10 --scenes 3 --target-chars 3000 --count 1 --seed 42
node scripts/wishmachine.js ideas draw --type outlinepack --genre 修仙 --volumes 3 --chapters-per-volume 10 --count 1 --seed 42 --dir my-book --save
node scripts/wishmachine.js book write setup --dir my-book --from-idea <saved-outlinepack-id> --apply
node scripts/wishmachine.js book write outline --dir my-book --from-idea <saved-outlinepack-id> --apply
node scripts/wishmachine.js ideas draw --type worldpack --genre 修仙 --count 1 --seed 42 --dir my-book --save
node scripts/wishmachine.js ideas import --dir my-book --type motif --source "web research" --file cards.json
node scripts/wishmachine.js ideas discover --dir my-book --topic history --limit 3
node scripts/wishmachine.js ideas search --dir my-book --provider wikipedia --query "Mary Celeste" --limit 3
node scripts/wishmachine.js book read ideas --dir my-book
node scripts/wishmachine.js book read idea --id <saved-id> --dir my-book
node scripts/wishmachine.js book read graph --dir my-book
node scripts/wishmachine.js book write research --dir my-book --id <pack-id> < report.json
node scripts/wishmachine.js book read research --dir my-book --id <pack-id>
node scripts/wishmachine.js ideas types
```

抽卡是确定性的；保留 seed 可复现。

`worldpack` returns one premise, engine, location, faction, equipment, two
resources, two scenarios, two storylines and four role-tagged cast cards.
`plotpack` wraps a worldpack with cast relations and six chapter beats
(setup / inciting / midpoint / crisis / climax / resolution).
`outlinepack` expands those beats into chapters with 3-5 scenes per chapter,
target character counts and a draft outline that passes `validateOutline`.
`--volumes` / `--chapters-per-volume` produce multiple volumes; the six beats
are distributed across the whole book instead of repeating per volume, and each
volume uses a different storyline when the pack has one. Volumes carry
opening/closing beats, mysteries and timeline anchors. Chapters carry an
obstacle, planted/resolved mysteries and a beat map; scenes carry
goal/obstacle/turn/stakes. Scenes also carry `turn_event`, `consequence`
(and its `result` alias) and planted/resolved scene mysteries. A chapter's
`scene_chain` records each scene's turn and consequence, and the next scene's
goal begins from the previous consequence. Chapters carry
`entry_from_previous` / `exit_consequence`, so the chain continues across
chapters and volumes. The entry consequence also feeds the chapter's
`obstacle`, `conflict`, `chapter_payoff.pressure`, `mysteries.carried` and
previous `hook`. Pending mysteries carry across chapters/volumes and are
resolved at climax/resolution; `pending_mysteries` is capped. Mysteries are
structured objects with `id`, `question`, `answer`, `payoff`, `importance`,
`thread`, `thread_id`, `thread_type`, `related_cast`, `related_cast_ids` and
`status`. `thread_registry` and `setup_draft.storylines[*].thread_id` share the
same ids; cast `storyline_refs` use those ids. `thread_registry` entries carry
`resolved_in`, `resolved_chapters`, `resolved_mysteries`, `abandoned_history` and
`abandoned_mysteries`. `mystery_registry` stores the deduplicated mystery objects sorted by chapter/id;
both registries carry `*_registry_version: 2`. `check` reports setup/outline
registry drift (including mystery registry drift), unknown chapter thread ids,
and thread references to missing or non-registry mystery ids. The mystery
registry order is checked with natural chapter ordering (C2 before C10), setup
mystery registries are order-checked, and thread registries must be main/sub
then id sorted. Doctor rebuild keeps them sorted and `doctor --fix` reorders
setup/outline registries. Thread `resolved_mysteries` and `abandoned_mysteries`
are sorted and deduplicated by mystery id.
`doctor --fix` rebuilds a missing or stale mystery registry from chapter data.
Checks also flag stale registry entries, final-status mismatches and resolved
or dropped mysteries that are not linked from their thread. `doctor --fix`
removes stale registry entries.
Dropped mysteries carry `reason: pending_capacity`; registry status must be
present in the chapter status set. `book registry` summarizes registry
versions/counts and thread/mystery drift; `book registry clean` rebuilds the
mystery registry and removes stale entries. `book registry clean --dry-run`
previews the before/after counts without writing. `doctor --fix`
migrates old projects, synchronizes thread status from resolved mysteries and
fills abandoned entries; it also downgrades a resolved thread when no matching
resolved mystery remains. Pending mysteries are sorted by importance and capped; dropped
mysteries are recorded in `dropped_mysteries` and `abandoned_threads`.
The saved pack also contains `setup_draft` with main/subplot
storylines, premise progression and a world timeline.
Some packs also include a `motif` and an `inspired_by` graph edge.
`cast_relations` links the four characters to each other, the faction, the
location and the first storyline; each relation carries a `stake`.
`prompt_pack` contains positive, negative, style and keywords; `prompt` is
kept as the positive prompt for compatibility.
Genre decks currently cover default sci-fi, xianxia, suspense, urban and history.

## 4. 读取指导

```bash
node scripts/wishmachine.js gen workflow list
node scripts/wishmachine.js gen workflow read outline
node scripts/wishmachine.js gen reference list
node scripts/wishmachine.js gen reference read outline-schema
node scripts/wishmachine.js gen reference read review-checklist
node scripts/wishmachine.js gen workflow read research
```

第一次写 setup 前读 `setup-schema`；第一次写 outline 前读 `outline-schema`。
设定和大纲的编辑性审查使用 `review-checklist`，它不会替代确定性检查。
历史/文化/科学元素使用 `gen workflow read research`，在主 skill 内完成联网考究后再进入 canon。

## 边界

- 不生成 setup/outline/正文。
- 不调用 LLM。
- 抽卡结果默认只输出；加 `--save` 才写入 `story/ideas/`。
- `ideas import` 可导入人工/联网考究后的卡片；`book write research` 保存考究报告。
- 不做自动历史考据；主 skill 的 `research` workflow 负责联网核验，主 skill 只负责保存抽卡结果和确定性检查。
- 不包含 RPG 模拟；`check --profile rpg` 会明确报未实现。
- 不做 MCP；只提供 CLI，方便作为 Skill 的 `scripts/` 直接运行。
- 不直接编辑项目文件；写入走 `book write`。
