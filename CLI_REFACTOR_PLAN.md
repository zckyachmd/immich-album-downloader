# CLI Refactor Plan

Goal: make `immich-album-downloader` feel like production-grade interactive CLI app for `npx`, `bunx`, `pnpx`, and direct Bun usage.

## Desired behavior

- [x] Running `npx immich-album-downloader` with no config starts an interactive setup wizard.
- [x] Running with flags bypasses stored config for those values.
- [x] Running with existing `.env` uses it without prompting.
- [x] Missing required config prompts only when terminal is interactive.
- [x] Missing required config in non-interactive mode fails with clear error and examples.
- [x] Valid prompt result is tested against Immich before saving.
- [x] Valid prompt result can be saved to `.env`.
- [x] Existing `.env` is merged safely, not overwritten blindly.
- [x] `--reset-config` clears saved Immich config and starts setup again.
- [x] `--no-interactive` disables prompts.

## Config priority

- [x] Use priority order:
  1. CLI flags
  2. Existing `.env` / process env
  3. Interactive prompt
  4. Defaults for optional values only

## New CLI flags

- [x] Add `--base-url <url>` for Immich base URL.
- [x] Add `--api-key <key>` for Immich API key.
- [x] Add `--no-interactive` to fail instead of prompt.
- [x] Add `--reset-config` to remove saved Immich config and prompt again.
- [x] Add `--save-config` if explicit save control is preferred.
- [x] Keep existing flags working:
  - [x] `--all`
  - [x] `--only`
  - [x] `--exclude`
  - [x] `--output`
  - [x] `--concurrency`
  - [x] `--max-retries`
  - [x] `--limit-size`
  - [x] `--dry-run`
  - [x] `--force`
  - [x] `--resume-failed`
  - [x] database maintenance flags

## Target architecture

```text
src/
  main.ts                    # shebang/process boundary only
  index.ts                   # public exports
  app.ts                     # app orchestration, returns exit code
  cli/
    index.ts                 # CLI parse entry
    options.ts               # yargs option schema
    prompts.ts               # interactive setup wizard
    configFile.ts            # .env read/write/reset/merge
    databaseCommands.ts      # DB command routing, no process.exit
  core/
    downloader.ts            # downloader usecase, config passed in
  lib/
    api.ts                   # Immich API calls, config passed in
    config.ts                # config types + validation + resolution
    health.ts                # health check, config passed in
    download.ts              # album download, config passed in where needed
    db.ts
    logger.ts
    errors.ts
    helpers.ts
    fetchConfig.ts
    cancellation.ts
```

## Phase 1: remove global config side effects

- [x] Replace `export const config = validateConfig()` in `src/lib/config.ts`.
- [x] Export config type, defaults, validators, and resolver functions instead.
- [x] Make importing `src/lib/config.ts` safe without env.
- [x] Move env validation from import time to runtime.
- [x] Remove hard dependency on `dotenv/config` from `src/app.ts`.
- [x] Load `.env` explicitly inside config resolution.

Suggested API:

```ts
export type AppConfig = {
  apiKey: string;
  baseUrl: string;
  defaultOutput: string;
  sslVerify: boolean;
  concurrency: number;
  maxRetries: number;
  downloadTimeout: number;
};

export function validateConfig(input: Partial<AppConfig>): AppConfig;
export async function resolveConfig(argv: CliArgs): Promise<AppConfig>;
```

## Phase 2: config file management

- [x] Create `src/cli/configFile.ts`.
- [x] Detect `.env` in current working directory.
- [x] Read existing `.env` if present.
- [x] Preserve unknown keys.
- [x] Merge only known Immich keys.
- [x] Write file atomically enough for CLI use.
- [x] Add reset helper for known keys.
- [x] Avoid logging API key.

Known keys:

- [x] `IMMICH_BASE_URL`
- [x] `IMMICH_API_KEY`
- [x] `DEFAULT_OUTPUT`
- [x] `IMMICH_SSL_VERIFY`
- [x] `IMMICH_CONCURRENCY`
- [x] `IMMICH_MAX_RETRIES`
- [x] `IMMICH_DOWNLOAD_TIMEOUT`

Reset behavior options:

- [x] Minimal reset: remove known keys from `.env`, preserve file.
- [x] If `.env` only contains known keys, delete `.env`.
- [x] If user passes `--reset-config`, run reset then continue into wizard.

## Phase 3: interactive wizard

- [x] Create `src/cli/prompts.ts`.
- [x] Prompt only when `process.stdin.isTTY` and `--no-interactive` is not set.
- [x] Ask for base URL.
- [x] Ask for API key as password input.
- [x] Ask for output directory.
- [x] Ask for concurrency.
- [x] Ask for max retries.
- [x] Ask whether to save config to `.env`.
- [x] Do local validation before health check.
- [x] Do health check before saving.
- [x] Re-prompt on invalid values.

Prompt defaults:

- [x] `DEFAULT_OUTPUT=./downloads`
- [x] `IMMICH_CONCURRENCY=5`
- [x] `IMMICH_MAX_RETRIES=3`
- [x] `IMMICH_DOWNLOAD_TIMEOUT=30000`
- [x] `IMMICH_SSL_VERIFY=true`

## Phase 4: validation rules

- [x] `baseUrl` must be valid URL.
- [x] Normalize trailing slash.
- [x] Preserve `/api` if user includes it.
- [x] `apiKey` must be non-empty and long enough.
- [x] `concurrency` must be `1..50`.
- [x] `maxRetries` must be `0..10`.
- [x] `downloadTimeout` must be `5000..600000`.
- [x] `output` must be string path.
- [x] Never save config until health check passes.

## Phase 5: inject config through app

- [x] Change `run(argv)` to resolve config first.
- [x] Pass config into `runDownloader(argv, config)`.
- [x] Pass config into `checkHealth(config)`.
- [x] Pass config into API calls or create API client.
- [x] Avoid module-level `const API_KEY = config.apiKey`.
- [x] Avoid module-level `const BASE_URL = config.baseUrl`.

Preferred small step:

```ts
export async function getAlbums(config: AppConfig) {}
export async function getAssetsByAlbumId(config: AppConfig, albumId: string) {}
export async function downloadAssetById(config: AppConfig, assetId: string, destPath: string, retries = 3) {}
```

Later optional cleanup:

```ts
export function createImmichClient(config: AppConfig) {
  return { getAlbums, getAssetsByAlbumId, downloadAssetById };
}
```

## Phase 6: process boundary cleanup

- [x] `src/main.ts` owns `process.exit`.
- [x] `app.run()` returns exit code.
- [x] `handleFatalError()` returns exit code or throws normalized error.
- [x] `databaseCommands.ts` stops calling `process.exit`.
- [x] `downloader.ts` stops calling `process.exit`.
- [x] Cancellation returns `130` from app boundary.
- [x] Validation failure returns `1`.
- [x] Success returns `0`.

## Phase 7: database command behavior

- [x] DB maintenance commands still bypass downloader flow.
- [x] DB commands do not require Immich API config.
- [x] DB commands can run without `.env`.
- [x] `--cleanup-db` validates numeric range.
- [x] `--backup-db` handles directory path.
- [x] `--restore-db` keeps warning before destructive action.
- [x] `--list-backups` returns success exit code.

## Phase 8: package readiness

- [x] Decide Bun-only or Node-compatible distribution.
- [x] If Bun-only, keep `#!/usr/bin/env bun` and document Bun requirement.
- [ ] If npm/npx production-grade, ship built `dist` files.
- [ ] Point `bin` to built CLI entry.
- [ ] Point `exports` to built library entry.
- [x] Include only needed files in package.
- [x] Add `prepublishOnly` or release build check.

Possible future package shape:

```json
{
  "bin": {
    "immich-album-downloader": "./dist/main.js"
  },
  "exports": {
    ".": "./dist/index.js"
  },
  "files": ["dist", "README.md", "USAGE.md"]
}
```

## Phase 9: tests

- [ ] Move tests toward CLI-oriented structure:

```text
test/
  unit/
    config.test.ts
    configFile.test.ts
    validation.test.ts
  cli/
    configResolution.test.ts
    resetConfig.test.ts
  integration/
    appConfigFlow.test.ts
  fixtures/
    env.complete
    env.partial
    env.empty
```

- [x] Test import of config module without env does not throw.
- [x] Test missing config prompts in interactive mode.
- [x] Test missing config errors in non-interactive mode.
- [x] Test flags override `.env`.
- [x] Test reset removes known keys.
- [x] Test `.env` merge preserves unknown keys.
- [x] Test invalid prompt result is not saved.
- [x] Test health check failure is not saved.
- [x] Test DB commands do not need Immich config.

## Phase 10: migration notes

- [x] Existing `.env` users continue working.
- [x] Existing env var names continue working.
- [x] Existing download scripts continue working.
- [x] First-run user gets guided setup.
- [x] Non-interactive CI gets deterministic error.
- [x] API key never printed.

## Recommended implementation order

- [x] 1. Make config import side-effect free.
- [x] 2. Add config resolver with argv/env/default priority.
- [x] 3. Add prompt flow for missing required config.
- [x] 4. Add `.env` read/write/reset helper.
- [x] 5. Validate with health check before saving.
- [x] 6. Inject config into health/API/downloader.
- [x] 7. Remove `process.exit` outside `main.ts`.
- [x] 8. Add remaining tests for resolver and config file behavior.
- [ ] 9. Update package `bin`/build strategy.
- [x] 10. Update README/USAGE after behavior stabilizes.

## Done criteria

- [x] `bun test` passes.
- [x] `bun run typecheck` passes.
- [x] Fresh clone with no `.env` starts wizard in TTY.
- [x] `--no-interactive` fails cleanly without `.env`.
- [x] `.env` writes only after successful validation and health check.
- [x] `--reset-config` resets saved config and re-prompts.
- [x] CLI flags override saved config.
- [x] DB commands work without Immich config.
- [x] No secret appears in logs.
