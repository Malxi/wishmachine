# Setup schema

setup artifact 是 `story/setup/story_setup.json`，命令为：

```bash
node scripts/wishmachine.js book write setup --dir <project> --mode replace < setup.json
node scripts/wishmachine.js book write setup --dir <project> --mode replace --apply < setup.json
```

stdin 必须是一个 `StorySetup` 对象，不要再包一层。快路也可以不手写：

```bash
node scripts/wishmachine.js book write setup --dir my-book --from-idea <outlinepack-id> --mode replace --apply
```

其中 `<outlinepack-id>` 是 `ideas draw --type outlinepack --dir my-book --save` 返回的
`saved.id`。

## Canonical shape

```json
{
  "project_name": "string",
  "genres": ["string"],
  "premise": "string (2-4 sentences)",
  "theme": "string",
  "rules": ["string"],
  "target_audience": "string",
  "tone": "string",
  "tense": "past",
  "pov_style": "third_person_limited",
  "writing_style": {
    "name": "string",
    "description": "string",
    "principles": ["string"],
    "avoid": ["string"],
    "reference_excerpt": "string"
  },
  "long_form_plan": {
    "target_chapters": 15,
    "target_volumes": 3,
    "main_loop": "string",
    "escalation_ladder": ["string"],
    "reader_promises": ["string"],
    "payoff_cadence": "string",
    "volume_pattern": ["string"],
    "midpoint_mutation": "string",
    "endgame_promise": "string"
  },
  "core_cast": [
    {
      "id": "cast_protagonist",
      "name": "string",
      "role": "protagonist",
      "importance": 10,
      "story_function": "string",
      "relationship_to_lead": "string",
      "relationship_arc": "string",
      "entry_phase": "opening",
      "payoff": "string",
      "storyline_refs": ["string"]
    }
  ],
  "storylines": [
    {
      "name": "string",
      "description": "string",
      "type": "main",
      "importance": 10,
      "scope": "book",
      "payoff_style": "staged_reveal",
      "setup_role": "string",
      "repeatable_pressure": "string",
      "payoff_cadence": "string",
      "mutation": "string",
      "failure_mode": "string",
      "desire": "string",
      "opposition": "string",
      "stakes": "string",
      "turn": "string",
      "payoff": "string",
      "open_question": "string",
      "pressure_points": ["string"],
      "appeal_engine": {
        "appeal": "string",
        "surface_limit": "string",
        "exploit": "string",
        "signature_win": "string",
        "upgrade_path": "string",
        "opponent_misread": "string",
        "reward_type": "string"
      }
    }
  ],
  "premises": [
    {
      "name": "string",
      "description": "string",
      "category": "string",
      "progression": [
        {
          "level": 1,
          "name": "string",
          "description": "string",
          "requirements": "string"
        }
      ],
      "appeal_engine": {
        "appeal": "string",
        "surface_limit": "string",
        "exploit": "string",
        "signature_win": "string"
      }
    }
  ],
  "world_timeline": [
    {
      "year": "string",
      "event": "string",
      "impact": "string",
      "related_mystery": "string"
    }
  ],
  "world_resources": [
    {
      "name": "string",
      "category": "能源|消耗品|材料|货币",
      "scarcity": "常见|稀有|独一无二",
      "description": "string"
    }
  ]
}
```

## Common mistakes

- `premise` 是**字符串**；`premises` 是**对象数组**。不要把字符串放进 `premises`。
- `writing_style` 是**对象**，不是字符串。可省略，或用上面的对象形状。
- `world_resources`、`core_cast`、`storylines`、`world_timeline` 是对象数组，不是字符串数组。
- `genres`、`rules`、`storyline_refs`、`principles` 是字符串数组。
- `importance` 是数字；`long_form_plan.target_chapters` / `target_volumes` 是数字。
- `replace` 覆盖整个 setup；`patch` 只传改动字段。

## Derived registries: thread_registry / mystery_registry

setup 与 outline 都可以带顶层 `thread_registry`、`mystery_registry` 数组。它们是
**派生字段**：由 setup 的 storylines/世界资源与 outline 的章节 mysteries 推导出来，
不要手写或手工增删。条目形状：

```json
{
  "id": "m01",
  "status": "open|resolved|dropped",
  "chapter_id": "P1-V1-C2",
  "description": "string",
  "source": "chapter.resolved"
}
```

- `thread_registry` 条目含 `id`、`name`、`type`、`importance`、`status`、`resolved_in`；
  `storylines[*].thread_id` 必须引用其中的 id。
- 缺失或漂移时：`check --target outline` 报 `quality.registry.drift`（medium，不 blocking），
  `doctor` 报 `registry.drift_needs_repair`；`doctor --fix` 或 `book write setup/outline --apply`
  会重建 setup+outline 两份 registry（写入自动修复）。
- 想确认当前状态：`book registry log`、`book registry status`；破坏性操作前先
  `book registry backup`。
