import { afterEach, describe, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { resetEnvConfig, writeEnvConfig } from "../../src/cli/configFile";
import type { AppConfig } from "../../src/lib/config";

const config: AppConfig = {
  apiKey: "fake-api-key-for-tests",
  baseUrl: "https://example.com",
  defaultOutput: "./downloads",
  sslVerify: true,
  concurrency: 5,
  maxRetries: 3,
  downloadTimeout: 30000,
};

let tempDirs: string[] = [];

function tempEnvPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iad-config-"));
  tempDirs.push(dir);
  return path.join(dir, ".env");
}

afterEach(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

describe("config file", () => {
  test("writeEnvConfig preserves unknown keys and replaces known keys", () => {
    const filePath = tempEnvPath();
    fs.writeFileSync(
      filePath,
      [
        "UNKNOWN=value",
        "IMMICH_BASE_URL=https://old.example.com",
        "IMMICH_API_KEY=old-api-key-for-tests",
        "OTHER=kept",
        "",
      ].join("\n")
    );

    writeEnvConfig(config, filePath);

    expect(fs.readFileSync(filePath, "utf8")).toBe(
      [
        "UNKNOWN=value",
        "OTHER=kept",
        "IMMICH_BASE_URL=https://example.com",
        "IMMICH_API_KEY=fake-api-key-for-tests",
        "DEFAULT_OUTPUT=./downloads",
        "IMMICH_SSL_VERIFY=true",
        "IMMICH_CONCURRENCY=5",
        "IMMICH_MAX_RETRIES=3",
        "IMMICH_DOWNLOAD_TIMEOUT=30000",
        "",
      ].join("\n")
    );
  });

  test("resetEnvConfig removes known keys and preserves unknown keys", () => {
    const filePath = tempEnvPath();
    fs.writeFileSync(
      filePath,
      [
        "UNKNOWN=value",
        "IMMICH_BASE_URL=https://example.com",
        "IMMICH_API_KEY=fake-api-key-for-tests",
        "OTHER=kept",
        "",
      ].join("\n")
    );

    resetEnvConfig(filePath);

    expect(fs.readFileSync(filePath, "utf8")).toBe("UNKNOWN=value\nOTHER=kept\n");
  });

  test("resetEnvConfig deletes .env when only known keys remain", () => {
    const filePath = tempEnvPath();
    fs.writeFileSync(
      filePath,
      [
        "IMMICH_BASE_URL=https://example.com",
        "IMMICH_API_KEY=fake-api-key-for-tests",
        "DEFAULT_OUTPUT=./downloads",
        "",
      ].join("\n")
    );

    resetEnvConfig(filePath);

    expect(fs.existsSync(filePath)).toBe(false);
  });
});
