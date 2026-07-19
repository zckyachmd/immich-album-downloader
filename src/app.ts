import { parseArgs } from "@/cli/index";
import { handleDatabaseCommand } from "@/cli/databaseCommands";
import { databaseLoaded, loadDatabase, markDatabaseLoaded, runDownloader } from "@/core/downloader";
import { resolveConfig } from "@/lib/config";
import { ConfigurationError, ValidationError } from "@/lib/errors";
import { logError } from "@/lib/logger";

export const run = async (argv = parseArgs()) => {
  if (
    argv["cleanup-db"] !== undefined ||
    argv["backup-db"] !== undefined ||
    argv["restore-db"] !== undefined ||
    argv["list-backups"]
  ) {
    markDatabaseLoaded();
    return await handleDatabaseCommand(argv);
  }

  const config = await resolveConfig(argv);
  await runDownloader(argv, config);
  return 0;
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

  return 1;
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
