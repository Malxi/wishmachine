# Check profiles and findings

`node scripts/wishmachine.js check --dir <project>` 跑确定性检查并返回 JSON。

## Profiles

```text
quality   结构、引用、ID、章节数量、谜题/线程一致性
schema    setup/outline/craft/recap 的 JSON 形状
custom    references/builtin-rules.json + 项目 .wishmachine/rules/*.json
style     风格/AI 味统计指标（advisory，low/medium，永不 blocking）
all       quality + schema + custom（默认，不含 style）
```

`--profile rpg` 等未知值会被枚举校验拒绝（退出码 1），不会静默跳检查。
`style` 只支持 `--target setup` 与 `--target chapter --id`；指标与阈值见
`references/style-checklist.md`，改稿流程见 `references/workflow-deai.md`。

## 常用命令

```bash
node scripts/wishmachine.js check --dir my-book --profile all --target outline --max-findings 20
node scripts/wishmachine.js check --dir my-book --profile schema --target setup
node scripts/wishmachine.js check --dir my-book --profile all --target chapter --id P1-V1-C1
node scripts/wishmachine.js check --dir my-book --profile all --target craft --id character
node scripts/wishmachine.js check --dir my-book --profile all --target recap --id P1-V1-C1
node scripts/wishmachine.js check --dir my-book --profile custom --target chapter --id P1-V1-C1
node scripts/wishmachine.js check --dir my-book --profile style --target chapter --id P1-V1-C1
node scripts/wishmachine.js check --dir my-book --profile style --target setup
node scripts/wishmachine.js audit --dir my-book --view brief
node scripts/wishmachine.js audit --dir my-book --profile style --view summary
node scripts/wishmachine.js doctor --dir my-book --fix
```

`--target` 默认 `outline`；`chapter`/`recap` 必须给 `--id`；`craft` 的 `--id` 是 craft kind，
默认 `character`。

目标 artifact 不存在或 JSON 损坏时，不再抛原始文件错误，而是返回
`artifact.<target>.missing` / `artifact.<target>.invalid_json`（`critical`，blocking，
退出码 2），`suggestion` 会提示先 `book write <section>` 或跑 `doctor`。因此空项目上
`check --target outline` 也是结构化结果而不是崩溃。

outline quality 还检查物品获取/使用、资源账本算术、状态锚点连续性、事件-角色引用、
事件顺序、storyline 引用、重复事件类型、节奏、地点切换、谜题解析顺序、离场/死亡角色
回归、主角缺席等；chapter quality 交叉检查大纲章节、recap 的地点/人物/正文存在性与字数；
recap quality 检查 `chapter_id`、大纲存在性、cast、地点、last line、beat 锚点与正文引用。

`book write` 的候选检查包含 custom 规则，因此内置/项目规则能在落盘前阻止写入。

## blocking 与过滤

- finding 为 blocking 的条件：`severity` 为 `high` 或 `critical`。
- `--min-severity low|medium|high|critical` 只过滤**展示的** findings；`summary` 与
  `score` 始终基于全量。
- `--max-findings all|<n>` 限制展示条数，`all`（默认）不限制；被截断时 `truncated:true`。
- `--ignore rule_id,...` / `--ignore-file <json>`：按 rule_id 忽略 findings（文件为 JSON
  数组或 `{"rules":[...]}`，语法与 `ideas validate` 相同）；忽略数量记在
  `summary.ignored_findings` / `summary.ignored_rules`（顶层同名）。用于接受已知的历史
  finding 而不关闭整条规则；`check` 与 `audit` 都支持。
- `--no-strict`：即使有 blocking 也退出 0（JSON 里的 `ok/blocking` 不变）。

退出码：`0` 通过 · `1` 用法/系统错误 · `2` 有 blocking。`audit`/`doctor`/`book write`
遵循同一退出码约定；`--no-strict` 只被 `check`/`audit`/`doctor` 接受（`book write`
没有该 flag，未知 flag 会直接报错）。

## 输出

```json
{
  "ok": false,
  "blocking": true,
  "profile": "all",
  "target": "outline",
  "id": "P1-V1-C1",
  "score": 68,
  "summary": {"total": 10, "critical": 0, "high": 1, "medium": 5, "low": 4,
               "ignored_findings": 0, "ignored_rules": {}},
  "ignored_findings": 0,
  "ignored_rules": {},
  "filtered_out": 0,
  "findings": [
    {
      "id": "finding-1a2b3c4d",
      "rule_id": "schema.outline.chapter.title",
      "severity": "high",
      "target_id": "P1-V1-C1",
      "issue": "P1-V1-C1.title must be a non-empty string",
      "suggestion": ""
    }
  ],
  "truncated": false
}
```

findings 带内容哈希稳定 `id`，已去重并按 severity 降序、rule_id 升序排序；同一份输入
重复检查得到同样的 id。

## Custom rules

项目规则放在 `<project>/.wishmachine/rules/*.json`，在 `custom`/`all` profile 与
`book write` 候选检查中生效。一个文件可以是一个规则对象或规则数组：

```json
{"id":"no-deus-ex","target":"chapter","severity":"high","kind":"regex","pattern":"突然.*醒来","message":"possible deus ex machina"}
```

`kind` 支持 `regex` 和 `contains`；`target` 为 `setup|outline|chapter|craft|recap|all`。
`references/builtin-rules.json` 是内置规则集，项目规则叠加其上；格式错误的规则文件
会产生 `invalid.*` finding。

## audit / doctor

`audit` 对 setup、outline、全部 craft/recap/已写章节跑同一套检查并汇总，支持
`--min-severity`、`--max-findings all|<n>`、`--ignore`/`--ignore-file`、
`--view brief|summary|full`、`--no-strict`。`--view summary` 只返回 totals 与
`failing_targets`（输出很小，适合脚本/模型快速判断）；brief 额外给 `top_findings`；
full 还带每个 target 的 findings。审计过程中单个 artifact 缺失/损坏/意外错误会降级为
`artifact.*` / `quality.audit.error` finding（带稳定 id），不会让整个 audit 崩溃。

registry 漂移属于 quality 检查：`check --target outline` / `audit` 会报
`quality.registry.drift`（medium），`suggestion` 指向 `doctor --fix`；因此不会再出现
“audit 100 分、doctor 却说 registry 不一致”的假绿灯。

`doctor` 检查项目目录、`novel.json`、artifact JSON 有效性与 orphan 文件；`--fix` 会创建
缺失目录、修复可自动修复的问题（含重建 setup/outline registry）。`doctor` 有 blocking 时
同样退出 2，`--no-strict` 强制 0。
