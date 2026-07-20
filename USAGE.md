# Usage Guide 🚀

Technical guide for running Immich Album Downloader. Built for technical users who want clear commands, predictable config, and backup workflows without side quests.

## TL;DR ⚡

| Goal | Command |
| --- | --- |
| Interactive setup/run | `npx immich-album-downloader` |
| Download every album | `npx immich-album-downloader --all` |
| Preview without writes | `npx immich-album-downloader --all --dry-run --verbose` |
| Resume failed assets | `npx immich-album-downloader --resume-failed` |
| Run with Docker | `docker run --rm --env-file .env -v "$(pwd)/downloads:/downloads" -v "$(pwd)/data:/app/data" ghcr.io/zckyachmd/immich-album-downloader:latest --all` |
| Develop from source | `git clone https://github.com/zckyachmd/immich-album-downloader.git && cd immich-album-downloader && bun install` |

## 🧭 Choose Your Runtime

| Mode | Best for | Requires | Vibe |
| --- | --- | --- | --- |
| `npx` | Quick runs, local machines, no repo clone | Node.js + npm/npx | fastest path |
| Docker | Servers, NAS boxes, CI, repeatable runtime | Docker or Docker Compose | stable runtime |
| Raw clone | Development, contributions, source debugging | Bun 1.2+ | contributor mode |

## ⚡ Mode 1: `npx`

Use this when you want the CLI without cloning the repo.

### Quick commands

| Workflow | Command |
| --- | --- |
| Interactive mode | `npx immich-album-downloader` |
| Download every album | `npx immich-album-downloader --all` |
| Dry run with logs | `npx immich-album-downloader --all --dry-run --verbose` |
| Resume failed assets | `npx immich-album-downloader --resume-failed` |
| Include matching albums | `npx immich-album-downloader --only "vacation"` |
| Exclude matching albums | `npx immich-album-downloader --all --exclude "archive"` |
| Custom output + concurrency | `npx immich-album-downloader --all --output ./backups --concurrency 10` |

<details>
<summary><strong>Prepare npx</strong></summary>

Make sure Node.js and `npx` are available:

```bash
node --version
npx --version
```

Set minimum config with a `.env` file in your working directory:

```env
IMMICH_BASE_URL=https://gallery.example.com/api
IMMICH_API_KEY=your_api_key_here
```

Or pass environment variables inline:

```bash
IMMICH_BASE_URL=https://gallery.example.com/api \
IMMICH_API_KEY=your_api_key_here \
npx immich-album-downloader --all
```

</details>

## 🐳 Mode 2: Docker

Docker is the move when you want a repeatable runtime for a server, NAS, or scheduled backup job.

### Docker quick commands

| Workflow | Command |
| --- | --- |
| One-shot run | `docker run --rm --env-file .env -v "$(pwd)/downloads:/downloads" -v "$(pwd)/data:/app/data" ghcr.io/zckyachmd/immich-album-downloader:latest --all` |
| Interactive run | `docker run --rm -it --env-file .env -v "$(pwd)/downloads:/downloads" -v "$(pwd)/data:/app/data" ghcr.io/zckyachmd/immich-album-downloader:latest` |
| Compose up | `docker compose -f docker/docker-compose.yml up` |
| Compose one-shot | `docker compose -f docker/docker-compose.yml run --rm immich-album-downloader --all` |
| Follow logs | `docker compose -f docker/docker-compose.yml logs -f` |
| Build local image | `docker build -f docker/Dockerfile -t ghcr.io/zckyachmd/immich-album-downloader:latest .` |

<details>
<summary><strong>Docker Run details</strong></summary>

Create `.env`:

```env
IMMICH_BASE_URL=https://gallery.example.com/api
IMMICH_API_KEY=your_api_key_here
DEFAULT_OUTPUT=/downloads
IMMICH_CONCURRENCY=5
IMMICH_MAX_RETRIES=3
```

Run a one-shot download for every album:

```bash
docker run --rm \
  --env-file .env \
  -v "$(pwd)/downloads:/downloads" \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/zckyachmd/immich-album-downloader:latest --all
```

Interactive mode needs a TTY:

```bash
docker run --rm -it \
  --env-file .env \
  -v "$(pwd)/downloads:/downloads" \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/zckyachmd/immich-album-downloader:latest
```

Pin a specific image tag for repeatable environments. `latest` is fine for testing, less fine for prod-ish backup jobs.

</details>

<details>
<summary><strong>Docker Compose details</strong></summary>

Start the service from the repo compose file:

```bash
docker compose -f docker/docker-compose.yml up
```

