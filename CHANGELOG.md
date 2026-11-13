# Changelog

本项目的所有重要变更都记录在此文件。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.5.4] - 2026-11-13

### Added

- `style.chapter.fragments`：叙述句里 ≤5 字碎片句占比（排除对话），抓“没响。”式电报句。
- `style.chapter.enumeration`：“九把/两捆/三道”式数量清单密度，抓清单式罗列。
- `style.chapter.counting_tic` / `style.chapter.recount_tic`：数/点/核对/清点动词密度与
  “点过一遍，又点一遍”式重复动作。
- `references/scene-guide.md` 增加“电报句/清单式罗列/数数口头禅”三种病与改法。

### Changed

- style 阈值按《上行八级》《第七垄》校准：碎片句 warn 0.04 / risk 0.08，清单 15/22，
  数数动词 2/3，重复点数 0.5/1.5。

## [0.5.3] - 2026-11-13

### Fixed

- `style.setup.name_source`：`authored` 角色的 `namecard_id`（如 `authored-01`）不再被
  计入抽卡来源覆盖率；4 抽卡 + 4 自建会正确报 0.5（low）而不是 1.0。补了回归测试。

## [0.5.2] - 2026-11-13

### Added

- `style.chapter.padding`：章节 CJK / target_chars 超过 1.1/1.25 时提示注水。
- `style.chapter.motif_overuse` + `novel.json.style.motifs`：项目级母题词表（如“数/手指/
  六/第七垄/纸边”）密度检查；母题每次重复必须升级代价或认知。
- `style.book.repeated_motif`：跨章检测重复的 4–6 字描写/动作短语（≥40% 章节出现），
  输出 `motifs` 证据（短语 + 出现的章节）。
- `references/scene-guide.md`：场景目标/阻碍/转折/结果四件事、段落功能、母题预算、
  “数数”场景改写示例、删减顺序。

### Changed

- `audit --profile style` 返回 `motifs` 并新增书级 repeated_motif finding；书级汇总不再
  误用单章 padding 规则。
- SKILL/workflow-deai/style-checklist 增加场景焦点与母题预算说明。

## [0.5.1] - 2026-11-13

### Added

- 取名 pass：`references/name-guide.md`；`core_cast[*]` 新增可选 `namecard_id`、
  `naming_style`、`naming_logic`、`name_source` 字段；`ideas outlinepack` 的 setup_draft
  会把 namecard 的来源字段带进 setup。
- `style.setup.name_*` 检查：姓氏集中度、描述式名字（老X/阿X/收成人/XX那位）、双字姓名里
  的单字名比例、namecard 来源覆盖率、命名风格多样性、重名；均为 low/medium advisory。
- setup schema 校验 `name_source`（draw|authored）与 `naming_style`
  （plain|literary|hard|rustic）取值。

### Changed

- SKILL 的“风格与去 AI 味”流程增加“先定题材 → namecard 抽名 → 写进 setup”步骤；
  workflow-deai、style-checklist、setup-schema、README 同步。

## [0.5.0] - 2026-11-13

### Added

- `check --profile style`：确定性风格/AI 味统计指标（单字谓语、否定式单字谓语、句首复用、
  段尾升华、比喻密度、模板连接句、对话比例、句长/段长节奏、短句簇），setup 另有题材堆叠、
  抽象词密度、格言式主题、规则可操作性；findings 只报 low/medium，永不 blocking，带
  `metrics`、`evidence` 和改写建议。阈值可在 `novel.json.style` 覆盖。
- `audit --profile style`：全书 pooled metrics + 每章 metrics + 书级 findings，支持
  `--view summary`、`--min-severity`、`--max-findings`、`--ignore`/`--ignore-file`。
- voice card（`story/style/voice.json`）：`book write style` / `book read style`，
  `book read context` 带 `style` summary；记录声音描述、原则、禁用项与正/反样本。
- `references/workflow-deai.md` + `references/style-checklist.md`：设定 loop、章节 loop
  （最多 2 轮 + 指标退出条件）、书级 loop、具体性置换/句法去模板/重复纪律/对话口语化/
  场景裁剪等改稿手法，以及第七垄实测反例。

### Changed

- `check` / `audit` 的 profile 列表增加 `style`；`audit` 新增 `--profile` 参数。
- `SKILL.md` 增加“风格与去 AI 味”流程与 voice card 用法；README、check-profiles、
  book-write、stage-contracts 同步更新。

## [0.4.1] - 2026-11-13

### Added

- `export --format html`：无外链、无脚本的单文件阅读页（目录/人物/规则/全文、深浅色、
  移动端与打印样式），替代“自己写脚本生成阅读页”的重复劳动。
- `audit --view summary`：只返回 totals 与 `failing_targets`，适合脚本/模型快速判断；
  `book write chapter` 返回 `stats: {cjk, chars, paragraphs}`，dry-run 即可核对字数。
- `quality.registry.drift`（medium）：`check`/`audit` 现在能发现 setup/outline 派生
  registry 不一致，不再出现“audit 100 分、doctor 报 registry 漂移”的假绿灯。

### Changed

- `book write setup/outline --apply` 写盘后自动重建 `thread_registry`/`mystery_registry`
  （两份一起，结果带 `registry_repair`；dry-run 提前给 `needed`），并新增对应测试。
- `book init --genre` 支持 `,`、`，`、`、`、`/` 分隔的多题材列表。
- `chapter` 超过 `target_chars × 1.25` 时新增 low 提示；`book write chapter` 的 dry-run
  不再提示“缺少 recap”（recap 是下一步；`check`/`audit` 仍会提示）。
