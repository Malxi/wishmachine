# Refresh workflow

Use this when setup/outline JSON was edited or imported and the generated
markdown companions are stale.

```bash
node scripts/wishmachine.js refresh
node scripts/wishmachine.js refresh setup
node scripts/wishmachine.js refresh outline
node scripts/wishmachine.js book refresh
```

Refresh only rebuilds:

```text
story/setup/story_setup.md
story/compose/outline.md
```

It does not call a model, generate prose, or change the JSON artifacts.
