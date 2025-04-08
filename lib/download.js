import fs from "fs";
import path from "path";
import pLimit from "p-limit";
import { downloadAssetById } from "./api.js";
import { log, logError, logProgress } from "./logger.js";
import { sanitizeName, calculateFileHash } from "./helpers.js";
import {
  assetAlreadyDownloaded,
  markAssetAsDownloaded,
  markAssetAsFailed,
  getFailedAssets,
} from "./db.js";

const BASE_URL = process.env.IMMICH_BASE_URL;

const checkFileExistence = async (
  filePath,
  expectedChecksum,
  assetId,
  albumId,
  targetDir
) => {
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
          await markAssetAsDownloaded(
            assetId,
            albumId,
            expectedChecksum,
            targetDir
          );
          return true;
        }
      }
    }
  } catch (err) {
    return false;
  }

  return false;
};

const downloadWithRetry = async (
  asset,
  outputFilePath,
  retries = 3,
  sizeLimitInBytes
) => {
  if (asset.size > sizeLimitInBytes) {
    return "skip";
  }

  let attempt = 0;
  while (attempt < retries) {
    try {
      await downloadAssetById(asset.id, outputFilePath);
      return "success";
    } catch (err) {
      attempt++;
      if (attempt >= retries) {
        return "failed";
      }
    }
  }
};
export async function downloadAlbum(album, outputDir, options = {}) {
  const albumDir = path.join(outputDir, sanitizeName(album.albumName));
  fs.mkdirSync(albumDir, { recursive: true });

  let assetsToDownload = album.assets;

  if (options.resumeFailed) {
    const failedIds = await getFailedAssets(album.id);
    assetsToDownload = assetsToDownload.filter((a) => failedIds.includes(a.id));

    if (assetsToDownload.length === 0) {
      log(
        `📭 There are no failed assets to continue in the album: ${album.albumName}`
      );
      return;
    }
  }

  const total = assetsToDownload.length;
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  const limit = pLimit(options.concurrencyLimit || 5);

  const sizeLimitInBytes = options.limitSize
    ? options.limitSize * 1024 * 1024
    : Infinity;

  const tasks = assetsToDownload.map((asset) =>
    limit(async () => {
      const safeFilename = sanitizeName(
        asset.originalFileName || `unnamed-${asset.id}`
      );
      const outputFilePath = path.join(albumDir, safeFilename);

      const fileChecksum = asset.checksum;

      const fileExistsAndValid = await checkFileExistence(
        outputFilePath,
        fileChecksum,
        asset.id,
        album.id,
        albumDir
      );

      if (!options.force && fileExistsAndValid) {
        skipped++;
        logProgress(downloaded + skipped + failed, total, {
          downloaded,
          skipped,
          failed,
        });
        return;
      }

      if (options.dryRun) {
        log(
          `💡 Dry-run: Simulates a download ${safeFilename} → ${outputFilePath}`
        );

        downloaded++;

        logProgress(downloaded + skipped + failed, total, {
          downloaded,
          skipped,
          failed,
        });
        return;
      }

      try {
        if (options.verbose) {
          process.stdout.write(
            `\n⬇️  Downloading: ${safeFilename} → ${outputFilePath}\n`
          );
        }

        const downloadSuccess = await downloadWithRetry(
          asset,
          outputFilePath,
          3,
          sizeLimitInBytes
        );

        if (downloadSuccess === "skip") {
          skipped++;
          logProgress(downloaded + skipped + failed, total, {
            downloaded,
            skipped,
            failed,
          });
          return;
        } else if (downloadSuccess === "failed") {
          failed++;
          await markAssetAsFailed(asset.id, album.id);
        } else {
          downloaded++;
          await markAssetAsDownloaded(
            asset.id,
            album.id,
            fileChecksum,
            albumDir
          );
        }
      } catch (err) {
        failed++;
        await markAssetAsFailed(asset.id, album.id);

        logError(
          `❌ Failed: ${safeFilename} | Album: ${album.albumName} | URL: ${BASE_URL}/photos/${asset.id} | Reason: ${err.message}`,
          { silent: true }
        );
      }

      logProgress(downloaded + skipped + failed, total, {
        downloaded,
        skipped,
        failed,
      });
    })
  );

  await Promise.all(tasks);
  process.stdout.write("\n");
}
