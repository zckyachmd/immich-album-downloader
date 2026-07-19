import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import fs from "fs";
import type { AppConfig } from "./config";
import { logError } from "./logger";
import { rateLimiter } from "./rateLimiter";
import { APIError, NetworkError } from "./errors";
import { getFetchOptions } from "./fetchConfig";
import { cancellationToken } from "./cancellation";

const getApiBase = (config: AppConfig) =>
  config.baseUrl.endsWith("/api") ? config.baseUrl : `${config.baseUrl}/api`;

/**
 * Fetches all albums from Immich API
 * @returns {Promise<Array>} Array of album objects
 * @throws {APIError} If API request fails
 * @throws {NetworkError} If network error occurs
 */
export async function getAlbums(config: AppConfig) {
  await rateLimiter.waitIfNeeded();

  try {
    // Normalize URL - ensure /api prefix
    const apiBase = getApiBase(config);
    const res = await fetch(
      `${apiBase}/albums`,
      getFetchOptions({
        headers: {
          "x-api-key": config.apiKey,
          Accept: "application/json",
        },
      }, config.sslVerify)
    );

    if (!res.ok) {
      throw new APIError(
        `Failed to fetch albums: ${res.status} ${res.statusText}`,
        res.status,
        "/api/albums"
      );
    }

    return await res.json();
  } catch (err) {
    if (err instanceof APIError) {
      throw err;
    }
    throw new NetworkError(`Network error while fetching albums: ${err.message}`, err);
  }
}

/**
 * Fetches assets for a specific album
 * @param {string} albumId - The album ID
 * @returns {Promise<Array>} Array of asset objects
 * @throws {APIError} If API request fails
 * @throws {NetworkError} If network error occurs
 * @throws {ValidationError} If response format is invalid
 */
export async function getAssetsByAlbumId(config: AppConfig, albumId) {
  const apiBase = getApiBase(config);

  try {
    await rateLimiter.waitIfNeeded();

    const albumRes = await fetch(
      `${apiBase}/albums/${albumId}?withoutAssets=false`,
      getFetchOptions({
        headers: {
          Accept: "application/json",
          "x-api-key": config.apiKey,
        },
      }, config.sslVerify)
    );

    if (!albumRes.ok) {
      throw new APIError(
        `Failed to fetch album ${albumId}: ${albumRes.status} ${albumRes.statusText}`,
        albumRes.status,
        `/api/albums/${albumId}`
      );
    }

    const album = await albumRes.json();
    if (Array.isArray(album?.assets)) return album.assets;
    if (Array.isArray(album?.assetList)) return album.assetList;
    if (Array.isArray(album?.items)) return album.items;
    if (Array.isArray(album)) return album;

    return await searchAssetsByAlbumId(config, apiBase, albumId, album?.assetCount);
  } catch (err) {
    if (err instanceof APIError) {
      throw err;
    }
    throw new NetworkError(`Network error while fetching album assets: ${err.message}`, err);
  }
}

async function searchAssetsByAlbumId(config: AppConfig, apiBase, albumId, expectedCount) {
  const assets = [];
  const pageSize = 1000;
  let page = 1;

  while (true) {
    await rateLimiter.waitIfNeeded();

    const res = await fetch(
      `${apiBase}/search/metadata`,
      getFetchOptions({
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
        },
        body: JSON.stringify({ albumIds: [albumId], page, size: pageSize, withExif: true }),
      }, config.sslVerify)
    );

    if (!res.ok) {
      throw new APIError(
        `Failed to search album ${albumId} assets: ${res.status} ${res.statusText}`,
        res.status,
        `/api/search/metadata`
      );
    }

    const data = await res.json();
    const items = data?.assets?.items ?? data?.items ?? data?.assets ?? data;

    if (!Array.isArray(items)) {
      logError("💥 Unexpected asset search response structure", { verbose: true });
      logError(`Response keys: ${Object.keys(data ?? {}).join(", ")}`, { verbose: true });
      throw new APIError(
        `Assets not found in search response for album ${albumId}. Response structure may have changed.`,
        500,
        `/api/search/metadata`
      );
    }

    assets.push(...items);

    const total = data?.assets?.total ?? data?.total ?? expectedCount;
    const nextPage = data?.assets?.nextPage ?? data?.nextPage;
    if (!nextPage && (items.length < pageSize || (total && assets.length >= total))) break;

    page = Number(nextPage ?? page + 1);
  }

  return assets;
}

