import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, readText } from './util.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILTIN_RULES_FILE = path.join(ROOT, 'references', 'builtin-rules.json');

const SEVERITIES = ['critical', 'high', 'medium', 'low'];

export function finding(ruleId, severity, issue, targetId = '', suggestion = '') {
  const normalized = SEVERITIES.includes(severity) ? severity : 'medium';
  return { rule_id: ruleId, severity: normalized, target_id: targetId, issue, suggestion };
}

export function validateCraft(craft, kind) {
  const findings = [];
  const key = String(kind || 'character');
  if (!craft || typeof craft !== 'object' || Array.isArray(craft)) {
    return [finding('schema.craft.object', 'critical', `${key} craft must be a JSON object`)];
  }
  if (typeof craft.name !== 'string' || !craft.name.trim()) {
    findings.push(finding('schema.craft.name', 'high', `${key}.name must be a non-empty string`, craft.name || ''));
  }
  const requireString = (field, severity = 'high') => {
    if (typeof craft[field] !== 'string' || !craft[field].trim()) {
      findings.push(finding(`schema.craft.${field}`, severity, `${key}.${field} must be a non-empty string`, craft.name || ''));
    }
  };
  const requireArray = (field, severity = 'high') => {
    if (!Array.isArray(craft[field]) || craft[field].some((v) => typeof v !== 'string')) {
      findings.push(finding(`schema.craft.${field}`, severity, `${key}.${field} must be an array of strings`, craft.name || ''));
    }
  };
  if (key === 'character') {
    requireString('appearance');
    requireString('background');
    requireString('motivation');
    requireString('role_in_story');
    requireArray('personality');
  } else if (key === 'item') {
    requireString('type');
    requireString('description');
    requireString('appearance');
    requireString('function');
    requireString('significance');
  } else if (key === 'location') {
    requireString('type');
    requireString('description');
    requireString('appearance');
    requireString('atmosphere');
    requireString('significance');
  } else if (key === 'organization') {
    requireString('type');
    requireString('description');
    requireArray('goals');
    requireString('significance');
  } else {
    findings.push(finding('schema.craft.kind', 'high', `unsupported craft kind: ${key}; valid: character, item, location, organization`));
  }
  return findings;
}

export function validateRecap(recap) {
  const findings = [];
  if (!recap || typeof recap !== 'object' || Array.isArray(recap)) {
    return [finding('schema.recap.object', 'critical', 'recap must be a JSON object')];
  }
  for (const field of ['chapter_id', 'title', 'location', 'time', 'last_line']) {
    if (typeof recap[field] !== 'string' || !recap[field].trim()) {
      findings.push(finding(`schema.recap.${field}`, 'high', `recap.${field} must be a non-empty string`, recap.chapter_id || ''));
    }
  }
  for (const field of ['present', 'plot_beats', 'decisions', 'reveals', 'unresolved', 'promises', 'items', 'status']) {
    if (!Array.isArray(recap[field]) || recap[field].some((v) => typeof v !== 'string')) {
      findings.push(finding(`schema.recap.${field}`, field === 'plot_beats' ? 'high' : 'medium', `recap.${field} must be an array of strings`, recap.chapter_id || ''));
    }
  }
  return findings;
}

export function validateSetup(setup) {
  const findings = [];
  if (!setup || typeof setup !== 'object' || Array.isArray(setup)) {
    return [finding('schema.setup.object', 'critical', 'setup must be a JSON object')];
  }
  if (typeof setup.project_name !== 'string' || !setup.project_name.trim()) {
    findings.push(finding('schema.setup.project_name', 'high', 'project_name must be a non-empty string'));
  }
  if (setup.genres !== undefined && (!Array.isArray(setup.genres) || setup.genres.some((v) => typeof v !== 'string'))) {
    findings.push(finding('schema.setup.genres', 'high', 'genres must be an array of strings'));
  }
  if (typeof setup.premise !== 'string' || !setup.premise.trim()) {
    findings.push(finding('schema.setup.premise', 'high', 'premise must be a non-empty string'));
  }
  if (typeof setup.theme !== 'string' || !setup.theme.trim()) {
    findings.push(finding('schema.setup.theme', 'medium', 'theme must be a non-empty string'));
  }
  if (setup.rules !== undefined && (!Array.isArray(setup.rules) || setup.rules.some((v) => typeof v !== 'string'))) {
    findings.push(finding('schema.setup.rules', 'medium', 'rules must be an array of strings'));
  }
  if (setup.writing_style !== undefined) {
    if (!setup.writing_style || typeof setup.writing_style !== 'object' || Array.isArray(setup.writing_style)) {
      findings.push(finding('schema.setup.writing_style', 'high', 'writing_style must be an object, not a string'));
    }
  }
  for (const key of ['core_cast', 'storylines', 'premises', 'world_timeline', 'world_resources']) {
    if (setup[key] === undefined) continue;
    if (!Array.isArray(setup[key])) {
      findings.push(finding(`schema.setup.${key}`, 'high', `${key} must be an array`));
      continue;
    }
    setup[key].forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        findings.push(finding(`schema.setup.${key}`, 'high', `${key}[${index}] must be an object`, '', 'Use an object array; strings are not accepted here.'));
      }
    });
  }
  return findings;
}

