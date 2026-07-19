import { afterEach, describe, expect, mock, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { run } from "../../src/app";

const env = {
  IMMICH_API_KEY: process.env.IMMICH_API_KEY,
  IMMICH_BASE_URL: process.env.IMMICH_BASE_URL,
};
let tempDirs: string[] = [];

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iad-db-command-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  mock.restore();

  if (env.IMMICH_API_KEY === undefined) delete process.env.IMMICH_API_KEY;
  else process.env.IMMICH_API_KEY = env.IMMICH_API_KEY;

  if (env.IMMICH_BASE_URL === undefined) delete process.env.IMMICH_BASE_URL;
  else process.env.IMMICH_BASE_URL = env.IMMICH_BASE_URL;

  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

describe("database commands", () => {
  test("backup-db handles directory path", async () => {
    const dir = tempDir();

    await expect(run({ "backup-db": `${dir}/` })).resolves.toBe(0);

    expect(fs.readdirSync(dir).some((file) => file.startsWith("downloads.db.backup."))).toBe(true);
  });

  test("cleanup-db rejects invalid numeric range", async () => {
    await expect(run({ "cleanup-db": 0 })).resolves.toBe(1);
    await expect(run({ "cleanup-db": 1.5 })).resolves.toBe(1);
  });

  test("restore-db warns before destructive action", async () => {
    const logs: string[] = [];
    const consoleMock = mock((message: string) => logs.push(message));
    console.log = consoleMock as unknown as typeof console.log;

    await expect(run({ "restore-db": path.join(tempDir(), "missing.db") })).resolves.toBe(1);

    expect(logs.some((line) => line.includes("WARNING: This will replace the current database"))).toBe(
      true
    );
  });

  test("list-backups does not require Immich config", async () => {
    delete process.env.IMMICH_API_KEY;
    delete process.env.IMMICH_BASE_URL;

    await expect(run({ "list-backups": true })).resolves.toBe(0);
  });
});
