import { afterEach, describe, expect, mock, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

const cwd = process.cwd();
const isTTY = process.stdin.isTTY;
let tempDirs: string[] = [];
let promptResult = {};
const promptForConfig = mock(() => Promise.resolve(promptResult));

mock.module("@/cli/prompts", () => ({ promptForConfig }));

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iad-config-resolution-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  promptForConfig.mockClear();
  process.chdir(cwd);
  Object.defineProperty(process.stdin, "isTTY", { value: isTTY, configurable: true });
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

describe("config resolution", () => {
  test("missing config prompts in interactive mode", async () => {
    promptResult = {
      apiKey: "fake-prompt-api-key",
      baseUrl: "https://prompt.example.com",
      saveConfig: false,
    };
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });

    const { resolveConfig } = await import("../../src/lib/config");
    const config = await resolveConfig({}, {});

    expect(promptForConfig).toHaveBeenCalledTimes(1);
    expect(config.apiKey).toBe("fake-prompt-api-key");
    expect(config.baseUrl).toBe("https://prompt.example.com");
  });

  test("invalid prompt result is not saved", async () => {
    const dir = tempDir();
    process.chdir(dir);
    promptResult = {
      apiKey: "short",
      baseUrl: "https://prompt.example.com",
      saveConfig: true,
    };
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });

    const { resolveConfig } = await import("../../src/lib/config");

    await expect(resolveConfig({}, {})).rejects.toThrow("IMMICH_API_KEY appears to be invalid");
    expect(fs.existsSync(".env")).toBe(false);
  });
});
