// Shape (JSON schema) rules for craft, recap and setup artifacts.
import { sortMysteryArray } from '../registry.js';
import { finding } from './finding.js';

function validateCraft(craft, kind) {
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

function validateRecap(recap) {
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

function validateSetup(setup) {
  const findings = [];
  if (!setup || typeof setup !== 'object' || Array.isArray(setup)) {
    return [finding('schema.setup.object', 'critical', 'setup must be a JSON object')];
  }
  validateSetupCore(setup, findings);
  if (setup.thread_registry !== undefined) {
    if (!Array.isArray(setup.thread_registry)) {
      findings.push(finding('schema.setup.thread_registry', 'high', 'thread_registry must be an array'));
    } else {
      validateSetupThreadRegistry(setup, findings);
    }
  }
  return findings;
}

function validateSetupCore(setup, findings) {
  if (typeof setup.project_name !== 'string' || !setup.project_name.trim()) {
    findings.push(finding('schema.setup.project_name', 'high', 'project_name must be a non-empty string'));
  }
  if (setup.genres !== undefined && (!Array.isArray(setup.genres) || setup.genres.some((value) => typeof value !== 'string'))) {
    findings.push(finding('schema.setup.genres', 'high', 'genres must be an array of strings'));
  }
  if (typeof setup.premise !== 'string' || !setup.premise.trim()) {
    findings.push(finding('schema.setup.premise', 'high', 'premise must be a non-empty string'));
  }
  if (typeof setup.theme !== 'string' || !setup.theme.trim()) {
    findings.push(finding('schema.setup.theme', 'medium', 'theme must be a non-empty string'));
  }
  if (setup.rules !== undefined && (!Array.isArray(setup.rules) || setup.rules.some((value) => typeof value !== 'string'))) {
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
}

function validateSetupThreadRegistry(setup, findings) {
  const ids = new Set();
  for (const thread of setup.thread_registry) {
    if (!thread?.id) {
      findings.push(finding('schema.setup.thread_registry.id', 'high', 'thread registry entry needs an id'));
      continue;
    }
    if (ids.has(thread.id)) findings.push(finding('quality.setup.thread_registry.duplicate', 'high', `duplicate thread id ${thread.id}`, thread.id));
    ids.add(thread.id);
    if (thread.resolved_chapters !== undefined && !Array.isArray(thread.resolved_chapters)) {
      findings.push(finding('schema.setup.thread_registry.resolved_chapters', 'medium', `${thread.id}.resolved_chapters must be an array`, thread.id));
    }
    if (thread.abandoned_history !== undefined && typeof thread.abandoned_history !== 'boolean') {
      findings.push(finding('schema.setup.thread_registry.abandoned_history', 'medium', `${thread.id}.abandoned_history must be boolean`, thread.id));
    }
    for (const key of ['resolved_mysteries', 'abandoned_mysteries']) {
      if (thread[key] !== undefined && (!Array.isArray(thread[key]) || thread[key].some((item) => typeof item !== 'object' || Array.isArray(item)))) {
        findings.push(finding(`schema.setup.thread_registry.${key}`, 'medium', `${thread.id}.${key} must be an array of objects`, thread.id));
      }
    }
  }
  for (const storyline of setup.storylines || []) {
    if (storyline?.thread_id && !ids.has(storyline.thread_id)) {
      findings.push(finding('quality.setup.thread_registry.unknown', 'high', `storyline ${storyline.name || storyline.thread_id} references unknown thread ${storyline.thread_id}`, storyline.thread_id));
    }
  }
  if (setup.abandoned_threads !== undefined) {
    if (!Array.isArray(setup.abandoned_threads)) {
      findings.push(finding('schema.setup.abandoned_threads', 'high', 'abandoned_threads must be an array'));
    } else {
      for (const thread of setup.abandoned_threads) {
        if (!thread?.thread_id || !ids.has(thread.thread_id)) {
          findings.push(finding('quality.setup.abandoned_threads.unknown', 'high', `abandoned thread ${thread?.thread_id || '(missing)'} is not in thread_registry`, thread?.thread_id || ''));
        }
      }
    }
  }
  validateSetupMysteryRegistry(setup, findings);
}

function validateSetupMysteryRegistry(setup, findings) {
  if (setup.mystery_registry === undefined) return;
  if (!Array.isArray(setup.mystery_registry)) {
    findings.push(finding('schema.setup.mystery_registry', 'high', 'mystery_registry must be an array'));
    return;
  }
  const mysteryIds = new Set();
  for (const mystery of setup.mystery_registry) {
    if (!mystery?.id) {
      findings.push(finding('schema.setup.mystery_registry.id', 'high', 'mystery registry entry needs an id'));
      continue;
    }
    if (mysteryIds.has(mystery.id)) findings.push(finding('quality.setup.mystery_registry.duplicate', 'high', `duplicate mystery id ${mystery.id}`, mystery.id));
    mysteryIds.add(mystery.id);
  }
  const sorted = sortMysteryArray(setup.mystery_registry);
  if (sorted.some((mystery, index) => mystery.id !== setup.mystery_registry[index]?.id)) {
    findings.push(finding('quality.setup.mystery_registry.order', 'low', 'mystery_registry is not sorted by chapter_id/id'));
  }
}

export { validateCraft, validateRecap, validateSetup };
