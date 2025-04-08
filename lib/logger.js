import fs from "fs";
import path from "path";
import readline from "readline";
import { expandPath } from "./helpers.js";

const LOG_DIR = expandPath("media-cache");
const LOG_PATH = path.join(LOG_DIR, "immich-album-downloader.log");

let isVerbose = false;

export function setVerbose(value) {
  isVerbose = value;
}

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export const log = (message, level = "info", options = {}) => {
  const { verbose = false, silent = false } = options;
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase();

  const sanitize = (text) =>
    text
      .toString()
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const printToConsole = (text, level) => {
    const importantLevels = ["info", "warn", "error"];
    const isImportant = importantLevels.includes(level);
    const shouldPrint = !silent && (verbose || isImportant);

    if (!shouldPrint) return;

    const lines = text
      .toString()
      .split("\n")
      .map((line) => line.trim());

    lines.forEach((line) => {
      if (line !== "") console.log(line);
    });
  };

  const cleanedMessage = Array.isArray(message)
    ? message.map(sanitize).join(" ")
    : sanitize(message);

  const logLine = `[${timestamp}] [${levelUpper}] ${cleanedMessage}`;

  if (Array.isArray(message)) {
    message.forEach((msg) => printToConsole(msg, level));
  } else {
    printToConsole(message, level);
  }

  fs.appendFileSync(LOG_PATH, logLine + "\n", "utf8");
};

export function logProgress(current, total, stats = {}) {
  if (total <= 0) return;

  current = Math.min(current, total);
  const percent = Math.floor((current / total) * 100);
  const barWidth = 30;
  const filled = Math.floor((percent / 100) * barWidth);
  const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
  const { downloaded = 0, skipped = 0, failed = 0 } = stats;

  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(
    `[${bar}] ${percent}% (${current}/${total}) | ✅ ${downloaded} ⏩ ${skipped} ❌ ${failed}`
  );
}

export const logError = (message, options = {}) => log(message, "error", options);
export const logWarn = (message, options = {}) => log(message, "warn", options);