export function validateOutline(outline, config) {
  const findings = [];
  if (!outline || typeof outline !== 'object' || Array.isArray(outline)) {
    return [finding('schema.outline.object', 'critical', 'outline must be a JSON object')];
  }
  if (!Array.isArray(outline.parts) || outline.parts.length === 0) {
    return [finding('schema.outline.parts', 'critical', 'outline.parts must be a non-empty array')];
  }
  const ids = new Set();
  const chapterIds = [];
  let volumeCount = 0;
  let chapterCount = 0;
  outline.parts.forEach((part, pi) => {
    const partId = part?.id || `parts[${pi}]`;
    if (!part || typeof part !== 'object') {
      findings.push(finding('schema.outline.part', 'critical', `${partId} must be an object`, partId));
      return;
    }
    for (const key of ['id', 'title', 'summary']) {
      if (typeof part[key] !== 'string' || !part[key].trim()) {
        findings.push(finding(`schema.outline.part.${key}`, 'high', `${partId}.${key} must be a non-empty string`, partId));
      }
    }
    if (ids.has(part.id)) {
      findings.push(finding('quality.outline.duplicate_id', 'high', `duplicate id ${part.id}`, part.id));
    }
    ids.add(part.id);
    if (!Array.isArray(part.volumes) || part.volumes.length === 0) {
      findings.push(finding('schema.outline.volumes', 'high', `${partId}.volumes must be a non-empty array`, partId));
      return;
    }
    part.volumes.forEach((volume, vi) => {
      volumeCount += 1;
      const volumeId = volume?.id || `${partId}.volumes[${vi}]`;
      if (!volume || typeof volume !== 'object') {
        findings.push(finding('schema.outline.volume', 'critical', `${volumeId} must be an object`, volumeId));
        return;
      }
      for (const key of ['id', 'title', 'summary']) {
        if (typeof volume[key] !== 'string' || !volume[key].trim()) {
          findings.push(finding(`schema.outline.volume.${key}`, 'high', `${volumeId}.${key} must be a non-empty string`, volumeId));
        }
      }
      if (ids.has(volume.id)) {
        findings.push(finding('quality.outline.duplicate_id', 'high', `duplicate id ${volume.id}`, volume.id));
      }
      ids.add(volume.id);
      if (!Array.isArray(volume.chapters) || volume.chapters.length === 0) {
        findings.push(finding('schema.outline.chapters', 'high', `${volumeId}.chapters must be a non-empty array`, volumeId));
        return;
      }
      volume.chapters.forEach((chapter, ci) => {
        chapterCount += 1;
        const chapterId = chapter?.id || `${volumeId}.chapters[${ci}]`;
        if (!chapter || typeof chapter !== 'object') {
          findings.push(finding('schema.outline.chapter', 'critical', `${chapterId} must be an object`, chapterId));
          return;
        }
        chapterIds.push(chapter.id);
        for (const key of ['id', 'title', 'summary', 'conflict', 'pacing']) {
          if (typeof chapter[key] !== 'string' || !chapter[key].trim()) {
            findings.push(finding(`schema.outline.chapter.${key}`, 'high', `${chapterId}.${key} must be a non-empty string`, chapterId));
          }
        }
        if (!Array.isArray(chapter.characters) || chapter.characters.some((v) => typeof v !== 'string')) {
          findings.push(finding('schema.outline.chapter.characters', 'high', `${chapterId}.characters must be an array of strings`, chapterId));
        }
        if (!Array.isArray(chapter.events)) {
          findings.push(finding('schema.outline.chapter.events', 'high', `${chapterId}.events must be an array`, chapterId));
        } else {
          chapter.events.forEach((event, ei) => {
            const eventId = `${chapterId}.events[${ei}]`;
            if (!event || typeof event !== 'object' || Array.isArray(event)) {
              findings.push(finding('schema.outline.chapter.event', 'high', `${eventId} must be an object`, eventId));
              return;
            }
            if (typeof (event.type || event.action) !== 'string' || !(event.type || event.action).trim()) {
              findings.push(finding('schema.outline.chapter.event', 'high', `${eventId} needs a non-empty type or action`, eventId));
            }
            if (event.characters !== undefined && (!Array.isArray(event.characters) || event.characters.some((v) => typeof v !== 'string'))) {
              findings.push(finding('schema.outline.chapter.event', 'medium', `${eventId}.characters must be an array of strings`, eventId));
            }
            if (event.target_type !== undefined && typeof event.target_type !== 'string') {
              findings.push(finding('schema.outline.chapter.event', 'medium', `${eventId}.target_type must be a string`, eventId));
            }
            if (event.order !== undefined && typeof event.order !== 'number') {
              findings.push(finding('schema.outline.chapter.event', 'medium', `${eventId}.order must be a number`, eventId));
            }
          });
        }
        if (chapter.timeline !== undefined) {
          if (!chapter.timeline || typeof chapter.timeline !== 'object' || Array.isArray(chapter.timeline)) {
            findings.push(finding('schema.outline.chapter.timeline', 'high', `${chapterId}.timeline must be an object`, chapterId));
          } else if (chapter.timeline.time_jump !== undefined && typeof chapter.timeline.time_jump !== 'boolean') {
            findings.push(finding('schema.outline.chapter.timeline', 'medium', `${chapterId}.timeline.time_jump must be a boolean`, chapterId));
          }
        }
        if (chapter.state_anchor !== undefined) {
          if (!chapter.state_anchor || typeof chapter.state_anchor !== 'object' || Array.isArray(chapter.state_anchor)) {
            findings.push(finding('schema.outline.chapter.state_anchor', 'high', `${chapterId}.state_anchor must be an object`, chapterId));
          } else {
            const anchor = chapter.state_anchor;
            if (anchor.spirit_stones !== undefined && typeof anchor.spirit_stones !== 'number') {
              findings.push(finding('schema.outline.chapter.state_anchor', 'medium', `${chapterId}.state_anchor.spirit_stones must be a number`, chapterId));
            }
            for (const key of ['allies', 'key_items', 'injuries']) {
              if (anchor[key] !== undefined && (!Array.isArray(anchor[key]) || anchor[key].some((v) => typeof v !== 'string'))) {
                findings.push(finding('schema.outline.chapter.state_anchor', 'medium', `${chapterId}.state_anchor.${key} must be an array of strings`, chapterId));
              }
            }
          }
        }
        if (chapter.mysteries !== undefined) {
          if (!chapter.mysteries || typeof chapter.mysteries !== 'object' || Array.isArray(chapter.mysteries)) {
            findings.push(finding('schema.outline.chapter.mysteries', 'high', `${chapterId}.mysteries must be an object`, chapterId));
          } else {
            for (const key of ['planted', 'resolved']) {
              if (chapter.mysteries[key] !== undefined && !Array.isArray(chapter.mysteries[key])) {
                findings.push(finding('schema.outline.chapter.mysteries', 'medium', `${chapterId}.mysteries.${key} must be an array`, chapterId));
              }
            }
          }
        }
        if (chapter.chapter_payoff !== undefined && (!chapter.chapter_payoff || typeof chapter.chapter_payoff !== 'object' || Array.isArray(chapter.chapter_payoff))) {
          findings.push(finding('schema.outline.chapter.chapter_payoff', 'medium', `${chapterId}.chapter_payoff must be an object`, chapterId));
        }
        if (chapter.resource_ledger !== undefined && !Array.isArray(chapter.resource_ledger)) {
          findings.push(finding('schema.outline.chapter.resource_ledger', 'high', `${chapterId}.resource_ledger must be an array`, chapterId));
        }
        if (ids.has(chapter.id)) {
          findings.push(finding('quality.outline.duplicate_id', 'high', `duplicate id ${chapter.id}`, chapter.id));
        }
        ids.add(chapter.id);
        if (config?.structure?.target_chapters && volume.chapters.length !== config.structure.target_chapters) {
          findings.push(finding('quality.outline.chapter_count', 'medium', `${volumeId} has ${volume.chapters.length} chapters; target is ${config.structure.target_chapters}`, volumeId));
        }
      });
    });
  });
  if (config?.structure?.target_volumes && volumeCount !== config.structure.target_volumes) {
    findings.push(finding('quality.outline.volume_count', 'medium', `outline has ${volumeCount} volumes; target is ${config.structure.target_volumes}`));
  }
  if (config?.structure?.target_chapters && chapterIds.length !== config.structure.target_chapters * volumeCount) {
    // This is already covered per volume; keep the global count visible only when volumes differ.
  }
  return findings;
}

