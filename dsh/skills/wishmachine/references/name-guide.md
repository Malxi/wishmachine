# 取名指南（namecard pass）

人物名是 AI 味最容易露馅的地方之一：模型倾向于给每个名字都安一个主题隐喻
（穗=收成、砚=文墨、观垄=看田），姓氏集中、单字雅名扎堆、配角干脆用“老X/阿X/收成人”
这种角色标签。本指南把取名做成 setup 的固定步骤，并让抽卡结果可审计。

## 1. 先定题材，再抽名字

名字必须和**最终题材**一致。不要用“悬疑”抽出来的名字去写“种田+克苏鲁”：

```bash
wishmachine ideas draw --type namecard --genre 种田文 --count 20 --seed 13 --output names.json
```

`namecard` 每张卡自带：

- `id`、`name`、`surname`、`given_name`
- `naming_style`：`plain | literary | hard`（以及扩展的 `rustic`）
- `naming_logic`：这张卡为什么叫这个名字
- `archetype`、`personality`、`contradiction` 等

## 2. 选名字，写进 setup

从 20 张里选主配角，**至少 60% 的 core_cast 来自抽卡**；允许改名，但要保留
`namecard_id`、`naming_style`、`naming_logic`，并把来源记成 `draw`：

```json
{
  "id": "cast_1",
  "name": "沈穗",
  "namecard_id": "name-13-03",
  "naming_style": "plain",
  "naming_logic": "先定原型“档案员”，再选音感；姓氏“沈”与名字“穗”组合为“沈穗”。",
  "name_source": "draw"
}
```

自己起的名字写 `"name_source": "authored"`，并在 voice card 的 `voice.avoid` 里记下
“不要所有名字都点题”。

## 3. 取名规则

- **姓氏要杂**：同一姓氏不超过主角团的 40%；要有王、李、张、刘、陈这种不承担隐喻的姓。
- **名要分层**：主角可以有一个雅名，配角要有日常名、土名、小名、重名；不要全员单字雅名。
- **绰号是补充不是本体**：老X/阿X/收成人/XX那位最多占 20%；角色先有正常姓名，绰号再由关系产生。
- **名字不解释主题**：名字不负责点题；点题交给情节和代价。
- **同名/近音要避**：沈/申、裴/培这类同音姓不要混用；主角团不要出现同姓同辈。

## 4. 确定性检查

`wishmachine check --profile style --target setup` 会报：

| rule | 含义 |
|---|---|
| `style.setup.name_surname` | 同一姓氏占比过高 |
| `style.setup.name_descriptor` | 老X/阿X/收成人/XX那位式名字偏多 |
| `style.setup.name_single_char` | 双字姓名里单字名过多 |
| `style.setup.name_source` | core_cast 缺少 namecard_id/name_source |
| `style.setup.name_style` | naming_style 单一或缺失 |
| `style.setup.name_duplicate` | 重复姓名 |

全部是 low/medium advisory，不阻塞写入。`audit --profile style` 会汇总全书。

## 5. 改法示例

- ❌ 沈穗、裴砚、沈观垄、老井、阿箬、收成人、垄下那位
  （2 个沈、2 个单字雅名、3 个描述式/绰号，每个名字都在点题）
- ✅ 沈穗、裴砚秋、王满仓、李招娣、陈二妮、老井（绰号）、收成人（畸物代称）
  （姓氏分散；主角保留一个雅名；配角有日常名/土名；绰号只给非人角色或关系称呼）
