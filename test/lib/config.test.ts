import { describe, test, expect } from "bun:test";
import { resolveConfig, validateConfig } from "../../src/lib/config";

const env = {
  IMMICH_API_KEY: "fake-api-key-for-tests",
  IMMICH_BASE_URL: "https://example.com/",
};

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
});
