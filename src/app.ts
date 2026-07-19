// @ts-nocheck
import "dotenv/config";
import inquirer from "inquirer";
import { getAlbums, getAssetsByAlbumId } from "./lib/api.js";
import { expandPath } from "./lib/helpers";
import { log, logError, logWarn } from "./lib/logger.js";
import { parseArgs } from "./cli/index";
// Import config to validate environment variables early
import { config } from "./lib/config.js";
import { checkHealth } from "./lib/health.js";
import { ValidationError, ConfigurationError } from "./lib/errors.js";
import { setupSignalHandlers, cancellationToken } from "./lib/cancellation.js";

let databaseLoaded = false;

const loadDatabase = async () => {
  databaseLoaded = true;
  return import("./lib/db");
};

const validateFlags = (argv) => {
  const flagValidations = [
    {
      flag: "limit-size",
      errorMsg: "❌ --limit-size must be a valid number.",
      validator: (val) => val > 0 && val <= 100000, // Max 100GB
      rangeMsg: "❌ --limit-size must be between 1 and 100000 MB.",
    },
    {
      flag: "concurrency",
      errorMsg: "❌ --concurrency must be a valid number.",
      validator: (val) => val >= 1 && val <= 50, // Reasonable limits
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
    if (argv[flag] !== undefined) {
      if (isNaN(argv[flag])) {
        throw new ValidationError(errorMsg, flag);
      }
      if (validator && !validator(argv[flag])) {
        throw new ValidationError(rangeMsg || `${errorMsg} Value out of acceptable range.`, flag);
      }
    }
  });

  // Validate string inputs
  if (argv["only"] !== undefined && typeof argv["only"] !== "string") {
    throw new ValidationError("❌ --only must be a string.", "only");
  }

  if (argv["exclude"] !== undefined && typeof argv["exclude"] !== "string") {
    throw new ValidationError("❌ --exclude must be a string.", "exclude");
  }

  if (argv["output"] !== undefined && typeof argv["output"] !== "string") {
    throw new ValidationError("❌ --output must be a string.", "output");
  }

  if (argv["dry-run"] && argv["resume-failed"]) {
    logWarn("⚠️ Dry run + resume-failed used together. Nothing will be resumed.");
  }
};

