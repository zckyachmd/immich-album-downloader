# 📖 Usage Guide

Complete guide to using Immich Album Downloader.

---

## 🧑‍💻 Basic Usage

### Quick Start

**Using Bun scripts (recommended):**

```bash
bun run download       # Interactive mode - select albums
bun run download:all   # Download all albums
bun run download:resume # Resume failed downloads
bun run download:dry   # Preview without downloading
```

**Using node directly:**

```bash
bun src/main.ts           # Interactive mode
bun src/main.ts --all     # Download all albums (or use -a)
bun src/main.ts -h        # Show all available options (or use --help)
bun src/main.ts -V        # Show version (or use --version)
```

---

## 📋 Package Scripts

### Main Scripts

| Script                     | Command                           | Description                                           | Alias Equivalent     |
| -------------------------- | --------------------------------- | ----------------------------------------------------- | -------------------- |
| `bun run download`         | `bun src/main.ts`                 | Interactive mode - select albums from list            | -                    |
| `bun run download:all`     | `bun src/main.ts --all`           | Download all albums without prompt                    | `bun src/main.ts -a` |
| `bun run download:resume`  | `bun src/main.ts --resume-failed` | Resume previously failed downloads                    | `bun src/main.ts -R` |
| `bun run download:dry`     | `bun src/main.ts --dry-run`       | Preview what would be downloaded (no actual download) | `bun src/main.ts -d` |
| `bun run download:verbose` | `bun src/main.ts --verbose`       | Download with detailed logging                        | `bun src/main.ts -v` |

### Test Scripts

| Script                  | Command               | Description                   |
| ----------------------- | --------------------- | ----------------------------- |
| `bun test`              | `bun test`            | Run tests                     |
| `bun run test:watch`    | `bun test --watch`    | Run tests in watch mode       |
| `bun run test:coverage` | `bun test --coverage` | Generate test coverage report |

### Examples with Bun scripts:

```bash
# Download all albums with verbose logging
bun run download:all -- --verbose
# or using alias
bun run download:all -- -v

# Resume failed downloads with custom output
bun run download:resume -- --output ./backups
# or using alias
bun run download:resume -- -o ./backups

# Preview download with specific album filter
bun run download:dry -- --only "vacation"
# or using alias
bun run download:dry -- --only "vacation" -v
```

> 💡 **Note:** Use `--` to pass additional arguments to package scripts.
>
> 💡 **Tip:** All package scripts support aliases. For example:
>
> - `bun run download:all` = `bun src/main.ts -a`
> - `bun run download:resume` = `bun src/main.ts -R`
> - `bun run download:dry` = `bun src/main.ts -d`
> - `bun run download:verbose` = `bun src/main.ts -v`

---

## ⚙️ CLI Options

### Album Selection

| Option / Alias              | Type    | Description                                               | Default | Example                         |
| --------------------------- | ------- | --------------------------------------------------------- | ------- | ------------------------------- |
| `-a`, `--all`               | boolean | Download all albums without prompt                        | `false` | `-a` or `--all`                 |
| `--only <keyword>`          | string  | Only include albums containing keyword (case-insensitive) | -       | `--only vacation`               |
| `-e`, `--exclude <keyword>` | string  | Skip albums containing keyword (case-insensitive)         | -       | `-e memes` or `--exclude memes` |

### Download Behavior

| Option / Alias          | Type    | Description                                          | Default | Example                   |
| ----------------------- | ------- | ---------------------------------------------------- | ------- | ------------------------- |
| `-f`, `--force`         | boolean | Re-download even if file already exists              | `false` | `-f` or `--force`         |
| `-R`, `--resume-failed` | boolean | Only retry previously failed downloads               | `false` | `-R` or `--resume-failed` |
| `-d`, `--dry-run`       | boolean | Preview mode - simulate download without downloading | `false` | `-d` or `--dry-run`       |

### Output & Configuration

| Option / Alias         | Type   | Description                                                                          | Default             | Example                                |
| ---------------------- | ------ | ------------------------------------------------------------------------------------ | ------------------- | -------------------------------------- |
| `-o`, `--output <dir>` | string | Custom output directory (overrides `DEFAULT_OUTPUT` env var)                         | `./media-downloads` | `-o ./backups` or `--output ./backups` |
| `-c`, `--concurrency`  | number | Number of concurrent downloads (overrides `IMMICH_CONCURRENCY` env var)              | `5`                 | `-c 10` or `--concurrency 10`          |
| `-r`, `--max-retries`  | number | Maximum retry attempts for failed downloads (overrides `IMMICH_MAX_RETRIES` env var) | `3`                 | `-r 5` or `--max-retries 5`            |
| `-l`, `--limit-size`   | number | Skip files larger than X MB                                                          | No limit            | `-l 200` or `--limit-size 200`         |

### Database Management