Run a one-shot command:

```bash
docker compose -f docker/docker-compose.yml run --rm immich-album-downloader --all
```

Run in the background and follow logs:

```bash
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml logs -f
```

Build a local image:

```bash
docker build -f docker/Dockerfile -t ghcr.io/zckyachmd/immich-album-downloader:latest .
```

</details>

## 🧑‍💻 Mode 3: Raw Clone for Development/Contributors

Raw clone mode runs the source directly with Bun. Use it for development, debugging, or contributions.

### Contributor TL;DR

| Task | Command |
| --- | --- |
| Install deps | `bun install` |
| Run interactive CLI | `bun src/main.ts` |
| Download all albums | `bun src/main.ts --all` |
| Run tests | `bun test` |
| Typecheck | `bun run typecheck` |

<details>
<summary><strong>Setup from clone</strong></summary>

```bash
git clone https://github.com/zckyachmd/immich-album-downloader.git
cd immich-album-downloader
bun install
cp .env.example .env
```

Set minimum config:

```env
IMMICH_BASE_URL=https://gallery.example.com/api
IMMICH_API_KEY=your_api_key_here
```

Local entry point:

```bash
bun src/main.ts
```

Package scripts:

```bash
bun run download         # interactive mode
bun run download:all     # download every album
bun run download:resume  # retry failed assets
bun run download:dry     # preview without writing files
```

Direct CLI usage:

```bash
bun src/main.ts
bun src/main.ts --all
bun src/main.ts --help
bun src/main.ts --version
```

Use `--` when passing extra args through a package script:

```bash
bun run download:all -- --verbose
bun run download:resume -- --output ./backups
bun run download:dry -- --only "vacation"
```

Contributor checks:

```bash
bun test
bun run typecheck
```

</details>

## ⚙️ Configuration

Config can come from CLI flags, `.env`, process environment, or the interactive setup wizard.

| Priority | Source |
| --- | --- |
| 1 | CLI arguments |
| 2 | Process environment or `.env` |
| 3 | Interactive prompt for required config in TTY sessions |
| 4 | Defaults for optional config |

<details open>
<summary><strong>Required and optional config</strong></summary>

Required config:

```env
IMMICH_BASE_URL=https://gallery.example.com/api
IMMICH_API_KEY=your_api_key_here
```

Optional config:

```env
DEFAULT_OUTPUT=./downloads
IMMICH_CONCURRENCY=5
IMMICH_MAX_RETRIES=3
IMMICH_DOWNLOAD_TIMEOUT=30000
IMMICH_RATE_LIMIT_REQUESTS=10
IMMICH_RATE_LIMIT_WINDOW_MS=1000
IMMICH_SSL_VERIFY=true
```

Use `--no-interactive` for CI and automation so missing config fails cleanly instead of opening prompts.

</details>

## 🎛️ CLI Options

<details open>
<summary><strong>Album Selection</strong></summary>

| Option | Type | Description | Default |
| --- | --- | --- | --- |
| `-a`, `--all` | boolean | Download every album without opening album selection | `false` |
| `--only <keyword>` | string | Include only albums whose name contains the keyword, case-insensitive | - |
| `-e`, `--exclude <keyword>` | string | Skip albums whose name contains the keyword, case-insensitive | - |

</details>

<details open>
<summary><strong>Download Behavior</strong></summary>

| Option | Type | Description | Default |
| --- | --- | --- | --- |
| `-f`, `--force` | boolean | Re-download even when a local file already exists | `false` |
| `-R`, `--resume-failed` | boolean | Retry only assets previously marked as failed | `false` |
| `-d`, `--dry-run` | boolean | Simulate the run without downloading files | `false` |
| `-l`, `--limit-size <mb>` | number | Skip assets larger than the given size in MB | no limit |

</details>

<details open>
<summary><strong>Output and Runtime Config</strong></summary>

| Option | Type | Description | Default |
| --- | --- | --- | --- |
| `--base-url <url>` | string | Override `IMMICH_BASE_URL` | - |
| `--api-key <key>` | string | Override `IMMICH_API_KEY` | - |
| `--no-interactive` | boolean | Disable interactive prompts | `false` |
| `--reset-config` | boolean | Remove saved Immich keys from `.env`, then continue config resolution | `false` |
| `-o`, `--output <dir>` | string | Override `DEFAULT_OUTPUT` | `./downloads` |
| `-c`, `--concurrency <n>` | number | Number of parallel downloads | `5` |
| `-r`, `--max-retries <n>` | number | Maximum retries per failed download | `3` |