/**
 * Downloads an asset by ID from Immich API
 * @param {string} assetId - The asset ID to download
 * @param {string} destPath - Destination file path
 * @param {number} retries - Number of retry attempts (default: 3)
 * @returns {Promise<boolean>} True if download successful
 * @throws {APIError} If API request fails with unrecoverable error
 * @throws {NetworkError} If network error occurs after all retries
 * @throws {FileSystemError} If file write fails
 */
export async function downloadAssetById(config: AppConfig, assetId, destPath, retries = 3) {
  // Check cancellation before starting
  cancellationToken.throwIfCancelled();

  // Normalize URL - ensure /api prefix
  const apiBase = getApiBase(config);
  const url = `${apiBase}/assets/${assetId}/original`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    // Check cancellation before each attempt
    cancellationToken.throwIfCancelled();

    await rateLimiter.waitIfNeeded();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.downloadTimeout);

    // Also abort on cancellation
    const cancelListener = () => {
      controller.abort();
    };
    const unsubscribe = cancellationToken.onCancel(cancelListener);

    try {
      const res = await fetch(
        url,
        getFetchOptions({
          headers: {
            "x-api-key": config.apiKey,
            Accept: "application/octet-stream",
          },
          signal: controller.signal,
        }, config.sslVerify)
      );

      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status < 500 && res.status !== 429) {
          throw new APIError(
            `Unrecoverable status ${res.status}`,
            res.status,
            `/api/assets/${assetId}/original`
          );
        }
        throw new APIError(
          `Status ${res.status} - ${res.statusText}`,
          res.status,
          `/api/assets/${assetId}/original`
        );
      }

      if (!res.body) {
        throw new APIError(
          "No response body (stream is null)",
          500,
          `/api/assets/${assetId}/original`
        );
      }

      const writeStream = fs.createWriteStream(destPath);

      try {
        await pipeline(Readable.fromWeb(res.body as unknown as NodeReadableStream), writeStream);

        // Remove cancel listener on success
        if (unsubscribe) {
          unsubscribe();
        }

        return true;
      } catch (pipeErr) {
        // Close stream on error
        writeStream.destroy();
        throw pipeErr;
      }
    } catch (err) {
      clearTimeout(timeout);

      // Remove cancel listener
      if (unsubscribe) {
        unsubscribe();
      }

      // Check if error is due to cancellation
      if (cancellationToken.isCancelled() || err.name === "AbortError") {
        // Clean up partial file if exists
        try {
          if (fs.existsSync(destPath)) {
            fs.unlinkSync(destPath);
          }
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }
        const cancelError = new Error("Download cancelled");
        cancelError.name = "CancellationError";
        throw cancelError;
      }

      // If it's an unrecoverable API error, throw immediately
      if (err instanceof APIError && err.statusCode < 500 && err.statusCode !== 429) {
        throw err;
      }

      // If last attempt, wrap error appropriately
      if (attempt === retries) {
        if (err instanceof APIError || err instanceof NetworkError) {
          throw err;
        }
        throw new NetworkError(
          `Failed to download asset after ${retries} attempts: ${err.message}`,
          err
        );
      }

      // Exponential backoff with jitter
      const backoff = Math.min(1000 * 2 ** (attempt - 1), 10000);
      const jitter = Math.random() * 300;
      await new Promise((r) => setTimeout(r, backoff + jitter));
    }
  }
}
