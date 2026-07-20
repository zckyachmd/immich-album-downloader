// @ts-nocheck
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { commonOptions } from "./options";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));

const brand = [
  "  ██╗███╗   ███╗███╗   ███╗██╗ ██████╗██╗  ██╗",
  "  ██║████╗ ████║████╗ ████║██║██╔════╝██║  ██║",
  "  ██║██╔████╔██║██╔████╔██║██║██║     ███████║",
  "  ██║██║╚██╔╝██║██║╚██╔╝██║██║██║     ██╔══██║",
  "  ██║██║ ╚═╝ ██║██║ ╚═╝ ██║██║╚██████╗██║  ██║",
  "  ╚═╝╚═╝     ╚═╝╚═╝     ╚═╝╚═╝ ╚═════╝╚═╝  ╚═╝",
  "",
  "  Immich Album Downloader",
].join("\n");

export const parseArgs = () => {
  return yargs(hideBin(process.argv))
    .scriptName("immich-album-downloader")
    .usage(`${brand}\n\nUsage: $0 [options]`)
    .options(commonOptions)
    .strict()
    .help("help")
    .version(packageJson.version)
    .alias("V", "version")
    .wrap(null)
    .parse();
};
