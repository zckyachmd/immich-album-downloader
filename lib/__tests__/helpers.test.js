import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import {
  sanitizeName,
  validatePathWithinBase,
  expandPath,
  calculateFileHash,
  formatFileSize,
  formatDuration,
} from "../helpers.js";
import { PathTraversalError } from "../errors.js";
import path from "path";
import os from "os";
import fs from "fs";
import crypto from "crypto";

describe("helpers", () => {
  describe("sanitizeName", () => {
    test("should sanitize invalid characters", () => {
      expect(sanitizeName("test/file\\name")).toBe("test-file-name");
      // Note: * is replaced with empty string, not dash
      expect(sanitizeName("test?name*")).toBe("test-name");
    });

    test("should remove path traversal attempts", () => {
      expect(sanitizeName("../../../etc/passwd")).toBe("etc-passwd");
      expect(sanitizeName("..test..")).toBe("test");
    });

    test("should handle empty or invalid input", () => {
      expect(sanitizeName("")).toBe("unnamed");
      expect(sanitizeName(null)).toBe("unnamed");
      expect(sanitizeName(undefined)).toBe("unnamed");
    });

    test("should limit length to 255 characters", () => {
      const longName = "a".repeat(300);
      const result = sanitizeName(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });

    test("should remove leading/trailing dashes", () => {
      expect(sanitizeName("---test---")).toBe("test");
      expect(sanitizeName("-test-")).toBe("test");
    });

    test("should handle special characters", () => {
      expect(sanitizeName('test%name:with|chars"<>')).toBe("test-name-with-chars");
    });

    test("should collapse multiple dashes", () => {
      expect(sanitizeName("test---name")).toBe("test-name");
    });
  });

  describe("validatePathWithinBase", () => {
    const baseDir = os.tmpdir();

    test("should allow valid paths within base", () => {
      const validPath = path.join(baseDir, "subdir", "file.txt");
      const result = validatePathWithinBase(validPath, baseDir);
      expect(result).toBe(path.resolve(validPath));
    });

    test("should throw PathTraversalError for paths outside base", () => {
      const outsidePath = path.join(os.homedir(), "sensitive-file.txt");
      expect(() => {
        validatePathWithinBase(outsidePath, baseDir);
      }).toThrow(PathTraversalError);
    });

    test("should allow base directory itself", () => {
      const result = validatePathWithinBase(baseDir, baseDir);
      expect(result).toBe(path.resolve(baseDir));
    });

    test("should handle relative paths correctly", () => {
      const validPath = path.join(baseDir, "test", "file.txt");
      const result = validatePathWithinBase(validPath, baseDir);
      expect(result).toBe(path.resolve(validPath));
    });
  });

  describe("expandPath", () => {
    let testDir;

    beforeEach(() => {
      testDir = path.join(os.tmpdir(), "immich-test-" + Date.now());
    });

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    test("should expand path with ~ to home directory", () => {
      const result = expandPath("~/test-dir");
      expect(result).toContain(os.homedir());
      expect(fs.existsSync(result)).toBe(true);
    });

    test("should resolve relative paths", () => {
      const result = expandPath("./test-dir");
      expect(path.isAbsolute(result)).toBe(true);
      expect(fs.existsSync(result)).toBe(true);
    });

    test("should create directory if it does not exist", () => {
      const newDir = path.join(testDir, "new-subdir");
      const result = expandPath(newDir);
      expect(fs.existsSync(result)).toBe(true);
      expect(fs.statSync(result).isDirectory()).toBe(true);
    });

    test("should normalize path", () => {
      const result = expandPath(testDir + "/../test-dir");
      expect(result).not.toContain("..");
    });
  });

  describe("calculateFileHash", () => {
    let testFile;

    beforeEach(() => {
      testFile = path.join(os.tmpdir(), "test-file-" + Date.now() + ".txt");
      fs.writeFileSync(testFile, "test content");
    });

    afterEach(() => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    test("should calculate SHA1 hash of file", async () => {
      const hash = await calculateFileHash(testFile);
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(40); // SHA1 hex is 40 chars
    });

    test("should reject when file does not exist", async () => {
      await expect(calculateFileHash("/nonexistent/file.txt")).rejects.toThrow();
    });

    test("should produce consistent hash for same content", async () => {
      const hash1 = await calculateFileHash(testFile);
      const hash2 = await calculateFileHash(testFile);
      expect(hash1).toBe(hash2);
    });
  });

  describe("formatFileSize", () => {
    test("should format bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 B");
      expect(formatFileSize(1024)).toBe("1.0 KB");
      expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.0 GB");
    });

    test("should handle edge cases", () => {
      expect(formatFileSize(Infinity)).toBe("Unknown");
      expect(formatFileSize(NaN)).toBe("Unknown");
    });

    test("should format decimal sizes correctly", () => {
      expect(formatFileSize(1536)).toBe("1.5 KB");
      expect(formatFileSize(2560)).toBe("2.5 KB");
    });

    test("should handle large sizes", () => {
      expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe("1.0 TB");
    });
  });

  describe("formatDuration", () => {
    test("should format seconds correctly", () => {
      expect(formatDuration(0)).toBe("0s");
      expect(formatDuration(5000)).toBe("5s");
      expect(formatDuration(30000)).toBe("30s");
    });

    test("should format minutes correctly", () => {
      expect(formatDuration(60000)).toBe("1m 0s");
      expect(formatDuration(90000)).toBe("1m 30s");
      expect(formatDuration(120000)).toBe("2m 0s");
    });

    test("should format hours correctly", () => {
      expect(formatDuration(3600000)).toBe("1h 0m 0s");
      expect(formatDuration(3665000)).toBe("1h 1m 5s");
    });

    test("should format days correctly", () => {
      expect(formatDuration(86400000)).toBe("1d 0h 0m");
      expect(formatDuration(90000000)).toBe("1d 1h 0m");
    });

    test("should handle edge cases", () => {
      expect(formatDuration(Infinity)).toBe("Unknown");
      expect(formatDuration(NaN)).toBe("Unknown");
      expect(formatDuration(-1000)).toBe("Unknown");
    });
  });
});
