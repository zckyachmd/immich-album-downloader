import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { commonOptions } from "./options.js";

export const parseArgs = () => {
  return yargs(hideBin(process.argv))
    .scriptName("immich-album-downloader")
    .usage("Usage: $0 [options]")
    .options(commonOptions)
    .strict()
    .help("help")
    .alias("h", "help")
    .wrap(Math.min(100, process.stdout.columns || 80))
    .parse();
};
