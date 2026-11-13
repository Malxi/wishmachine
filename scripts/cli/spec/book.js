// Flag specification for `book` subcommands.
const BOOK_COMMAND_FLAGS = {
  'book init': ['dir', 'parts', 'volumes', 'chapter', 'chapter-chars', 'min-chars', 'genre', 'language'],
  'book status': ['dir', 'json'],
  'book registry': ['dir'],
  'book registry clean': ['dir', 'dry-run'],
  'book registry log': ['dir', 'limit', 'action', 'since'],
  'book registry undo': ['dir', 'operation'],
  'book registry redo': ['dir', 'operation'],
  'book registry backups': ['dir', 'keep', 'prune'],
  'book registry check-backups': ['dir'],
  'book registry backup': ['dir'],
  'book registry restore': ['dir', 'backup', 'dry-run'],
  'book registry abandon': ['dir', 'mystery', 'reason', 'dry-run'],
  'book read': ['dir', 'id', 'view'],
  'book write': ['dir', 'mode', 'apply', 'id', 'target', 'from-idea', 'max-issues'],
};

export { BOOK_COMMAND_FLAGS };
