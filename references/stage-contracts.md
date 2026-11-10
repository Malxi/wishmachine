# Stage contracts

Wishmachine reads and writes the same basic project shape as Novelgen:

```text
novel.json
story/setup/story_setup.json
story/compose/outline.json
story/craft/*.json
story/recaps/*.json
chapters/*.md
```

Wishmachine does not generate these artifacts. WorkBuddy's model writes them,
then `book write` validates the deterministic shape and writes atomically.

Before generating:

1. `gen reference read setup-schema` for setup.
2. `gen reference read outline-schema` for outline.
3. `gen workflow read setup|outline|write|review`.
4. Use the canonical field names; do not invent fields.
5. Write through `book write`; do not edit project files directly.

The setup/outline contracts are defined by `references/setup-schema.md` and
`references/outline-schema.md`. The checks in `check` enforce the required
shape and basic references.
