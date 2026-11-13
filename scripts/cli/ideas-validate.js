// `ideas validate` handlers: one saved idea or --all, with optional --output/--ignore.
import fs from 'node:fs';
import path from 'node:path';
import { loadProject, readSection } from '../project.js';
import { readJson } from '../util.js';
import { validateIdeaDraw } from '../ideas.js';
import { EXIT_BLOCKING, EXIT_OK, boolFlag, enumFlag, maxFindingsFlag, print, stringFlag, usageFail } from './args.js';
import { SEVERITY_VALUES } from './spec.js';

function createValidateEmitter(output) {
  return (payload, code) => {
    if (output && output !== '-') {
      const file = path.resolve(output);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temp = `${file}.tmp-${process.pid}`;
      try {
        fs.writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        fs.renameSync(temp, file);
      } catch (error) {
        fs.rmSync(temp, { force: true });
        throw error;
      }
      print({ ok: payload.ok, action: payload.action, output: file, count: payload.count, total_findings: payload.total_findings });
    } else {
      print(payload);
    }
    return code;
  };
}

function validateAllIdeas(project, options) {
  const list = readSection(project, 'ideas').results || [];
  const results = list.map((item) => {
    const draw = readSection(project, 'idea', { id: item.id }).draw;
    const result = validateIdeaDraw(draw, options);
    return {
      id: item.id,
      ok: result.ok,
      total_findings: result.findings.length,
      ignored_findings: result.ignored_findings,
      ignored_rules: result.ignored_rules,
      findings: options.maxFindings ? result.findings.slice(0, options.maxFindings) : result.findings,
    };
  });
  const ok = results.every((item) => item.ok);
  const ignoredFindings = results.reduce((sum, item) => sum + (item.ignored_findings || 0), 0);
  const ignoredRules = results.reduce((aggregate, item) => {
    for (const [rule, count] of Object.entries(item.ignored_rules || {})) {
      aggregate[rule] = (aggregate[rule] || 0) + count;
    }
    return aggregate;
  }, {});
  return { schema_version: 1, ok, section: 'ideas', action: 'validate-all', count: results.length, ignored_findings: ignoredFindings, ignored_rules: ignoredRules, results };
}

function validateOneIdea(project, id, options) {
  const draw = readSection(project, 'idea', { id }).draw;
  const result = validateIdeaDraw(draw, options);
  const findings = options.maxFindings ? result.findings.slice(0, options.maxFindings) : result.findings;
  return { schema_version: 1, ok: result.ok, section: 'ideas', action: 'validate', id, total_findings: result.findings.length, ignored_findings: result.ignored_findings, ignored_rules: result.ignored_rules, findings };
}

function runIdeasValidate(flags) {
  const project = loadProject(stringFlag(flags, 'dir', ''));
  const minSeverity = enumFlag(flags, 'min-severity', SEVERITY_VALUES, 'low');
  const maxFindings = maxFindingsFlag(flags);
  const ignoreFile = stringFlag(flags, 'ignore-file', '');
  let fileIgnore = [];
  if (ignoreFile) {
    const doc = readJson(path.resolve(ignoreFile));
    fileIgnore = Array.isArray(doc) ? doc : (doc.rules || []);
  }
  const ignoreRules = [
    ...stringFlag(flags, 'ignore', '').split(',').map((rule) => rule.trim()).filter(Boolean),
    ...fileIgnore.map((rule) => String(rule || '').trim()).filter(Boolean),
  ];
  const output = stringFlag(flags, 'output', '');
  const emit = createValidateEmitter(output);
  const options = { minSeverity, maxFindings, ignoreRules };
  const strict = boolFlag(flags, 'strict');
  if (boolFlag(flags, 'all')) {
    const payload = validateAllIdeas(project, options);
    return emit(payload, strict && !payload.ok ? EXIT_BLOCKING : EXIT_OK);
  }
  const id = stringFlag(flags, 'id', '');
  if (!id) usageFail('ideas validate requires --id or --all', 'example: ideas validate --id outlinepack-7-... --dir <project>');
  const payload = validateOneIdea(project, id, options);
  return emit(payload, strict && !payload.ok ? EXIT_BLOCKING : EXIT_OK);
}

export { runIdeasValidate };
