# 发布检查单（RELEASING）

面向维护者。目标是：版本号在四处版本源中始终一致，测试/门禁全绿，tag 与产物可复现，
GitHub Release 和 skill 平台上都能下载到同一份 zip。

约定：版本号严格 `MAJOR.MINOR.PATCH`（可选 `-pre`/`+build`）；发版提交统一为
`chore(release): v<version>`；发布后不再改写已推送的 tag。

## 0. 前置

- 在 `main` 上、工作区干净：`git status`。
- Node.js >= 18、`npm ci` 完成，`gh` CLI 已登录（`gh auth status`）。
- 确认 `docs/MODULES.md` 的门禁（lint:modules）仍通过，且没有未合并的发布相关改动。

## 1. 更新版本号（唯一入口：release 脚本）

```bash
# 先看计划，不写盘
node scripts/release.js <version> --dry-run
# 正式更新；需要立刻打包时加 --pack
node scripts/release.js <version> --pack
```

脚本会**原子地**更新并互相校验四处版本源，任意一处不一致或目标版本更低都会直接拒绝：

- `package.json` → `version`
- `package-lock.json` → 根 `version` + `packages[""].version`
- `scripts/package.json` → `version`（随 zip 分发，CLI 的 `version` 命令读它）
- `SKILL.md` → YAML frontmatter `version:`

输出是 JSON summary（`ok`、`from`、`version`、`files`、`pack`），失败时 stdout 为
`{"ok":false,"error":{...}}`、退出码 1，且不会留下半更新文件。

> 也支持 `npm run release -- <version>`，但注意 npm 会把自己的配置 flag 从参数里吃掉：
> `--dry-run` / `--pack` 会变成 `npm_config_dry_run` / `npm_config_pack` 环境变量
> （脚本已兼容，semantics 不变）；`--root` 会被拆成多余位置参数而直接报错。
> 因此涉及 `--root` 或想绝对确定时，一律显式用 `node scripts/release.js ...`。

> 不要手改任何 version 字段，也不要用 `npm version`——脚本之外的手改会让下一次发布被
> `version fields disagree` 拒绝。

## 2. 更新 CHANGELOG

- 把 `## [Unreleased]` 下的条目移动到新的 `## [<version>] - YYYY-MM-DD` 段落
  （`Added` / `Changed` / `Fixed` / `Removed` 按 Keep a Changelog 分类）。
- 更新文件底部的 compare/release 链接，Unreleased 指向新 tag。
- 只记录用户可感知的变化，不写内部过程性提交。

## 3. 验证门禁

```bash
npm test
npm run lint
npm run lint:modules
npm run format:check
npm run pack
```

手工检查打包产物（版本必须与 `package.json` 一致）：

```bash
node -p "require('./package.json').version"
unzip -l dist/wishmachine-skill-v<version>.zip | head
unzip -l dist/wishmachine-skill-v<version>.zip | grep -E 'SKILL.md|scripts/package.json|scripts/wishmachine.js'
unzip -l dist/wishmachine-skill-flat-v<version>.zip | grep -E 'SKILL.md|scripts/package.json'
```

期望：两个 zip 都存在；标准版条目带 `wishmachine/` 前缀，flat 版在根；都包含
`SKILL.md`、`scripts/wishmachine.js`、`scripts/package.json`，且**不含** `pack.js`、
`release.js`、`check-imports.js`、`check-structure.js`、`skill-manifest.js` 等开发脚本。
`SKILL.md` frontmatter 的 `version` 与包名一致（`scripts/pack.js` 会强校验）。

## 4. 提交

```bash
git add package.json package-lock.json scripts/package.json SKILL.md CHANGELOG.md \
  scripts/release.js tests/release.test.js tests/ideas.matrix.test.js \
  RELEASING.md .github/workflows/ci.yml .github/workflows/release.yml
git commit -m "chore(release): v<version>"
```

`dist/` 在 `.gitignore` 中，不提交；release workflow 会从 tag 重新打包。

## 5. 打 tag 并推送（触发自动发布）

```bash
git push origin main
git tag -a v<version> -m "wishmachine v<version>"
git push origin v<version>
```

`v*` tag push 会触发 `.github/workflows/release.yml`：`npm ci` → 测试与门禁 → `npm run pack`
→ 校验 tag 与 `package.json` 版本一致 → 创建（或复用已有）GitHub Release（`--generate-notes`）
→ 上传 `wishmachine-skill-v<version>.zip` 与 `wishmachine-skill-flat-v<version>.zip`
（`--clobber`，可重跑）。

## 6. 发布后核验

```bash
gh release view v<version>
gh release view v<version> --json assets --jq '.assets[].name'
```

- 两个 zip 都在 release assets 里，文件名含正确版本号。
- 下载标准版 zip，解压后执行 `node scripts/wishmachine.js version`，输出 `wishmachine <version>`。
- 新建一个空目录，按 `SKILL.md` 的“路径 A”跑通 init → draw → write setup/outline → check。

## 7. 上传到 skill 平台（豆包 / Coze 等）

自动发布只覆盖 GitHub Release；skill 平台需要在核验后手动上传（通常是
`dist/wishmachine-skill-v<version>.zip`；平台若要求平铺目录则用 flat 版）：

1. 打开平台的 skill/插件上传入口，上传对应 zip。
2. 平台解析到的 name/description/version 必须与 `SKILL.md` frontmatter 一致；
   不一致时先修 `SKILL.md` 再重新发版，不要手改 zip。
3. 上传后在新会话用三条最小路径冒烟一次（只读 `version`、init + draw、
   写 setup/outline 后 `check`）。
4. 平台侧如有缓存，确认旧版本下架/新版本生效后再宣布发布完成。

## 8. 回滚

- 版本号已发但内容有问题：**不要**移动/删除已推送的 tag；发布一个更高的 patch 版本修复，
  必要时在 GitHub Release notes 标注 `known issue`。
- release workflow 失败但 tag 已推送：修复 workflow 后重跑 job，或本地
  `gh release upload v<version> dist/*.zip --clobber` 补齐 assets。