- `references/setup-schema.md`、`outline-schema.md`、`book-write.md`、`check-profiles.md`
  补充派生 registry 的 canonical 形状、自动修复与 `doctor --fix` 流程。

## [0.4.0] - 2026-11-13

### Added

- DeepSeek Harness bundle（`dsh/`）：把 `wishmachine` 技能注册为 Host 级 skill provider，
  可在 DSH **Plugins → Add plugin** 粘贴 Git 链接直接安装，也可通过自定义插件索引在
  **Discover** 里安装——不需要手工复制 Skill 目录到 `~/.dsh/skills`。
- `scripts/build-dsh-bundle.js`（`npm run build:dsh` / `npm run lint:dsh`）：从
  `SKILL.md`、`scripts/`、`references/` 生成自包含的 `dsh/skills/wishmachine/`，同步
  bundle 版本并重建插件索引；CI 校验生成树与索引是否同步。
- `docs/DSH.md`：链接安装、更新/卸载、运行时（`ELECTRON_RUN_AS_NODE`）与安全说明。

### Changed

- `scripts/release.js` 同步 `dsh/` 版本文件、bundle 内 `SKILL.md` 与插件索引版本；
  `RELEASING.md` 增加发布时固定索引 commit 的步骤。

## [0.3.3] - 2026-11-13

### Added

- 逐命令帮助：`wishmachine <command> [subcommand] --help` 输出该命令的用法与 flag 列表；
  裸 `--help` 仍为全局帮助。
- `check`/`audit` 支持 `--ignore rule_id,...` 与 `--ignore-file <json>`，忽略数量记录在
  `ignored_findings` / `ignored_rules`。
- 单一数据契约 `scripts/contracts.js`：setup/outline 形状、ID 正则、registry 状态枚举、
  资源类别只维护一份，rules / ideas / registry / decks 共用。
- 发布工程化：`scripts/release.js` 原子更新四处版本源；新增 `CHANGELOG.md`、`RELEASING.md`；
  CI 扩展为 ubuntu + windows × Node 18/20/22 并 smoke 打包；新增 tag 触发的
  `release.yml` 自动创建 GitHub Release 并上传两份 zip。
- 生成器矩阵回归 `tests/ideas.matrix.test.js`：6 题材 × 2 seed × 2 结构配置，写回后
  medium/high/critical 均为 0。

### Changed

- 缺失/损坏的 artifact 现在返回 `artifact.<target>.missing` / `artifact.<target>.invalid_json`
  finding（blocking，exit 2），不再抛原始 ENOENT/JSON 错误；`audit` 的单目标异常降级为
  `quality.audit.error` finding。
- `state.next.command` / `fast_path` 使用真实项目路径（含空格时自动加引号）。
- ideas `--save` 落盘改为紧凑 JSON（10 章 outlinepack 约 677KB → 393KB）。
- 继续拆分 `ideas/draw.js`、`registry-store.js`、`registry-actions.js`、`rules/quality/outline.js`；
  模块数 95，0 循环，结构与边界门禁全绿。
- 联网抓取默认传输改为连接固定已校验 IP（`node:http/https` + 自定义 lookup），消除
  DNS rebinding 窗口；逐跳重定向仍重新做 SSRF 校验。

### Fixed

- `check` 空项目/损坏 JSON 不再崩溃；`audit` 不再因单个 artifact 故障整体失败。

## [0.3.2] - 2026-11-13

### Fixed

- 打包产物携带 `scripts/package.json`；解压/全局安装后 CLI 不再因缺少仓库根
  `package.json` 而报 `MODULE_NOT_FOUND`。
- `SKILL.md` 输出合法 YAML frontmatter，修复 skill 平台上传时报
  “missing YAML name/description”。

### Changed

- 新增模块边界门禁（`scripts/check-imports.js`）与结构门禁
  （`scripts/check-structure.js`：文件 ≤350 行、函数 ≤80 行、参数 ≤4），
  两者并入 `npm run lint:modules` 与测试。
- 按层拆分巨型模块（ideas、rules、registry、CLI），支持多 agent 并行编辑。

## [0.3.1] - 2026-11-13

### Fixed

- 依据外部 QA 报告修复多卷 outlinepack、registry 一致性与写入健壮性问题。

## [0.3.0] - 2026-11-13

首个带 tag 的发布版本。

### Added

- 多卷 outlinepack 生成：`--volumes` / `--chapters-per-volume`，卷级 `payoff_contract`，
  卷/章/场景三层节拍与场景链。
- mystery / thread registry：生成、跨 setup/outline 同步、状态一致性检查与 doctor 修复。
- 确定性检查：profile/target 组合、稳定 finding id、去重排序、`--min-severity` /
  `--max-findings`、ignores 与 ignored 汇总、validation 输出 schema。
- 抽卡：21 种 idea 类型、cast 角色分配与 auto cast、warning codes、全部题材 deck 数据外置。
- registry 运维：status / clean / repair、快照备份、undo / redo、操作日志。
- `book init/write/read/check/audit/refresh/export` 等 CLI 契约与 JSON 错误输出。
- 两份可分发 zip（标准 `wishmachine/` 前缀与 flat 版）打包脚本。

### Changed

- 完成 P0-P2 审核整改与大规模模块拆分。

[Unreleased]: https://github.com/Malxi/wishmachine/compare/v0.5.4...HEAD
[0.5.4]: https://github.com/Malxi/wishmachine/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/Malxi/wishmachine/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/Malxi/wishmachine/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/Malxi/wishmachine/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/Malxi/wishmachine/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/Malxi/wishmachine/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/Malxi/wishmachine/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/Malxi/wishmachine/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/Malxi/wishmachine/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/Malxi/wishmachine/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Malxi/wishmachine/releases/tag/v0.3.0
