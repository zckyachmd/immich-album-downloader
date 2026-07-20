// @ts-nocheck
import inquirer from "inquirer";
import { writeEnvConfig } from "@/cli/configFile";
import { getAlbums, getAssetsByAlbumId } from "@/lib/api";
import { cancellationToken, setupSignalHandlers } from "@/lib/cancellation";
import type { AppConfig } from "@/lib/config";
import { CancellationError, ValidationError } from "@/lib/errors";
import { expandPath } from "@/lib/helpers";
import { checkHealth } from "@/lib/health";
import { log, logError, logWarn } from "@/lib/logger";

export let databaseLoaded = false;

export const loadDatabase = async () => {
  databaseLoaded = true;
  return import("../lib/db");
};

export const markDatabaseLoaded = () => {
  databaseLoaded = true;
};

const validateFlags = (options) => {
  const flagValidations = [
    {
      flag: "limit-size",
      errorMsg: "❌ --limit-size must be a valid number.",
      validator: (val) => val > 0 && val <= 100000,
      rangeMsg: "❌ --limit-size must be between 1 and 100000 MB.",
    },
    {
      flag: "concurrency",
      errorMsg: "❌ --concurrency must be a valid number.",
      validator: (val) => val >= 1 && val <= 50,
      rangeMsg: "❌ --concurrency must be between 1 and 50.",
    },
    {
      flag: "max-retries",
      errorMsg: "❌ --max-retries must be a valid number.",
      validator: (val) => val >= 0 && val <= 10,
      rangeMsg: "❌ --max-retries must be between 0 and 10.",
    },
  ];

  flagValidations.forEach(({ flag, errorMsg, validator, rangeMsg }) => {
    if (options[flag] !== undefined) {
      if (isNaN(options[flag])) {
        throw new ValidationError(errorMsg, flag);
      }
      if (validator && !validator(options[flag])) {
        throw new ValidationError(rangeMsg || `${errorMsg} Value out of acceptable range.`, flag);
      }
    }
  });

  if (options["only"] !== undefined && typeof options["only"] !== "string") {
    throw new ValidationError("❌ --only must be a string.", "only");
  }

  if (options["exclude"] !== undefined && typeof options["exclude"] !== "string") {
    throw new ValidationError("❌ --exclude must be a string.", "exclude");
  }

  if (options["output"] !== undefined && typeof options["output"] !== "string") {
    throw new ValidationError("❌ --output must be a string.", "output");
  }

  if (options["dry-run"] && options["resume-failed"]) {
    logWarn("⚠️ Dry run + resume-failed used together. Nothing will be resumed.");
  }
};

const selectTargets = async (options, albums) => {
  if (options.all || options.only) {
    if (options.all) {
      log(`🛠  --all. ${albums.length} target(s).`);
      return albums;
    }
    if (options["only"]) {
      const filteredAlbums = albums.filter((album) =>
        album.albumName.toLowerCase().includes(options["only"].toLowerCase())
      );
      log(`🔎 Filtered by "--only": ${filteredAlbums.length} matched`);
      return filteredAlbums;
    }
  }

  if (options["exclude"]) {
    const filteredAlbums = albums.filter(
      (album) => !album.albumName.toLowerCase().includes(options["exclude"].toLowerCase())
    );
    log(`🔎 Filtered by "--exclude": ${filteredAlbums.length} matched`);
    return filteredAlbums;
  }

  const { selectedAlbums } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selectedAlbums",
      message: "🎯 Select album(s) to backup:",
      choices: albums.map((album) => ({
        name: `${album.albumName} (${album.assetCount} items)`,
        value: album,
      })),
      validate: (value) => (value.length > 0 ? true : "Please select at least one album"),
    },
  ]);

  log(`🧠 Selected ${selectedAlbums.length} album(s) via prompt.`);
  return selectedAlbums;
};

