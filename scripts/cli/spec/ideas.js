// Flag specification for `ideas` subcommands.
const IDEAS_COMMAND_FLAGS = {
  'ideas draw': ['dir', 'type', 'genre', 'count', 'seed', 'source', 'chapters', 'scenes', 'target-chars', 'volumes', 'chapters-per-volume', 'cast-count', 'cast-roles', 'prompt-chars', 'character-prompt-chars', 'save', 'output'],
  'ideas import': ['dir', 'file', 'type', 'genre', 'source'],
  'ideas discover': ['dir', 'topic', 'limit'],
  'ideas search': ['dir', 'query', 'provider', 'limit', 'ingest'],
  'ideas validate': ['dir', 'id', 'all', 'strict', 'min-severity', 'max-findings', 'ignore', 'ignore-file', 'output'],
  'ideas types': [],
};

export { IDEAS_COMMAND_FLAGS };
