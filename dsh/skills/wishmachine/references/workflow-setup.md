# Setup workflow

项目缺 setup，或用户要改前提时使用。所有命令在 Skill 根目录执行，`--dir` 指向项目根。

1. 看项目状态与现有 setup：

   ```bash
   node scripts/wishmachine.js state --dir my-book --view brief
   node scripts/wishmachine.js book read setup --dir my-book
   ```

2. 先做 namecard pass（setup 前，名字不能由 AI 自创）：

   ```bash
   node scripts/wishmachine.js ideas draw --type namecard --genre 科幻 --count 20 --seed 42 --output names.json
   ```

   用户从结果中选名字，把 `namecard_id/naming_style/naming_logic/name_source: "draw"`
   写进 `core_cast`；用户自己提供的名字用 `name_source: "human"`。详见
   `references/name-guide.md`。

3. 需要其他参考时抽卡（结果只是参考，不是 canon）：

   ```bash
   node scripts/wishmachine.js ideas draw --type premise --genre 科幻 --count 3 --seed 7
   ```

   或直接用快路从一个 saved outlinepack 生成 setup：

   ```bash
   node scripts/wishmachine.js ideas draw --type outlinepack --genre 科幻 --count 1 --seed 7 --dir my-book --save
   node scripts/wishmachine.js book write setup --dir my-book --from-idea <saved.id> --mode replace --apply
   ```

4. 手写前读 schema：

   ```bash
   node scripts/wishmachine.js gen reference read setup-schema
   ```

5. 产出一个完整的 setup JSON 对象，先 dry-run 再加 `--apply`：

   ```bash
   node scripts/wishmachine.js book write setup --dir my-book --mode replace < setup.json
   node scripts/wishmachine.js book write setup --dir my-book --mode replace --apply < setup.json
   ```

   dry-run 返回 `applied:false` 与 `check`；blocking finding 时 apply 不会写盘并退出 2。

6. 建每本书的 style 文件（声音卡 + writing-style，样本必须来自
   `data/style/human-samples.json` 的 `sample_id` 或用户确认的 human 文本）：

   ```bash
   node scripts/wishmachine.js book write style --dir my-book --mode replace --apply < voice.json
   node scripts/wishmachine.js book write writing-style --dir my-book --mode replace --apply < writing-style.json
   ```

7. 检查：

   ```bash
   node scripts/wishmachine.js check --dir my-book --profile all --target setup --max-findings 12
   node scripts/wishmachine.js check --dir my-book --profile style --target setup
   ```

Wishmachine 不生成 setup；创作由你完成。
