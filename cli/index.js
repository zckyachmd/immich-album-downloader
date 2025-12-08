import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { commonOptions } from "./options.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

export const parseArgs = () => {
  return yargs(hideBin(process.argv))
    .scriptName("immich-album-downloader")
    .usage("Usage: $0 [options]")
    .options(commonOptions)
    .strict()
    .help("help")
    .version(packageJson.version)
    .alias("V", "version")
    .wrap(Math.min(100, process.stdout.columns || 80))
    .parse();
};
