import "dotenv/config";
import inquirer from "inquirer";
import { getAlbums, getAssetsByAlbumId } from "./lib/api.js";
import { downloadAlbum } from "./lib/download.js";
import { expandPath } from "./lib/helpers.js";
import { log, logError, logWarn } from "./lib/logger.js";
import { parseArgs } from "./cli/index.js";
// Import config to validate environment variables early
import { config } from "./lib/config.js";
import { checkHealth } from "./lib/health.js";
import { ValidationError, ConfigurationError } from "./lib/errors.js";
import { setupSignalHandlers, cancellationToken } from "./lib/cancellation.js";
import { closeDatabase } from "./lib/db.js";

const argv = parseArgs();

if (argv["dry-run"]) argv.verbose = true;

const validateFlags = () => {
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

const main = async () => {
  // Setup signal handlers for graceful shutdown
  setupSignalHandlers();

  log("📸 Immich Album Downloader\n");
  log("💡 Press Ctrl+C to cancel gracefully\n", "info");

  try {
    validateFlags();
  } catch (err) {
    logError(err.message);
    process.exit(1);
  }

  // Handle database operations (cleanup, backup, restore, list)
  if (argv["cleanup-db"] !== undefined) {
    const { cleanupDatabase, backupDatabase } = await import("./lib/db.js");
    const daysOld = argv["cleanup-db"];
    const onlyFailed = !argv["cleanup-db-all"];

    // Create backup before cleanup
    try {
      log(`💾 Creating backup before cleanup...`);
      const backupPath = await backupDatabase();
      log(`✅ Backup created: ${backupPath}`);
    } catch (err) {
      logWarn(`⚠️  Could not create backup before cleanup: ${err.message}`);
    }

    log(`🧹 Cleaning up database records older than ${daysOld} days...`);
    log(`   Mode: ${onlyFailed ? "Failed records only" : "All records"}`);

    try {
      const result = await cleanupDatabase({
        daysOld: daysOld,
        onlyFailed: onlyFailed,
      });

      log(`✅ Cleanup completed: ${result.deleted} record(s) deleted`);
      log(`   Cutoff date: ${new Date(result.cutoffDate).toLocaleString()}`);

      // Close database and exit
      closeDatabase();
      process.exit(0);
    } catch (err) {
      logError(`❌ Database cleanup failed: ${err.message}`);
      closeDatabase();
      process.exit(1);
    }
  }

  // Handle database backup
  if (argv["backup-db"] !== undefined) {
    const { backupDatabase } = await import("./lib/db.js");
    let backupPath = argv["backup-db"];

    // If path ends with '/', treat as directory and auto-generate filename
    if (backupPath.endsWith("/") || backupPath.endsWith("\\")) {
      const { expandPath } = await import("./lib/helpers.js");
      const path = await import("path");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      backupPath = path.join(expandPath(backupPath), `downloads.db.backup.${timestamp}`);
    }

    log(`💾 Creating database backup...`);

    try {
      const fs = await import("fs");
      const result = await backupDatabase(backupPath);
      const stats = fs.statSync(result);
      log(`✅ Backup created successfully: ${result}`);
      log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);

      closeDatabase();
      process.exit(0);
    } catch (err) {
      logError(`❌ Database backup failed: ${err.message}`);
      closeDatabase();
      process.exit(1);
    }
  }

  // Handle database restore
  if (argv["restore-db"] !== undefined) {
    const { restoreDatabase } = await import("./lib/db.js");
    const backupPath = argv["restore-db"];

    log(`⚠️  WARNING: This will replace the current database with the backup!`);
    log(`📂 Restoring from: ${backupPath}`);

    try {
      const preRestoreBackup = await restoreDatabase(backupPath, true);
      if (preRestoreBackup) {
        log(`✅ Pre-restore backup created: ${preRestoreBackup}`);
      }
      log(`✅ Database restored successfully from: ${backupPath}`);

      closeDatabase();
      process.exit(0);
    } catch (err) {
      logError(`❌ Database restore failed: ${err.message}`);
      closeDatabase();
      process.exit(1);
    }
  }

  // Handle list backups
  if (argv["list-backups"]) {
    const { listBackups } = await import("./lib/db.js");
    const { formatFileSize } = await import("./lib/helpers.js");

    log(`📋 Listing database backups...`);

    try {
      const backups = await listBackups();

      if (backups.length === 0) {
        log(`📭 No backups found.`);
      } else {
        log(`\nFound ${backups.length} backup(s):\n`);
        backups.forEach((backup, index) => {
          log(`${index + 1}. ${backup.filename}`);
          log(`   Path: ${backup.path}`);
          log(`   Size: ${formatFileSize(backup.size)}`);
          log(`   Created: ${backup.created.toLocaleString()}`);
          log(``);
        });
      }

      closeDatabase();
      process.exit(0);
    } catch (err) {
      logError(`❌ Failed to list backups: ${err.message}`);
      closeDatabase();
      process.exit(1);
    }
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

    try {
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
        const { getDatabaseStats } = await import("./lib/db.js");
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

main().catch((err) => {
  // Handle different error types with appropriate messages
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

  // Close database before exit
  try {
    closeDatabase();
  } catch (dbErr) {
    logError(`⚠️  Failed to close database: ${dbErr.message}`);
  }

  process.exit(1);
});

// Ensure database is closed on normal exit
process.once("exit", () => {
  try {
    closeDatabase();
  } catch (err) {
    // Ignore errors during exit
  }
});
