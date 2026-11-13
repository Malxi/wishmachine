// help text: the global command list plus scoped usage for one command topic.
// Global output stays stable for the CLI contract tests; scoped help is chosen by
// the positional command path (e.g. `book write --help` or `ideas validate --help`).
import { COMMAND_FLAGS } from './spec.js';
import { VERSION } from './version.js';

const COMMAND_USAGE = {
  help: 'Usage: wishmachine help\n\nPrint the global command list.',
  version: 'Usage: wishmachine version\n\nPrint the CLI version.',
  state: 'Usage: wishmachine state [--dir <dir>] [--view brief|full]\n\nPrint the project status snapshot, including state.next.',
  audit: 'Usage: wishmachine audit [--dir <dir>] [--view brief|summary|full] [--min-severity ...] [--max-findings all|<n>] [--ignore rule_id,...] [--ignore-file <json>] [--no-strict]\n\nCheck every artifact that exists; exits 2 when a blocking finding is found. --view summary prints only totals and failing targets.',
  refresh: 'Usage: wishmachine refresh [setup|outline|all] [--dir <dir>]\n\nRebuild the markdown companions from the JSON artifacts.',
  export: 'Usage: wishmachine export [--dir <dir>] [--output <file>] [--format book|plain|html] [--force]\n\nExport the manuscript: book (default drafts/manuscript.md), plain (drafts/manuscript-plain.md) or a self-contained reader page (drafts/manuscript.html).',
  doctor: 'Usage: wishmachine doctor [--dir <dir>] [--fix] [--no-strict]\n\nReport layout/config/JSON/registry problems; --fix repairs what it can.',
  check: 'Usage: wishmachine check [--profile quality|schema|custom|all] [--target setup|outline|chapter|craft|recap] [--id <id>] [--min-severity ...] [--max-findings all|<n>] [--ignore rule_id,...] [--ignore-file <json>] [--no-strict] [--dir <dir>]\n\nExit codes: 0 ok, 1 usage error, 2 blocking findings. Missing or corrupt artifacts return artifact.<target>.missing / artifact.<target>.invalid_json findings.',
  book: 'Usage: wishmachine book <init|status|read|write|registry> [options] [--dir <dir>]\n\nCreate and maintain a book project: init a project, read artifacts, write validated artifacts, maintain the registry.',
  'book init': 'Usage: wishmachine book init <name> [--dir <dir>] [--parts 1] [--volumes 1] [--chapter 20] [--chapter-chars 3000] [--min-chars 1800] [--genre "科幻,奇幻"] [--language zh]\n\nCreate a new project (novel.json, artifact directories and a setup placeholder). --genre accepts a comma/、/separated list.',
  'book status': 'Usage: wishmachine book status [--dir <dir>] [--json]\n\nPrint the current step and (with --json) the status payload.',
  'book read': 'Usage: wishmachine book read <setup|outline|craft|chapter|recap|context|logs|ideas|idea|research|graph> [--id <id>] [--view summary|index|full] [--dir <dir>]\n\nRead one artifact (chapter/recap/craft require --id).',
  'book write': 'Usage: wishmachine book write <setup|outline|craft|chapter|recap|research> [--mode replace|patch|append] [--apply] [--id <id>] [--target <kind>] [--from-idea <id>] [--max-issues <n>] [--dir <dir>]\n\nValidate a candidate from stdin and write it unless a blocking finding stops it (--apply required for JSON artifacts). setup/outline writes rebuild the derived thread/mystery registries automatically.',
  'book registry': 'Usage: wishmachine book registry [clean|log|undo|redo|backups|check-backups|backup|restore|abandon] [options] [--dir <dir>]\n\nInspect and maintain the setup/outline registry; subcommands manage operations, backups and abandoned mysteries.',
  ideas: 'Usage: wishmachine ideas <draw|import|discover|search|validate|types> [options] [--dir <dir>]\n\nDraw deterministic idea cards and validate saved draws.',
  'ideas draw': 'Usage: wishmachine ideas draw --type <type> [--count <n>] [--seed <n>] [--genre <genre>] [--output <file>] [--dir <dir> --save]\n\noutlinepack/worldpack/plotpack accept type-specific options (e.g. --chapters, --volumes, --cast-count).',
  'ideas import': 'Usage: wishmachine ideas import --file <cards.json> [--dir <dir>] [--type <type>] [--source <source>]\n\nImport external idea cards into the project.',
  'ideas discover': 'Usage: wishmachine ideas discover [--topic history|myth|novel] [--limit 3] [--dir <dir>]\n\nDiscover source material for the project.',
  'ideas search': 'Usage: wishmachine ideas search --query <text> [--provider wikipedia|gutenberg] [--limit 3] [--ingest] [--dir <dir>]\n\nSearch external sources; --ingest saves the results as idea cards.',
  'ideas validate': 'Usage: wishmachine ideas validate --id <saved-idea-id> | --all [--strict] [--min-severity ...] [--max-findings all|<n>] [--ignore rule_id,...] [--ignore-file <json>] [--output <file|->] [--dir <dir>]\n\nValidate saved draws; --ignore/--ignore-file take a JSON array or {"rules":[...]}.',
  'ideas types': 'Usage: wishmachine ideas types\n\nList the available idea types.',
  gen: 'Usage: wishmachine gen <workflow|skill|reference> list|read <name>\n\nRead bundled guides (workflows, the skill manifest, references).',
  'gen workflow': 'Usage: wishmachine gen workflow list\n       wishmachine gen workflow read <name>\n\nRead bundled authoring workflows.',
  'gen skill': 'Usage: wishmachine gen skill list\n       wishmachine gen skill read <name>\n\nRead the bundled skill manifest.',
  'gen reference': 'Usage: wishmachine gen reference list\n       wishmachine gen reference read <name>\n\nRead bundled schema/workflow references.',
};

