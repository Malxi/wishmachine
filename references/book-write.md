# Book write reference

`node scripts/wishmachine.js book write <section> --dir <project>` 从 stdin 读完整 artifact。
默认 dry-run；`--apply` 才写盘。dry-run 与 apply 都会跑确定性检查；blocking dry-run 返回
`ok:false, applied:false` 且退出码 2，不写盘。

| section | mode | stdin |
| --- | --- | --- |
| setup | replace、patch | 完整 StorySetup JSON |
| outline | replace、patch | 完整 Outline JSON（`parts`） |
| outline | patch | volume/chapter patch JSON，配 `--target volume --id P1-V1` 或 `--target chapter --id P1-V1-C1` |
| craft | replace、patch | craft JSON，配 `--target character\|item\|location\|organization` |
| chapter | replace、append | 完整 chapter markdown，配 `--id P1-V1-C1` |
| recap | replace、patch | recap JSON，配 `--id P1-V1-C1` |
| research | 仅 `--apply` 落盘 | 考究报告 JSON，配 `--id <pack-id>` |

```bash
node scripts/wishmachine.js book write setup --dir my-book --mode replace < setup.json
node scripts/wishmachine.js book write setup --dir my-book --mode replace --apply < setup.json
node scripts/wishmachine.js book write outline --dir my-book --mode replace --apply < outline.json
node scripts/wishmachine.js book write outline --dir my-book --mode patch --target volume --id P1-V1 --apply < patch.json
node scripts/wishmachine.js book write chapter --dir my-book --id P1-V1-C1 --apply < chapter.md
node scripts/wishmachine.js book write recap --dir my-book --id P1-V1-C1 --apply < recap.json
node scripts/wishmachine.js book write research --dir my-book --id <pack-id> < report.json  # 只预览，不落盘
node scripts/wishmachine.js book write research --dir my-book --id <pack-id> --apply < report.json
```

## setup/outline 自动修复 registry

`setup` / `outline` 的 `--apply` 在写盘后会重建派生的 `thread_registry` /
`mystery_registry`（setup+outline 两份一起），结果里带：

```json
"registry_repair": { "repaired": true, "reasons": ["mystery_registry (setup)"], "actions": ["repaired registry: ..."] }
```

dry-run 若发现需要修复，会返回 `"registry_repair": { "needed": ["..."] }`，不写盘。
因此正常流程不需要手工补 registry；只有手工改了 JSON 才需要 `doctor --fix`。

## 章节长度

`check` 用 CJK 字符数对照 `novel.json` 的 `chapter_config.target_chars` / `min_chars`：
低于 `min_chars` 是 high finding，阻止 `--apply`；低于 `target_chars` 是 medium 警告；
超过 `target_chars * 1.25` 是 low 提示（只提醒，不阻止）。
`chapter` 只支持 `replace`（整章覆盖）和 `append`（追加到已有正文）。
写入结果带 `stats: { cjk, chars, paragraphs }`，dry-run 也能直接看到字数，不必自己数。

## recap 形状

recap 是**从正文整理**的 JSON（不是大纲摘要的复制）。`quality.recap.outline_copy` 会检出
从 outline event 文本抄来的 `plot_beats`。

```json
{
  "chapter_id": "P1-V1-C1",
  "title": "第1章 · setup",
  "location": "三号休眠舱段",
  "time": "凌晨三点",
  "last_line": "证人已经不在了。",
  "present": ["裴夜航", "孟思衡"],
  "plot_beats": ["撤离船只剩一个舱位", "裴夜航要求核对名单"],
  "decisions": ["裴夜航决定先核对名单再决定谁上船"],
  "reveals": ["撤离船只剩一个舱位"],
  "unresolved": ["证人的下落"],
  "promises": ["下一章处理抽签"],
  "items": ["登记表"],
  "status": ["舱段封闭"]
}
```

`chapter_id`、`title`、`location`、`time`、`last_line` 是非空字符串；其余字段都是字符串
数组。`plot_beats` 缺失是 high，其他数组缺失是 medium。

## research 报告

`book write research` 默认只回显预览（`dry_run:true`），加 `--apply` 才保存。报告由
`workflow-research` 流程产出，形状见 `references/workflow-research.md`。

## 写前读

首次写 setup/outline 前先读 schema，能避开大多数首次失败：

```bash
node scripts/wishmachine.js gen reference read setup-schema
node scripts/wishmachine.js gen reference read outline-schema
```

schema 区分 `premise`（字符串）与 `premises`（对象数组）、`writing_style`（对象），
这是最常见的首次写入失败原因。

导出面向读者的稿子：

```bash
node scripts/wishmachine.js export --dir my-book
node scripts/wishmachine.js export --dir my-book --format plain
```

`book` 输出带简介、目录、人物与规则的阅读版；`plain` 是纯章节拼接。默认写到
`drafts/manuscript.md`（`book`）或 `drafts/manuscript-plain.md`（`plain`），用 `--output <file>`
指定目标；两种格式默认不再互相覆盖。输出路径默认必须位于项目内；
写到项目外需要显式加 `--force`（否则 JSON 报错退出 1）。
