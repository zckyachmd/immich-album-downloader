import fs from "fs";
import path from "path";
import pLimit from "p-limit";
import readline from "readline";
import { downloadAssetById } from "./api.js";
import { log, logError, logProgress, logWarn, resetProgressTracking } from "./logger.js";
import {
  sanitizeName,
  calculateFileHash,
  validatePathWithinBase,
  formatFileSize,
} from "./helpers.js";
import {
  assetAlreadyDownloaded,
  markAssetAsDownloaded,
  markAssetAsFailed,
  getFailedAssets,
} from "./db.js";
import { config } from "./config.js";
import { cancellationToken } from "./cancellation.js";
import { DatabaseError } from "./errors.js";

const BASE_URL = config.baseUrl;

const checkFileExistence = async (filePath, expectedChecksum, assetId, albumId, targetDir) => {
  try {
    await fs.promises.access(filePath);

    const currentHash = await calculateFileHash(filePath);
    const currentHashBuffer = Buffer.from(currentHash, "hex");
    const decodedChecksum = Buffer.from(expectedChecksum, "base64");

    if (currentHashBuffer.equals(decodedChecksum)) {
      const stats = fs.statSync(filePath);
      if (stats.size > 0) {
        const alreadyInDb = await assetAlreadyDownloaded(
          assetId,
          albumId,
          expectedChecksum,
          targetDir
        );
        if (alreadyInDb) {
          return true;
        } else {
          await markAssetAsDownloaded(assetId, albumId, expectedChecksum, targetDir);
          return true;
        }
      }
    }
  } catch (err) {
    return false;
  }

  return false;
};

