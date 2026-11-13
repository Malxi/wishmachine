// Cross-artifact semantics for outline mysteries and threads.
import { chapterResolvedMysteries, sortMysteryArray } from '../registry.js';
import { finding } from './finding.js';

function validateMysterySemantics(ctx) {
  const { outline, findings } = ctx;
  for (const mystery of outline.mystery_registry || []) {
    if (!mystery?.id) continue;
    if (!ctx.mysteryChapter.has(mystery.id)) {
      findings.push(finding('quality.outline.mystery.stale_registry', 'high', `${mystery.id} is in mystery_registry but no chapter contains it`, mystery.id));
      continue;
    }
    const finalStatus = ctx.mysteryFinalStatus.get(mystery.id);
    if (finalStatus && mystery.status !== finalStatus) {
      findings.push(finding('quality.outline.mystery.status_mismatch', 'medium', `${mystery.id} registry status ${mystery.status} differs from final chapter status ${finalStatus}`, mystery.id));
    }
    validateMysteryThreadLinks(ctx, mystery);
  }
}

function validateMysteryThreadLinks(ctx, mystery) {
  const { findings } = ctx;
  if (mystery.status === 'resolved' && mystery.thread_id) {
    const thread = ctx.threadMap.get(mystery.thread_id);
    if (thread && !(thread.resolved_mysteries || []).some((item) => item.id === mystery.id)) {
      findings.push(finding('quality.outline.thread.resolution_not_linked', 'medium', `${mystery.id} is resolved but not linked from ${thread.id}.resolved_mysteries`, thread.id));
    }
  }
  if (mystery.status === 'dropped' && mystery.thread_id) {
    const thread = ctx.threadMap.get(mystery.thread_id);
    if (thread && !(thread.abandoned_mysteries || []).some((item) => item.id === mystery.id)) {
      findings.push(finding('quality.outline.thread.abandonment_not_linked', 'medium', `${mystery.id} is dropped but not linked from ${thread.id}.abandoned_mysteries`, thread.id));
    }
  }
}

function validateThreadSemantics(ctx) {
  for (const thread of ctx.threadMap.values()) {
    validateThreadMysteryLinks(ctx, thread);
    validateThreadStatus(ctx, thread);
  }
}

function validateThreadMysteryLinks(ctx, thread) {
  const { findings } = ctx;
  for (const [key, ruleId] of [
    ['resolved_mysteries', 'quality.outline.thread.resolved_mystery_missing'],
    ['abandoned_mysteries', 'quality.outline.thread.abandoned_mystery_missing'],
  ]) {
    const links = thread[key] || [];
    const sortedLinks = sortMysteryArray(links);
    if (sortedLinks.some((mystery, index) => mystery.id !== links[index]?.id)) {
      findings.push(finding('quality.outline.thread.mystery_link_order', 'low', `${thread.id}.${key} is not sorted`, thread.id));
    }
    const linkIds = new Set();
    for (const mystery of links) {
      if (linkIds.has(mystery.id)) {
        findings.push(finding('quality.outline.thread.mystery_link_duplicate', 'low', `${thread.id}.${key} repeats ${mystery.id}`, thread.id));
      }
      linkIds.add(mystery.id);
    }
    for (const mystery of links) validateThreadMysteryLink(ctx, thread, key, ruleId, mystery);
  }
}

function validateThreadMysteryLink(ctx, thread, key, ruleId, mystery) {
  const { findings } = ctx;
  if (!mystery?.id || !ctx.mysteryChapter.has(mystery.id)) {
    findings.push(finding(ruleId, 'high', `${thread.id}.${key} references unknown mystery ${mystery?.id || '(missing)'}`, thread.id));
  } else if (ctx.hasMysteryRegistry && !ctx.mysteryRegistryIds.has(mystery.id)) {
    findings.push(finding('quality.outline.thread.mystery_not_in_registry', 'high', `${thread.id}.${key} references ${mystery.id}, which is not in mystery_registry`, thread.id));
  } else if (mystery.chapter_id && ctx.mysteryChapter.get(mystery.id) !== mystery.chapter_id) {
    findings.push(finding('quality.outline.thread.mystery_chapter_mismatch', 'medium', `${thread.id}.${key} says ${mystery.id} is in ${mystery.chapter_id}, but it is in ${ctx.mysteryChapter.get(mystery.id)}`, thread.id));
  }
}

function validateThreadStatus(ctx, thread) {
  validateActiveThread(ctx, thread);
  validateResolvedThread(ctx, thread);
  if (thread.status !== 'abandoned') return;
  const listed = (ctx.outline.abandoned_threads || []).some((item) => item.thread_id === thread.id);
  if (!listed) {
    ctx.findings.push(finding('quality.outline.abandoned_thread_missing', 'high', `${thread.id} is abandoned but missing from abandoned_threads`, thread.id));
  }
}

function validateActiveThread(ctx, thread) {
  if (thread.status !== 'active') return;
  if (thread.resolved_in) {
    ctx.findings.push(finding('quality.outline.thread.active_with_resolution', 'high', `${thread.id} is active but has resolved_in`, thread.id));
  }
  const resolvedChapter = [...ctx.chaptersById.values()].find((chapter) => (
    chapterResolvedMysteries(chapter).some((mystery) => mystery.thread_id === thread.id)
  ));
  if (resolvedChapter) {
    ctx.findings.push(finding('quality.outline.thread_should_resolve', 'medium', `${thread.id} is active but resolved in ${resolvedChapter.id}`, thread.id));
  }
}

function validateResolvedThread(ctx, thread) {
  if (thread.status !== 'resolved') return;
  if (!thread.resolved_in) {
    ctx.findings.push(finding('quality.outline.thread.resolved_without_chapter', 'high', `${thread.id} is resolved without resolved_in`, thread.id));
    return;
  }
  const chapter = ctx.chaptersById.get(thread.resolved_in);
  if (!chapter) {
    ctx.findings.push(finding('quality.outline.thread.unknown_resolved_chapter', 'high', `${thread.id} resolved_in ${thread.resolved_in} is not a chapter`, thread.id));
  } else if (!chapterResolvedMysteries(chapter).some((mystery) => mystery.thread_id === thread.id)) {
    // Scene-level mysteries count as resolutions here: registry derivation
    // (buildThreadRegistry / repair) uses chapterResolvedMysteries too, so the
    // checker must share that definition or generated packs get false blockers.
    ctx.findings.push(finding('quality.outline.thread_resolution_missing', 'high', `${thread.id} resolves in ${thread.resolved_in} without a matching resolved mystery`, thread.id));
  }
}

function validateOutlineCounts(ctx) {
  if (ctx.config?.structure?.target_volumes && ctx.volumeCount !== ctx.config.structure.target_volumes) {
    ctx.findings.push(finding('quality.outline.volume_count', 'medium', `outline has ${ctx.volumeCount} volumes; target is ${ctx.config.structure.target_volumes}`));
  }
}

export { validateMysterySemantics, validateOutlineCounts, validateThreadSemantics };
