import { afterEach, describe, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { runDownloader } from "../../src/core/downloader";

const cwd = process.cwd();
let tempDirs: string[] = [];

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iad-app-config-flow-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  process.chdir(cwd);
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

describe("app config flow", () => {
  test("health check failure is not saved", async () => {
    const dir = tempDir();
    process.chdir(dir);

    await expect(
      runDownloader(
        { all: true },
        {
          apiKey: "fake-api-key-for-tests",
          baseUrl: "http://127.0.0.1:9",
          defaultOutput: "./downloads",
          sslVerify: true,
          concurrency: 5,
          maxRetries: 3,
          downloadTimeout: 5000,
          saveConfig: true,
        }
      )
    ).rejects.toThrow("Cannot proceed without a valid connection");

    expect(fs.existsSync(".env")).toBe(false);
  });
});
