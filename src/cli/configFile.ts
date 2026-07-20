import fs from "fs";
import path from "path";
import type { AppConfig } from "../lib/config";

const envPath = () => path.join(process.cwd(), ".env");
const knownKeys = new Set([
  "IMMICH_BASE_URL",
  "IMMICH_API_KEY",
  "DEFAULT_OUTPUT",
  "IMMICH_SSL_VERIFY",
  "IMMICH_CONCURRENCY",
  "IMMICH_MAX_RETRIES",
  "IMMICH_DOWNLOAD_TIMEOUT",
]);

const toLines = (config: AppConfig) => [
  `IMMICH_BASE_URL=${config.baseUrl}`,
  `IMMICH_API_KEY=${config.apiKey}`,
  `DEFAULT_OUTPUT=${config.defaultOutput}`,
  `IMMICH_SSL_VERIFY=${config.sslVerify}`,
  `IMMICH_CONCURRENCY=${config.concurrency}`,
  `IMMICH_MAX_RETRIES=${config.maxRetries}`,
  `IMMICH_DOWNLOAD_TIMEOUT=${config.downloadTimeout}`,
];

const keyFromLine = (line: string) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];

function writeFileAtomic(filePath: string, content: string) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, content);
  fs.renameSync(tempPath, filePath);
}

export function resetEnvConfig(filePath = envPath()) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const kept = lines.filter((line) => {
    const key = keyFromLine(line);
    return !key || !knownKeys.has(key);
  });

  if (kept.every((line) => line.trim() === "")) {
    fs.rmSync(filePath, { force: true });
    return;
  }

  writeFileAtomic(filePath, `${kept.join("\n").replace(/\n+$/, "")}\n`);
}

export function writeEnvConfig(config: AppConfig, filePath = envPath()) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").split(/\r?\n/) : [];
  const kept = existing.filter((line) => {
    const key = keyFromLine(line);
    return !key || !knownKeys.has(key);
  });
  const content = [...kept.filter((line) => line.trim() !== ""), ...toLines(config)].join("\n");
  writeFileAtomic(filePath, `${content}\n`);
}
