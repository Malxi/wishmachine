# Check profiles and findings

`node scripts/wishmachine.js check` runs deterministic checks and returns JSON.

Profiles:

```text
quality    structure, ID, character/event and chapter-count rules
schema     typed setup/outline JSON shape
custom     rules from .wishmachine/rules/*.json or .novelgen/rules/*.json
all        quality + schema + custom
```

RPG simulation is not ported to Wishmachine; `--profile rpg` returns an error.

Common flags:

```bash
node scripts/wishmachine.js check --profile all --target outline --max-findings 20
node scripts/wishmachine.js check --profile schema --target setup
node scripts/wishmachine.js check --profile all --target craft --id character
node scripts/wishmachine.js check --profile all --target recap --id P1-V1-C1
node scripts/wishmachine.js check --profile custom --target chapter --id P1-V1-C1
```

Outline quality also checks item acquisition/usage, resource-ledger arithmetic,
event-character references, storyline references, repeated event types, pacing
runs, missing location transitions, mystery resolution order, returning
characters, dead characters who appear again without a revival event, and a
protagonist who never appears.

Chapter quality cross-checks the outline chapter and recap presence/location,
and warns when the outline title or a listed character never appears in the
chapter text. Recap quality checks `chapter_id`, outline presence, cast
presence and location.

Output:

```json
{
  "ok": false,
  "blocking": true,
  "profile": "all",
  "target": "outline",
  "score": 68,
  "summary": {"total": 10, "critical": 0, "high": 1, "medium": 5, "low": 4},
  "findings": [
    {
      "rule_id": "schema.outline.chapter.title",
      "severity": "high",
      "target_id": "P1-V1-C1",
      "issue": "P1-V1-C1.title must be a non-empty string",
      "suggestion": ""
    }
  ]
}
```

A finding is blocking when `severity` is `high` or `critical`.

Custom rule example:

```json
{"id":"no-deus-ex","target":"chapter","severity":"high","kind":"regex","pattern":"突然.*醒来","message":"possible deus ex machina"}
```

`kind` supports `regex` and `contains`; a file may contain one rule object or an
array of rules. Wishmachine also loads the built-in rules in
`references/builtin-rules.json`; project rules under `.wishmachine/rules` or
`.novelgen/rules` are added on top.