const selectTargets = async (argv, albums) => {
  if (argv.all || argv.only) {
    if (argv.all) {
      log(`🛠  --all. ${albums.length} target(s).`);
      return albums;
    }
    if (argv["only"]) {
      const filteredAlbums = albums.filter((album) =>
        album.albumName.toLowerCase().includes(argv["only"].toLowerCase())
      );
      log(`🔎 Filtered by "--only": ${filteredAlbums.length} matched`);
      return filteredAlbums;
    }
  }

  if (argv["exclude"]) {
    const filteredAlbums = albums.filter(
      (album) => !album.albumName.toLowerCase().includes(argv["exclude"].toLowerCase())
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

export const run = async (argv = parseArgs()) => {
  if (argv["dry-run"]) argv.verbose = true;

  // Setup signal handlers for graceful shutdown
  setupSignalHandlers();

  log("📸 Immich Album Downloader\n");
  log("💡 Press Ctrl+C to cancel gracefully\n", "info");

  try {
    validateFlags(argv);
  } catch (err) {
    logError(err.message);
    process.exit(1);
  }

  if (
    argv["cleanup-db"] !== undefined ||
    argv["backup-db"] !== undefined ||
    argv["restore-db"] !== undefined ||
    argv["list-backups"]
  ) {
    databaseLoaded = true;
    const { handleDatabaseCommand } = await import("./cli/databaseCommands");
    await handleDatabaseCommand(argv);
  }

  // Use CLI argument if provided, otherwise use config from .env
  const resolvedOutputDir = expandPath(argv.output ?? config.defaultOutput);
  log(`📂 Output directory resolved: ${resolvedOutputDir}`, "info");

  // Health check
  log("🔍 Checking connection to Immich server...");
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    logError("💥 Cannot proceed without a valid connection to Immich server.");
    process.exit(1);
  }

  // Use CLI arguments if provided, otherwise use config defaults
  const concurrency = argv["concurrency"] ?? config.concurrency;
  const maxRetries = argv["max-retries"] ?? config.maxRetries;

  log(`🔧 Configuration:`);
  if (argv["limit-size"]) log(`-- Limit size: ${argv["limit-size"]} MB`);
  log(`-- Concurrency: ${concurrency}${argv["concurrency"] ? " (CLI)" : " (from .env)"}`);
  log(`-- Max retries: ${maxRetries}${argv["max-retries"] ? " (CLI)" : " (from .env)"}`);
  log(`-- Output directory: ${resolvedOutputDir}${argv.output ? " (CLI)" : " (from .env)"}`);
  if (argv.force) log(`-- Override existing files: enabled`);

  const albums = await getAlbums();
  if (!albums.length) {
    logWarn("🚫 No albums found.");
    return;
  }

  const sortedAlbums = albums.sort((a, b) => a.albumName.localeCompare(b.albumName));

  const targets = await selectTargets(argv, sortedAlbums);
  if (!targets.length) {
    logWarn("🚫 No album selected. Exiting.");
    return;
  }

  for (const [i, album] of targets.entries()) {
    // Check cancellation before processing each album
    if (cancellationToken.isCancelled()) {
      logWarn(`\n⚠️  Download cancelled. Processed ${i}/${targets.length} album(s).`);
      break;
    }

    log(
      `\n💾 [${i + 1}/${targets.length}] ${
        argv["dry-run"] ? "[DRY RUN] Simulating download for" : "Downloading"
      } ${album.albumName}${argv["resume-failed"] ? " (Resume)" : ""}`
    );

    try {
      const assets = await getAssetsByAlbumId(album.id);
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

    if (argv["dry-run"]) {
      log(`🧪 Dry run: ${album.assets.length} asset(s) found, no files downloaded.`);
      continue;
    }

    try {
      databaseLoaded = true;
      const { downloadAlbum } = await import("./lib/download.js");
      await downloadAlbum(album, resolvedOutputDir, {
        force: argv.force,
        resumeFailed: argv["resume-failed"],
        verbose: argv.verbose,
        dryRun: argv["dry-run"],
        maxRetries: maxRetries,
        concurrencyLimit: concurrency,
        limitSize: argv["limit-size"],
      });
    } catch (err) {
      if (err.name === "CancellationError" || cancellationToken.isCancelled()) {
        logWarn(`\n⚠️  Download cancelled during album "${album.albumName}".`);
        break;
      }
      throw err;
    }

    // Check cancellation after each album
    if (cancellationToken.isCancelled()) {
      logWarn(`\n⚠️  Download cancelled. Completed ${i + 1}/${targets.length} album(s).`);
      break;
    }
  }

  // Final summary with database statistics
  if (cancellationToken.isCancelled()) {
    logWarn("\n⚠️  Download process was cancelled by user.");
    logWarn("💡 Progress has been saved. Use --resume-failed to continue where you left off.\n");
    process.exit(130); // Standard exit code for SIGINT
  } else {
    // Show database statistics if not dry-run
    if (!argv["dry-run"]) {
      try {
        const { getDatabaseStats } = await import("./lib/db");
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
        // Don't fail if stats can't be retrieved
        logWarn(`⚠️  Could not retrieve database statistics: ${err.message}`);
      }
    }

    log(
      argv["dry-run"]
        ? "\n🧪 Dry run completed. No files were downloaded.\n"
        : "\n✅ Backup completed. Please check the output directory & logs if anything went wrong.\n"
    );
  }
};

export const handleFatalError = async (err) => {
  if (err instanceof ConfigurationError) {
    logError(`💥 Configuration Error: ${err.message}`);
  } else if (err instanceof ValidationError) {
    logError(`💥 Validation Error: ${err.message}`);
  } else {
    logError(`💥 Error: ${err.message}`);
    if (process.env.NODE_ENV === "development" && err.stack) {
      console.error(err.stack);
    }
  }

  if (databaseLoaded) {
    try {
      const { closeDatabase } = await loadDatabase();
      closeDatabase();
    } catch (dbErr) {
      logError(`⚠️  Failed to close database: ${dbErr.message}`);
    }
  }

  process.exit(1);
};

export const closeDatabaseOnExit = () => {
  process.once("beforeExit", async () => {
    if (!databaseLoaded) return;

    try {
      const { closeDatabase } = await loadDatabase();
      closeDatabase();
    } catch (err) {}
  });
};
