// Flag specification for top-level project commands (state/audit/refresh/export/doctor/check/version/help).
const PROJECT_COMMAND_FLAGS = {
  version: [],
  help: [],
  state: ['dir', 'view'],
  audit: ['dir', 'view', 'profile', 'min-severity', 'max-findings', 'ignore', 'ignore-file', 'no-strict'],
  refresh: ['dir', 'target'],
  export: ['dir', 'output', 'format', 'force'],
  doctor: ['dir', 'fix', 'no-strict'],
  check: ['dir', 'profile', 'target', 'id', 'min-severity', 'max-findings', 'ignore', 'ignore-file', 'no-strict'],
};

export { PROJECT_COMMAND_FLAGS };
