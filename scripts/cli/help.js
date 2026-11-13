// help text (kept byte-identical for the CLI contract tests).
import { VERSION } from './version.js';

function help() {
  return `wishmachine ${VERSION}

Commands:
  book init <name> [--dir <dir>] [--parts 1] [--volumes 1] [--chapter 20] [--chapter-chars 3000] [--min-chars 1800] [--genre ...]
  book status [--dir <dir>] [--json]
  state [--dir <dir>] [--view brief|full]
  audit [--dir <dir>] [--view brief|full] [--min-severity low|medium|high|critical] [--max-findings all|<n>] [--no-strict]
  refresh [setup|outline|all] [--dir <dir>]
  export [--dir <dir>] [--output drafts/manuscript.md] [--format book|plain] [--force]
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
  check [--profile quality|schema|custom|all] [--target setup|outline|chapter|craft|recap] [--id <id>] [--min-severity ...] [--max-findings all|<n>] [--no-strict]
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
`;
}

export { help };
