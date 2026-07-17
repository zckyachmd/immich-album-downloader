export const commonOptions = {
  all: {
    type: "boolean",
    default: false,
    describe: "Download all albums",
    alias: "a",
  },
  concurrency: {
    type: "number",
    describe:
      "Number of concurrent downloads (default: 5, can be set via IMMICH_CONCURRENCY env var)",
    alias: "c",
  },
  exclude: {
    type: "string",
    describe: "Exclude albums with this name (case-insensitive)",
    alias: "e",
  },
  "dry-run": {
    type: "boolean",
    default: false,
    describe: "Simulate the backup process (no downloads)",
    alias: "d",
  },
  "limit-size": {
    type: "number",
    describe: "Limit file size in MB for the download (default: no limit)",
    alias: "l",
  },
  "max-retries": {
    type: "number",
    describe: "Maximum number of retries (default: 3, can be set via IMMICH_MAX_RETRIES env var)",
    alias: "r",
  },
  only: {
    type: "string",
    describe: "Only include albums with this name (case-insensitive)",
  },
  output: {
    type: "string",
    describe: "Custom output directory (default: ./media-downloads)",
    alias: "o",
  },
  force: {
    type: "boolean",
    default: false,
    describe: "Force re-download even if files exist",
    alias: "f",
  },
  "resume-failed": {
    type: "boolean",
    default: false,
    describe: "Only retry previously failed downloads",
    alias: "R",
  },
  verbose: {
    alias: "v",
    type: "boolean",
    default: false,
    describe: "Enable detailed logging output",
  },
  "cleanup-db": {
    type: "number",
    describe: "Clean up database records older than N days (default: 90, only failed records)",
  },
  "cleanup-db-all": {
    type: "boolean",
    default: false,
    describe: "Clean up all old records (not just failed) when using --cleanup-db",
  },
  "backup-db": {
    type: "string",
    describe: "Create database backup to specified path (or auto-generate if path ends with '/')",
  },
  "restore-db": {
    type: "string",
    describe: "Restore database from backup file path",
  },
  "list-backups": {
    type: "boolean",
    default: false,
    describe: "List all available database backups",
  },
  help: {
    type: "boolean",
    default: false,
    describe: "Show help message and exit",
    alias: "h",
  },
};