| Option                | Type    | Description                                                                                                       | Default | Example                                                 |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------- |
| `--cleanup-db <days>` | number  | Clean up database records older than N days (only failed records by default). Auto-creates backup before cleanup. | -       | `--cleanup-db 90`                                       |
| `--cleanup-db-all`    | boolean | Clean up all old records (not just failed) when using `--cleanup-db`                                              | `false` | `--cleanup-db 30 --cleanup-db-all`                      |
| `--backup-db <path>`  | string  | Create database backup to specified path (or auto-generate if path ends with '/')                                 | -       | `--backup-db ./backups/`                                |
| `--restore-db <path>` | string  | Restore database from backup file (creates backup of current DB first)                                            | -       | `--restore-db ./backups/downloads.db.backup.2024-01-01` |
| `--list-backups`      | boolean | List all available database backups                                                                               | `false` | `--list-backups`                                        |

### Logging & Help

| Option / Alias    | Type    | Description                    | Default | Example             |
| ----------------- | ------- | ------------------------------ | ------- | ------------------- |
| `-v`, `--verbose` | boolean | Enable detailed logging output | `false` | `-v` or `--verbose` |
| `-h`, `--help`    | boolean | Show help message and exit     | -       | `-h` or `--help`    |
| `-V`, `--version` | boolean | Show version number and exit   | -       | `-V` or `--version` |

### Configuration Priority

1. **CLI arguments** (highest priority) - e.g., `--concurrency 10`
2. **Environment variables** (`.env` file) - e.g., `IMMICH_CONCURRENCY=5`
3. **Default values** (lowest priority) - e.g., `5` for concurrency

---

## 💡 Common Usage Examples

### Basic Examples

```bash
# Interactive mode - select albums from list
bun src/main.ts

# Download all albums
bun src/main.ts --all
# or using alias
bun src/main.ts -a

# Download specific album
bun src/main.ts --only "vacation"

# Exclude certain albums
bun src/main.ts --all --exclude "memes"
# or using alias
bun src/main.ts -a -e "memes"

# Combine filters
bun src/main.ts --only "vacation" --exclude "test"
```

### Advanced Examples

```bash
# Download with custom settings (using long form)
bun src/main.ts --all --concurrency 20 --output ./backups --verbose

# Same command using aliases
bun src/main.ts -a -c 20 -o ./backups -v

# Resume failed downloads
bun src/main.ts --resume-failed
# or using alias
bun src/main.ts -R

# Preview what would be downloaded
bun src/main.ts --dry-run --verbose
# or using aliases
bun src/main.ts -d -v

# Download with size limit
bun src/main.ts --all --limit-size 500
# or using aliases
bun src/main.ts -a -l 500

# Force re-download everything
bun src/main.ts --all --force
# or using aliases
bun src/main.ts -a -f

# Complex example with multiple aliases
bun src/main.ts -a -c 10 -r 5 -o ./backups -v -l 200

# Resume failed with verbose logging using aliases
bun src/main.ts -R -v

# Download all with dry-run using aliases
bun src/main.ts -a -d -v
```

### Help and Version

```bash
# Show help message
bun src/main.ts --help
# or using alias
bun src/main.ts -h

# Show version number
bun src/main.ts --version
# or using alias
bun src/main.ts -V
```

---

## 🐳 Docker Usage

You can run Immich Album Downloader in a Docker container, which makes it easy to use without installing Node.js locally.

### Option 1: Docker Run with Pre-built Image (Recommended)

The simplest way is to use the pre-built image from GitHub Container Registry:

1. **Create a `.env` file** with your configuration:

```bash
IMMICH_BASE_URL=https://gallery.yourdomain.com/api
IMMICH_API_KEY=your_api_key_here
DEFAULT_OUTPUT=/downloads
IMMICH_CONCURRENCY=5
IMMICH_MAX_RETRIES=3
```

2. **Run the container directly**:

```bash
# Interactive mode (select albums)
docker run --rm -it \
  --env-file .env \
  -v "$(pwd)/downloads:/downloads" \
  -v "$(pwd)/media-cache:/app/media-cache" \
  ghcr.io/zckyachmd/immich-album-downloader:latest

# Download all albums
docker run --rm \
  --env-file .env \
  -v "$(pwd)/downloads:/downloads" \
  -v "$(pwd)/media-cache:/app/media-cache" \
  ghcr.io/zckyachmd/immich-album-downloader:latest --all

# Resume failed downloads
docker run --rm \
  --env-file .env \
  -v "$(pwd)/downloads:/downloads" \
  -v "$(pwd)/media-cache:/app/media-cache" \
  ghcr.io/zckyachmd/immich-album-downloader:latest --resume-failed

# Dry run with verbose
docker run --rm \
  --env-file .env \
  -v "$(pwd)/downloads:/downloads" \
  -v "$(pwd)/media-cache:/app/media-cache" \
  ghcr.io/zckyachmd/immich-album-downloader:latest --dry-run --verbose

# Download specific album
docker run --rm \
  --env-file .env \
  -v "$(pwd)/downloads:/downloads" \
  -v "$(pwd)/media-cache:/app/media-cache" \
  ghcr.io/zckyachmd/immich-album-downloader:latest --only "vacation"
```

