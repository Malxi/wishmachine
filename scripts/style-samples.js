// Human style reference data: load the built-in sample catalog and validate
// that a writing-style/voice reference is either a known sample_id (verbatim)
// or an explicitly user-confirmed human/licensed excerpt. AI-written samples
// are never accepted as positive references.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const DATA_FILE = fileURLToPath(new URL('../data/style/human-samples.json', import.meta.url));
const ALLOWED_SOURCES = ['human', 'public-domain', 'licensed'];

function loadHumanSamples() {
  const doc = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return Array.isArray(doc?.entries) ? doc.entries : [];
}

function normalizeSampleText(text) {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findHumanSample(id) {
  return loadHumanSamples().find((sample) => sample.id === id) || null;
}

function validateReferenceSample(reference, label) {
  if (!reference || typeof reference !== 'object' || Array.isArray(reference)) {
    throw new Error(`${label} entries must be objects`);
  }
  if (typeof reference.text !== 'string' || reference.text.trim().length < 80) {
    throw new Error(`${label} entries need a verbatim text of at least 80 chars`);
  }
  const source = reference.source;
  if (source === 'ai') {
    throw new Error(`${label}.source must be human|public-domain|licensed; AI-generated samples are not accepted`);
  }
  if (!ALLOWED_SOURCES.includes(source)) {
    throw new Error(`${label}.source must be one of ${ALLOWED_SOURCES.join('|')}`);
  }
  if (reference.sample_id !== undefined) {
    const sample = findHumanSample(reference.sample_id);
    if (!sample) throw new Error(`${label}.sample_id not found in data/style/human-samples.json: ${reference.sample_id}`);
    if (normalizeSampleText(reference.text) !== normalizeSampleText(sample.text)) {
      throw new Error(`${label}.text must match sample_id ${reference.sample_id} verbatim`);
    }
    if (source !== sample.source) throw new Error(`${label}.source must match sample_id source (${sample.source})`);
    return reference;
  }
  if (source === 'public-domain') {
    throw new Error(`${label} with source=public-domain needs sample_id from data/style/human-samples.json`);
  }
  if (typeof reference.author !== 'string' || !reference.author.trim()) {
    throw new Error(`${label} needs author for source=${source}`);
  }
  if (typeof reference.license !== 'string' || !reference.license.trim()) {
    throw new Error(`${label} needs license for source=${source}`);
  }
  if (reference.user_confirmed !== true) {
    throw new Error(`${label} needs user_confirmed: true; only a human user can confirm a sample`);
  }
  return reference;
}

export {
  ALLOWED_SOURCES,
  findHumanSample,
  loadHumanSamples,
  normalizeSampleText,
  validateReferenceSample,
};
