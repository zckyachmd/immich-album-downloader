import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { log, resetProgressTracking, logProgress } from "../logger.js";

describe("logger", () => {
  let originalConsoleLog;
  let consoleLogSpy;

  beforeEach(() => {
    // Mock console.log
    originalConsoleLog = console.log;
    consoleLogSpy = jest.fn();
    console.log = consoleLogSpy;
  });

  afterEach(() => {
    // Restore console.log
    console.log = originalConsoleLog;
    if (consoleLogSpy.mockClear) {
      consoleLogSpy.mockClear();
    }
  });

  test("should log messages with correct format", () => {
    log("Test message", "info");

    expect(consoleLogSpy).toHaveBeenCalled();
    const logCall = consoleLogSpy.mock.calls[0][0];
    expect(logCall).toContain("Test message");
  });

  test("should handle different log levels", () => {
    log("Info message", "info");
    log("Warning message", "warn");
    log("Error message", "error");

    expect(consoleLogSpy).toHaveBeenCalledTimes(3);
  });

  test("should handle array messages", () => {
    log(["Message 1", "Message 2"], "info");

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test("should reset progress tracking", () => {
    // Should not throw
    expect(() => resetProgressTracking()).not.toThrow();
  });

  test("should handle logProgress with valid stats", () => {
    resetProgressTracking();

    // Should not throw
    expect(() => {
      logProgress(5, 10, {
        downloaded: 3,
        skipped: 1,
        failed: 1,
        downloadedBytes: 1024 * 1024,
        totalBytes: 2 * 1024 * 1024,
      });
    }).not.toThrow();
  });

  test("should handle logProgress with zero total", () => {
    // Should not throw and should return early
    expect(() => {
      logProgress(5, 0);
    }).not.toThrow();
  });

  test("should handle verbose option", () => {
    log("Verbose message", "info", { verbose: true });

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  test("should handle silent option", () => {
    log("Silent message", "info", { silent: true });

    // Should not print to console for non-important levels
    // But error/warn/info are important levels, so they still print
    // Let's test with a debug level
    consoleLogSpy.mockClear();
    log("Debug message", "debug", { silent: true });
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  test("should handle logProgress with speed calculation", () => {
    resetProgressTracking();

    // First call - initialize
    logProgress(1, 10, {
      downloaded: 1,
      downloadedBytes: 1024 * 1024, // 1 MB
      totalBytes: 10 * 1024 * 1024, // 10 MB
    });

    // Wait a bit to simulate time passing
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    return wait(200).then(() => {
      // Second call - should calculate speed
      expect(() => {
        logProgress(2, 10, {
          downloaded: 2,
          downloadedBytes: 2 * 1024 * 1024, // 2 MB
          totalBytes: 10 * 1024 * 1024,
        });
      }).not.toThrow();
    });
  });

  test("should handle logProgress with ETA calculation", () => {
    resetProgressTracking();

    // Simulate progress with speed
    logProgress(1, 10, {
      downloaded: 1,
      downloadedBytes: 1024 * 1024,
      totalBytes: 10 * 1024 * 1024,
    });

    return new Promise((resolve) => {
      setTimeout(() => {
        expect(() => {
          logProgress(5, 10, {
            downloaded: 5,
            downloadedBytes: 5 * 1024 * 1024,
            totalBytes: 10 * 1024 * 1024,
          });
        }).not.toThrow();
        resolve();
      }, 200);
    });
  });

  test("should handle logProgress edge cases", () => {
    resetProgressTracking();

    // Test with current > total
    expect(() => {
      logProgress(15, 10, { downloaded: 10 });
    }).not.toThrow();

    // Test with no stats
    expect(() => {
      logProgress(5, 10);
    }).not.toThrow();
  });
});
