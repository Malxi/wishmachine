// Shape (JSON schema) rules for craft, recap and setup artifacts.
import {
  ABANDONED_THREADS_FIELD,
  MYSTERY_REGISTRY_FIELD,
  SETUP_ARRAY_FIELDS,
  SETUP_OBJECT_FIELDS,
  SETUP_REQUIRED_STRING_FIELDS,
  SETUP_STRING_ARRAY_FIELDS,
  THREAD_REGISTRY_ARRAY_FIELDS,
  THREAD_REGISTRY_BOOLEAN_FIELDS,
  THREAD_REGISTRY_FIELD,
  THREAD_REGISTRY_OBJECT_ARRAY_FIELDS,
} from '../contracts.js';
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
  if (setup[THREAD_REGISTRY_FIELD] !== undefined) {
    if (!Array.isArray(setup[THREAD_REGISTRY_FIELD])) {
      findings.push(finding('schema.setup.thread_registry', 'high', 'thread_registry must be an array'));
    } else {
      validateSetupThreadRegistry(setup, findings);
    }
  }
  return findings;
}

function validateSetupCore(setup, findings) {
  for (const { key, severity } of SETUP_REQUIRED_STRING_FIELDS) {
    if (typeof setup[key] !== 'string' || !setup[key].trim()) {
      findings.push(finding(`schema.setup.${key}`, severity, `${key} must be a non-empty string`));
    }
  }
  for (const { key, severity } of SETUP_STRING_ARRAY_FIELDS) {
    if (setup[key] !== undefined && (!Array.isArray(setup[key]) || setup[key].some((value) => typeof value !== 'string'))) {
      findings.push(finding(`schema.setup.${key}`, severity, `${key} must be an array of strings`));
    }
  }
  for (const key of SETUP_OBJECT_FIELDS) {
    if (setup[key] !== undefined
      && (!setup[key] || typeof setup[key] !== 'object' || Array.isArray(setup[key]))) {
      findings.push(finding(`schema.setup.${key}`, 'high', `${key} must be an object, not a string`));
    }
  }
  for (const key of SETUP_ARRAY_FIELDS) {
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
  for (const thread of setup[THREAD_REGISTRY_FIELD]) {
    if (!thread?.id) {
      findings.push(finding('schema.setup.thread_registry.id', 'high', 'thread registry entry needs an id'));
      continue;
    }
    if (ids.has(thread.id)) findings.push(finding('quality.setup.thread_registry.duplicate', 'high', `duplicate thread id ${thread.id}`, thread.id));
    ids.add(thread.id);
    for (const key of THREAD_REGISTRY_ARRAY_FIELDS) {
      if (thread[key] !== undefined && !Array.isArray(thread[key])) {
        findings.push(finding(`schema.setup.thread_registry.${key}`, 'medium', `${thread.id}.${key} must be an array`, thread.id));
      }
    }
    for (const key of THREAD_REGISTRY_BOOLEAN_FIELDS) {
      if (thread[key] !== undefined && typeof thread[key] !== 'boolean') {
        findings.push(finding(`schema.setup.thread_registry.${key}`, 'medium', `${thread.id}.${key} must be boolean`, thread.id));
      }
    }
    for (const key of THREAD_REGISTRY_OBJECT_ARRAY_FIELDS) {
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
  if (setup[ABANDONED_THREADS_FIELD] !== undefined) {
    if (!Array.isArray(setup[ABANDONED_THREADS_FIELD])) {
      findings.push(finding('schema.setup.abandoned_threads', 'high', 'abandoned_threads must be an array'));
    } else {
      for (const thread of setup[ABANDONED_THREADS_FIELD]) {
        if (!thread?.thread_id || !ids.has(thread.thread_id)) {
          findings.push(finding('quality.setup.abandoned_threads.unknown', 'high', `abandoned thread ${thread?.thread_id || '(missing)'} is not in thread_registry`, thread?.thread_id || ''));
        }
      }
    }
  }
  validateSetupMysteryRegistry(setup, findings);
}

function validateSetupMysteryRegistry(setup, findings) {
  if (setup[MYSTERY_REGISTRY_FIELD] === undefined) return;
  if (!Array.isArray(setup[MYSTERY_REGISTRY_FIELD])) {
    findings.push(finding('schema.setup.mystery_registry', 'high', 'mystery_registry must be an array'));
    return;
  }
  const mysteryIds = new Set();
  for (const mystery of setup[MYSTERY_REGISTRY_FIELD]) {
    if (!mystery?.id) {
      findings.push(finding('schema.setup.mystery_registry.id', 'high', 'mystery registry entry needs an id'));
      continue;
    }
    if (mysteryIds.has(mystery.id)) findings.push(finding('quality.setup.mystery_registry.duplicate', 'high', `duplicate mystery id ${mystery.id}`, mystery.id));
    mysteryIds.add(mystery.id);
  }
  const sorted = sortMysteryArray(setup[MYSTERY_REGISTRY_FIELD]);
  if (sorted.some((mystery, index) => mystery.id !== setup[MYSTERY_REGISTRY_FIELD][index]?.id)) {
    findings.push(finding('quality.setup.mystery_registry.order', 'low', 'mystery_registry is not sorted by chapter_id/id'));
  }
}

export { validateCraft, validateRecap, validateSetup };