const downloadWithRetry = async (asset, outputFilePath, retries = 3, sizeLimitInBytes) => {
  // File size is in exifInfo.fileSizeInByte (confirmed from API testing)
  const assetSize =
    asset.exifInfo?.fileSizeInByte || asset.size || asset.fileSize || asset.originalSize || 0;

  if (assetSize > sizeLimitInBytes) {
    return { status: "skip", error: null };
  }

  let attempt = 0;
  let lastError = null;

  while (attempt < retries) {
    try {
      await downloadAssetById(asset.id, outputFilePath);
      return { status: "success", error: null };
    } catch (err) {
      attempt++;
      lastError = err;

      // If it's a cancellation error, don't retry
      if (err.name === "CancellationError") {
        throw err;
      }

      // If last attempt, return failed
      if (attempt >= retries) {
        return { status: "failed", error: err };
      }

      // Exponential backoff with jitter before retry
      // Base delay: 1s, 2s, 4s, 8s... max 10s
      const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      const jitter = Math.random() * 500; // Random 0-500ms
      const delay = baseDelay + jitter;

      // Only wait if not cancelled
      if (!cancellationToken.isCancelled()) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return { status: "failed", error: lastError };
};
export async function downloadAlbum(album, outputDir, options = {}) {
  // Validate base output directory
  const validatedOutputDir = path.resolve(outputDir);

  const albumDir = path.join(validatedOutputDir, sanitizeName(album.albumName));

  // Ensure album directory is within base
  const validatedAlbumDir = validatePathWithinBase(albumDir, validatedOutputDir);

  fs.mkdirSync(validatedAlbumDir, { recursive: true });

  let assetsToDownload = album.assets;

  if (options.resumeFailed) {
    const failedIds = await getFailedAssets(album.id);
    assetsToDownload = assetsToDownload.filter((a) => failedIds.includes(a.id));

    if (assetsToDownload.length === 0) {
      log(`📭 There are no failed assets to continue in the album: ${album.albumName}`);
      return;
    }
  }

  const total = assetsToDownload.length;
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const failedItems = []; // Track failed items with details

  // Calculate total size
  // File size is in exifInfo.fileSizeInByte based on actual API response
  const totalBytes = assetsToDownload.reduce((sum, asset) => {
    // Primary source: exifInfo.fileSizeInByte (confirmed from API testing)
    const size =
      asset.exifInfo?.fileSizeInByte || asset.size || asset.fileSize || asset.originalSize || 0;
    return sum + size;
  }, 0);

  let downloadedBytes = 0; // Track downloaded bytes
  let skippedBytes = 0; // Track skipped bytes (already downloaded)

  // Track total from actual files if API doesn't provide size info
  let totalBytesFromFiles = 0;

  // Reset progress tracking
  resetProgressTracking();

  // Show initial progress
  if (!options.dryRun) {
    const sizeInfo = totalBytes > 0 ? ` (${formatFileSize(totalBytes)})` : "";
    log(`📊 Processing ${total} file(s)${sizeInfo}...`);
    logProgress(0, total, {
      downloaded: 0,
      skipped: 0,
      failed: 0,
      downloadedBytes: 0,
      totalBytes: totalBytes,
    });
  }

  const limit = pLimit(options.concurrencyLimit || 5);

  const sizeLimitInBytes = options.limitSize ? options.limitSize * 1024 * 1024 : Infinity;

  const tasks = assetsToDownload.map((asset) =>
    limit(async () => {
      // Check for cancellation before starting download
      cancellationToken.throwIfCancelled();

      const safeFilename = sanitizeName(asset.originalFileName || `unnamed-${asset.id}`);
      const outputFilePath = path.join(albumDir, safeFilename);

      const fileChecksum = asset.checksum;

      // Validate final file path
      const validatedFilePath = validatePathWithinBase(outputFilePath, validatedAlbumDir);

      let fileExistsAndValid = false;
      try {
        fileExistsAndValid = await checkFileExistence(
          validatedFilePath,
          fileChecksum,
          asset.id,
          album.id,
          validatedAlbumDir
        );
      } catch (dbErr) {
        // If database check fails, assume file doesn't exist and continue
        if (dbErr instanceof DatabaseError) {
          logError(`⚠️  Database error while checking file existence: ${dbErr.message}`);
        }
        fileExistsAndValid = false;
      }

      // Check cancellation before processing
      cancellationToken.throwIfCancelled();

      if (!options.force && fileExistsAndValid) {
        skipped++;

        // Get actual file size for skipped files
        // Primary source: exifInfo.fileSizeInByte (confirmed from API testing)
        const assetSize =
          asset.exifInfo?.fileSizeInByte || asset.size || asset.fileSize || asset.originalSize || 0;
        let fileSize = assetSize;
        try {
          const stats = fs.statSync(validatedFilePath);
          fileSize = stats.size; // Use actual file size (more accurate)
          if (totalBytes === 0) {
            totalBytesFromFiles += fileSize;
          }
        } catch (err) {
          // If file doesn't exist or can't read, use asset size
          fileSize = assetSize;
          if (totalBytes === 0 && assetSize > 0) {
            totalBytesFromFiles += assetSize;
          }
        }

        skippedBytes += fileSize;
        if (totalBytes === 0) {
          totalBytesFromFiles += fileSize;
        }
        const effectiveTotalBytes = totalBytes > 0 ? totalBytes : totalBytesFromFiles;
        logProgress(downloaded + skipped + failed, total, {
          downloaded,
          skipped,
          failed,
          downloadedBytes: downloadedBytes + skippedBytes,
          totalBytes: effectiveTotalBytes,
        });
        return;
      }

      if (options.dryRun) {
        log(`💡 Dry-run: Simulates a download ${safeFilename} → ${outputFilePath}`);

        downloaded++;
        // For dry-run, use asset size
        // Primary source: exifInfo.fileSizeInByte (confirmed from API testing)
        const assetSize =
          asset.exifInfo?.fileSizeInByte || asset.size || asset.fileSize || asset.originalSize || 0;
        downloadedBytes += assetSize;
        if (totalBytes === 0 && assetSize > 0) {
          totalBytesFromFiles += assetSize;
        }

        const effectiveTotalBytes = totalBytes > 0 ? totalBytes : totalBytesFromFiles;
        logProgress(downloaded + skipped + failed, total, {
          downloaded,
          skipped,
          failed,
          downloadedBytes: downloadedBytes + skippedBytes,
          totalBytes: effectiveTotalBytes,
        });
        return;
      }

      try {
        // Check cancellation before starting download
        cancellationToken.throwIfCancelled();

        // Only show individual download messages in verbose mode
        // Otherwise, rely on progress bar for feedback
        if (options.verbose) {
          // Clear progress line, show download message, then restore progress
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(`⬇️  Downloading: ${safeFilename}\n`);
        }

        const downloadResult = await downloadWithRetry(
          asset,
          validatedFilePath,
          options.maxRetries || 3,
          sizeLimitInBytes
        );

        if (downloadResult.status === "skip") {
          skipped++;
          // For skipped files (size limit), use asset size
          // Primary source: exifInfo.fileSizeInByte (confirmed from API testing)
          const assetSize =
            asset.exifInfo?.fileSizeInByte ||
            asset.size ||
            asset.fileSize ||
            asset.originalSize ||
            0;
          skippedBytes += assetSize;
        } else if (downloadResult.status === "failed") {
          failed++;
          const errorMessage =
            downloadResult.error?.message || downloadResult.error?.toString() || "Unknown error";

          // Store failed item details
          failedItems.push({
            filename: safeFilename,
            assetId: asset.id,
            error: errorMessage,
          });

          // Try to mark as failed in database
          try {
            await markAssetAsFailed(asset.id, album.id, errorMessage);
          } catch (dbErr) {
            // Log database error but don't fail the download process
            if (dbErr instanceof DatabaseError) {
              logError(`⚠️  Database error while marking asset as failed: ${dbErr.message}`);
            } else {
              logError(`⚠️  Unexpected error while marking asset as failed: ${dbErr.message}`);
            }
          }

          // Log error (show in verbose mode or if it's a critical error)
          if (options.verbose || failedItems.length <= 10) {
            logError(`❌ Failed: ${safeFilename} | Error: ${errorMessage}`);
          }
        } else {
          downloaded++;

          // Get actual file size after download (more accurate than asset size)
          // Primary source: exifInfo.fileSizeInByte (confirmed from API testing)
          let fileSize =
            asset.exifInfo?.fileSizeInByte ||
            asset.size ||
            asset.fileSize ||
            asset.originalSize ||
            0;
          try {
            const stats = fs.statSync(validatedFilePath);
            fileSize = stats.size; // Use actual file size (most accurate)
            if (totalBytes === 0) {
              // If we don't have total from API, accumulate from actual files
              totalBytesFromFiles += fileSize;
            }
          } catch (err) {
            // If file doesn't exist or can't read, use asset size
            // Primary source: exifInfo.fileSizeInByte (confirmed from API testing)
            fileSize =
              asset.exifInfo?.fileSizeInByte ||
              asset.size ||
              asset.fileSize ||
              asset.originalSize ||
              0;
          }

          downloadedBytes += fileSize;

          try {
            await markAssetAsDownloaded(asset.id, album.id, fileChecksum, validatedAlbumDir);
          } catch (dbErr) {
            // Log database error but don't fail the download process
            if (dbErr instanceof DatabaseError) {
              logError(`⚠️  Database error while marking asset as downloaded: ${dbErr.message}`);
            } else {
              logError(`⚠️  Unexpected error while marking asset as downloaded: ${dbErr.message}`);
            }
          }
        }

        // Update progress with size information
        // Use totalBytesFromFiles if API didn't provide size info
        const effectiveTotalBytes = totalBytes > 0 ? totalBytes : totalBytesFromFiles;
        logProgress(downloaded + skipped + failed, total, {
          downloaded,
          skipped,
          failed,
          downloadedBytes: downloadedBytes + skippedBytes,
          totalBytes: effectiveTotalBytes,
        });
      } catch (err) {
        // Check if this is a cancellation error
        if (err.name === "CancellationError" || cancellationToken.isCancelled()) {
          // Don't mark as failed if cancelled - just rethrow
          throw err;
        }

        failed++;
        const errorMessage = err.message || err.toString() || "Unknown error";
        try {
          await markAssetAsFailed(asset.id, album.id, errorMessage);
        } catch (dbErr) {
          // Log database error but don't fail the download process
          if (dbErr instanceof DatabaseError) {
            logError(`⚠️  Database error while marking asset as failed: ${dbErr.message}`);
          } else {
            logError(`⚠️  Unexpected error while marking asset as failed: ${dbErr.message}`);
          }
        }

        // Store failed item details
        failedItems.push({
          filename: safeFilename,
          assetId: asset.id,
          error: errorMessage,
        });

        // Log error (show in verbose mode or if it's a critical error)
        if (options.verbose || failedItems.length <= 10) {
          logError(
            `❌ Failed: ${safeFilename} | Album: ${album.albumName} | Error: ${errorMessage}`
          );
        }
      }

      const effectiveTotalBytes = totalBytes > 0 ? totalBytes : totalBytesFromFiles;
      logProgress(downloaded + skipped + failed, total, {
        downloaded,
        skipped,
        failed,
        downloadedBytes: downloadedBytes + skippedBytes,
        totalBytes: effectiveTotalBytes,
      });
    })
  );

  // Wait for all tasks with cancellation support
  try {
    await Promise.all(tasks);
  } catch (err) {
    if (err.name === "CancellationError") {
      // Cancellation requested - don't treat as error
      // Clear progress line first
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write("\n");
      logWarn(`⚠️  Download cancelled: ${err.message}`);
      logWarn(`💡 Progress saved. You can resume with --resume-failed`);
    } else {
      throw err;
    }
  }

  // Clear progress line and move to new line
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write("\n");

  // Check if cancelled after tasks complete
  if (cancellationToken.isCancelled()) {
    logWarn(`\n⚠️  Download process was cancelled`);
    logWarn(`📊 Progress so far: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
    logWarn(`💡 You can resume failed downloads with --resume-failed`);
    return; // Exit early, don't show summary
  }

  // Print summary with enhanced statistics
  log(`\n📊 Download Summary for "${album.albumName}":`);
  log(`   ✅ Downloaded: ${downloaded}/${total}`);
  log(`   ⏩ Skipped: ${skipped}/${total}`);
  log(`   ❌ Failed: ${failed}/${total}`);

  // Show size information if available
  const effectiveTotalBytes = totalBytes > 0 ? totalBytes : totalBytesFromFiles;
  if (effectiveTotalBytes > 0) {
    const downloadedSize = formatFileSize(downloadedBytes + skippedBytes);
    const totalSize = formatFileSize(effectiveTotalBytes);
    log(`   📦 Size: ${downloadedSize} / ${totalSize}`);
  }

  // Show failed items if any
  if (failed > 0) {
    log(`\n❌ Failed Downloads (${failed} items):`);

    // Show first 20 failed items (or all if less than 20)
    const itemsToShow = failedItems.slice(0, 20);
    itemsToShow.forEach((item, index) => {
      log(`   ${index + 1}. ${item.filename}`);
      if (options.verbose) {
        log(`      Asset ID: ${item.assetId}`);
        log(`      Error: ${item.error}`);
      } else {
        // Show error in one line if not verbose
        const shortError =
          item.error.length > 60 ? item.error.substring(0, 60) + "..." : item.error;
        log(`      Error: ${shortError}`);
      }
    });

    if (failedItems.length > 20) {
      log(`   ... and ${failedItems.length - 20} more failed items`);
      log(`   💡 Use --verbose to see all failed items with details`);
    }

    log(`\n💡 Tip: Use --resume-failed to retry failed downloads`);
    log(`💡 Tip: Use --verbose to see detailed error messages`);
  }
}
