// Top-level project commands: state / audit / refresh / export / doctor / check.
import { auditProject, doctorProject, exportManuscript, loadProject, projectState, refreshProject } from '../project.js';
import { checkProject } from '../schema.js';
import {
  CHECK_TARGETS,
  EXIT_OK,
  FORMAT_VALUES,
  PROFILE_VALUES,
  REFRESH_TARGETS,
  SEVERITY_VALUES,
  boolFlag,
  checkExit,
  enumFlag,
  fail,
  maxFindingsFlag,
  print,
  stringFlag,
} from './args.js';

function runState(flags) {
  const view = enumFlag(flags, 'view', ['brief', 'full'], 'brief');
  const project = loadProject(stringFlag(flags, 'dir', ''));
  print(projectState(project, { view }));
  return EXIT_OK;
}

function runAudit(flags) {
  const view = enumFlag(flags, 'view', ['brief', 'full'], 'brief');
  const minSeverity = enumFlag(flags, 'min-severity', SEVERITY_VALUES, '');
  const maxFindings = maxFindingsFlag(flags);
  const project = loadProject(stringFlag(flags, 'dir', ''));
  const result = auditProject(project, { view, minSeverity, maxFindings });
  print(result);
  return boolFlag(flags, 'no-strict') ? EXIT_OK : checkExit(result);
}

function runRefresh(positionals, flags) {
  const target = enumFlag(flags, 'target', REFRESH_TARGETS, positionals[1] || 'all');
  const project = loadProject(stringFlag(flags, 'dir', ''));
  print(refreshProject(project, { target }));
  return EXIT_OK;
}

function runExport(flags) {
  const format = enumFlag(flags, 'format', FORMAT_VALUES, 'book');
  const project = loadProject(stringFlag(flags, 'dir', ''));
  print(exportManuscript(project, {
    output: stringFlag(flags, 'output', ''),
    format,
    force: boolFlag(flags, 'force'),
  }));
  return EXIT_OK;
}

function runDoctor(flags) {
  const project = loadProject(stringFlag(flags, 'dir', ''));
  const result = doctorProject(project, { fix: boolFlag(flags, 'fix') });
  print(result);
  return boolFlag(flags, 'no-strict') ? EXIT_OK : checkExit(result);
}

function runCheck(flags) {
  const profile = enumFlag(flags, 'profile', PROFILE_VALUES, 'all');
  const target = enumFlag(flags, 'target', CHECK_TARGETS, 'outline');
  const id = stringFlag(flags, 'id', '');
  const minSeverity = enumFlag(flags, 'min-severity', SEVERITY_VALUES, '');
  const maxFindings = maxFindingsFlag(flags);
  if (['chapter', 'recap'].includes(target) && !id) {
    fail(`check --target ${target} requires --id`, {
      code: 'check.needs_id',
      hint: `add --id <${target}-id>, e.g. --id P1-V1-C1`,
      fixCommand: `node scripts/wishmachine.js check --dir <project> --target ${target} --id P1-V1-C1`,
    });
  }
  const project = loadProject(stringFlag(flags, 'dir', ''));
  const result = checkProject(project, { profile, target, id, minSeverity, maxFindings });
  print(result);
  return boolFlag(flags, 'no-strict') ? EXIT_OK : checkExit(result);
}

export { runAudit, runCheck, runDoctor, runExport, runRefresh, runState };
