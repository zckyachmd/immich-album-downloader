import { afterEach, describe, expect, test, mock } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { APIError } from "../errors";
import { downloadAssetById, getAlbums, getAssetsByAlbumId } from "../api";

const apiKey = "test-api-key-1234567890";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  mock.restore();
});

describe("Immich API client", () => {
  test("GET /api/albums uses official x-api-key auth header", async () => {
    const albums = [
      {
        id: "album-1",
        albumName: "Vacation Photos",
        assetCount: 1,
        assets: [],
      },
    ];
    const fetchMock = mock(() => Promise.resolve(jsonResponse(albums)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(getAlbums()).resolves.toEqual(albums);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/api/albums");
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "x-api-key": apiKey,
      Accept: "application/json",
    });
  });

  test("GET /api/albums/{id} returns official AlbumResponseDto assets", async () => {
    const assets = [
      {
        id: "asset-1",
        originalFileName: "IMG_0001.jpg",
        checksum: Buffer.from("checksum").toString("base64"),
        exifInfo: { fileSizeInByte: 8 },
      },
    ];
    const album = {
      id: "album-1",
      albumName: "Vacation Photos",
      assetCount: 1,
      assets,
    };
    const fetchMock = mock(() => Promise.resolve(jsonResponse(album)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(getAssetsByAlbumId("album-1")).resolves.toEqual(assets);

    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/api/albums/album-1");
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      Accept: "application/json",
      "x-api-key": apiKey,
    });
  });

  test("GET /api/assets/{id}/original writes original asset bytes", async () => {
    const bytes = new TextEncoder().encode("original");
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(bytes, {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        })
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "immich-api-test-"));
    const dest = path.join(dir, "asset.bin");

    await expect(downloadAssetById("asset-1", dest, 1)).resolves.toBe(true);

    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/api/assets/asset-1/original");
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "x-api-key": apiKey,
      Accept: "application/octet-stream",
    });
    expect(fs.readFileSync(dest, "utf8")).toBe("original");

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("throws APIError for non-OK album responses", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ message: "Unauthorized" }, 401))
    ) as unknown as typeof fetch;

    await expect(getAlbums()).rejects.toThrow(APIError);
  });
});
