import "dotenv/config";
import inquirer from "inquirer";
import { getAlbums, getAssetsByAlbumId } from "./lib/api.js";
import { downloadAlbum } from "./lib/download.js";
import { expandPath } from "./lib/helpers.js";
import { log, logError, logWarn } from "./lib/logger.js";
import { parseArgs } from "./cli/index.js";

const argv = parseArgs();

if (argv["dry-run"]) argv.verbose = true;

const validateFlags = () => {
  const flagValidations = [
    { flag: "limit-size", errorMsg: "❌ --limit-size must be a valid number." },
    {
      flag: "concurrency",
      errorMsg: "❌ --concurrency must be a valid number.",
    },
    {
      flag: "max-retries",
      errorMsg: "❌ --max-retries must be a valid number.",
    },
  ];

  flagValidations.forEach(({ flag, errorMsg }) => {
    if (argv[flag] && isNaN(argv[flag])) throw new Error(errorMsg);
  });

  if (argv["dry-run"] && argv["resume-failed"]) {
    logWarn(
      "⚠️ Dry run + resume-failed used together. Nothing will be resumed."
    );
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
      (album) =>
        !album.albumName.toLowerCase().includes(argv["exclude"].toLowerCase())
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
      validate: (value) =>
        value.length > 0 ? true : "Please select at least one album",
    },
  ]);

  log(`🧠 Selected ${selectedAlbums.length} album(s) via prompt.`);
  return selectedAlbums;
};

const main = async () => {
  log("📸 Immich Album Downloader\n");

  try {
    validateFlags();
  } catch (err) {
    logError(err.message);
    process.exit(1);
  }

  const resolvedOutputDir = expandPath(
    argv.output || process.env.DEFAULT_OUTPUT || "./media-downloads"
  );
  log(`📂 Output directory resolved: ${resolvedOutputDir}`, "info");

  log(`🔧 Configuration:`);
  if (argv["limit-size"]) log(`-- Limit size: ${argv["limit-size"]} MB`);
  if (argv["concurrency"]) log(`-- Concurrency: ${argv["concurrency"]}`);
  if (argv["max-retries"]) log(`-- Max retries: ${argv["max-retries"]}`);
  if (argv.force) log(`-- Override existing files: enabled`);

  const albums = await getAlbums();
  if (!albums.length) {
    logWarn("🚫 No albums found.");
    return;
  }

  const sortedAlbums = albums.sort((a, b) =>
    a.albumName.localeCompare(b.albumName)
  );

  const targets = await selectTargets(argv, sortedAlbums);
  if (!targets.length) {
    logWarn("🚫 No album selected. Exiting.");
    return;
  }

  for (const [i, album] of targets.entries()) {
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
      logError(`💥 Failed fetch album from ${album.albumName}: ${err.message}`);
      continue;
    }

    await downloadAlbum(album, resolvedOutputDir, {
      force: argv.force,
      resumeFailed: argv["resume-failed"],
      verbose: argv.verbose,
      dryRun: argv["dry-run"],
      maxRetries: argv["max-retries"] ?? 3,
      concurrencyLimit: argv["concurrency"] ?? 5,
      limitSize: argv["limit-size"],
    });
  }

  log(
    argv["dry-run"]
      ? "\n🧪 Dry run completed. No files were downloaded.\n"
      : "\n✅ Backup completed. Please check the output directory & logs if anything went wrong.\n"
  );
};

main().catch((err) => {
  logError(`💥 Error: ${err.message}`);
  process.exit(1);
});
