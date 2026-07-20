# Security Policy

## Supported Versions

Security fixes are provided for the latest released version only.

## Reporting a Vulnerability

Do not report security vulnerabilities through public GitHub issues.

Report privately through one of these channels:

1. GitHub Security Advisory, if enabled for this repository
2. Email or direct contact listed on maintainer GitHub profile

Include:

- Vulnerability description
- Steps to reproduce
- Potential impact
- Affected version or commit
- Suggested fix, if available

Expected response:

- Acknowledgment within 48 hours
- Initial assessment within 7 days
- Public disclosure after a fix is available

## User Security Notes

### API keys

- Keep `IMMICH_API_KEY` in `.env` or environment variables
- Never commit `.env`
- Rotate exposed keys from Immich settings
- Use least-privilege keys when Immich supports them

### Network

- Use HTTPS for remote Immich servers
- Keep SSL verification enabled in production
- Set `IMMICH_SSL_VERIFY=false` only for trusted development or self-signed setups

### Filesystem

This tool writes downloaded media, logs, and a SQLite database to local paths. Protect those directories according to your OS/user access model.

Default local state:

- Downloads: `./downloads`
- Database: `data/downloads.db`
- Logs: `data/immich-album-downloader.log`

### Docker

- Prefer pinned image tags for repeatable runs
- Mount only needed host directories
- Protect `.env` files passed with `--env-file`

## Project Security Behavior

The application is designed to:

- Avoid logging API keys
- Validate required configuration before use
- Prevent path traversal in generated file paths
- Verify downloaded assets with checksums where available
- Rate-limit API requests
- Use parameterized SQLite queries

## Dependency Audit

```bash
bun audit
```

## Immich Relationship

This is an unofficial client for the Immich API. It is not affiliated with, endorsed by, or maintained by the Immich project. Follow Immich's own security guidance for server setup and API key management.