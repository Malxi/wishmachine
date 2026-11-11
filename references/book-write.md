# Book write reference

`wishmachine book write <setup|outline|craft|chapter|recap>` reads the complete
artifact from stdin. The command defaults to a dry run; `--apply` writes.
Both dry-run and apply run the deterministic checks; a blocking dry-run returns
`ok: false` and does not write.

| Section | mode | stdin |
| --- | --- | --- |
| setup | replace | complete StorySetup JSON |
| outline | replace | complete Outline JSON (`parts`) |
| outline | patch | volume/chapter patch JSON with `--target volume --id P1-V1` |
| craft | replace or patch | craft JSON (`--target character|item|location|organization`) |
| chapter | replace | complete chapter markdown (`--id P1-V1-C1`) |
| recap | replace or patch | recap JSON (`--id P1-V1-C1`) |

Useful flags:

```bash
node scripts/wishmachine.js book write outline --mode replace --apply < outline.json
node scripts/wishmachine.js book write outline --mode patch --target volume --id P1-V1 --apply < patch.json
node scripts/wishmachine.js book write chapter --id P1-V1-C1 --apply < chapter.md
```

Before the first setup or outline write, load:

```bash
node scripts/wishmachine.js gen reference read setup-schema
node scripts/wishmachine.js gen reference read outline-schema
```

The schemas distinguish `premise` (string) from `premises` (array of objects)
and `writing_style` (object), the shapes that most often fail a first write.
