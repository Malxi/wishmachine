# 模块化与并发编辑指南

目标：让多个 agent（或多人）可以**同时改不同模块**，靠稳定边界和 CI 门禁避免互相踩。
本文档是模块所有权的单一事实来源；`npm run lint:modules` 会强制检查下面的大部分规则。

## 1. 架构分层

依赖只能指向**同层或更低层**，且不允许循环。`scripts/check-imports.js` 里有唯一的层映射表。

| 层 | 模块 | 职责 | 允许依赖 |
|---|---|---|---|
| L0 | `util.js` | 纯工具（路径/原子写/种子/校验） | 无本地依赖 |
| L1 | `paths.js`、`registry.js`、`contracts.js`、`rules/finding.js`、`decks/**` | 文件路径声明、纯 registry 推导、artifact 形状/枚举契约、finding 构造、题材卡牌数据 | L0 |
| L2 | `rules/**`、`ideas/**`、`graph.js`、`store.js`、`state.js`、`write.js`、`read.js`、`export.js`、`sources.js`、`sources/**`、`doctor.js`、`registry*.js`、`guides.js`、`schema.js`（门面）、`ideas.js`（门面） | 校验规则、抽卡生成、artifact 读写、状态快照、registry 存储/操作、网络与导出 | L0–L2 |
| L3 | `project-core.js`、`project.js`（门面） | 项目生命周期（init/load/audit/refresh）、对外组合入口 | L0–L3 |
| L4 | `cli.js`、`cli/**`、`wishmachine.js`，以及开发用 `pack.js`、`release.js`、`check-imports.js`、`check-structure.js`、`skill-manifest.js` | 命令行解析/分发、进程入口、打包/发布/门禁脚本（开发脚本不进 skill zip） | L0–L4 |

附加规则：

- **门面只做 re-export**：`schema.js`、`ideas.js`、`project.js` 不允许出现逻辑（≤80 行）。
- **CLI 边界**：`cli.js` / `cli/**` 只能 import `../project.js`、`../schema.js`、`../ideas.js`、`../guides.js`、`../util.js` 和 cli 内部文件，不能直接 import 领域内部模块。
- **features 隔离**：`rules/**` 不得 import `ideas/**`、`project*`、`state`、`write/read/export/sources/graph/doctor`；`ideas/**` 不得 import `rules/**`。
- **数据模块纯净**：`decks/*.js`（除 `index.js`）没有任何本地 import。
- **无环、无坏引用**；门面 ≤80 行。

另有独立的**结构门禁**（`scripts/check-structure.js`，`npm run lint:structure`）：

| 限制 | 阈值 | 说明 |
|---|---|---|
| 文件行数 | **≤350** | 超了拆模块；数据/门面文件同样适用 |
| 函数行数 | **≤80** | 超了抽 helper 或拆函数 |
| 参数个数 | **≤4** | 超了改为传 options 对象（`fn({ a, b, c, d, e })`） |

唯一例外是 `rules/finding.js:finding`（规则词汇表本身，5 个位置参数；改成对象会让每条规则调用难读），在 `PARAM_ALLOWLIST` 中显式登记。`npm run lint:modules` 会同时跑边界与结构两个 checker，`tests/modules.test.js`、`tests/structure.test.js` 也在测试里锁住。

## 2. 公共面（稳定 API）

