---
name: wishmachine-research
display_name: 小说许愿机·考究
display_name_en: Novel Wish Machine Research
description: 对小说许愿机抽出的世界包、历史母题、地点、势力、装备和人物关系做联网考究，标注来源、时代与地区错配，阻止离谱组合进入设定。
description_zh: 对小说许愿机抽出的世界包、历史母题、地点、势力、装备和人物关系做联网考究，标注来源、时代与地区错配，阻止离谱组合进入设定。
description_en: Research Wishmachine worldpacks, historical motifs, places, factions, equipment and character relations on the web; cite sources, flag anachronisms, and reject implausible combinations before they enter the story bible.
version: 0.1.6
author: Malxi
---

# 小说许愿机·考究

Use this skill after `wishmachine` has produced cards and before `setup` or
`outline` treats them as canon.

## Rules

1. **Read the actual card.** Do not research a title from memory.
2. **Search the web** for historical, cultural, scientific or public-domain
   claims. Record the exact source title and URL opened.
3. **Never invent a citation.** If no usable source is found, mark the entity
   `unsupported`.
4. **Separate the card from the source.** A card may be a deliberate fantasy
   transformation; label it `inspired_by`, not `historical_fact`.
5. **Check relations, not only entities.** A verified location can still be
   paired with an impossible faction or anachronistic equipment.
6. **Do not silently rewrite canon.** Return a report and a `safe_prompt`; the
   main skill decides whether to apply it.

## Workflow

```bash
node scripts/wishmachine.js book read ideas
node scripts/wishmachine.js book read idea --id <saved-id>
node scripts/wishmachine.js gen reference read review-checklist
node scripts/wishmachine.js gen workflow read research
```

For each `entity` in a saved pack's `graph.entities`:

```text
search -> source title/url -> period/region -> verified|plausible|anachronism|unsupported|rejected
```

Save a raw source card when you open a page:

```bash
node scripts/wishmachine.js ideas ingest --dir my-book --url "https://example.org/source"
```

Or seed from the bundled source catalog:

```bash
node scripts/wishmachine.js ideas discover --dir my-book --topic history --limit 3
node scripts/wishmachine.js ideas discover --dir my-book --topic myth --limit 3
node scripts/wishmachine.js ideas discover --dir my-book --topic novel --limit 3
```

For an open query, use the source search:

```bash
node scripts/wishmachine.js ideas search --dir my-book --provider wikipedia --query "Mary Celeste" --limit 3
node scripts/wishmachine.js ideas search --dir my-book --provider gutenberg --query "Frankenstein" --limit 3
```

`--ingest` fetches each Wikipedia page for title/meta/excerpt extraction.
Gutenberg results save metadata and a link to the public-domain text.

For each `relation`:

```text
does the target's method/resource/cost fit the source's rule and period?
```

After saving cards, inspect the merged project graph:

```bash
node scripts/wishmachine.js book read graph --dir my-book
```

If it reports `graph.dangling_relation` or `graph.entity_conflict`, fix the
imported graph before treating it as canon.

## Output

```json
{
  "pack_id": "...",
  "entities": [{"id": "...", "status": "verified|plausible|anachronism|unsupported|rejected", "source": "...", "note": "..."}],
  "relations": [{"from": "...", "to": "...", "status": "ok|weak|conflict", "issue": "..."}],
  "rejected": [{"entity": "...", "reason": "anachronism|unsupported|genre_mismatch"}],
  "safe_prompt": "..."
}
```

Save the report:

```bash
node scripts/wishmachine.js book write research --dir my-book --id <pack-id> < report.json
node scripts/wishmachine.js book read research --dir my-book --id <pack-id>
```

If research produces replacement cards, import them into the project deck:

```bash
node scripts/wishmachine.js ideas import --dir my-book --type motif --source "web research" --file replacement-cards.json
```

Do not present `anachronism`, `unsupported` or `rejected` entities as canon.
If a relation is weak, propose a replacement from the same genre deck rather
than forcing the original combination.
