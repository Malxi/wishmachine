# Review workflow

Use this when the user asks whether an outline or chapter is ready.

Whole-project audit:

```bash
node scripts/wishmachine.js audit
```

Outline review:

```bash
node scripts/wishmachine.js check --profile all --target outline --max-findings 20
```

Chapter review:

```bash
node scripts/wishmachine.js check --profile quality --target chapter --id P1-V1-C1
```

Report blocking findings first, then medium/low. Repair through `book write`:

```bash
node scripts/wishmachine.js book write outline --mode patch --target volume --id P1-V1 --apply < patch.json
```

This port has no RPG simulation. `--profile rpg` is intentionally unsupported.
