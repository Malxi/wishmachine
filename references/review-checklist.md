# Setup / outline review checklist

`check` 与 `audit` 是确定性的：能抓结构和连续性错误，不能判断设定或情节好不好。确定性
检查通过后，用本清单做编辑性审查。确定性契约见 `references/stage-contracts.md`。

## Setup review

- **Genre promise**：premise 是否兑现了用户要的题材？修仙故事不应依赖飞船、虫洞或
  克隆保险，除非 premise 明确把这种混搭当成卖点。
- **Causal spine**：把 premise 写成 `if -> then` 链。这条特殊规则为真时，对普通人、机构、
  主角分别意味着什么？如果去掉规则情节不变，它就是装饰。
- **Cost and loophole**：每条世界规则都要有代价、限制，以及主角不破坏规则就能利用的漏洞。
- **Cast roles**：每个 core cast 都需要功能、与主角的关系、矛盾，以及在剧情需要前行动的动机。
- **Resource scarcity**：谁控制稀缺资源、谁被排除、主角要拿什么去换。
- **Theme**：premise 是否让主题可争论，而不是直接宣布。
- **Language and world**：术语、称谓、技术/修炼词汇、时代错误，以及世界规则是否一致使用。

## Outline review

- **Global arc**：promise -> escalation -> midpoint reversal -> payoff -> cost；每卷都应
  改变主角可用的选择。
- **Chapter function**：每章需要目标、障碍、转折、后果。只解释设定的章节是设定笔记，不是章节。
- **Event causality**：事件应由之前的决定引发，并迫使之后做出决定；凭空发生的是填充。
- **Character agency**：主角每章至少做一个有后果的选择；其他角色要有相互冲突的欲望。
- **Mystery discipline**：先种后解，只回收读者有机会注意到的谜题，每个答案都要有代价。
- **Continuity**：时间、地点、资源账本、伤势、物品、人物在场要跨章延续。
- **Pacing**：压力与喘息交替；不要重复同一事件类型或同一角色小动作到变成填充。
- **Expandability**：每章大纲要够写出 3-5 个散文场景和配置的章节长度。大纲摘要比正文还长
  说明章节被压缩了。

## Reporting

按严重度报：`critical` 前提/大纲撑不起故事；`high` 矛盾、缺失因果、承诺破裂；`medium`
动机弱、重复 beat、章节没展开；`low` 润色、术语、可选质感。严重度语义与机器 findings
（`rule_id`/`severity`/`target_id`）的映射见 `references/check-profiles.md`。

不要把确定性检查通过说成文学质量过关；明确区分 `deterministic violation` 与
`editorial judgment`。
