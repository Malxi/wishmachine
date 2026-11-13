# Wishmachine for DeepSeek Harness

This directory is a **DSH bundle**: installing it registers the `wishmachine`
skill in the Host-wide skill catalog. The skill itself is the same
deterministic novel-project CLI as the standalone package; the only difference
is that DSH loads it from the installed bundle instead of a local skills
directory.

## Install

Two equivalent link-based ways:

1. **Plugins → Add plugin → Install a third-party plugin**, and paste the Git
   address with the pinned commit and bundle path:

   ```text
   git+https://github.com/Malxi/wishmachine.git#<40-hex-commit>&path:/dsh
   ```

   Confirm the source in the dialog, wait for pnpm to install and the bundle to
   activate, then start a new session (or reload) and ask for the `wishmachine`
   skill.

2. **Discover tab** (after enabling the experimental *Custom plugin indexes*
   bundle): add the index URL
   `https://cdn.jsdelivr.net/gh/Malxi/wishmachine@v<version>/dsh/market/index.json`
   (or the raw GitHub URL from the same tag), then install **Wishmachine** from
   the card.

The skill files are copied into `skills/wishmachine/` by
`scripts/build-dsh-bundle.js`; `index.js` exposes that directory as the skill's
resource base, so every relative path in `SKILL.md` resolves correctly.

## Runtime requirement

The skill runs a Node.js CLI. DSH Desktop bundles Electron but may not put
`node` on `PATH`; either install Node.js ≥ 18 or run the CLI through the
Harness runtime:

```bash
ELECTRON_RUN_AS_NODE=1 "$DSH_NODE_EXECUTABLE" "<skill-base>/scripts/wishmachine.js" version
```

`SKILL.md` also documents the PowerShell form.

## Develop

```bash
node scripts/build-dsh-bundle.js --check   # verify the synced skill tree
node scripts/build-dsh-bundle.js           # resync from the repository root
```

`dsh/package.json`, `dsh/skill-meta.js`, `dsh/skills/**` and
`dsh/market/index.json` are generated and must not be edited by hand.