| 公共面 | 内容 | 使用者 |
|---|---|---|
| `scripts/project.js` | 项目生命周期 + artifact store + registry + export/sources/graph 的完整 API（27 个导出） | `cli/**`、`tests/**`、外部调用方 |
| `scripts/schema.js` | `finding`、`validate*`、`checkProject`/`checkCandidate`、`outlineIndex` | `write.js`、`read.js`、`doctor.js`、`cli/**` |
| `scripts/ideas.js` | `drawIdeas`、`ideasTypes`、`validateIdeaDraw` | `cli/**`、`tests/**` |
| `scripts/rules/index.js` | 规则实现的统一出口（schema.js 的唯一依赖） | `schema.js`、rules 内部 |
| `scripts/contracts.js` | setup/outline 形状、ID 正则、registry 状态枚举、资源类别等唯一数据契约 | `rules/**`、`ideas/**`、`registry.js`、`decks/index.js` |
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
| registry | `scripts/registry.js`、`scripts/registry-rules.js`、`scripts/registry-store.js` / `registry-snapshot.js` / `registry-operations.js` / `registry-backup.js`、`scripts/registry-actions.js` / `registry-clean.js` / `registry-abandon.js` / `registry-repair.js` / `registry-status.js` / `registry-docs.js`、`scripts/doctor.js` | registry 一致性、备份/undo、doctor |
| sources-graph | `scripts/sources.js`、`scripts/sources/**`、`scripts/graph.js`、`scripts/guides.js` | 联网检索/SSRF（固定 IP 连接）、实体图、文档读取 |
| contracts | `scripts/contracts.js` | setup/outline 形状与枚举的单一契约来源；改动要同步 rules 与 ideas |
| cli | `scripts/cli/**`、`scripts/cli.js` | 命令、flag、help、输出契约（逐命令 help） |
| tests | `tests/**` | 按模块拆分的测试、fixtures、矩阵/发布/安全回归 |
| docs/release | `SKILL.md`、`README.md`、`references/**`、`docs/**`、`CHANGELOG.md`、`RELEASING.md`、`package.json`、`.github/**`、`scripts/release.js`、`dist` | 文档、版本（release 脚本）、CHANGELOG、CI、发布 |

每个 scope 的测试文件也是该 scope 所有（例如 `tests/rules.test.js` 归 rules）。跨 scope 的测试改动在对应 scope 里做。

## 4. 共享热点（必须串行/单一 owner）

这些文件天然会被所有 agent 碰到，规则是**同一时间只允许一个 owner 改**，其他人通过「先改公共面 + 通知」推进：

| 热点 | 冲突原因 | 缓解 |
|---|---|---|
| `scripts/check-imports.js` 的 `LAYERS` 映射 | 新增顶层模块都要登记 | 只在确定新层级时由架构 owner 改一次 |
| `scripts/rules/index.js`、`decks/index.js` | 聚合导出 | 只在新增公共符号时改；排序无关紧要 |
| `scripts/schema.js`、`ideas.js`、`project.js` 门面 | 所有跨模块调用都看它 | 保持只 re-export；先加公共面再迁实现 |
| `scripts/cli/spec.js` | 命令/flag 表集中 | 按命令组拆 spec 后冲突面已缩小；新增命令只加自己组 |
| `scripts/contracts.js` | rules 与 ideas 都依赖它（fan-in 12） | 只由 contracts owner 改；改动必须先跑 rules+ideas 两侧测试 |
| `scripts/release.js` + 版本文件（package.json / package-lock / scripts/package.json / SKILL.md） | 发版必定同时改动 | 只能由 release owner 用 `node scripts/release.js <version>` 改，禁止手改 version |
| `tests/fixtures.js` | 所有测试共享 | 只加不删；新 fixture 命名带模块前缀 |
| `package.json`、`SKILL.md`、`README.md`、`references/**`、`CHANGELOG.md`、`RELEASING.md`、`AUDIT-*.md` | 版本/文档 | docs/release owner 独占 |
| `docs/MODULES.md`、CI | 规则本身 | 架构 owner 独占 |

## 5. 并发工作流建议

1. 任务开始：确认 scope，读该 scope 现有测试，跑一次基线 `node --test`。
2. 只改自己 scope；需要别的 scope 的公共 API 时，**先在公共面加导出**（不改对方内部实现）。
3. 每完成一块跑 `node --test` + `npm run lint:modules`；不要等全部做完才跑。
4. 跨 scope 的接口变更：在 commit message/report 里列出「新增公共符号」，依赖方按需跟进。
5. 合并前门禁：`npm test && npm run lint && npm run lint:modules && npm run format:check`（CI 同款）。

## 6. 当前状态（v0.3.x 三轮重构后）

2026-11-13 的并发友好重构与体验/工程化收尾已落地：

