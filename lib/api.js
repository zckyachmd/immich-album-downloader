import { pipeline } from "stream/promises";
import fetch from "node-fetch";
import fs from "fs";
import { config } from "./config.js";
import { logError } from "./logger.js";
import { rateLimiter } from "./rateLimiter.js";
import { APIError, NetworkError } from "./errors.js";
import { getFetchOptions } from "./fetchConfig.js";
import { cancellationToken } from "./cancellation.js";

const API_KEY = config.apiKey;
const BASE_URL = config.baseUrl;

/**
 * Fetches all albums from Immich API
 * @returns {Promise<Array>} Array of album objects
 * @throws {APIError} If API request fails
 * @throws {NetworkError} If network error occurs
 */
export async function getAlbums() {
  await rateLimiter.waitIfNeeded();

  try {
    // Normalize URL - ensure /api prefix
    const apiBase = BASE_URL.endsWith("/api") ? BASE_URL : `${BASE_URL}/api`;
    const res = await fetch(
      `${apiBase}/albums`,
      getFetchOptions({
        headers: {
          "x-api-key": API_KEY,
          Accept: "application/json",
        },
      })
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
export async function getAssetsByAlbumId(albumId) {
  await rateLimiter.waitIfNeeded();

  try {
    // Normalize URL - ensure /api prefix
    const apiBase = BASE_URL.endsWith("/api") ? BASE_URL : `${BASE_URL}/api`;
    const res = await fetch(
      `${apiBase}/albums/${albumId}`,
      getFetchOptions({
        headers: {
          Accept: "application/json",
          "x-api-key": API_KEY,
        },
      })
    );

    if (!res.ok) {
      throw new APIError(
        `Failed to fetch album ${albumId}: ${res.status} ${res.statusText}`,
        res.status,
        `/api/albums/${albumId}`
      );
    }

    const album = await res.json();

    // Validate response structure
    if (!album || typeof album !== "object") {
      throw new APIError(
        `Invalid response format for album ${albumId}`,
        500,
        `/api/albums/${albumId}`
      );
    }

    // Try to find assets array in different possible locations
    let assets = null;

    if (Array.isArray(album.assets)) {
      assets = album.assets;
    } else if (Array.isArray(album.assetList)) {
      assets = album.assetList;
    } else if (Array.isArray(album.items)) {
      assets = album.items;
    } else if (Array.isArray(album)) {
      // If response is directly an array, it might be the assets
      assets = album;
    }

    if (!assets || !Array.isArray(assets)) {
      logError("💥 Unexpected asset response structure", { verbose: true });
      logError(`Response keys: ${Object.keys(album).join(", ")}`, { verbose: true });
      throw new APIError(
        `Assets not found in response for album ${albumId}. Response structure may have changed.`,
        500,
        `/api/albums/${albumId}`
      );
    }

    return assets;
  } catch (err) {
    if (err instanceof APIError) {
      throw err;
    }
    throw new NetworkError(`Network error while fetching album assets: ${err.message}`, err);
  }
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
export async function downloadAssetById(assetId, destPath, retries = 3) {
  // Check cancellation before starting
  cancellationToken.throwIfCancelled();

  // Normalize URL - ensure /api prefix
  const apiBase = BASE_URL.endsWith("/api") ? BASE_URL : `${BASE_URL}/api`;
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
            "x-api-key": API_KEY,
            Accept: "application/octet-stream",
          },
          signal: controller.signal,
        })
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
        await pipeline(res.body, writeStream);

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
