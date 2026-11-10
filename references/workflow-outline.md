# Outline workflow

Use this when the outline is missing, a volume is empty, or the user asks to
regenerate structure.

1. Read setup and the current outline:

   ```bash
   node scripts/wishmachine.js book read setup
   node scripts/wishmachine.js book read outline --view index
   ```

2. Read the schema:

   ```bash
   node scripts/wishmachine.js gen reference read outline-schema
   ```

3. Produce a complete outline JSON object with `parts -> volumes -> chapters`.
   Every chapter needs `id`, `title`, `summary`, `characters`, `location`,
   `events`, `conflict`, and `pacing`.

4. Dry-run and apply:

   ```bash
   node scripts/wishmachine.js book write outline --mode replace < outline.json
   node scripts/wishmachine.js book write outline --mode replace --apply < outline.json
   ```

5. Check:

   ```bash
   node scripts/wishmachine.js check --profile all --target outline --max-findings 12
   ```

For a local volume fix, use:

```bash
node scripts/wishmachine.js book write outline --mode patch --target volume --id P1-V1 --apply < volume-patch.json
```

Never add chapters by editing `story/compose/outline.json` directly.
