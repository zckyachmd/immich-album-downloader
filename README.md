# Immich Album Downloader 📸

A CLI for backing up Immich albums to local storage. Built for technical users who want predictable runs, resumable downloads, checksum validation, SQLite state tracking, and clean workflows via `npx`, Docker, or a raw clone for development.

> Unofficial Immich API client. Not affiliated with the Immich project.

## ✨ Why use this?

- Download all albums or a filtered subset by album name
- Resume failed downloads without starting over
- Validate files with checksums before marking assets complete
- Track download state in a local SQLite database
- Mirror Immich album names into local output folders
- Use a first-run setup wizard for required config
- Configure via CLI flags, `.env`, or environment variables
- Run via `npx`, Docker, Docker Compose, or Bun from source

## ⚡ Quick Start

Fastest path: use `npx`.

```bash
npx immich-album-downloader
```

Download every album:

```bash
npx immich-album-downloader --all
```

No `.env` yet? In an interactive terminal, the setup wizard asks for required config.

```env
IMMICH_BASE_URL=https://gallery.example.com/api
IMMICH_API_KEY=your_api_key_here
```

## 📚 Usage Docs

Full command reference, `npx` mode, Docker mode, raw clone development mode, CLI options, database maintenance, environment variables, and troubleshooting live in [USAGE.md](./USAGE.md).

## 🛠️ Development

```bash
git clone https://github.com/zckyachmd/immich-album-downloader.git
cd immich-album-downloader
bun install
bun test
bun run typecheck
```

## 🔐 Security

See [SECURITY.md](./SECURITY.md) for vulnerability reporting and operational notes around API keys, local files, Docker, and TLS.

## 📄 License

MIT. See [LICENSE.md](./LICENSE.md).

Immich is AGPL-3.0. This project remains MIT because it is independent code, does not include Immich source, and only talks to Immich through the public Immich HTTP API.