function outlineIndex(outline) {
  return {
    part_count: outline?.parts?.length || 0,
    volume_count: (outline?.parts || []).reduce((n, p) => n + (p.volumes?.length || 0), 0),
    chapter_count: (outline?.parts || []).reduce((n, p) => n + (p.volumes || []).reduce((m, v) => m + (v.chapters?.length || 0), 0), 0),
    parts: (outline?.parts || []).map((p) => ({
      id: p.id,
      title: p.title,
      volumes: (p.volumes || []).map((v) => ({
        id: v.id,
        title: v.title,
        chapters: (v.chapters || []).map((c) => ({ id: c.id, title: c.title })),
      })),
    })),
  };
}

export { outlineIndex };

function findOutlineChapter(outline, id) {
  for (const part of outline?.parts || []) {
    for (const volume of part.volumes || []) {
      for (const chapter of volume.chapters || []) {
        if (chapter.id === id) return { part, volume, chapter };
      }
    }
  }
  return null;
}

function qualityFindings(project, target, id, override = {}) {
  const findings = [];
  if (target === 'setup') {
    const setup = override.setup || readJson(path.join(project.dir, 'story', 'setup', 'story_setup.json'));
    if (!(setup.core_cast || []).some((c) => c.role === 'protagonist')) {
      findings.push(finding('quality.setup.protagonist', 'medium', 'setup has no protagonist in core_cast', 'setup'));
    }
    if (!setup.premise || setup.premise.length < 20) {
      findings.push(finding('quality.setup.premise', 'medium', 'premise is too short to guide an outline', 'setup'));
    }
    return findings;
  }
  if (target === 'craft') {
    const kind = id || 'character';
    const craft = override.craft || readJson(path.join(project.dir, 'story', 'craft', `${kind}.json`));
    if (kind === 'character') {
      if (String(craft.background || '').trim().length < 20) {
        findings.push(finding('quality.craft.background', 'medium', 'character background is too thin', craft.name || kind));
      }
      if (String(craft.motivation || '').trim().length < 10) {
        findings.push(finding('quality.craft.motivation', 'medium', 'character motivation is too thin', craft.name || kind));
      }
    }
    return findings;
  }
  if (target === 'recap') {
    if (!id) throw new Error('recap check requires --id');
    const recap = override.recap || readJson(path.join(project.dir, 'story', 'recaps', `${id}.json`));
    if (!(recap.plot_beats || []).length) {
      findings.push(finding('quality.recap.plot_beats', 'medium', 'recap has no plot beats', id));
    }
    if (recap.chapter_id && recap.chapter_id !== id) {
      findings.push(finding('quality.recap.chapter_id', 'high', `recap declares chapter_id ${recap.chapter_id}, expected ${id}`, id));
    }
    const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
    let found = null;
    if (fs.existsSync(outlineFile)) {
      const outline = readJson(outlineFile);
      found = findOutlineChapter(outline, id);
      if (!found) {
        findings.push(finding('quality.recap.not_in_outline', 'medium', `${id} recap has no matching outline chapter`, id));
      } else {
        const known = new Set(found.chapter.characters || []);
        for (const name of recap.present || []) {
          if (known.size > 0 && !known.has(name)) {
            findings.push(finding('quality.recap.presence', 'medium', `${id} recap mentions ${name}, who is not in the outline chapter`, id));
          }
        }
        if (found.chapter.location && recap.location && found.chapter.location !== recap.location) {
          findings.push(finding('quality.recap.location', 'low', `${id} recap location ${recap.location} differs from outline location ${found.chapter.location}`, id));
        }
      }
    }
    const chapterFile = path.join(project.dir, 'chapters', `${id}.md`);
    if (fs.existsSync(chapterFile)) {
      const chapterText = readText(chapterFile);
      if (recap.last_line && !chapterText.includes(recap.last_line)) {
        findings.push(finding('quality.recap.last_line', 'low', `${id} recap last_line does not appear in the chapter text`, id));
      }
      for (const name of recap.present || []) {
        if (!chapterText.includes(name)) {
          findings.push(finding('quality.recap.presence_text', 'low', `${id} recap present character ${name} does not appear in the chapter text`, id));
        }
      }
      const knownNames = [...new Set([...(found?.chapter?.characters || []), ...(recap.present || [])])];
      for (const beat of recap.plot_beats || []) {
        if (knownNames.length > 0 && !knownNames.some((name) => chapterText.includes(name)) && !chapterText.includes(String(beat).slice(0, 6))) {
          findings.push(finding('quality.recap.plot_beat_text', 'low', `${id} recap plot beat has no recognizable anchor in the chapter text: ${beat}`, id));
        }
      }
    }
    return findings;
  }
  if (target === 'outline') {
    const outline = override.outline || readJson(path.join(project.dir, 'story', 'compose', 'outline.json'));
    const setupFile = path.join(project.dir, 'story', 'setup', 'story_setup.json');
    const setup = override.setup || (fs.existsSync(setupFile) ? readJson(setupFile) : null);
    let protagonistName = '';
    if (setup) {
      const protagonist = (setup.core_cast || []).find((c) => c.role === 'protagonist');
      if (!protagonist) {
        findings.push(finding('quality.setup.protagonist', 'medium', 'setup has no protagonist in core_cast', 'setup'));
      } else {
        protagonistName = protagonist.name || '';
        if (!protagonist.story_function) {
          findings.push(finding('quality.character.background', 'medium', 'protagonist has no story_function/background anchor', protagonist.id || protagonist.name || 'protagonist'));
        }
        if (!protagonist.relationship_to_lead && !protagonist.relationship_arc) {
          findings.push(finding('quality.character.motivation', 'medium', 'protagonist has no relationship or motivation anchor', protagonist.id || protagonist.name || 'protagonist'));
        }
      }
    }
    const names = new Set();
    const itemState = new Map();
    const plantedMysteries = new Set();
    const knownItems = new Set([
      ...((setup?.world_resources || []).map((item) => item.name)),
      ...((setup?.premises || []).map((item) => item.name)),
    ].filter(Boolean));
    const craftItemFile = path.join(project.dir, 'story', 'craft', 'item.json');
    if (fs.existsSync(craftItemFile)) {
      const craftItem = readJson(craftItemFile);
      if (craftItem?.name) knownItems.add(craftItem.name);
    }
    const castNames = new Set((setup?.core_cast || []).map((c) => c.name).filter(Boolean));
    const storylineNames = new Set((setup?.storylines || []).map((s) => s.name).filter(Boolean));
    const lastSeen = new Map();
    const returnedCharacters = new Set();
    const deadCharacters = new Set();
    const absentCharacters = new Set();
    let previousSpiritEnd = null;
    let sequence = 0;
    for (const part of outline.parts || []) {
      for (const volume of part.volumes || []) {
        const eventTypes = {};
        const chapters = volume.chapters || [];
        for (let index = 0; index < chapters.length; index += 1) {
          const chapter = chapters[index];
          sequence += 1;
          if (chapter.id && !/^P\d+-V\d+-C\d+$/.test(chapter.id)) {
            findings.push(finding('quality.outline.chapter_id', 'low', `chapter id ${chapter.id} does not use P1-V1-C1 form`, chapter.id));
          }
          const revivedNow = new Set((chapter.events || [])
            .filter((event) => ['revive', 'resurrect'].includes(String(event.action || event.change || '').toLowerCase()))
            .map((event) => String(event.target || event.subject || '').trim())
            .filter(Boolean));
          const returnedNow = new Set((chapter.events || [])
            .filter((event) => ['return', 'arrive', 'rejoin'].includes(String(event.action || event.change || '').toLowerCase()))
            .map((event) => String(event.target || event.subject || '').trim())
            .filter(Boolean));
          for (const name of chapter.characters || []) {
            if (deadCharacters.has(name) && !revivedNow.has(name)) {
              findings.push(finding('quality.outline.dead_character_present', 'high', `${chapter.id} includes ${name}, who died in an earlier chapter`, chapter.id, 'Add a revival event or remove the character from this chapter.'));
            } else if (absentCharacters.has(name) && !returnedNow.has(name)) {
              findings.push(finding('quality.outline.character_absent_return', 'low', `${chapter.id} includes ${name}, who left earlier without a return event`, chapter.id, 'Add a return/arrive event or show how the character rejoined.'));
            }
          }
          for (const name of chapter.characters || []) {
            names.add(name);
            const previous = lastSeen.get(name);
            if (previous !== undefined && sequence - previous > 2 && !returnedCharacters.has(name)) {
              findings.push(finding('quality.outline.character_return', 'low', `${name} returns after ${sequence - previous - 1} chapters without a presence beat`, chapter.id, 'Show where the character has been or why they return now.'));
              returnedCharacters.add(name);
            }
            lastSeen.set(name, sequence);
            if (castNames.size > 0 && !castNames.has(name)) {
              findings.push(finding('quality.outline.unknown_character', 'low', `${chapter.id} uses unknown character ${name}`, chapter.id));
            }
          }
          for (const ally of chapter.state_anchor?.allies || []) {
            if (deadCharacters.has(ally)) {
              findings.push(finding('quality.outline.dead_ally', 'high', `${chapter.id} state_anchor lists ${ally}, who already died`, chapter.id, 'Remove the dead ally or add a revival event.'));
            } else if (absentCharacters.has(ally)) {
              findings.push(finding('quality.outline.absent_ally', 'low', `${chapter.id} state_anchor lists ${ally}, who has left`, chapter.id));
            } else if (castNames.size > 0 && !castNames.has(ally)) {
              findings.push(finding('quality.outline.unknown_ally', 'low', `${chapter.id} state_anchor lists unknown ally ${ally}`, chapter.id));
            }
          }
          for (const item of chapter.state_anchor?.key_items || []) {
            if (!knownItems.has(item) && !itemState.has(item)) {
              findings.push(finding('quality.outline.anchor_item', 'low', `${chapter.id} state_anchor lists unknown key item ${item}`, chapter.id, 'Define it in setup/craft or acquire it in an earlier event.'));
            }
          }
          if ((chapter.characters || []).length === 0) {
            findings.push(finding('quality.outline.characters', 'medium', `${chapter.id} has no characters`, chapter.id));
          }
          if ((chapter.events || []).length === 0) {
            findings.push(finding('quality.outline.events', 'medium', `${chapter.id} has no events`, chapter.id));
          }
          let previousEventOrder = null;
          for (const event of chapter.events || []) {
            const type = event.type || event.action;
            if (type) eventTypes[type] = (eventTypes[type] || 0) + 1;
            if (typeof event.order === 'number') {
              if (previousEventOrder !== null && event.order < previousEventOrder) {
                findings.push(finding('quality.outline.event_order', 'medium', `${chapter.id} event order goes backwards: ${previousEventOrder} -> ${event.order}`, chapter.id));
              }
              previousEventOrder = event.order;
            }
            const chapterCharacters = new Set(chapter.characters || []);
            if (event.actor && chapterCharacters.size > 0 && !chapterCharacters.has(event.actor) &&
              (castNames.size === 0 || castNames.has(event.actor))) {
              findings.push(finding('quality.outline.event_actor', 'medium', `${chapter.id} event actor ${event.actor} is not in chapter.characters`, chapter.id));
            }
            const targetType = String(event.target_type || '').toLowerCase();
            const target = String(event.target || event.subject || '').trim();
            if (targetType === 'character' && target && chapterCharacters.size > 0 && !chapterCharacters.has(target)) {
              findings.push(finding('quality.outline.event_target', 'medium', `${chapter.id} event target ${target} is not in chapter.characters`, chapter.id));
            }
            for (const name of event.characters || []) {
              if (!(chapter.characters || []).includes(name)) {
                findings.push(finding('quality.outline.event_character', 'medium', `${chapter.id} event uses ${name}, who is not in chapter.characters`, chapter.id));
              }
            }
            const action = String(event.action || event.change || '').toLowerCase();
            if (target && (targetType === 'character' || type === 'character')) {
              if (['kill', 'die', 'death'].includes(action)) {
                deadCharacters.add(target);
                absentCharacters.delete(target);
              } else if (['revive', 'resurrect'].includes(action)) {
                deadCharacters.delete(target);
              } else if (['leave', 'exit', 'depart'].includes(action)) {
                absentCharacters.add(target);
              } else if (['return', 'arrive', 'rejoin'].includes(action)) {
                absentCharacters.delete(target);
              }
            }
            if (target && (targetType === 'item' || type === 'item')) {
              if (['acquire', 'get', 'pickup', 'receive', 'gain'].includes(action)) {
                itemState.set(target, true);
              } else if (['use', 'consume', 'equip', 'spend'].includes(action) && !itemState.get(target) && !knownItems.has(target)) {
                findings.push(finding('quality.outline.item_usage', 'high', `${chapter.id} uses item ${target} before it is acquired`, chapter.id, 'Add an acquire event earlier or remove the item usage.'));
              }
            }
          }
          for (const advance of chapter.storyline_advances || []) {
            const name = advance.storyline_name;
            if (name && storylineNames.size > 0 && !storylineNames.has(name)) {
              findings.push(finding('quality.outline.unknown_storyline', 'medium', `${chapter.id} advances unknown storyline ${name}`, chapter.id));
            }
          }
          for (const entry of chapter.resource_ledger || []) {
            if (typeof entry?.start !== 'number' || typeof entry?.delta !== 'number' || typeof entry?.end !== 'number') {
              findings.push(finding('quality.outline.resource_ledger', 'medium', `${chapter.id} resource_ledger entry for ${entry?.item || 'item'} needs numeric start/delta/end`, chapter.id));
            } else if (entry.start + entry.delta !== entry.end) {
              findings.push(finding('quality.outline.resource_ledger', 'high', `${chapter.id} resource_ledger arithmetic is wrong for ${entry.item || 'item'}: ${entry.start} + ${entry.delta} != ${entry.end}`, chapter.id));
            }
          }
          const anchorSpirit = chapter.state_anchor?.spirit_stones;
          if (previousSpiritEnd !== null && typeof anchorSpirit === 'number' && anchorSpirit !== previousSpiritEnd) {
            findings.push(finding('quality.outline.anchor_continuity', 'medium', `${chapter.id} state_anchor.spirit_stones ${anchorSpirit} does not match the previous ledger end ${previousSpiritEnd}`, chapter.id, 'Carry the previous end value into the next state_anchor.'));
          }
          const spiritEntry = (chapter.resource_ledger || []).find((entry) =>
            /spirit|灵石|灵力|晶石/i.test(String(entry?.item || '')));
          if (spiritEntry && typeof spiritEntry.end === 'number') {
            previousSpiritEnd = spiritEntry.end;
          }
          if (spiritEntry && typeof anchorSpirit === 'number' && anchorSpirit !== spiritEntry.start) {
            findings.push(finding('quality.outline.anchor_start', 'medium', `${chapter.id} state_anchor.spirit_stones ${anchorSpirit} does not match its own ledger start ${spiritEntry.start}`, chapter.id));
          }
          if (typeof chapter.state_anchor?.spirit_stones === 'number' && chapter.state_anchor.spirit_stones < 0) {
            findings.push(finding('quality.outline.negative_resource', 'medium', `${chapter.id} state_anchor.spirit_stones is negative`, chapter.id));
          }
          if (index > 0) {
            const previous = chapters[index - 1];
            if (previous.location && chapter.location && previous.location !== chapter.location &&
              !String(chapter.timeline?.transition || '').trim()) {
              findings.push(finding('quality.outline.transition', 'low', `${previous.id} -> ${chapter.id} changes location without a timeline.transition`, chapter.id, 'Explain the move or add a transition beat.'));
            }
          }
          for (const planted of chapter.mysteries?.planted || []) {
            if (planted.id) {
              if (plantedMysteries.has(planted.id)) {
                findings.push(finding('quality.outline.mystery_duplicate', 'low', `${chapter.id} re-plants mystery ${planted.id}`, chapter.id));
              }
              plantedMysteries.add(planted.id);
            }
          }
          for (const resolved of chapter.mysteries?.resolved || []) {
            if (resolved.id && !plantedMysteries.has(resolved.id)) {
              findings.push(finding('quality.outline.mystery_resolution', 'medium', `${chapter.id} resolves mystery ${resolved.id} before it is planted`, chapter.id));
            }
          }
          if (index >= 2) {
            const previous = chapters.slice(index - 2, index + 1);
            if (previous.every((item) => String(item.pacing || '').toLowerCase().startsWith('fast'))) {
              findings.push(finding('quality.outline.pacing', 'medium', `${previous[0].id}..${chapter.id} is three consecutive fast chapters`, chapter.id, 'Insert a slower chapter or a breather scene.'));
            }
          }
        }
        for (const [type, count] of Object.entries(eventTypes)) {
          if (count > 3) {
            findings.push(finding('quality.outline.event_repetition', 'medium', `event type '${type}' is used ${count} times in ${volume.id}`, volume.id, 'Vary the event types across the volume.'));
          }
        }
      }
    }
    if (names.size === 0) {
      findings.push(finding('quality.outline.cast', 'high', 'outline has no chapter characters'));
    }
    if (protagonistName && !names.has(protagonistName)) {
      findings.push(finding('quality.outline.protagonist_missing', 'medium', `protagonist ${protagonistName} does not appear in any chapter`, 'protagonist'));
    }
    return findings;
  }
  if (target === 'chapter') {
    if (!id) throw new Error('chapter check requires --id');
    const file = path.join(project.dir, 'chapters', `${id}.md`);
    let text = override.chapterText;
    if (text === undefined) {
      if (!fs.existsSync(file)) throw new Error(`chapter not found: ${id}`);
      text = readText(file);
    }
    if (text.trim().length < 200) {
      findings.push(finding('quality.chapter.length', 'medium', `${id} is shorter than 200 characters`, id));
    }
    const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
    const outline = fs.existsSync(outlineFile) ? readJson(outlineFile) : null;
    const found = outline ? findOutlineChapter(outline, id) : null;
    if (outline && !found) {
      findings.push(finding('quality.chapter.not_in_outline', 'medium', `${id} is not present in the outline`, id));
    }
    if (found?.chapter) {
      if (found.chapter.title && !text.includes(found.chapter.title)) {
        findings.push(finding('quality.chapter.title', 'low', `${id} text does not contain the outline title ${found.chapter.title}`, id));
      }
      for (const name of found.chapter.characters || []) {
        if (!text.includes(name)) {
          findings.push(finding('quality.chapter.character_absent', 'low', `${id} outline character ${name} never appears in the text`, id));
        }
      }
      for (const event of found.chapter.events || []) {
        const labels = [
          event.actor, event.target, event.subject,
          ...(event.characters || []),
        ].filter((value) => typeof value === 'string' && value.trim());
        if (labels.length > 0 && !labels.some((value) => text.includes(value))) {
          findings.push(finding('quality.chapter.event_absent', 'low', `${id} outline event ${labels.join(' / ')} does not appear in the text`, id));
        }
      }
    }
    const recapFile = path.join(project.dir, 'story', 'recaps', `${id}.json`);
    if (fs.existsSync(recapFile)) {
      const recap = readJson(recapFile);
      if (recap.chapter_id && recap.chapter_id !== id) {
        findings.push(finding('quality.chapter.recap_id', 'high', `${id} recap declares chapter_id ${recap.chapter_id}`, id));
      }
      const known = new Set(found?.chapter?.characters || []);
      for (const name of recap.present || []) {
        if (known.size > 0 && !known.has(name)) {
          findings.push(finding('quality.chapter.recap_presence', 'medium', `${id} recap mentions ${name}, who is not in the outline chapter`, id));
        }
      }
      if (found?.chapter?.location && recap.location && found.chapter.location !== recap.location) {
        findings.push(finding('quality.chapter.recap_location', 'low', `${id} recap location ${recap.location} differs from outline location ${found.chapter.location}`, id));
      }
    } else {
      findings.push(finding('quality.chapter.no_recap', 'low', `${id} has no recap`, id));
    }
    return findings;
  }
  return findings;
}

