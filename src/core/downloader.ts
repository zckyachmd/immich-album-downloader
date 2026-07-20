// @ts-nocheck
import chalk from "chalk";
import figures from "@inquirer/figures";
import inquirer from "inquirer";

// Checkbox prompt hardcodes the "❯" cursor glyph glued to the radio icon
// (❯◯), which reads as noisy clutter. Blank it so only the radio shows.
figures.pointer = "";
import { writeEnvConfig } from "@/cli/configFile";
import { promptForConfig } from "@/cli/prompts";
import { getAlbums, getAssetsByAlbumId } from "@/lib/api";
import { cancellationToken, setupSignalHandlers } from "@/lib/cancellation";
import type { AppConfig } from "@/lib/config";
import { CancellationError, ValidationError } from "@/lib/errors";
import { expandPath } from "@/lib/helpers";
import { checkHealth } from "@/lib/health";
import { log, logError, logWarn } from "@/lib/logger";

const ui = {
  success: chalk.green("✓"),
  error: chalk.red("✗"),
  info: chalk.cyan("i"),
  warning: chalk.yellow("!"),
  muted: (text: string) => chalk.gray(text),
  bold: (text: string) => chalk.bold(text),
};

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
      log(`${ui.info} --all selected. ${albums.length} album(s).`);
      return albums;
    }
    if (options["only"]) {
      const filteredAlbums = albums.filter((album) =>
        album.albumName.toLowerCase().includes(options["only"].toLowerCase())
      );
      log(`${ui.info} --only matched ${filteredAlbums.length} album(s).`);
      return filteredAlbums;
    }
  }

  if (options["exclude"]) {
    const filteredAlbums = albums.filter(
      (album) => !album.albumName.toLowerCase().includes(options["exclude"].toLowerCase())
    );
    log(`${ui.info} --exclude kept ${filteredAlbums.length} album(s).`);
    return filteredAlbums;
  }

  const { selectedAlbums } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selectedAlbums",
      message: `${ui.bold("Select albums to backup")}`,
      choices: albums.map((album) => ({
        name: `${album.albumName} (${album.assetCount} items)`,
        value: album,
      })),
      validate: (value) => (value.length > 0 ? true : `${ui.error} Select at least one album`),
    },
  ]);

  log(`${ui.success} Selected ${selectedAlbums.length} album(s).`);
  return selectedAlbums;
};

export const runDownloader = async (options, config: AppConfig) => {
  if (options["dry-run"]) options.verbose = true;

  setupSignalHandlers();

  validateFlags(options);

  const resolvedOutputDir = expandPath(options.output ?? config.defaultOutput);

  while (true) {
    log(`${ui.info} Checking connection to Immich server...`);
    const isHealthy = await checkHealth(config);
    if (isHealthy) break;

    if (options.interactive === false || !process.stdin.isTTY) {
      throw new ValidationError("Cannot proceed without a valid connection to Immich server.");
    }

    logWarn(`${ui.warning} Connection failed. Update server URL or API key.`);
    const retryConfig = await promptForConfig(config, { connectionOnly: true });
    Object.assign(config, retryConfig);
  }

  if (config.saveConfig) writeEnvConfig(config);

  const concurrency = options["concurrency"] ?? config.concurrency;
  const maxRetries = options["max-retries"] ?? config.maxRetries;

  log("");
  log(ui.muted("┌─ Immich ─────────────────────────"));
  log(`  ${ui.success} Server connected${(config as any).serverInfo ?? ""}`);
  log(`  ${ui.info} Output  ${resolvedOutputDir}${options.output ? " (CLI)" : ""}`);
  if (options["limit-size"]) log(`  ${ui.info} Limit   ${options["limit-size"]} MB`);
  if (options.force) log(`  ${ui.info} Force   enabled`);
  log(ui.muted("└──────────────────────────────────"));
  log(`${ui.info} Ctrl+C cancel\n`, "info");

  const albums = await getAlbums(config);
  if (!albums.length) {
    logWarn(`${ui.warning} No albums found.`);
    return;
  }

  const sortedAlbums = albums.sort((a, b) => a.albumName.localeCompare(b.albumName));
  const targets = await selectTargets(options, sortedAlbums);
  if (!targets.length) {
    logWarn(`${ui.warning} No album selected. Exiting.`);
    return;
  }

  for (const [i, album] of targets.entries()) {
    if (cancellationToken.isCancelled()) {
      logWarn(`\n${ui.warning} Download cancelled. Processed ${i}/${targets.length} album(s).`);
      break;
    }

    log(
      `\n${ui.info} [${i + 1}/${targets.length}] ${
        options["dry-run"] ? "Dry run" : "Downloading"
      }: ${album.albumName}${options["resume-failed"] ? " (resume)" : ""}`
    );

    try {
      const assets = await getAssetsByAlbumId(config, album.id);
      if (!assets.length) {
        logWarn(`${ui.warning} Album "${album.albumName}" empty. Skipping.`);
        continue;
      }
      album.assets = assets;
    } catch (err) {
      if (cancellationToken.isCancelled()) {
        logWarn(`\n${ui.warning} Download cancelled while fetching album "${album.albumName}".`);
        break;
      }
      logError(`${ui.error} Failed to fetch album "${album.albumName}": ${err.message}`);
      continue;
    }

    if (options["dry-run"]) {
      log(`${ui.info} Dry run: ${album.assets.length} asset(s) found. No files downloaded.`);
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
        logWarn(`\n${ui.warning} Download cancelled during album "${album.albumName}".`);
        break;
      }
      throw err;
    }

    if (cancellationToken.isCancelled()) {
      logWarn(`\n${ui.warning} Download cancelled. Completed ${i + 1}/${targets.length} album(s).`);
      break;
    }
  }

  if (cancellationToken.isCancelled()) {
    logWarn(`\n${ui.warning} Download cancelled by user.`);
    logWarn(`${ui.info} Progress saved. Use --resume-failed to continue.\n`);
    throw new CancellationError();
  }

  if (!options["dry-run"]) {
    try {
      const { getDatabaseStats } = await import("../lib/db");
      const dbStats = await getDatabaseStats();
      log(`\n${ui.muted("┌─ Database ───────────────────────")}`);
      log(`  ${ui.info} Total       ${dbStats.total}`);
      log(`  ${ui.success} Downloaded  ${dbStats.downloaded}`);
      log(`  ${ui.info} Skipped     ${dbStats.skipped}`);
      log(`  ${ui.warning} Failed      ${dbStats.failed}`);
      if (dbStats.failed > 0) {
        log(`  ${ui.info} Use --resume-failed to retry failed downloads`);
      }
      log(ui.muted("└──────────────────────────────────"));
    } catch (err) {
      logWarn(`${ui.warning} Could not retrieve database statistics: ${err.message}`);
    }
  }

  log(
    options["dry-run"]
      ? `\n${ui.success} Dry run complete. No files downloaded.\n`
      : `\n${ui.success} Backup complete.\n`
  );
};
