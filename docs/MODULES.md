# 模块化与并发编辑指南

目标：让多个 agent（或多人）可以**同时改不同模块**，靠稳定边界和 CI 门禁避免互相踩。
本文档是模块所有权的单一事实来源；`npm run lint:modules` 会强制检查下面的大部分规则。

## 1. 架构分层

依赖只能指向**同层或更低层**，且不允许循环。`scripts/check-imports.js` 里有唯一的层映射表。

| 层 | 模块 | 职责 | 允许依赖 |
|---|---|---|---|
| L0 | `util.js` | 纯工具（路径/原子写/种子/校验） | 无本地依赖 |
| L1 | `paths.js`、`registry.js`、`rules/finding.js`、`decks/**` | 文件路径声明、纯 registry 推导、finding 构造、题材卡牌数据 | L0 |
| L2 | `rules/**`、`ideas/**`、`graph.js`、`store.js`、`state.js`、`write.js`、`read.js`、`export.js`、`sources.js`、`doctor.js`、`registry-store.js`、`registry-actions.js`、`registry-rules.js`、`guides.js`、`schema.js`（门面）、`ideas.js`（门面） | 校验规则、抽卡生成、artifact 读写、状态快照、registry 存储/操作、网络与导出 | L0–L2 |
| L3 | `project-core.js`、`project.js`（门面） | 项目生命周期（init/load/audit/refresh）、对外组合入口 | L0–L3 |
| L4 | `cli.js`、`cli/**`、`wishmachine.js`、`pack.js`、`check-imports.js` | 命令行解析/分发、进程入口、打包与门禁脚本 | L0–L4 |

附加规则：

- **门面只做 re-export**：`schema.js`、`ideas.js`、`project.js` 不允许出现逻辑（≤80 行）。
- **CLI 边界**：`cli.js` / `cli/**` 只能 import `../project.js`、`../schema.js`、`../ideas.js`、`../guides.js`、`../util.js` 和 cli 内部文件，不能直接 import 领域内部模块。
- **features 隔离**：`rules/**` 不得 import `ideas/**`、`project*`、`state`、`write/read/export/sources/graph/doctor`；`ideas/**` 不得 import `rules/**`。
- **数据模块纯净**：`decks/*.js`（除 `index.js`）没有任何本地 import。
- **无环、无坏引用、单文件 ≤600 行**（门面 ≤80 行）。

## 2. 公共面（稳定 API）

| 公共面 | 内容 | 使用者 |
|---|---|---|
| `scripts/project.js` | 项目生命周期 + artifact store + registry + export/sources/graph 的完整 API（27 个导出） | `cli/**`、`tests/**`、外部调用方 |
| `scripts/schema.js` | `finding`、`validate*`、`checkProject`/`checkCandidate`、`outlineIndex` | `write.js`、`read.js`、`doctor.js`、`cli/**` |
| `scripts/ideas.js` | `drawIdeas`、`ideasTypes`、`validateIdeaDraw` | `cli/**`、`tests/**` |
| `scripts/rules/index.js` | 规则实现的统一出口（schema.js 的唯一依赖） | `schema.js`、rules 内部 |
| `scripts/decks/index.js` | 题材 deck 注册表与 `selectDeck` | `ideas/**`、`rules/**`（只读常量） |

规则：**跨目录引用只走公共面**；公共面之后若要保持兼容，内部文件可以自由拆分/改名。

## 3. 并行编辑的所有权切分

给不同 agent 的任务应按下面的 scope 切，尽量一 task 一 scope：

| Scope | 文件/目录 | 典型任务 |
|---|---|---|
| rules | `scripts/rules/**`、`scripts/schema.js` | 新增/调整校验规则、finding 文案 |
| ideas | `scripts/ideas/**`、`scripts/decks/**` | 抽卡逻辑、题材数据、生成器修复 |
| project-state | `scripts/paths.js`、`scripts/state.js`、`scripts/project-core.js`、`scripts/project.js`、`scripts/store.js` | 项目生命周期、状态快照、artifact 保存 |
| artifact-io | `scripts/write.js`、`scripts/read.js`、`scripts/export.js` | 写入管线、读取器、导出格式 |
| registry | `scripts/registry.js`、`scripts/registry-rules.js`、`scripts/registry-store.js`、`scripts/registry-actions.js`、`scripts/doctor.js` | registry 一致性、备份/undo、doctor |
| sources-graph | `scripts/sources.js`、`scripts/graph.js`、`scripts/guides.js` | 联网检索/SSRF、实体图、文档读取 |
| cli | `scripts/cli/**`、`scripts/cli.js` | 命令、flag、help、输出契约 |
| tests | `tests/**` | 按模块拆分的测试、fixtures |
| docs/release | `SKILL.md`、`README.md`、`references/**`、`docs/**`、`package.json`、`.github/**`、`dist` | 文档、版本、CI、发布 |

每个 scope 的测试文件也是该 scope 所有（例如 `tests/rules.test.js` 归 rules）。跨 scope 的测试改动在对应 scope 里做。

## 4. 共享热点（必须串行/单一 owner）

