# Write workflow

Use this for chapter prose and chapter-level repairs.

1. Read the relevant outline and existing chapter:

   ```bash
   node scripts/wishmachine.js book read outline --id P1-V1-C1
   node scripts/wishmachine.js book read chapter --id P1-V1-C1
   ```

2. Write or revise the chapter markdown with WorkBuddy's model. Use canonical
   names and events from the outline.

3. Dry-run and apply:

   ```bash
   node scripts/wishmachine.js book write chapter --id P1-V1-C1 --mode replace < chapter.md
   node scripts/wishmachine.js book write chapter --id P1-V1-C1 --mode replace --apply < chapter.md
   ```

4. Check:

   ```bash
   node scripts/wishmachine.js check --profile quality --target chapter --id P1-V1-C1
   ```

Wishmachine does not call a model and does not generate prose.