function customRules(project) {
  const dirs = [
    path.join(project.dir, '.wishmachine', 'rules'),
    path.join(project.dir, '.novelgen', 'rules'),
  ];
  const rules = [];
  if (fs.existsSync(BUILTIN_RULES_FILE)) {
    try {
      const value = JSON.parse(readText(BUILTIN_RULES_FILE));
      for (const rule of Array.isArray(value) ? value : [value]) {
        rules.push({ ...rule, source: 'builtin', file: 'builtin-rules.json' });
      }
    } catch {
      // Built-in rule corruption must not make every check fail.
    }
  }
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
      try {
        const value = JSON.parse(readText(path.join(dir, name)));
        const list = Array.isArray(value) ? value : [value];
        for (const rule of list) rules.push({ ...rule, source: 'project', file: name });
      } catch {
        // A malformed rule is reported by check as a low finding below.
        rules.push({ id: `invalid.${name}`, target: 'all', severity: 'medium', message: `invalid custom rule ${name}` });
      }
    }
  }
  return rules;
}

function customFindings(project, target, id, overrideText) {
  const findings = [];
  let text = overrideText;
  if (text === undefined) {
    text = '';
    if (target === 'setup') text = readText(path.join(project.dir, 'story', 'setup', 'story_setup.json'));
    if (target === 'outline') text = readText(path.join(project.dir, 'story', 'compose', 'outline.json'));
    if (target === 'chapter') {
      if (!id) throw new Error('chapter custom check requires --id');
      text = readText(path.join(project.dir, 'chapters', `${id}.md`));
    }
    if (target === 'craft') {
      const kind = id || 'character';
      text = readText(path.join(project.dir, 'story', 'craft', `${kind}.json`));
    }
    if (target === 'recap') {
      if (!id) throw new Error('recap custom check requires --id');
      text = readText(path.join(project.dir, 'story', 'recaps', `${id}.json`));
    }
  }
  for (const rule of customRules(project)) {
    const ruleTarget = String(rule.target || 'all');
    if (ruleTarget !== 'all' && ruleTarget !== target) continue;
    let matched = false;
    if (rule.kind === 'contains') {
      matched = text.includes(rule.pattern || '');
    } else {
      try {
        matched = new RegExp(rule.pattern || '').test(text);
      } catch {
        findings.push(finding(`invalid.${rule.file || 'rule'}`, 'medium', `invalid regex in ${rule.id || 'custom rule'}`));
        continue;
      }
    }
    if (matched) {
      findings.push(finding(rule.id || 'custom', rule.severity || 'medium', rule.message || 'custom rule matched', id || target, rule.suggestion || ''));
    }
  }
  return findings;
}

