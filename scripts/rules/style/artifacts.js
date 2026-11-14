// Style provenance checks: legacy setup.writing_style, missing/invalid style
// artifacts and AI-authored voice samples.
import fs from 'node:fs';
import { setupFile, styleVoiceFile, styleWritingFile } from '../../paths.js';
import { finding } from '../finding.js';
import { validateWritingStyle } from '../../style-card.js';
import { validateReferenceSample } from '../../style-samples.js';

function readOptionalJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function styleArtifactFindings(project) {
  const findings = [];
  const setup = readOptionalJson(setupFile(project.dir));
  if (setup?.writing_style) {
    findings.push(finding(
      'style.setup.writing_style_deprecated',
      'medium',
      'setup.writing_style should live in story/style/writing-style.json',
      'setup',
      'Move the object to story/style/writing-style.json and remove it from setup; move per-chapter beats to the outline.',
    ));
  }
  const styleFile = styleWritingFile(project.dir);
  if (!fs.existsSync(styleFile)) {
    findings.push(finding(
      'style.writing_style.missing',
      'low',
      'story/style/writing-style.json is missing',
      'style',
      'Create it with book write writing-style --apply < writing-style.json; references must be verbatim human/public-domain excerpts.',
    ));
  } else {
    try {
      validateWritingStyle(JSON.parse(fs.readFileSync(styleFile, 'utf8')));
    } catch (error) {
      findings.push(finding('style.writing_style.invalid', 'medium', `writing style is invalid: ${error.message}`, 'style'));
    }
  }
  const voice = readOptionalJson(styleVoiceFile(project.dir));
  const positiveSamples = Array.isArray(voice?.samples) ? voice.samples : [];
  const invalidSamples = [];
  for (const [index, sample] of positiveSamples.entries()) {
    try {
      validateReferenceSample(sample, `samples[${index}]`);
    } catch (error) {
      invalidSamples.push(error.message);
    }
  }
  if (invalidSamples.length > 0) {
    findings.push(finding(
      'style.voice.sample_source',
      'medium',
      `${invalidSamples.length}/${positiveSamples.length} voice samples are not human/public-domain: ${invalidSamples[0]}`,
      'voice',
      'Use a built-in sample_id from data/style/human-samples.json, or a user-confirmed human/licensed excerpt; keep AI text only in negative_samples.',
    ));
  }
  return findings;
}

export { styleArtifactFindings };
