# Review workflow

Use this when the user asks whether a setup, outline, or chapter is ready.

## 1. Deterministic pass

Whole-project audit:

```bash
node scripts/wishmachine.js audit
```

Outline review:

```bash
node scripts/wishmachine.js check --profile all --target outline --max-findings 20
```

## 2. Editorial pass

Deterministic checks do not judge whether the setting or plot is good. Load the
review checklist and the actual artifacts:

```bash
node scripts/wishmachine.js gen reference read review-checklist
node scripts/wishmachine.js state
node scripts/wishmachine.js book read setup
node scripts/wishmachine.js book read outline --view index
```

Review **setting** for genre promise, causal spine, rule cost/loophole, cast
roles, resource scarcity, theme and terminology. Review **outline** for global
arc, chapter function, event causality, character agency, mystery discipline,
continuity, pacing and expandability.

For prose, read the chapter before trusting the score. Check:

```text
Does each chapter contain scenes, or only outline summaries?
Is there action/dialogue/sensory detail?
Does the chapter meet chapter_config.target_chars?
Does the recap sound like this chapter, or like the outline?
Are character tics repeated until they become filler?
```

Then run:

```bash
node scripts/wishmachine.js check --profile all --target chapter --id P1-V1-C1
```

## 3. Report

Separate:

```text
deterministic violation
editorial judgment
```

Do not claim a structural 100 means the novel is good. Report blocking findings
first, then patterns (repetition, compressed chapters, weak causality), then
optional polish.
