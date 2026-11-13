# Outline workflow

大纲缺失、某卷为空，或用户要求重做结构时使用。所有命令都带 `--dir` 指向项目根。

1. 读 setup 与当前大纲索引：

   ```bash
   node scripts/wishmachine.js state --dir my-book --view brief
   node scripts/wishmachine.js book read outline --dir my-book --view index
   node scripts/wishmachine.js book read setup --dir my-book
   ```

2. 读 schema，或走快路用 saved outlinepack：

   ```bash
   node scripts/wishmachine.js gen reference read outline-schema
   node scripts/wishmachine.js book write outline --dir my-book --from-idea <saved.id> --mode replace --apply
   ```

3. 手写完整大纲 JSON（`parts -> volumes -> chapters`）。每章至少要有 `id`、`title`、
   `summary`、`characters`、`location`、`events`、`conflict`、`pacing`。

4. 先 dry-run 再 apply：

   ```bash
   node scripts/wishmachine.js book write outline --dir my-book --mode replace < outline.json
   node scripts/wishmachine.js book write outline --dir my-book --mode replace --apply < outline.json
   ```

5. 检查并按 finding 修复：

   ```bash
   node scripts/wishmachine.js check --dir my-book --profile all --target outline --max-findings 12
   ```

局部修复用 patch，不要手改 `story/compose/outline.json`：

```bash
node scripts/wishmachine.js book write outline --dir my-book --mode patch --target volume --id P1-V1 --apply < volume-patch.json
node scripts/wishmachine.js book write outline --dir my-book --mode patch --target chapter --id P1-V1-C1 --apply < chapter-patch.json
```

大纲改动后 `refresh` 会重建 `story/compose/outline.md` 伴生文件。
