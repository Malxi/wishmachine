// Multi-volume outlinepack assembly: volume plan, volume metadata and setup draft.
import { DEFAULT_DECK } from '../decks/index.js';
import { collectMysteryRegistry } from '../registry.js';
import { clampNumber } from './shared.js';
import { buildThreadRegistry } from './registry-build.js';
import { buildOutlinePack } from './outline-volume.js';
import { buildSetupDraft } from './setup-draft.js';

function resolveVolumePlan(plot, options) {
  const volumes = clampNumber(options.volumes, 1, 10, 1);
  const rawChaptersPerVolume = Number(options.chaptersPerVolume);
  const chaptersPerVolume = Number.isFinite(rawChaptersPerVolume) && rawChaptersPerVolume > 0
    ? clampNumber(rawChaptersPerVolume, 3, 60, 10)
    : clampNumber(options.chapters, 3, 60, 10);
  return { volumes, chaptersPerVolume, storylines: (plot.storylines || [plot.storyline]).filter(Boolean) };
}

function applyVolumeMetadata({ volume, volumePlot, plot, volumeIndex, volumes }) {
  volume.id = `P1-V${volumeIndex + 1}`;
  volume.title = `第${volumeIndex + 1}卷`;
  volume.chapters.forEach((chapter, chapterIndex) => {
    chapter.id = `${volume.id}-C${chapterIndex + 1}`;
  });
  volume.payoff_contract = {
    volume_question: volumePlot.storyline?.promise || '主角能否改变现状？',
    power_promise: volumePlot.storyline?.escalation || '主角获得一次改变规则的能力。',
    main_opponent_misread: plot.premise?.hidden_truth || '对手误读了主角真正的筹码。',
    big_win: volumePlot.storyline?.payoff || '主角完成一次无法撤回的胜利。',
    visible_reward: volumePlot.storyline?.cost || '胜利留下一个可见的代价。',
    reputation_shift: '主角从被规则支配的人变成能改写规则的人。',
    next_bigger_game: volumeIndex === volumes - 1 ? '故事收束，代价留下。' : '更大的对手进入视野。',
  };
  volume.opening_beat = `第${volumeIndex + 1}卷开场：${volumePlot.storyline?.promise || '旧规则仍在运转'}`;
  volume.closing_beat = `第${volumeIndex + 1}卷收束：${volumePlot.storyline?.payoff || '主角付出代价'}`;
  volume.mysteries = {
    planted: [volumePlot.storyline?.midpoint, plot.premise?.hidden_truth].filter(Boolean),
    resolved: [volumePlot.storyline?.cost].filter(Boolean),
  };
  volume.timeline = {
    start: volumeIndex === 0 ? 'before the first rule' : `after volume ${volumeIndex}`,
    end: `end of volume ${volumeIndex + 1}`,
    anchor: volumePlot.storyline?.title || plot.premise?.title || '',
  };
}

function assembleMultiVolumePack(context) {
  const { plot, seed, options, volumeList, bases, storylines, carriedMysteries, chaptersPerVolume, volumes } = context;
  const chapters = volumeList.flatMap((volume) => volume.chapters);
  const mysteryRegistry = collectMysteryRegistry(chapters);
  const id = `outlinepack-${seed}-${String((options.index || 0) + 1).padStart(2, '0')}`;
  const targetChars = clampNumber(options.targetChars, 500, 10000, 3000);
  const chapterConfig = {
    target_chars: targetChars,
    min_chars: Math.floor(targetChars * 0.6),
    volumes,
    chapters_per_volume: chaptersPerVolume,
    chapters: chapters.length,
    scenes_per_chapter: clampNumber(options.scenes, 1, 5, 3),
  };
  const setupDraft = buildSetupDraft({ ...plot, storylines }, { chapter_config: chapterConfig }, options.deck || DEFAULT_DECK);
  const allDropped = bases.flatMap((base) => base.dropped_mysteries || []);
  const abandonedThreads = allDropped.map((item) => item.abandoned_thread).filter(Boolean);
  setupDraft.abandoned_threads = abandonedThreads;
  setupDraft.dropped_mysteries = allDropped;
  setupDraft.mystery_registry = mysteryRegistry;
  const threadRegistry = buildThreadRegistry(storylines, chapters, allDropped);
  setupDraft.thread_registry = threadRegistry;
  return {
    ...bases[0],
    id,
    volumes: volumeList,
    chapters,
    setup_draft: setupDraft,
    mystery_registry: mysteryRegistry,
    thread_registry: threadRegistry,
    draft_outline: {
      thread_registry: threadRegistry,
      abandoned_threads: abandonedThreads,
      dropped_mysteries: allDropped,
      mystery_registry: mysteryRegistry,
      parts: [{
        id: 'P1',
        title: plot.premise?.title || '未命名故事',
        summary: plot.premise?.statement || '未填写故事前提。',
        volumes: volumeList,
      }],
    },
    chapter_config: chapterConfig,
    pending_mysteries: carriedMysteries,
    dropped_mysteries: allDropped,
    abandoned_threads: abandonedThreads,
  };
}

function buildMultiVolumeOutlinePack(plot, seed, options = {}) {
  const { volumes, chaptersPerVolume, storylines } = resolveVolumePlan(plot, options);
  const bases = [];
  let previousVolumeConsequence = '';
  let carriedMysteries = [];
  for (let volumeIndex = 0; volumeIndex < volumes; volumeIndex += 1) {
    const volumePlot = {
      ...plot,
      storyline: storylines[volumeIndex % storylines.length] || plot.storyline,
    };
    const base = buildOutlinePack(volumePlot, seed, {
      ...options,
      chapters: chaptersPerVolume,
      index: volumeIndex,
      chapterOffset: volumeIndex * chaptersPerVolume,
      totalChapters: volumes * chaptersPerVolume,
      volumeId: `P1-V${volumeIndex + 1}`,
      previousConsequence: previousVolumeConsequence,
      carriedMysteries,
    });
    const volume = base.draft_outline.parts[0].volumes[0];
    applyVolumeMetadata({ volume, volumePlot, plot, volumeIndex, volumes });
    previousVolumeConsequence = volume.chapters[volume.chapters.length - 1]?.exit_consequence || previousVolumeConsequence;
    carriedMysteries = base.pending_mysteries || [];
    bases.push(base);
  }
  return assembleMultiVolumePack({
    plot,
    seed,
    options,
    volumeList: bases.map((base) => base.draft_outline.parts[0].volumes[0]),
    bases,
    storylines,
    carriedMysteries,
    chaptersPerVolume,
    volumes,
  });
}

export { buildMultiVolumeOutlinePack, buildOutlinePack, buildThreadRegistry };