- 第一轮：`artifacts.js`(371/23 导出/唯一循环) → `paths.js` / `state.js` / `store.js` / `project-core.js`；`project.js` 变 19 行纯门面；循环清零。`rules/quality.js`(473) 按 target 拆分；`cli/args.js`(238) 拆成 args/spec/分组 spec + `cli/index.js`。
- 第二轮：`ideas/outlinepack.js`(443) / `worldpack.js`(407)、`sources.js`(368)、`rules/outline-shape.js`(352) 全部拆分；结构门禁（文件 ≤350、函数 ≤80、参数 ≤4）上线。
- 第三轮：`contracts.js` 成为 setup/outline 形状/枚举/ID 正则的单一契约（rules、ideas、registry、decks 共用，删除重复字面量）；`ideas/draw.js` → draw + `cast-plan.js`；`registry-store.js` → snapshot/operations/backup；`registry-actions.js` → clean/abandon/repair/status/docs；`rules/quality/outline.js` → 编排 + cast/events/resources；`ideas --save` 落盘改紧凑 JSON（10 章 payload 677KB → 393KB，1.72×）。
- 体验：missing/corrupt artifact 返回 `artifact.*` findings；`check/audit --ignore/--ignore-file`；`state.next.command` 用真实路径；逐命令 `--help`；audit 兜底 finding 统一走 `finding()`。
- 安全：sources 默认传输改为**连接固定已校验 IP**（`node:http/https` + 自定义 lookup），消除 DNS rebinding；保留逐跳 SSRF 校验、重定向上限与错误契约。
- 工程化：`scripts/release.js` 原子同步四处版本源；CHANGELOG/RELEASING；CI ubuntu+windows × Node 18/20/22 + pack smoke；tag push 自动 GitHub Release；24 组生成器矩阵回归。
- 全仓 **95 个模块、0 循环**；`project.js`/`schema.js`/`ideas.js` 门面 19/6/4 行；checker 与 tests 锁住边界/结构。

依赖中枢（fan-in）现状：`util.js` 30、`rules/finding.js` 20、`paths.js` 13、`contracts.js` 12、`registry.js` 11；它们都是稳定的低层契约，改动时由对应 owner 串行处理即可。

## 7. 下一步拆分候选（按并发收益排序）

| 位置 | 行数 | 问题 | 建议 |
|---|---|---|---|
| `sources/net.js` | 303 | 固定 IP 传输 + 重定向 + 解压集中 | 拆 `transport.js` + `redirects.js` |
| `ideas/outline-volume.js` | 283 | 单卷章节构建仍偏大 | 拆 scenes/mysteries 装配 |
| `ideas/draw.js` | 265 | 16 类型分派 + 结果信封 | 分派表独立 |
| `ideas/validate.js` | 257 | 抽卡校验器规则较多 | 按 cast/thread/mystery 拆 |
| `rules/check.js` | 240 | artifact 预检 + profile 分派 + ignore | 预检层独立 `artifact-read.js` |
| `write.js` | 240 | 写入管线可再细化 | 按 section preparer 拆 |

以上都不影响现有并发边界：拆分只发生在单一 scope/dir 内部，公共面保持不变。

## 8. 新增模块 checklist

- [ ] 放进正确的层（见 §1）；纯数据放 `decks/`，纯规则放 `rules/`，命令处理放 `cli/`。
- [ ] 在 `scripts/check-imports.js` 的 `LAYERS` 里登记（若属于新顶层文件）。
- [ ] 跨目录使用者只从公共面 import；目录内实现文件可以自由拆分。
- [ ] 补该 scope 的测试（`tests/<scope>.test.js`）。
- [ ] 若新增/修改 artifact 字段或枚举，先改 `scripts/contracts.js`，再改 rules 与 ideas 两端。
- [ ] 检查结构门禁：文件 ≤350 行、函数 ≤80 行、参数 ≤4 个（超了改 options 对象）。
- [ ] 跑 `npm test && npm run lint:modules && npm run lint && npm run format:check`。
- [ ] 发版相关改动走 `node scripts/release.js`，不要手改任何 version 字段（见 RELEASING.md）。
