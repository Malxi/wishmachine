# Write workflow

Use this for chapter prose and chapter-level repairs.

1. Load the chapter contract:

   ```bash
   node scripts/wishmachine.js state
   node scripts/wishmachine.js book read outline --id P1-V1-C1
   node scripts/wishmachine.js book read recap --id P1-V1-C0
   ```

   Read the previous chapter's recap before writing the next chapter. Use the
   current outline chapter for planned events, not as prose to copy.

2. Write a real scene sequence, not an outline summary. A chapter should have:

   ```text
   3-5 scenes
   each scene: goal -> obstacle -> turn
   concrete time, place, action and dialogue
   at least one cost, reversal, or decision
   ```

   Do not compress several outline events into a single paragraph of
   explanation. Expand the most important event into a scene.

3. Respect the chapter length contract in `novel.json`:

   ```json
   "chapter_config": {
     "target_chars": 3000,
     "min_chars": 1800
   }
   ```

   The `check` command counts CJK characters. Below `min_chars` is a high
   finding and blocks `--apply`; below `target_chars` is a medium warning.

4. Dry-run one chapter, then apply it:

   ```bash
   node scripts/wishmachine.js book write chapter --id P1-V1-C1 --mode replace < chapter.md
   node scripts/wishmachine.js book write chapter --id P1-V1-C1 --mode replace --apply < chapter.md
   ```

5. Check the chapter and write the recap from the prose, not from the outline:

   ```bash
   node scripts/wishmachine.js check --profile all --target chapter --id P1-V1-C1
   ```

   Then write the recap using concrete details that actually appear in the
   chapter. Do not generate `plot_beats` by copying `actor：details` from the
   outline; `quality.recap.outline_copy` detects that shortcut.

6. Move to the next chapter only after the current chapter passes and its
   recap is grounded in the prose.

Wishmachine does not call a model and does not generate prose.