export const runDownloader = async (options, config: AppConfig) => {
  if (options["dry-run"]) options.verbose = true;

  setupSignalHandlers();

  validateFlags(options);

  const resolvedOutputDir = expandPath(options.output ?? config.defaultOutput);

  log("Checking connection to Immich server...");
  const isHealthy = await checkHealth(config);
  if (!isHealthy) {
    throw new ValidationError("💥 Cannot proceed without a valid connection to Immich server.");
  }

  if (config.saveConfig) writeEnvConfig(config);

  const concurrency = options["concurrency"] ?? config.concurrency;
  const maxRetries = options["max-retries"] ?? config.maxRetries;

  log(`Configuration:`);
  log(`-- Output directory: ${resolvedOutputDir}${options.output ? " (CLI)" : " (from .env)"}`);
  log(`-- Concurrency: ${concurrency}${options["concurrency"] ? " (CLI)" : " (from .env)"}`);
  log(`-- Max retries: ${maxRetries}${options["max-retries"] ? " (CLI)" : " (from .env)"}`);
  if (options["limit-size"]) log(`-- Limit size: ${options["limit-size"]} MB`);
  if (options.force) log(`-- Override existing files: enabled`);
  log("Press Ctrl+C to cancel gracefully\n", "info");

  const albums = await getAlbums(config);
  if (!albums.length) {
    logWarn("🚫 No albums found.");
    return;
  }

  const sortedAlbums = albums.sort((a, b) => a.albumName.localeCompare(b.albumName));
  const targets = await selectTargets(options, sortedAlbums);
  if (!targets.length) {
    logWarn("🚫 No album selected. Exiting.");
    return;
  }

  for (const [i, album] of targets.entries()) {
    if (cancellationToken.isCancelled()) {
      logWarn(`\n⚠️  Download cancelled. Processed ${i}/${targets.length} album(s).`);
      break;
    }

    log(
      `\n💾 [${i + 1}/${targets.length}] ${
        options["dry-run"] ? "[DRY RUN] Simulating download for" : "Downloading"
      } ${album.albumName}${options["resume-failed"] ? " (Resume)" : ""}`
    );

    try {
      const assets = await getAssetsByAlbumId(config, album.id);
      if (!assets.length) {
        logWarn(`🚫 Album "${album.albumName}" empty, skip.`);
        continue;
      }
      album.assets = assets;
    } catch (err) {
      if (cancellationToken.isCancelled()) {
        logWarn(`\n⚠️  Download cancelled while fetching album "${album.albumName}".`);
        break;
      }
      logError(`💥 Failed fetch album from ${album.albumName}: ${err.message}`);
      continue;
    }

    if (options["dry-run"]) {
      log(`🧪 Dry run: ${album.assets.length} asset(s) found, no files downloaded.`);
      continue;
    }

    try {
      databaseLoaded = true;
      const { downloadAlbum } = await import("../lib/download.js");
      await downloadAlbum(album, resolvedOutputDir, {
        force: options.force,
        resumeFailed: options["resume-failed"],
        verbose: options.verbose,
        dryRun: options["dry-run"],
        maxRetries: maxRetries,
        concurrencyLimit: concurrency,
        limitSize: options["limit-size"],
        config,
      });
    } catch (err) {
      if (err.name === "CancellationError" || cancellationToken.isCancelled()) {
        logWarn(`\n⚠️  Download cancelled during album "${album.albumName}".`);
        break;
      }
      throw err;
    }

    if (cancellationToken.isCancelled()) {
      logWarn(`\n⚠️  Download cancelled. Completed ${i + 1}/${targets.length} album(s).`);
      break;
    }
  }

  if (cancellationToken.isCancelled()) {
    logWarn("\n⚠️  Download process was cancelled by user.");
    logWarn("💡 Progress has been saved. Use --resume-failed to continue where you left off.\n");
    throw new CancellationError();
  }

  if (!options["dry-run"]) {
    try {
      const { getDatabaseStats } = await import("../lib/db");
      const dbStats = await getDatabaseStats();
      log("\n📊 Overall Database Statistics:");
      log(`   Total records: ${dbStats.total}`);
      log(`   ✅ Downloaded: ${dbStats.downloaded}`);
      log(`   ⏩ Skipped: ${dbStats.skipped}`);
      log(`   ❌ Failed: ${dbStats.failed}`);
      if (dbStats.failed > 0) {
        log(`   💡 Use --resume-failed to retry failed downloads`);
      }
    } catch (err) {
      logWarn(`⚠️  Could not retrieve database statistics: ${err.message}`);
    }
  }

  log(
    options["dry-run"]
      ? "\n🧪 Dry run completed. No files were downloaded.\n"
      : "\n✅ Backup completed. Please check the output directory & logs if anything went wrong.\n"
  );
};
