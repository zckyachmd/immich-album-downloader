import { describe, test, expect } from "bun:test";
import { getFetchOptions } from "../../src/lib/fetchConfig";

describe("fetchConfig", () => {
  test("should return fetch options", () => {
    const options = getFetchOptions({
      headers: { "x-api-key": "test" },
    });

    expect(options.headers).toEqual({ "x-api-key": "test" });
  });

  test("should handle empty options", () => {
    const options = getFetchOptions();

    expect(options.headers).toBeUndefined();
  });
});
