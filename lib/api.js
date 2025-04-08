import { pipeline } from "stream/promises";
import fetch from "node-fetch";
import fs from "fs";

const API_KEY = process.env.IMMICH_API_KEY;
const BASE_URL = process.env.IMMICH_BASE_URL;

export async function getAlbums() {
  const res = await fetch(`${BASE_URL}/api/albums`, {
    headers: {
      "x-api-key": API_KEY,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch albums: ${res.status}`);
  }

  return await res.json();
}

export async function getAssetsByAlbumId(albumId) {
  const res = await fetch(`${BASE_URL}/api/albums/${albumId}`, {
    headers: {
      Accept: "application/json",
      "x-api-key": API_KEY,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch album ${albumId}: ${res.status}`);
  }

  const album = await res.json();

  if (!Array.isArray(album.assets)) {
    console.error("💥 Unexpected asset response:", album);
    throw new Error(`Invalid asset list for album ${albumId}`);
  }

  return album.assets;
}

export async function downloadAssetById(assetId, destPath, retries = 3) {
  const url = `${BASE_URL}/api/assets/${assetId}/original`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(url, {
        headers: {
          "x-api-key": API_KEY,
          Accept: "application/octet-stream",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status < 500 && res.status !== 429) {
          throw new Error(`Unrecoverable status ${res.status}`);
        }
        throw new Error(`Status ${res.status} - ${res.statusText}`);
      }

      if (!res.body) {
        throw new Error("No response body (stream is null)");
      }

      await pipeline(res.body, fs.createWriteStream(destPath));
      return true;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === retries) throw err;

      const backoff = Math.min(1000 * 2 ** (attempt - 1), 10000);
      const jitter = Math.random() * 300;
      await new Promise((r) => setTimeout(r, backoff + jitter));
    }
  }
}
