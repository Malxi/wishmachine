# Write workflow

写章节正文或做章节级修复时使用。所有命令都带 `--dir` 指向项目根。

1. 读章节契约（先读上一章 recap，再写下一章）：

   ```bash
   node scripts/wishmachine.js state --dir my-book --view brief
   node scripts/wishmachine.js book read outline --dir my-book --id P1-V1-C1
   node scripts/wishmachine.js book read recap --dir my-book --id P1-V1-C0
   ```

   当前大纲章节是**计划**，不是可直接抄的正文。

2. 写真正的场景序列，而不是大纲摘要。一章应有：

   ```text
   3-5 scenes
   每个 scene：goal -> obstacle -> turn
   具体的时间、地点、动作与对话
   至少一个代价、反转或决定
   ```

   不要把多个 outline event 压成一段解释；把最重要的事件展开成场景。

3. 遵守 `novel.json` 的章节长度契约：

   ```json
   "chapter_config": {"target_chars": 3000, "min_chars": 1800}
   ```

   `check` 统计 CJK 字符数；低于 `min_chars` 是 high finding 并阻止 `--apply`，低于
   `target_chars` 是 medium 警告。

4. 先 dry-run，再 apply：

   ```bash
   node scripts/wishmachine.js book write chapter --dir my-book --id P1-V1-C1 --mode replace < chapter.md
   node scripts/wishmachine.js book write chapter --dir my-book --id P1-V1-C1 --mode replace --apply < chapter.md
   ```

5. 检查章节，并从**正文**写 recap（不要从 outline 抄）：

   ```bash
   node scripts/wishmachine.js check --dir my-book --profile all --target chapter --id P1-V1-C1
   node scripts/wishmachine.js book write recap --dir my-book --id P1-V1-C1 --mode replace --apply < recap.json
   ```

   recap 字段形状见 `references/book-write.md`；`quality.recap.outline_copy` 会检出复制
   outline 文本的取巧做法。

6. 本章通过且 recap 有正文依据后，再进入下一章。Wishmachine 不调用模型、不生成正文。
