// Voice card artifact: the project-level "how this book sounds" contract.
// Stored at story/style/voice.json; validated on write and summarized on read.

const MAX_SAMPLES = 5;
const MAX_SAMPLE_CHARS = 4000;
const MAX_AVOID = 50;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateStringList(value, label) {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of strings`);
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) throw new Error(`${label} must contain non-empty strings`);
  }
}

function validateSamples(value, label) {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (value.length > MAX_SAMPLES) throw new Error(`${label} supports at most ${MAX_SAMPLES} samples`);
  for (const sample of value) {
    if (!isPlainObject(sample)) throw new Error(`${label} samples must be objects`);
    if (typeof sample.text !== 'string' || !sample.text.trim()) throw new Error(`${label} samples need a text string`);
    if (sample.text.length > MAX_SAMPLE_CHARS) throw new Error(`${label} sample text is too long (max ${MAX_SAMPLE_CHARS} chars)`);
    if (sample.label !== undefined && typeof sample.label !== 'string') throw new Error(`${label} sample label must be a string`);
  }
}

function validateVoiceCard(card) {
  if (!isPlainObject(card)) throw new Error('voice card must be a JSON object');
  if (card.version !== 1) throw new Error('voice card version must be 1');
  if (card.narrative !== undefined && !isPlainObject(card.narrative)) throw new Error('narrative must be an object');
  if (card.voice !== undefined) {
    if (!isPlainObject(card.voice)) throw new Error('voice must be an object');
    if (card.voice.description !== undefined && typeof card.voice.description !== 'string') throw new Error('voice.description must be a string');
    validateStringList(card.voice.principles, 'voice.principles');
    validateStringList(card.voice.avoid, 'voice.avoid');
    if (Array.isArray(card.voice.avoid) && card.voice.avoid.length > MAX_AVOID) throw new Error(`voice.avoid supports at most ${MAX_AVOID} entries`);
  }
  validateSamples(card.samples, 'samples');
  validateSamples(card.negative_samples, 'negative_samples');
  if (card.baseline !== undefined && !isPlainObject(card.baseline)) throw new Error('baseline must be an object');
  if (card.history !== undefined && !Array.isArray(card.history)) throw new Error('history must be an array');
  return card;
}

function voiceCardSummary(card) {
  if (!card) return { present: false };
  return {
    present: true,
    version: card.version,
    description: card.voice?.description || '',
    principles: card.voice?.principles || [],
    avoid: card.voice?.avoid || [],
    samples: (card.samples || []).length,
    negative_samples: (card.negative_samples || []).length,
    baseline: card.baseline || null,
    history: (card.history || []).length,
  };
}

export { MAX_SAMPLES, validateVoiceCard, voiceCardSummary };
