# CLI Refactor Plan

Goal: make `immich-album-downloader` feel like production-grade interactive CLI app for `npx`, `bunx`, `pnpx`, and direct Bun usage.

## Desired behavior

- [ ] Running `npx immich-album-downloader` with no config starts an interactive setup wizard.
- [ ] Running with flags bypasses stored config for those values.
- [ ] Running with existing `.env` uses it without prompting.
- [ ] Missing required config prompts only when terminal is interactive.
- [ ] Missing required config in non-interactive mode fails with clear error and examples.
- [ ] Valid prompt result is tested against Immich before saving.
- [ ] Valid prompt result can be saved to `.env`.
- [ ] Existing `.env` is merged safely, not overwritten blindly.
- [ ] `--reset-config` clears saved Immich config and starts setup again.
- [ ] `--no-interactive` disables prompts.

## Config priority

- [ ] Use priority order:
  1. CLI flags
  2. Existing `.env` / process env
  3. Interactive prompt
  4. Defaults for optional values only

## New CLI flags

- [ ] Add `--base-url <url>` for Immich base URL.
- [ ] Add `--api-key <key>` for Immich API key.
- [ ] Add `--no-interactive` to fail instead of prompt.
- [ ] Add `--reset-config` to remove saved Immich config and prompt again.
- [ ] Add `--save-config` if explicit save control is preferred.
- [ ] Keep existing flags working:
  - [ ] `--all`
  - [ ] `--only`
  - [ ] `--exclude`
  - [ ] `--output`
  - [ ] `--concurrency`
  - [ ] `--max-retries`
  - [ ] `--limit-size`
  - [ ] `--dry-run`
  - [ ] `--force`
  - [ ] `--resume-failed`
  - [ ] database maintenance flags

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

- [ ] Replace `export const config = validateConfig()` in `src/lib/config.ts`.
- [ ] Export config type, defaults, validators, and resolver functions instead.
- [ ] Make importing `src/lib/config.ts` safe without env.
- [ ] Move env validation from import time to runtime.
- [ ] Remove hard dependency on `dotenv/config` from `src/app.ts`.
- [ ] Load `.env` explicitly inside config resolution.

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

- [ ] Create `src/cli/configFile.ts`.
- [ ] Detect `.env` in current working directory.
- [ ] Read existing `.env` if present.
- [ ] Preserve unknown keys.
- [ ] Merge only known Immich keys.
- [ ] Write file atomically enough for CLI use.
- [ ] Add reset helper for known keys.
- [ ] Avoid logging API key.

Known keys:

- [ ] `IMMICH_BASE_URL`
- [ ] `IMMICH_API_KEY`
- [ ] `DEFAULT_OUTPUT`
- [ ] `IMMICH_SSL_VERIFY`
- [ ] `IMMICH_CONCURRENCY`
- [ ] `IMMICH_MAX_RETRIES`
- [ ] `IMMICH_DOWNLOAD_TIMEOUT`

Reset behavior options:

- [ ] Minimal reset: remove known keys from `.env`, preserve file.
- [ ] If `.env` only contains known keys, delete `.env`.
- [ ] If user passes `--reset-config`, run reset then continue into wizard.

## Phase 3: interactive wizard

- [ ] Create `src/cli/prompts.ts`.
- [ ] Prompt only when `process.stdin.isTTY` and `--no-interactive` is not set.
- [ ] Ask for base URL.
- [ ] Ask for API key as password input.
- [ ] Ask for output directory.
- [ ] Ask for concurrency.
- [ ] Ask for max retries.
- [ ] Ask whether to save config to `.env`.
- [ ] Do local validation before health check.
- [ ] Do health check before saving.
- [ ] Re-prompt on invalid values.

Prompt defaults:

- [ ] `DEFAULT_OUTPUT=./downloads`
- [ ] `IMMICH_CONCURRENCY=5`
- [ ] `IMMICH_MAX_RETRIES=3`
- [ ] `IMMICH_DOWNLOAD_TIMEOUT=30000`
- [ ] `IMMICH_SSL_VERIFY=true`

## Phase 4: validation rules

- [ ] `baseUrl` must be valid URL.
- [ ] Normalize trailing slash.
- [ ] Preserve `/api` if user includes it.
- [ ] `apiKey` must be non-empty and long enough.
- [ ] `concurrency` must be `1..50`.
- [ ] `maxRetries` must be `0..10`.
- [ ] `downloadTimeout` must be `5000..600000`.
- [ ] `output` must be string path.
- [ ] Never save config until health check passes.

## Phase 5: inject config through app

- [ ] Change `run(argv)` to resolve config first.
- [ ] Pass config into `runDownloader(argv, config)`.
- [ ] Pass config into `checkHealth(config)`.
- [ ] Pass config into API calls or create API client.
- [ ] Avoid module-level `const API_KEY = config.apiKey`.
- [ ] Avoid module-level `const BASE_URL = config.baseUrl`.

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

- [ ] Decide Bun-only or Node-compatible distribution.
- [ ] If Bun-only, keep `#!/usr/bin/env bun` and document Bun requirement.
- [ ] If npm/npx production-grade, ship built `dist` files.
- [ ] Point `bin` to built CLI entry.
- [ ] Point `exports` to built library entry.
- [ ] Include only needed files in package.
- [ ] Add `prepublishOnly` or release build check.

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

- [ ] Test import of config module without env does not throw.
- [x] Test missing config prompts in interactive mode.
- [ ] Test missing config errors in non-interactive mode.
- [ ] Test flags override `.env`.
- [ ] Test reset removes known keys.
- [ ] Test `.env` merge preserves unknown keys.
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

- [ ] 1. Make config import side-effect free.
- [ ] 2. Add config resolver with argv/env/default priority.
- [ ] 3. Add prompt flow for missing required config.
- [ ] 4. Add `.env` read/write/reset helper.
- [ ] 5. Validate with health check before saving.
- [ ] 6. Inject config into health/API/downloader.
- [x] 7. Remove `process.exit` outside `main.ts`.
- [ ] 8. Add tests for resolver and config file behavior.
- [ ] 9. Update package `bin`/build strategy.
- [x] 10. Update README/USAGE after behavior stabilizes.

## Done criteria

- [ ] `bun test` passes.
- [ ] `bun run typecheck` passes.
- [ ] Fresh clone with no `.env` starts wizard in TTY.
- [ ] `--no-interactive` fails cleanly without `.env`.
- [ ] `.env` writes only after successful validation and health check.
- [ ] `--reset-config` resets saved config and re-prompts.
- [ ] CLI flags override saved config.
- [ ] DB commands work without Immich config.
- [ ] No secret appears in logs.
