import { describe, test, expect } from "bun:test";
import { config } from "../config";

describe("config", () => {
  test("should have valid config structure", () => {
    expect(config).toHaveProperty("apiKey");
    expect(config).toHaveProperty("baseUrl");
    expect(config).toHaveProperty("sslVerify");
    expect(config).toHaveProperty("concurrency");
    expect(config).toHaveProperty("maxRetries");
    expect(config).toHaveProperty("downloadTimeout");
    expect(config).toHaveProperty("defaultOutput");
  });
});