</details>

<details open>
<summary><strong>Database Maintenance</strong></summary>

| Option | Type | Description |
| --- | --- | --- |
| `--cleanup-db <days>` | number | Remove old records. By default, only failed records are removed. A backup is created first. |
| `--cleanup-db-all` | boolean | Remove all old records when used with `--cleanup-db`. |
| `--backup-db <path>` | string | Create a database backup at a file path or inside a directory. |
| `--restore-db <path>` | string | Restore from a database backup. The current database is backed up first. |
| `--list-backups` | boolean | List available database backups. |

</details>

<details open>
<summary><strong>Logging and Metadata</strong></summary>

| Option | Type | Description |
| --- | --- | --- |
| `-v`, `--verbose` | boolean | Enable more detailed logs |
| `-h`, `--help` | boolean | Show CLI help |
| `-V`, `--version` | boolean | Show package version |

</details>

## 🧪 Common Workflows

> Examples use `npx`. For raw clone mode, replace `npx immich-album-downloader` with `bun src/main.ts`. For Docker, place flags after the image name.

| Workflow | Command |
| --- | --- |
| Download every album | `npx immich-album-downloader --all` |
| Download albums by name match | `npx immich-album-downloader --only "vacation"` |
| Exclude albums by name match | `npx immich-album-downloader --all --exclude "archive"` |
| Preview before downloading | `npx immich-album-downloader --all --dry-run --verbose` |
| Resume failed downloads | `npx immich-album-downloader --resume-failed` |
| Tune concurrency and output | `npx immich-album-downloader --all --concurrency 10 --output ./backups` |
| Force a full re-download | `npx immich-album-downloader --all --force` |
| Skip large assets | `npx immich-album-downloader --all --limit-size 500` |
| Run in CI/non-interactive mode | `npx immich-album-downloader --all --no-interactive` |

## 🗄️ Database Operations

SQLite stores download state for skip logic, retries, and resume workflows.

| Operation | Command |
| --- | --- |
| Back up the database | `npx immich-album-downloader --backup-db ./backups/` |
| List backups | `npx immich-album-downloader --list-backups` |
| Restore a backup | `npx immich-album-downloader --restore-db ./backups/downloads.db.backup.2024-01-01` |
| Clean failed records older than 90 days | `npx immich-album-downloader --cleanup-db 90` |
| Clean all old records | `npx immich-album-downloader --cleanup-db 30 --cleanup-db-all` |

<details>
<summary><strong>How state works</strong></summary>

Default local paths:

- Downloads: `./downloads`
- Database: `data/downloads.db`
- Logs: `data/immich-album-downloader.log`

Assets are skipped when local state indicates the file already exists, checksum validation passes, and the database record is complete.

</details>

## 🚦 Rate Limiting

Built-in rate limiting keeps the CLI from turning your Immich server into an accidental stress test.

```env
IMMICH_RATE_LIMIT_REQUESTS=10
IMMICH_RATE_LIMIT_WINDOW_MS=1000
```

Lower `--concurrency` if the server returns rate-limit errors or timeouts.

## 🔒 TLS

SSL verification is enabled by default.

```env
IMMICH_SSL_VERIFY=true
```

<details>
<summary><strong>Trusted self-signed setup</strong></summary>

For trusted self-signed setups:

```env
IMMICH_SSL_VERIFY=false
```

Do not disable SSL verification for production endpoints exposed over public networks.

</details>

## 🧯 Troubleshooting

<details open>
<summary><strong>Downloads fail</strong></summary>

- Verify `IMMICH_BASE_URL`; include `/api` if your Immich deployment requires it
- Verify `IMMICH_API_KEY`
- Check network access to the Immich server
- Re-run with `--verbose`
- Review `data/immich-album-downloader.log`

</details>

<details>
<summary><strong>Files download again</strong></summary>

- Confirm checksums are available and match
- Check `data/downloads.db` consistency
- Use `--force` only when a full re-download is intentional

</details>

<details>
<summary><strong>Rate limits or timeouts</strong></summary>

- Lower `--concurrency`
- Tune `IMMICH_RATE_LIMIT_REQUESTS`
- Tune `IMMICH_RATE_LIMIT_WINDOW_MS`
- Increase `IMMICH_DOWNLOAD_TIMEOUT` for large assets or slow networks

</details>

<details>
<summary><strong>SSL certificate errors</strong></summary>

- Confirm the server certificate is valid
- For trusted self-signed environments, set `IMMICH_SSL_VERIFY=false`
- Keep verification enabled for production public endpoints

</details>
