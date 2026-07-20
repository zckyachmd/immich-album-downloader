# 📸 Immich Album Downloader

**Your one-stop CLI tool for backing up Immich albums like a pro.**

> Built for Bun, powered by SQLite, and polished for the modern dev. Automate it, test it, or just vibe with it.

---

## ✨ Features

Here's what you're getting out of the box:

- [x] 🔐 Auth with Immich API (API key powered)
- [x] 📁 Download all albums or get picky with filters
- [x] 🧠 Resume failed downloads like nothing happened
- [x] 🧾 Keep track of downloaded stuff via local SQLite
- [x] 🧪 Validate your files with checksum before wasting bandwidth
- [x] 🧱 Mirror Immich album folder structure
- [x] 📦 Override existing files with `--force` (only if you mean it)
- [x] 🎯 Filter albums with `--only` or `--exclude`
- [x] 💬 Fully interactive CLI with Inquirer prompts
- [x] 🌈 Cross-platform magic (macOS, Linux, Windows)

---

## 🚀 Quick Start

### 1. Clone and install

Requires Bun 1.2+.

```bash
git clone https://github.com/zckyachmd/immich-album-downloader.git
cd immich-album-downloader
bun install
```

### 2. Set up configuration

Run without `.env` in an interactive terminal to start the setup wizard, or copy the example file and fill in your values:

```bash
cp .env.example .env
```

Existing `.env` files and env var names continue working. CLI flags override saved config for that run.

**Required configuration:**

- `IMMICH_BASE_URL` - Your Immich server URL
- `IMMICH_API_KEY` - Your Immich API key

**Optional configuration (all can be overridden via CLI arguments):**

- `DEFAULT_OUTPUT` - Default download directory (override with `--output` or `-o`)
- `IMMICH_CONCURRENCY` - Concurrent downloads (override with `--concurrency` or `-c`)
- `IMMICH_MAX_RETRIES` - Max retries (override with `--max-retries` or `-r`)
- `IMMICH_DOWNLOAD_TIMEOUT` - Download timeout in milliseconds (5000-600000, default: 30000)
- `IMMICH_RATE_LIMIT_REQUESTS` - API rate limit requests per window
- `IMMICH_RATE_LIMIT_WINDOW_MS` - Rate limit time window in milliseconds
- `IMMICH_SSL_VERIFY` - SSL verification (set to `false` for self-signed certs)

> 💡 **Tip:** Priority: CLI flags > `.env` / process env > interactive prompt > optional defaults. API keys are never printed.
>
> 📝 **See `.env.example` for complete documentation of all configuration options.**

### 3. Run it

**Local installation:**

```bash
bun run download       # Interactive mode - select albums
bun run download:all   # Download all albums (quick start)
```

**Docker (using pre-built image from GitHub Container Registry):**

```bash
# Create .env file with your configuration
cp .env.example .env
# Edit .env with your Immich server details

# Run interactive mode
docker run --rm -it \
  --env-file .env \
  -v "$(pwd)/downloads:/downloads" \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/zckyachmd/immich-album-downloader:latest

# Or download all albums
docker run --rm \
  --env-file .env \
  -v "$(pwd)/downloads:/downloads" \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/zckyachmd/immich-album-downloader:latest --all
```

**Build locally (alternative):**

```bash
docker build -t ghcr.io/zckyachmd/immich-album-downloader:latest .
```

> 💡 **Tip:** Logs go to the console _and_ `data/immich-album-downloader.log`. No surprises.
>
> 💡 **Tip:** See [USAGE.md](./USAGE.md) for complete Docker usage guide.
>
> 💡 **Tip:** Most CLI options have short aliases:
>
> - `-a` for `--all` (download all)
> - `-R` for `--resume-failed` (resume)
> - `-d` for `--dry-run` (preview)
> - `-v` for `--verbose` (detailed logging)
>
> See [USAGE.md](./USAGE.md) for complete documentation of all aliases.

---

## 📚 Documentation

- **[USAGE.md](./USAGE.md)** - Complete usage guide with CLI options, examples, and advanced features
- **[LICENSE.md](./LICENSE.md)** - License information
- **[SECURITY.md](./SECURITY.md)** - Security best practices and guidelines

---

## 🧠 How it works

- It talks to your Immich server using your API key
- It fetches albums and assets, filters them based on your flags
- For each asset, it checks:
  1. Does the file already exist?
  2. Does the checksum match?
  3. Did we already mark this asset as downloaded in SQLite?

- If yes → skip
- If no → download it, verify it, log it, move on

All files are downloaded to folders that match your Immich album names — no weird nesting.

---

## 🧪 Testing

Run tests with:

```bash
bun test
```

Run tests in watch mode:

```bash
bun run test:watch
```

Generate coverage report:

```bash
bun run test:coverage
```

---

## 🔒 Security

See [SECURITY.md](./SECURITY.md) for security best practices and guidelines.

Key security features:

- ✅ Environment variable validation
- ✅ Path traversal protection
- ✅ Secure file permissions
- ✅ Log sanitization
- ✅ HTTPS validation
- ✅ Rate limiting
- ✅ Input validation
- ✅ Health checks

---

## 🧑‍🏫 Credits

Crafted with caffeine & code by [zckyachmd](https://github.com/zckyachmd)

Massive respect to the [Immich](https://github.com/immich-app/immich) project for making this even possible 🙌

---

## ⚠️ Disclaimer

This tool is unofficial. It's not affiliated with Immich.

Your API key and photos stay on your machine — scout's honor.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](./LICENSE.md) file for details.