这些文件天然会被所有 agent 碰到，规则是**同一时间只允许一个 owner 改**，其他人通过「先改公共面 + 通知」推进：

| 热点 | 冲突原因 | 缓解 |
|---|---|---|
| `scripts/check-imports.js` 的 `LAYERS` 映射 | 新增顶层模块都要登记 | 只在确定新层级时由架构 owner 改一次 |
| `scripts/rules/index.js`、`decks/index.js` | 聚合导出 | 只在新增公共符号时改；排序无关紧要 |
| `scripts/schema.js`、`ideas.js`、`project.js` 门面 | 所有跨模块调用都看它 | 保持只 re-export；先加公共面再迁实现 |
| `scripts/cli/spec.js` | 命令/flag 表集中 | 按命令组拆 spec 后冲突面已缩小；新增命令只加自己组 |
| `tests/fixtures.js` | 所有测试共享 | 只加不删；新 fixture 命名带模块前缀 |
| `package.json`、`SKILL.md`、`README.md`、`references/**`、`AUDIT-*.md` | 版本/文档 | docs/release owner 独占 |
| `docs/MODULES.md`、CI | 规则本身 | 架构 owner 独占 |

## 5. 并发工作流建议

1. 任务开始：确认 scope，读该 scope 现有测试，跑一次基线 `node --test`。
2. 只改自己 scope；需要别的 scope 的公共 API 时，**先在公共面加导出**（不改对方内部实现）。
3. 每完成一块跑 `node --test` + `npm run lint:modules`；不要等全部做完才跑。
4. 跨 scope 的接口变更：在 commit message/report 里列出「新增公共符号」，依赖方按需跟进。
5. 合并前门禁：`npm test && npm run lint && npm run lint:modules && npm run format:check`（CI 同款）。

## 6. 当前状态（v0.3.x 重构后）

2026-11-13 的并发友好重构已落地：

- `artifacts.js`（371 行、23 导出、与 `graph.js` 构成唯一循环）已拆成 `paths.js`(119) / `state.js`(150) / `store.js`(119) / `project-core.js`(204)，`project.js` 由 220 行混合实现变为 **19 行纯门面**；循环清零。
- `rules/quality.js`(473) 按 target 拆成 `rules/quality/{setup,craft,recap,chapter,outline,shared}.js`（最大 283 行），新增 `rules/index.js` 公共面。
- `cli/args.js`(238) 拆成 `args.js`(147，解析/助手) + `spec.js`(70) + `spec/{book,ideas,project,gen}.js`，新增 `cli/index.js`；`book.js`/`ideas.js` 的 registry 与 validate 子命令再拆出独立文件。
- 全仓 **68 个模块、0 循环**；`project.js`/`schema.js`/`ideas.js` 门面 18/6/4 行；`npm run lint:modules` 与 `tests/modules.test.js` 强制层方向、无环、门面纯净、CLI/features 隔离；CI 已加这一步。

依赖中枢（fan-in）现状：`util.js` 24、`rules/finding.js` 12、`paths.js` 10、`cli/args.js` 8、`registry.js` 7；它们都是稳定的低层契约，改动时由对应 owner 串行处理即可。

## 7. 下一步拆分候选（按并发收益排序）

| 位置 | 行数 | 问题 | 建议 |
|---|---|---|---|
| `ideas/outlinepack.js` | 443 | 单/多卷装配、registry、setup_draft 都在一处 | 拆 `volume.js` + `assemble.js` + `registry-build.js` |
| `ideas/worldpack.js` | 407 | worldpack/plotpack/namecards 混在一起 | 按 product 拆 3 个文件 |
| `sources.js` | 368 | URL 校验/重定向/HTML 解析/card 映射/保存 | 拆 `net.js` + `wikipedia.js` + `cards.js` |
| `rules/outline-shape.js` | 352 | 形状+语义+排序都在一处 | 按 part/volume/chapter/event 拆 |
| `ideas/draw.js` | 317 | 16 类型分派 + cast 规划 | 分派表 + `cast-plan.js` |
| `registry-store.js` | 303 | 快照/日志/undo/redo 全在一起 | 拆 `snapshot.js` + `operations-log.js` |
| 数据契约 | — | `rules/shape.js`（校验形状）与 `ideas/**`（生成形状）各维护一份 setup/outline 字段知识 | 远期抽 `contracts.js`（字段/枚举/必填的单一来源），rules 与 ideas 都从它派生 |

以上都不影响现有并发边界：拆分只发生在单一 scope/dir 内部，公共面保持不变。

## 7. 新增模块 checklist

- [ ] 放进正确的层（见 §1）；纯数据放 `decks/`，纯规则放 `rules/`，命令处理放 `cli/`。
- [ ] 在 `scripts/check-imports.js` 的 `LAYERS` 里登记（若属于新顶层文件）。
- [ ] 跨目录使用者只从公共面 import；目录内实现文件可以自由拆分。
- [ ] 补该 scope 的测试（`tests/<scope>.test.js`）。
- [ ] 跑 `npm test && npm run lint:modules && npm run lint && npm run format:check`。
