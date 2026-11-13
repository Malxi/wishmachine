# 在 DeepSeek Harness（DSH）中安装 Wishmachine

`dsh/` 是本仓库里的 **DSH bundle**。安装它后，`wishmachine` 技能会出现在 DSH 的
Host 级技能目录里，模型可以像加载其他技能一样加载它——不需要手工把 Skill 目录复制到
`~/.dsh/skills`，安装和更新都由 DSH 的插件管理器完成。

> 这是"链接安装"路径：用 Git 地址（或自定义插件索引 URL）安装，而不是上传 zip。

## 方式一：Add plugin 粘贴 Git 链接

1. 打开 **Plugins**。
2. 点 **Add plugin**（或箭头菜单里的 **Install a third-party plugin**）。
3. 粘贴 Git 地址，两种写法：

   ```text
   # 推荐：跟随发布 tag（无需查 commit）
   git+https://github.com/Malxi/wishmachine.git#v0.5.1&path:/dsh

   # 可复现：固定 40 位 commit
   git+https://github.com/Malxi/wishmachine.git#<40-hex-commit>&path:/dsh
   ```

   固定 commit 的写法从 [Releases](https://github.com/Malxi/wishmachine/releases) 或
   `dsh/market/index.json` 里取；`path:/dsh` 指向仓库中的 bundle 子目录。
4. 在确认框里核对 source 后安装；pnpm 会把包装进当前 profile，bundle 会自动激活。
5. 新开（或重载）一个会话，问模型"用 wishmachine 技能"或用 `/wishmachine` 显式加载。

这种方式不需要发布 npm 包，也不需要 GitHub Pages；Git 仓库本身就是安装源。

## 方式二：自定义插件索引（Discover，类似 marketplace）

1. 在 **Plugins → Experimental plugins** 打开 **Custom plugin indexes**。
2. **Discover → Add index source**，填入本仓库发布的索引 URL，例如：

   ```text
   https://cdn.jsdelivr.net/gh/Malxi/wishmachine@v<version>/dsh/market/index.json
   ```

   （或 `https://raw.githubusercontent.com/Malxi/wishmachine/v<version>/dsh/market/index.json`）
3. 在卡片里安装 **Wishmachine**；卡片会显示版本与 Git source，安装逻辑与方式一相同。

索引格式遵循 DSH 的 plugin index（`format: 1`，Git source 带 `commit` + `path`），由
`scripts/build-dsh-bundle.js` 生成，不需要手工编辑。

## 安装后

- 技能名 `wishmachine`，描述来自 `SKILL.md` frontmatter；模型通过 `skill` 工具加载，
  用户可以用 `/wishmachine` 触发。
- 技能内容与独立 Skill 包完全相同（`dsh/skills/wishmachine/`），bundle 会把该目录作为
  **resource base** 报告给宿主，所以 `SKILL.md` 里的相对路径（`scripts/`、`references/`）
  都能正确解析。
- 项目文件（`book init --dir ...`）创建在当前工作区，与技能安装位置无关。

## 运行时要求

技能本体是一个 Node.js CLI（Node ≥ 18）。DSH Desktop 自带 Electron，但**不保证 PATH
里有 `node`**。两种方式：

```bash
# 已安装 Node.js
node "<skill-base>/scripts/wishmachine.js" version

# 只装了 DSH Desktop：用 Harness 的运行时（bash）
ELECTRON_RUN_AS_NODE=1 "$DSH_NODE_EXECUTABLE" "<skill-base>/scripts/wishmachine.js" version
```

PowerShell：

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& $env:DSH_NODE_EXECUTABLE "<skill-base>\scripts\wishmachine.js" version
```

`<skill-base>` 是技能加载结果里 `Base directory for this skill:` 给出的路径。另外
PowerShell 不支持 `< file` 输入重定向，写入 artifact 时用
`Get-Content setup.json -Raw | node ...` 代替 `node ... < setup.json`。

## 更新 / 卸载

- **更新**：用新版本 commit 的 Git 地址重新 Add plugin（或从更新后的索引卡片安装）；
  DSH 会替换已安装的 bundle。
- **卸载**：Plugins → 打开 Wishmachine 卡片 → **Remove**（同时移除它的 skill provider）。

## 安全说明

Bundle 的 JS 在 DSH Host 进程内执行（与所有 Host 插件一样），拥有宿主权限；本仓库的
bundle 只注册一个只读 skill provider，不访问网络、不写文件。安装前请核对 commit 与
source，确认来自本仓库。

## 开发

```bash
npm run build:dsh     # 从仓库根同步 SKILL.md/scripts/references 并重建 dsh/ 与索引
npm run lint:dsh      # CI 校验 dsh/ 是否与源同步
npm test              # 含 tests/dsh-bundle.test.js
```

发版时先提交版本号，再把索引的 `commit` 指向该发布提交（见 [RELEASING.md](../RELEASING.md)）。