export function checkCandidate(project, options = {}) {
  const section = options.section;
  const candidate = options.candidate;
  const kind = options.kind || 'character';
  let findings = [];
  if (section === 'setup') {
    findings.push(...validateSetup(candidate));
    findings.push(...qualityFindings(project, 'setup', '', { setup: candidate }));
  } else if (section === 'outline') {
    findings.push(...validateOutline(candidate, project.config));
    findings.push(...qualityFindings(project, 'outline', '', { outline: candidate }));
  } else if (section === 'craft') {
    findings.push(...validateCraft(candidate, kind));
    findings.push(...qualityFindings(project, 'craft', kind, { craft: candidate }));
  } else if (section === 'recap') {
    findings.push(...validateRecap(candidate));
    findings.push(...qualityFindings(project, 'recap', options.id || candidate?.chapter_id || '', { recap: candidate }));
  } else if (section === 'chapter') {
    findings.push(...qualityFindings(project, 'chapter', options.id || '', { chapterText: candidate }));
  } else {
    throw new Error(`unsupported candidate section: ${section}`);
  }
  const candidateText = section === 'chapter' ? candidate : JSON.stringify(candidate);
  findings.push(...customFindings(project, section, options.id || '', candidateText));
  const summary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0 };
  for (const item of findings) summary[item.severity] += 1;
  const blocking = summary.critical > 0 || summary.high > 0;
  return {
    ok: !blocking,
    blocking,
    profile: 'all',
    target: section,
    id: options.id || undefined,
    score: Math.max(0, 100 - summary.critical * 20 - summary.high * 10 - summary.medium * 4 - summary.low),
    summary,
    findings: options.maxFindings > 0 ? findings.slice(0, options.maxFindings) : findings,
    truncated: options.maxFindings > 0 && findings.length > options.maxFindings,
  };
}