function help() {
  return `wishmachine ${VERSION}

Commands:
  book init <name> [--dir <dir>] [--parts 1] [--volumes 1] [--chapter 20] [--chapter-chars 3000] [--min-chars 1800] [--genre "科幻,奇幻"]
  book status [--dir <dir>] [--json]
  state [--dir <dir>] [--view brief|full]
  audit [--dir <dir>] [--view brief|summary|full] [--min-severity low|medium|high|critical] [--max-findings all|<n>] [--ignore rule_id,...] [--ignore-file <json>] [--no-strict]
  refresh [setup|outline|all] [--dir <dir>]
  export [--dir <dir>] [--output <file>] [--format book|plain|html] [--force]   (default: drafts/manuscript[-plain].md or manuscript.html)
  doctor [--dir <dir>] [--fix] [--no-strict]
  book read <setup|outline|craft|chapter|recap|context|logs|ideas|idea|research|graph> [--id <id>] [--view summary|index|full]
  book registry [--dir <project>]
  book registry clean [--dir <project>] [--dry-run]
  book registry log [--limit 20] [--action abandon|clean] [--since ISO] [--dir <project>]
  book registry undo [--operation <id>] [--dir <project>]
  book registry redo [--operation <id>] [--dir <project>]
  book registry backups [--keep 10] [--prune] [--dir <project>]
  book registry check-backups [--dir <project>]
  book registry backup [--dir <project>]
  book registry restore --backup <name> [--dry-run] [--dir <project>]
  book registry abandon --mystery <id> [--reason <text>] [--dry-run] [--dir <project>]
  book write <setup|outline|craft|chapter|recap|research> [--mode replace|patch|append] [--apply] [--id <id>] [--target <kind>] [--from-idea <id>] [--max-issues <n>]
  check [--profile quality|schema|custom|all] [--target setup|outline|chapter|craft|recap] [--id <id>] [--min-severity ...] [--max-findings all|<n>] [--ignore rule_id,...] [--ignore-file <json>] [--no-strict]
  ideas draw --type <type> [--count <n>] [--seed <n>] [--genre <genre>] [--dir <project> --save] [--output <file>]
  ideas draw --type outlinepack [--chapters 10] [--scenes 3] [--target-chars 3000] [--volumes 3] [--chapters-per-volume 10]
  ideas draw --type worldpack|plotpack [--cast-count 4|auto] [--cast-roles protagonist,antagonist,support] [--prompt-chars 800] [--character-prompt-chars 160]
  ideas import --file <cards.json> [--dir <project>] [--type <type>] [--source <source>]
  ideas discover [--topic history|myth|novel] [--limit 3] [--dir <project>]
  ideas search --query <text> [--provider wikipedia|gutenberg] [--limit 3] [--ingest] [--dir <project>]
  ideas validate --id <saved-idea-id> | --all [--strict] [--min-severity ...] [--max-findings all|<n>] [--ignore rule_id,...] [--ignore-file <json>] [--output <file|->] [--dir <project>]
  ideas types
  gen workflow list|read <name>
  gen skill list|read <name>
  gen reference list|read <name>
  version

Output contract:
  stdout is JSON on success; failures also print a JSON error object to stdout
  ({ ok: false, error: { code, message, hint?, fix_command? } }) and a one-line summary to stderr.
  Exit codes: 0 ok, 1 usage/system error, 2 blocking findings.
  --no-strict keeps check/audit/doctor at exit 0; a blocked book write always exits 2.
  Run "wishmachine <command> [subcommand] --help" for command-scoped usage.
`;
}

// Resolve the positional path to a help topic: `book registry log` stays exact,
// while `gen workflow` expands to the leaf topic and falls back to its parent.
function helpTopic(positionals) {
  const [first, second, third] = positionals;
  if (!first) return '';
  if (first === 'book') {
    if (second === 'registry') return third ? `book registry ${third}` : 'book registry';
    return second ? `book ${second}` : 'book';
  }
  if (first === 'ideas') return second ? `ideas ${second}` : 'ideas';
  if (first === 'gen') return second ? `gen ${second} ${third || 'list'}` : 'gen';
  return first;
}

function parentTopic(topic) {
  const index = topic.lastIndexOf(' ');
  return index < 0 ? '' : topic.slice(0, index);
}

function commandHelp(positionals) {
  const requested = helpTopic(positionals);
  let topic = requested;
  while (topic && !COMMAND_USAGE[topic]) topic = parentTopic(topic);
  if (!topic) return help();
  const flags = COMMAND_FLAGS[requested] ?? COMMAND_FLAGS[topic] ?? [];
  const flagLine = flags.length ? `Flags: ${flags.map((flag) => `--${flag}`).join(', ')}` : 'Flags: none';
  return `wishmachine ${VERSION}\n\n${COMMAND_USAGE[topic]}\n\n${flagLine}\n\nRun "wishmachine --help" for the full command list.\n`;
}

export { commandHelp, help };
