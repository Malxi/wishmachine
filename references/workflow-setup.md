# Setup workflow

Use this when the project has no setup, or the user asks to change the premise.

1. Inspect the project:

   ```bash
   node scripts/wishmachine.js state
   node scripts/wishmachine.js book read setup
   ```

2. Draw references if needed:

   ```bash
   node scripts/wishmachine.js ideas draw --type namecard --genre 科幻 --count 10 --seed 42
   node scripts/wishmachine.js ideas draw --type premise --genre 科幻 --count 3 --seed 7
   ```

3. Read the schema before writing:

   ```bash
   node scripts/wishmachine.js gen reference read setup-schema
   ```

4. Produce one complete setup JSON object.

5. Dry-run, then apply:

   ```bash
   node scripts/wishmachine.js book write setup --mode replace < setup.json
   node scripts/wishmachine.js book write setup --mode replace --apply < setup.json
   ```

6. Check:

   ```bash
   node scripts/wishmachine.js check --profile all --target setup --max-findings 12
   ```

Wishmachine does not generate the setup for you.
