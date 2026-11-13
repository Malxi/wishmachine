// `gen` command handlers: read bundled workflows / skills / references.
import { listReferences, listSkills, listWorkflows, readReference, readSkill, readWorkflow } from '../guides.js';
import { EXIT_ERROR, EXIT_OK, print, usageFail } from './args.js';

function runGen(args) {
  const group = args[0];
  const sub = args[1] || 'list';
  const name = args[2];
  if (group === 'workflow') {
    if (sub === 'list') {
      print({ ok: true, section: 'workflow', count: listWorkflows().length, results: listWorkflows() });
      return EXIT_OK;
    }
    if (sub === 'read') {
      if (!name) usageFail('gen workflow read requires a name', `workflows: ${listWorkflows().map((item) => item.name).join(', ')}`);
      print({ ok: true, section: 'workflow', count: 1, results: [{ name, content: readWorkflow(name) }] });
      return EXIT_OK;
    }
  }
  if (group === 'skill') {
    if (sub === 'list') {
      print({ ok: true, section: 'skill', count: listSkills().length, results: listSkills() });
      return EXIT_OK;
    }
    if (sub === 'read') {
      if (!name) usageFail('gen skill read requires a name', `skills: ${listSkills().map((item) => item.name).join(', ')}`);
      print({ ok: true, section: 'skill', count: 1, results: [{ name, content: readSkill(name) }] });
      return EXIT_OK;
    }
  }
  if (group === 'reference') {
    if (sub === 'list') {
      print({ ok: true, section: 'reference', count: listReferences().length, results: listReferences() });
      return EXIT_OK;
    }
    if (sub === 'read') {
      if (!name) usageFail('gen reference read requires a name', `references: ${listReferences().map((item) => item.name).join(', ')}`);
      print({ ok: true, section: 'reference', count: 1, results: [{ name, content: readReference(name) }] });
      return EXIT_OK;
    }
  }
  usageFail(`unknown gen command: ${args.join(' ') || '(none)'}`, 'groups: workflow|skill|reference; subcommands: list|read <name>');
  return EXIT_ERROR;
}

export { runGen };
