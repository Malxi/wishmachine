# Changelog

本项目的所有重要变更都记录在此文件。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

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

[Unreleased]: https://github.com/Malxi/wishmachine/compare/v0.3.3...HEAD
[0.3.3]: https://github.com/Malxi/wishmachine/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/Malxi/wishmachine/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/Malxi/wishmachine/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Malxi/wishmachine/releases/tag/v0.3.0