> 💡 **Tip:** Any CLI arguments (like `--all`, `--force`, `--only`) can be passed after the image name.
>
> 💡 **Tip:** Use specific version tags for stability: `ghcr.io/zckyachmd/immich-album-downloader:v1.0.2` or `ghcr.io/zckyachmd/immich-album-downloader:1.0.2`

### Option 2: Docker Compose

For easier management and configuration, use Docker Compose:

1. **Create a `.env` file** with your configuration:

```bash
IMMICH_BASE_URL=https://gallery.yourdomain.com/api
IMMICH_API_KEY=your_api_key_here
DEFAULT_OUTPUT=/downloads
IMMICH_CONCURRENCY=5
IMMICH_MAX_RETRIES=3
```

2. **Edit `docker/docker-compose.yml`** with your settings (if needed):

The `docker/docker-compose.yml` file uses environment variables from `.env` file, so you mainly need to configure the `.env` file.

3. **Run with Docker Compose**:

```bash
# Interactive mode (default)
docker compose -f docker/docker-compose.yml up

# Download all albums
docker compose -f docker/docker-compose.yml run --rm immich-album-downloader --all

# Resume failed downloads
docker compose -f docker/docker-compose.yml run --rm immich-album-downloader --resume-failed

# Dry run with verbose
docker compose -f docker/docker-compose.yml run --rm immich-album-downloader --dry-run --verbose

# Run in background
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml logs -f
```

> 💡 **Tip:** Use `docker compose -f docker/docker-compose.yml run --rm` for one-time commands, or `docker compose -f docker/docker-compose.yml up` for interactive mode.

### Option 3: Build Locally (Optional)

If you want to build the image yourself instead of using the pre-built image:

```bash
docker build -f docker/Dockerfile -t ghcr.io/zckyachmd/immich-album-downloader:latest .
```

> The image name matches the default used in the wrapper script for consistency.

### Option 4: Use the Provided Wrapper Script

```bash
./immich-album-downloader.sh --all
```

> This script automatically loads `.env` and forwards all arguments to the Docker container.

---

## 🔧 Advanced Usage

### Database Management

The tool uses SQLite to track downloaded files. You can manage the database with these commands:

```bash
# Create a backup of the database
bun src/main.ts --backup-db ./backups/

# List all available backups
bun src/main.ts --list-backups

# Restore from a backup
bun src/main.ts --restore-db ./backups/downloads.db.backup.2024-01-01

# Clean up old failed records (older than 90 days)
bun src/main.ts --cleanup-db 90

# Clean up all old records (not just failed)
bun src/main.ts --cleanup-db 30 --cleanup-db-all
```

### Environment Variables

All configuration can be set via environment variables in your `.env` file. See `.env.example` for complete documentation.

**Priority order:**

1. CLI arguments (highest)
2. Environment variables (`.env` file)
3. Default values (lowest)

### Rate Limiting

The tool includes built-in rate limiting to prevent overwhelming your Immich server. Configure it via:

- `IMMICH_RATE_LIMIT_REQUESTS` - Number of requests per window
- `IMMICH_RATE_LIMIT_WINDOW_MS` - Time window in milliseconds

### SSL/TLS Configuration

For self-signed certificates, you can disable SSL verification:

```bash
# In .env file
IMMICH_SSL_VERIFY=false
```

> ⚠️ **Warning:** Only use this in development or with trusted self-signed certificates.

---

## 🐛 Troubleshooting

### Common Issues

**Problem:** Downloads are failing

- Check your `IMMICH_BASE_URL` includes `/api` if needed
- Verify your API key is correct
- Check network connectivity
- Review logs in `media-cache/immich-album-downloader.log`

**Problem:** Files are being re-downloaded

- Check if checksums match
- Verify database is not corrupted
- Try `--force` to force re-download

**Problem:** Rate limiting errors

- Adjust `IMMICH_RATE_LIMIT_REQUESTS` and `IMMICH_RATE_LIMIT_WINDOW_MS`
- Reduce `--concurrency` value

**Problem:** SSL certificate errors

- Set `IMMICH_SSL_VERIFY=false` in `.env` (development only)
- Ensure your server's certificate is valid

---

## 📝 Notes

- Logs are written to both console and `media-cache/immich-album-downloader.log`
- The database is stored in `media-cache/downloads.db`
- Downloaded files maintain the Immich album folder structure
- Files are verified with checksums before being marked as downloaded
- Failed downloads can be resumed with `--resume-failed`
