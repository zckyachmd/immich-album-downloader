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

## 🚀 Getting Started

### 1. Clone and install

```bash
git clone https://github.com/zckyachmd/immich-album-downloader.git
cd immich-album-downloader
npm install
```

### 2. Set up your `.env`

```dotenv
IMMICH_BASE_URL=https://gallery.yourdomain.com/api
IMMICH_API_KEY=your_api_key_here
DEFAULT_OUTPUT=./media-downloads
```

---

## 🧑‍💻 Usage

Start the CLI:
```bash
node main.js
```

> Logs go to the console *and* `media-cache/immich-album-downloader.log`. No surprises.

---

## ⚙️ CLI Options

| Option / Alias        | What it does                                                 | Example                        |
|------------------------|---------------------------------------------------------------|--------------------------------|
| `-a`, `--all`          | Backup *everything*, no questions asked                       | `--all`                        |
| `-f`, `--force`        | Re-download even if file already exists                       | `--force`                      |
| `--resume-failed`      | Only retry the stuff that failed last time                    | `--resume-failed`              |
| `-o`, `--output <dir>` | Save to a specific folder                                     | `--output ./backups`           |
| `--only <keyword>`     | Filter album names that *contain* keyword                     | `--only vacation`              |
| `-e`, `--exclude`      | Skip albums matching keyword                                  | `--exclude memes`              |
| `-d`, `--dry-run`      | Run it like a preview — no files touched                      | `--dry-run`                    |
| `-l`, `--limit-size`   | Skip files over a certain size (MB)                           | `--limit-size 200`             |
| `-c`, `--concurrency`  | Max simultaneous downloads (default: 5)                       | `--concurrency 10`             |
| `-r`, `--max-retries`  | How many times to retry failed downloads (default: 3)         | `--max-retries 5`              |
| `-v`, `--verbose`      | Turn on debug logs                                            | `--verbose`                    |
| `-h`, `--help`         | Show all available commands                                   | `--help`                       |

---

## 🧠 How it works (aka “the vibe check”)

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

## 🧑‍🏫 Credits

Crafted with caffeine & code by [zckyachmd](https://github.com/zckyachmd)  
Massive respect to the [Immich](https://github.com/immich-app/immich) project for making this even possible 🙌

---

## ⚠️ Disclaimer

This tool is unofficial. It’s not affiliated with Immich.  
Your API key and photos stay on your machine — scout’s honor.
