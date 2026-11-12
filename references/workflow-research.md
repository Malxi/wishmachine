# Research workflow

Use this when a drawn card contains a historical event, a real-world culture,
a scientific claim, or a public-domain story that may not fit the target genre.

Wishmachine does not search the web itself. WorkBuddy should use its available
web search/fetch tools and record what it actually opened.

## 1. Load the pack

```bash
node scripts/wishmachine.js book read ideas
node scripts/wishmachine.js book read idea --id <saved-id>
```

If the pack was not saved, draw it with:

```bash
node scripts/wishmachine.js ideas draw --type worldpack --genre 修仙 --count 1 --seed 42 --dir my-book --save
```

## 2. Research each entity

For every entity in `pack.graph.entities`, search for:

```text
name
period
region
source
real / legendary / fictional
known uncertainties
```

Prefer primary or reputable public-domain/reference sources. Record the exact
title and URL you opened. Do not invent a citation or claim that a source says
something it does not.

## 3. Compatibility check

Classify each entity:

```text
verified      source supports the use
plausible     no direct contradiction, but not proven
anachronism   wrong period, region, technology, or social form
unsupported   no usable source
rejected      conflicts with the target genre or premise
```

Then check relations:

```text
Does the faction's method fit its resource?
Does the equipment's cost fit the premise's rule?
Does the location's danger fit the scenario?
Does the cast's role fit the storyline?
```

## 4. Output

Return a compact report:

```json
{
  "pack_id": "worldpack-42-01",
  "entities": [
    {"id": "...", "status": "verified", "source": "...", "note": "..."}
  ],
  "relations": [
    {"from": "...", "to": "...", "status": "plausible", "issue": "..."}
  ],
  "rejected": [
    {"entity": "...", "reason": "anachronism"}
  ],
  "safe_prompt": "..."
}
```

`anachronism`, `unsupported` and `rejected` entities must not be presented as
canon. Replace them with a verified alternative or mark the pack as experimental.

## 5. Persistence

Saved draws live in:

```text
story/ideas/<type>-<seed>-<stamp>.json
```

List them with `book read ideas`; read one with `book read idea --id`.
Research reports may be kept in the project's `drafts/research/` directory or
returned to the user; do not write unverified claims into `story/setup` or
`story/compose` as facts.
