# Setup workflow

项目缺 setup，或用户要改前提时使用。所有命令在 Skill 根目录执行，`--dir` 指向项目根。

1. 看项目状态与现有 setup：

   ```bash
   node scripts/wishmachine.js state --dir my-book --view brief
   node scripts/wishmachine.js book read setup --dir my-book
   ```

2. 需要参考时抽卡（结果只是参考，不是 canon）：

   ```bash
   node scripts/wishmachine.js ideas draw --type namecard --genre 科幻 --count 10 --seed 42
   node scripts/wishmachine.js ideas draw --type premise --genre 科幻 --count 3 --seed 7
   ```

   或直接用快路从一个 saved outlinepack 生成 setup：

   ```bash
   node scripts/wishmachine.js ideas draw --type outlinepack --genre 科幻 --count 1 --seed 7 --dir my-book --save
   node scripts/wishmachine.js book write setup --dir my-book --from-idea <saved.id> --mode replace --apply
   ```

3. 手写前读 schema：

   ```bash
   node scripts/wishmachine.js gen reference read setup-schema
   ```

4. 产出一个完整的 setup JSON 对象，先 dry-run 再加 `--apply`：

   ```bash
   node scripts/wishmachine.js book write setup --dir my-book --mode replace < setup.json
   node scripts/wishmachine.js book write setup --dir my-book --mode replace --apply < setup.json
   ```

   dry-run 返回 `applied:false` 与 `check`；blocking finding 时 apply 不会写盘并退出 2。

5. 检查：

   ```bash
   node scripts/wishmachine.js check --dir my-book --profile all --target setup --max-findings 12
   ```

Wishmachine 不生成 setup；创作由你完成。
