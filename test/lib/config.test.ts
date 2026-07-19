import { afterEach, describe, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { resolveConfig, validateConfig } from "../../src/lib/config";

const env = {
  IMMICH_API_KEY: "fake-api-key-for-tests",
  IMMICH_BASE_URL: "https://example.com/",
};

const cwd = process.cwd();
let tempDirs: string[] = [];

afterEach(() => {
  process.chdir(cwd);
  delete process.env.IMMICH_API_KEY;
  delete process.env.IMMICH_BASE_URL;
  delete process.env.IMMICH_CONCURRENCY;
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iad-config-resolver-"));
  tempDirs.push(dir);
  return dir;
}

describe("config", () => {
  test("validates config structure", () => {
    const config = validateConfig({ apiKey: env.IMMICH_API_KEY, baseUrl: env.IMMICH_BASE_URL });

    expect(config).toEqual({
      apiKey: "fake-api-key-for-tests",
      baseUrl: "https://example.com",
      sslVerify: true,
      concurrency: 5,
      maxRetries: 3,
      downloadTimeout: 30000,
      defaultOutput: "./downloads",
    });
  });

  test("argv overrides env", async () => {
    const config = await resolveConfig(
      { "api-key": "fake-flag-api-key", "base-url": "https://flag.example.com" },
      env
    );

    expect(config.apiKey).toBe("fake-flag-api-key");
    expect(config.baseUrl).toBe("https://flag.example.com");
  });

  test("throws cleanly without config in non-interactive mode", async () => {
    await expect(resolveConfig({ interactive: false }, {})).rejects.toThrow("Missing IMMICH_API_KEY");
  });

  test("loads existing .env when env argument is process.env", async () => {
    const dir = tempDir();
    process.chdir(dir);
    fs.writeFileSync(
      ".env",
      [
        "IMMICH_API_KEY=fake-env-file-api-key",
        "IMMICH_BASE_URL=https://env-file.example.com/",
        "IMMICH_CONCURRENCY=9",
        "",
      ].join("\n")
    );

    const config = await resolveConfig({ interactive: false }, process.env);

    expect(config.apiKey).toBe("fake-env-file-api-key");
    expect(config.baseUrl).toBe("https://env-file.example.com");
    expect(config.concurrency).toBe(9);
  });

  test("reset-config removes saved config before resolving", async () => {
    const dir = tempDir();
    process.chdir(dir);
    fs.writeFileSync(
      ".env",
      [
        "UNKNOWN=kept",
        "IMMICH_API_KEY=fake-env-file-api-key",
        "IMMICH_BASE_URL=https://env-file.example.com/",
        "",
      ].join("\n")
    );

    await expect(resolveConfig({ "reset-config": true, interactive: false }, {})).rejects.toThrow(
      "Missing IMMICH_API_KEY"
    );
    expect(fs.readFileSync(".env", "utf8")).toBe("UNKNOWN=kept\n");
  });
});
