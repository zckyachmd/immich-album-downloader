import { describe, test, expect, beforeEach } from "@jest/globals";
import { RateLimiter } from "../rateLimiter.js";

describe("RateLimiter", () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(5, 1000); // 5 requests per second
  });

  test("should allow requests within limit", async () => {
    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      await rateLimiter.waitIfNeeded();
    }
    const duration = Date.now() - start;
    // Should complete quickly (within 100ms)
    expect(duration).toBeLessThan(100);
  });

  test("should throttle requests exceeding limit", async () => {
    const start = Date.now();
    // Make 6 requests (exceeds limit of 5)
    for (let i = 0; i < 6; i++) {
      await rateLimiter.waitIfNeeded();
    }
    const duration = Date.now() - start;
    // Should take at least 1 second (window duration)
    expect(duration).toBeGreaterThanOrEqual(1000);
  });

  test("should reset correctly", async () => {
    // Make some requests
    for (let i = 0; i < 3; i++) {
      await rateLimiter.waitIfNeeded();
    }

    rateLimiter.reset();

    // After reset, should be able to make requests immediately
    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      await rateLimiter.waitIfNeeded();
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
