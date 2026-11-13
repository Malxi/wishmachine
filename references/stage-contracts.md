# Stage contracts

Wishmachine 只写下列固定位置的文件；字段形状由 `references/setup-schema.md` 和
`references/outline-schema.md` 定义，`check` 负责强制它们。所有命令都要 `--dir <project>`
指向项目根（含 `novel.json` 的目录）。

```text
novel.json                      项目配置，由 book init 生成
story/setup/story_setup.json    setup artifact
story/compose/outline.json      outline artifact
story/craft/<kind>.json         craft artifact（character|item|location|organization）
story/style/voice.json          voice card（风格契约，可选但推荐）
story/recaps/<chapter-id>.json  recap artifact
story/ideas/<type>-<seed>-*.json 抽卡结果（ideas draw --save）
chapters/<chapter-id>.md        章节正文
drafts/manuscript.md            export --format book 默认输出
drafts/manuscript-plain.md      export --format plain 默认输出
logs/                           registry 日志与备份
```

Wishmachine 不生成这些 artifact。模型/作者写出内容，先用 dry-run 看 `check`，再加
`--apply` 原子写入。

## 写入流程

```bash
node scripts/wishmachine.js book write setup  --dir my-book --mode replace < setup.json
node scripts/wishmachine.js book write setup  --dir my-book --mode replace --apply < setup.json
node scripts/wishmachine.js book write outline --dir my-book --mode replace < outline.json
node scripts/wishmachine.js book write outline --dir my-book --mode replace --apply < outline.json
node scripts/wishmachine.js book write chapter --dir my-book --id P1-V1-C1 --mode replace --apply < chapter.md
node scripts/wishmachine.js book write recap   --dir my-book --id P1-V1-C1 --mode replace --apply < recap.json
```

1. 从 stdin 读完整 artifact（`setup|outline|craft|chapter|recap`）或 JSON 报告（`research`）。
2. 先跑确定性检查。setup/outline/craft/recap/chapter 的 blocking finding 会阻止 `--apply`。
3. `--apply` 写盘前把旧文件复制到同目录 `checkpoints/`；写入是原子的。
4. 写后复查；若写后才出现 blocking，返回 `ok:false, applied:true, warning`，文件已写。

mode / target：

| section | mode | target / id |
|---|---|---|
| setup | `replace`、`patch` | — |
| outline | `replace`、`patch` | patch 时 `--target volume --id P1-V1` 或 `--target chapter --id P1-V1-C1` |
| craft | `replace`、`patch` | `--target character\|item\|location\|organization` |
| chapter | `replace`、`append` | `--id <chapter-id>` 必填 |
| recap | `replace`、`patch` | `--id <chapter-id>` 必填 |
| research | 仅 `--apply` 落盘 | `--id <pack-id>` |

`replace` 整块覆盖；`patch` 只合并传入字段。非法 section/mode/target 组合直接报错退出 1。

## 输出契约

- 成功：stdout 输出 JSON。`version`、`help`、不带 `--json` 的 `book status` 是纯文本。
- 失败：stdout 输出
  `{"ok":false,"schema_version":1,"error":{"code","message","hint?","fix_command?"}}`，
  stderr 一行 `wishmachine: <message>`。
- 退出码：`0` 成功；`1` 用法/系统错误（未知 flag、非法枚举、缺 artifact、无 `novel.json`）；
  `2` 有 blocking findings（`check`/`audit`/`doctor`/`book write`）。
- `--no-strict` 只在检查类命令上把退出码强制为 0，不改变 JSON 内容。

## 相关文档

- setup 字段：`references/setup-schema.md`
- outline 字段：`references/outline-schema.md`
- write 命令细节：`references/book-write.md`
- profile 与 findings：`references/check-profiles.md`
- 流程：`references/workflow-setup.md`、`workflow-outline.md`、`workflow-write.md`
