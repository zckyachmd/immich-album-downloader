export const commonOptions = {
  all: {
    type: "boolean",
    default: false,
    describe: "Download all albums",
    alias: "a",
  },
  concurrency: {
    type: "number",
    default: 5,
    describe: "Number of concurrent downloads (default: 5)",
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
    default: 3,
    describe: "Maximum number of retries (default: 3)",
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
  },
  verbose: {
    alias: "v",
    type: "boolean",
    default: false,
    describe: "Enable detailed logging output",
  },
};
