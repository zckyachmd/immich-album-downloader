import { afterEach, describe, expect, test, mock } from "bun:test";
import { checkHealth } from "@/lib/health";

const testConfig = {
  apiKey: "test-api-key-1234567890",
  baseUrl: "https://example.com",
  defaultOutput: "./downloads",
  sslVerify: true,
  concurrency: 5,
  maxRetries: 3,
  downloadTimeout: 30000,
};
const endpoints = {
  serverAbout: "https://example.com/api/server/about",
  albums: "https://example.com/api/albums",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  mock.restore();
});

describe("Immich health check", () => {
  test("GET /api/server/about uses official server info endpoint first", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(jsonResponse({ version: "v2.3.1", build: "abcdef0" }))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(checkHealth(testConfig)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(endpoints.serverAbout);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "x-api-key": "test-api-key-1234567890",
      Accept: "application/json",
    });
  });

  test("falls back to GET /api/albums when server/about fails", async () => {
    const fetchMock = mock((url: string) => {
      if (url === endpoints.serverAbout) {
        return Promise.resolve(jsonResponse({ message: "Not Found" }, 404));
      }
      if (url === endpoints.albums) {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.reject(new Error(`Unexpected endpoint: ${url}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(checkHealth(testConfig)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(endpoints.serverAbout);
    expect(fetchMock.mock.calls[1][0]).toBe(endpoints.albums);
  });

  test("returns false on authentication failure", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ message: "Unauthorized" }, 401))
    ) as unknown as typeof fetch;

    await expect(checkHealth(testConfig)).resolves.toBe(false);
  });
});
