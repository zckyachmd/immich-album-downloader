import { describe, test, expect } from "bun:test";
import { resolveConfig, validateConfig } from "../../src/lib/config";

const env = {
  IMMICH_API_KEY: "test-api-key-1234567890",
  IMMICH_BASE_URL: "https://example.com/",
};

describe("config", () => {
  test("validates config structure", () => {
    const config = validateConfig({ apiKey: env.IMMICH_API_KEY, baseUrl: env.IMMICH_BASE_URL });

    expect(config).toEqual({
      apiKey: "test-api-key-1234567890",
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
      { "api-key": "flag-api-key-123", "base-url": "https://flag.example.com" },
      env
    );

    expect(config.apiKey).toBe("flag-api-key-123");
    expect(config.baseUrl).toBe("https://flag.example.com");
  });
});
