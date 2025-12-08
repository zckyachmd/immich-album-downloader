# 📸 Immich Album Downloader

**Your one-stop CLI tool for backing up Immich albums like a pro.**

> Built with Node.js, powered by SQLite, and polished for the modern dev. Automate it, test it, or just vibe with it.

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

```bash
git clone https://github.com/zckyachmd/immich-album-downloader.git
cd immich-album-downloader
pnpm install
```

> 💡 **Note:** This project uses [pnpm](https://pnpm.io/) for faster and more efficient package management. If you don't have pnpm installed, you can install it with `npm install -g pnpm` or use `corepack enable` (Node.js 16.13+).

### 2. Set up your `.env`

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env` with your configuration. The `.env.example` file contains all available options with detailed comments.

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

> 💡 **Tip:** CLI arguments always override `.env` values. Priority: CLI > `.env` > defaults
>
> 📝 **See `.env.example` for complete documentation of all configuration options.**

### 3. Run it

**Local installation:**
```bash
pnpm run download       # Interactive mode - select albums
pnpm run download:all   # Download all albums (quick start)
```

**Docker Compose (recommended for easy setup):**
```bash
# Create .env file with your configuration
cp .env.example .env
# Edit .env with your Immich server details

# Run interactive mode
docker-compose up

# Or download all albums
docker-compose run --rm immich-album-downloader --all
```

> 💡 **Tip:** Logs go to the console _and_ `media-cache/immich-album-downloader.log`. No surprises.
>
> 💡 **Tip:** See [USAGE.md](./USAGE.md) for complete Docker usage guide including Docker Compose examples.
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
pnpm test
```

Run tests in watch mode:

```bash
pnpm run test:watch
```

Generate coverage report:

```bash
pnpm run test:coverage
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
