# Review workflow

用户问 setup/大纲/章节是否就绪时使用。所有命令都带 `--dir` 指向项目根。

## 1. 确定性检查

```bash
node scripts/wishmachine.js audit --dir my-book --view brief
node scripts/wishmachine.js check --dir my-book --profile all --target outline --max-findings 20
node scripts/wishmachine.js check --dir my-book --profile all --target chapter --id P1-V1-C1
```

blocking（high/critical）时这些命令退出码为 2；先修 blocking，再看 medium/low。

## 2. 编辑性审查

确定性检查不判断设定和情节好坏。读清单与真实 artifact：

```bash
node scripts/wishmachine.js gen reference read review-checklist
node scripts/wishmachine.js state --dir my-book --view brief
node scripts/wishmachine.js book read setup --dir my-book
node scripts/wishmachine.js book read outline --dir my-book --view index
```

审查清单见 `references/review-checklist.md`：setup 看题材承诺、因果骨架、规则代价与漏洞、
cast 功能、资源稀缺、主题与术语；outline 看全局弧线、章节功能、事件因果、角色能动性、
谜题纪律、连续性、节奏与可扩展性。正文则直接读章节，别只看分数。

## 3. 报告

分开写：

```text
确定性违规（引 rule_id、severity、target_id）
编辑性判断（引清单条目）
```

先报 blocking，再报模式（重复、压缩章、因果薄弱），最后是可选的润色建议。
结构分 100 不代表小说好；不要把编辑判断说成 schema 违规。