export function checkProject(project, options = {}) {
  const profile = options.profile || 'all';
  const target = options.target || 'outline';
  const id = options.id || '';
  if (profile === 'rpg') throw new Error('RPG profile is not ported to wishmachine');
  let findings = [];
  if (target === 'setup') {
    const setup = readJson(path.join(project.dir, 'story', 'setup', 'story_setup.json'));
    if (profile === 'schema' || profile === 'all') findings.push(...validateSetup(setup));
    if (profile === 'quality' || profile === 'all') findings.push(...qualityFindings(project, target, id));
  } else if (target === 'outline') {
    const outline = readJson(path.join(project.dir, 'story', 'compose', 'outline.json'));
    if (profile === 'schema' || profile === 'all') findings.push(...validateOutline(outline, project.config));
    if (profile === 'quality' || profile === 'all') findings.push(...qualityFindings(project, target, id));
  } else if (target === 'chapter') {
    if (profile === 'schema') throw new Error('schema check supports setup or outline');
    findings.push(...qualityFindings(project, target, id));
  } else if (target === 'craft') {
    const kind = id || 'character';
    const craft = readJson(path.join(project.dir, 'story', 'craft', `${kind}.json`));
    if (profile === 'schema' || profile === 'all') findings.push(...validateCraft(craft, kind));
    if (profile === 'quality' || profile === 'all') findings.push(...qualityFindings(project, target, kind));
  } else if (target === 'recap') {
    if (!id) throw new Error('recap check requires --id');
    const recap = readJson(path.join(project.dir, 'story', 'recaps', `${id}.json`));
    if (profile === 'schema' || profile === 'all') findings.push(...validateRecap(recap));
    if (profile === 'quality' || profile === 'all') findings.push(...qualityFindings(project, target, id));
  } else {
    throw new Error(`unsupported check target: ${target}`);
  }
  if (profile === 'custom' || profile === 'all') findings.push(...customFindings(project, target, id));
  const min = options.minSeverity;
  if (min) {
    const rank = { low: 0, medium: 1, high: 2, critical: 3 };
    findings = findings.filter((f) => rank[f.severity] >= rank[min]);
  }
  const summary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) summary[f.severity] += 1;
  const blocking = summary.critical > 0 || summary.high > 0;
  const score = Math.max(0, 100 - summary.critical * 20 - summary.high * 10 - summary.medium * 4 - summary.low);
  if (options.maxFindings > 0 && findings.length > options.maxFindings) {
    findings = findings.slice(0, options.maxFindings);
  }
  return {
    ok: !blocking,
    blocking,
    profile,
    target,
    id: id || undefined,
    score,
    summary,
    findings,
    truncated: options.maxFindings > 0 && summary.total > findings.length,
  };
}
