# Outline schema

outline artifact 是 `story/compose/outline.json`，命令为：

```bash
node scripts/wishmachine.js book write outline --dir <project> --mode replace < outline.json
node scripts/wishmachine.js book write outline --dir <project> --mode replace --apply < outline.json
```

stdin 必须是一个 `Outline` 对象，顶层只有 `parts`。快路也可以不手写：

```bash
node scripts/wishmachine.js book write outline --dir my-book --from-idea <outlinepack-id> --mode replace --apply
```

## Minimal complete shape

```json
{
  "parts": [
    {
      "id": "P1",
      "title": "string",
      "summary": "string",
      "volumes": [
        {
          "id": "P1-V1",
          "title": "string",
          "summary": "string",
          "payoff_contract": {
            "volume_question": "string",
            "power_promise": "string",
            "main_opponent_misread": "string",
            "big_win": "string",
            "visible_reward": "string",
            "reputation_shift": "string",
            "next_bigger_game": "string"
          },
          "chapters": [
            {
              "id": "P1-V1-C1",
              "title": "string",
              "summary": "string",
              "characters": ["string"],
              "location": "string",
              "events": [
                {
                  "type": "item",
                  "characters": ["string"],
                  "subject": "string",
                  "change": "get",
                  "details": "string",
                  "actor": "string",
                  "action": "acquire",
                  "target": "string",
                  "target_type": "item",
                  "context": "string",
                  "result": "string"
                }
              ],
              "conflict": "string",
              "pacing": "string",
              "timeline": {
                "anchor": "string",
                "start_time": "string",
                "end_time": "string",
                "duration": "string",
                "time_jump": false,
                "previous_gap": "string",
                "transition": "string"
              },
              "state_anchor": {
                "cultivation": "string",
                "spirit_stones": 0,
                "allies": ["string"],
                "injuries": ["string"],
                "location": "string",
                "key_items": ["string"],
                "notes": "string"
              },
              "enemies": [],
              "resource_ledger": [],
              "scenes": [],
              "mysteries": {
                "planted": [],
                "resolved": []
              },
              "storyline_advances": [
                {
                  "storyline_name": "string",
                  "stage": "pressure",
                  "change": "string",
                  "consequence": "string",
                  "pressure": "string"
                }
              ],
              "chapter_payoff": {
                "desire": "string",
                "pressure": "string",
                "clever_move": "string",
                "payoff_moment": "string",
                "reward": "string",
                "social_proof": "string",
                "hook": "string"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## Required level

- `parts` 是数组；每个 part 有 `id`、`title`、`summary`、`volumes`。
- 每个 volume 有 `id`、`title`、`summary`、`chapters`。
- 每个 chapter 有 `id`、`title`、`summary`、`characters`、`location`、`events`、
  `conflict`、`pacing`。
- ID 稳定：`P1`、`P1-V1`、`P1-V1-C1`。
- `chapters` 是对象数组，不能是字符串数组。

## Nested object rules

- `events` 是对象数组。`characters`、`subject` 是名字，不是嵌套角色对象。新事件优先用
  `actor` / `action` / `target` / `target_type`。
- `timeline`、`state_anchor`、`mysteries`、`chapter_payoff` 是对象；
  `mysteries.planted` / `mysteries.resolved` 是对象数组。
- `scenes` 是对象数组：`order`、`pov`、`goal`、`location`、`characters`、`words`、`tone`、`beats`。
- `enemies` 是对象数组：`name`、`faction`、`tier`、`count`、`level`、`is_boss`、`boss_id`、
  `status`、`context`。
- `resource_ledger` 是对象数组：`item`、`start`、`delta`、`end`、`reason`。

## Patching a volume or chapter

局部修复用 patch，不要发整份 Outline：

```bash
node scripts/wishmachine.js book write outline --dir my-book --mode patch --target volume --id P1-V1 --apply < volume-patch.json
node scripts/wishmachine.js book write outline --dir my-book --mode patch --target chapter --id P1-V1-C1 --apply < chapter-patch.json
```

patch 后仍会对整份 outline 校验；会改变章节集合的 patch 同样会被拦下。

## Optional thread_registry

`outline.json` 可以带顶层 `thread_registry` 数组，章节 `thread_id` 必须引用其中的 id。
`check --target outline` 报告未知 id 与 setup/outline registry 漂移。
