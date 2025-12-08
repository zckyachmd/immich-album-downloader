# 📖 Usage Guide

Complete guide to using Immich Album Downloader.

---

## 🧑‍💻 Basic Usage

### Quick Start

**Using pnpm scripts (recommended):**

```bash
pnpm run download       # Interactive mode - select albums
pnpm run download:all   # Download all albums
pnpm run download:resume # Resume failed downloads
pnpm run download:dry   # Preview without downloading
```

> 💡 **Note:** This project uses [pnpm](https://pnpm.io/) for package management. If you prefer npm, you can use `npm run` instead of `pnpm run`, but pnpm is recommended for better performance.

**Using node directly:**

```bash
node main.js           # Interactive mode
node main.js --all     # Download all albums (or use -a)
node main.js -h        # Show all available options (or use --help)
node main.js -V        # Show version (or use --version)
```

---

## 📋 Package Scripts

### Main Scripts

| Script                      | Command                        | Description                                           | Alias Equivalent  |
| --------------------------- | ------------------------------ | ----------------------------------------------------- | ----------------- |
| `pnpm run download`         | `node main.js`                 | Interactive mode - select albums from list            | -                 |
| `pnpm run download:all`     | `node main.js --all`           | Download all albums without prompt                    | `node main.js -a` |
| `pnpm run download:resume`  | `node main.js --resume-failed` | Resume previously failed downloads                    | `node main.js -R` |
| `pnpm run download:dry`     | `node main.js --dry-run`       | Preview what would be downloaded (no actual download) | `node main.js -d` |
| `pnpm run download:verbose` | `node main.js --verbose`       | Download with detailed logging                        | `node main.js -v` |

### Test Scripts

| Script                   | Command           | Description                   |
| ------------------------ | ----------------- | ----------------------------- |
| `pnpm test`              | `jest`            | Run tests                     |
| `pnpm run test:watch`    | `jest --watch`    | Run tests in watch mode       |
| `pnpm run test:coverage` | `jest --coverage` | Generate test coverage report |

### Examples with pnpm scripts:

```bash
# Download all albums with verbose logging
pnpm run download:all -- --verbose
# or using alias
pnpm run download:all -- -v

# Resume failed downloads with custom output
pnpm run download:resume -- --output ./backups
# or using alias
pnpm run download:resume -- -o ./backups

# Preview download with specific album filter
pnpm run download:dry -- --only "vacation"
# or using alias
pnpm run download:dry -- --only "vacation" -v
```

> 💡 **Note:** Use `--` to pass additional arguments to package scripts.
>
> 💡 **Tip:** All package scripts support aliases. For example:
>
> - `pnpm run download:all` = `node main.js -a`
> - `pnpm run download:resume` = `node main.js -R`
> - `pnpm run download:dry` = `node main.js -d`
> - `pnpm run download:verbose` = `node main.js -v`
>
> 💡 **Note:** You can also use `npm run` instead of `pnpm run` if you prefer, but pnpm is recommended for better performance.

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
node main.js

# Download all albums
node main.js --all
# or using alias
node main.js -a

# Download specific album
node main.js --only "vacation"

# Exclude certain albums
node main.js --all --exclude "memes"
# or using alias
node main.js -a -e "memes"

# Combine filters
node main.js --only "vacation" --exclude "test"
```

### Advanced Examples

```bash
# Download with custom settings (using long form)
node main.js --all --concurrency 20 --output ./backups --verbose

# Same command using aliases
node main.js -a -c 20 -o ./backups -v

# Resume failed downloads
node main.js --resume-failed
# or using alias
node main.js -R

# Preview what would be downloaded
node main.js --dry-run --verbose
# or using aliases
node main.js -d -v

# Download with size limit
node main.js --all --limit-size 500
# or using aliases
node main.js -a -l 500

# Force re-download everything
node main.js --all --force
# or using aliases
node main.js -a -f

# Complex example with multiple aliases
node main.js -a -c 10 -r 5 -o ./backups -v -l 200

# Resume failed with verbose logging using aliases
node main.js -R -v

# Download all with dry-run using aliases
node main.js -a -d -v
```

### Help and Version

```bash
# Show help message
node main.js --help
# or using alias
node main.js -h

# Show version number
node main.js --version
# or using alias
node main.js -V
```

---

## 🐳 Docker Usage

You can run Immich Album Downloader in a Docker container, which makes it easy to use without installing Node.js locally.

### 1. Build the Docker image locally (optional)

If you want to build the image yourself instead of using the default:

```bash
docker build -t ghcr.io/zckyachmd/immich-album-downloader:latest .
```

> The image name matches the default used in the wrapper script for consistency.

### 2. Create a `.env` file or use the existing

```bash
IMMICH_BASE_URL=https://gallery.yourdomain.com/api
IMMICH_API_KEY=your_api_key_here
DEFAULT_OUTPUT=/downloads
```

### 3. Run the container directly

```bash
docker run --rm \
  --env-file .env \
  -v "$(pwd)/downloads:/downloads" \
  ghcr.io/zckyachmd/immich-album-downloader:latest --all
```

> Any CLI arguments (like `--all`, `--force`, `--only`) can be passed after the image name.
> If no arguments are given, the container defaults to `--help`.

### 4. Optional: Use the provided wrapper script

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
node main.js --backup-db ./backups/

# List all available backups
node main.js --list-backups

# Restore from a backup
node main.js --restore-db ./backups/downloads.db.backup.2024-01-01

# Clean up old failed records (older than 90 days)
node main.js --cleanup-db 90

# Clean up all old records (not just failed)
node main.js --cleanup-db 30 --cleanup-db-all
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
