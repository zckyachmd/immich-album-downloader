import fs from "fs";
import path from "path";
import readline from "readline";
import { expandPath, formatFileSize, formatDuration } from "./helpers.js";

const LOG_DIR = expandPath("media-cache");
const LOG_PATH = path.join(LOG_DIR, "immich-album-downloader.log");

let isVerbose = false;

export function setVerbose(value) {
  isVerbose = value;
}

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 }); // drwx------
}

// Set secure permissions on log file if it exists (rw-------)
if (fs.existsSync(LOG_PATH)) {
  try {
    fs.chmodSync(LOG_PATH, 0o600);
  } catch (err) {
    // Ignore if file doesn't exist yet or permission error
  }
}

/**
 * Sanitizes sensitive data from log messages
 * @param {string} message - The message to sanitize
 * @returns {string} Sanitized message
 */
function sanitizeForLogging(message) {
  if (typeof message !== "string") {
    return String(message);
  }

  // Remove API keys
  let sanitized = message.replace(/IMMICH_API_KEY\s*[=:]\s*[^\s&"']+/gi, "IMMICH_API_KEY=***");

  // Remove API keys in URLs
  sanitized = sanitized.replace(/[?&]api[_-]?key\s*=\s*[^\s&"']+/gi, "api_key=***");

  // Remove x-api-key headers
  sanitized = sanitized.replace(/x-api-key\s*:\s*[^\s"']+/gi, "x-api-key: ***");

  // Remove potential tokens
  sanitized = sanitized.replace(/(token|auth|password|secret)\s*[=:]\s*[^\s&"']+/gi, "$1=***");

  return sanitized;
}

export const log = (message, level = "info", options = {}) => {
  const { verbose = false, silent = false } = options;
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase();

  const sanitize = (text) =>
    sanitizeForLogging(text) // Apply sanitization
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

  // Ensure log file has secure permissions after writing
  try {
    if (fs.existsSync(LOG_PATH)) {
      fs.chmodSync(LOG_PATH, 0o600);
    }
  } catch (err) {
    // Ignore permission errors
  }
};

// Track last progress update time for rate limiting
let lastProgressUpdate = 0;
const PROGRESS_UPDATE_INTERVAL = 100; // Update every 100ms max

// Track download speed calculation
let speedHistory = [];
const SPEED_HISTORY_SIZE = 10; // Keep last 10 measurements
let startTime = null;
let lastBytesDownloaded = 0;
let lastUpdateTime = null;

export function resetProgressTracking() {
  speedHistory = [];
  startTime = null;
  lastBytesDownloaded = 0;
  lastUpdateTime = null;
}

export function logProgress(current, total, stats = {}) {
  if (total <= 0) return;

  // Rate limit progress updates to avoid flickering
  const now = Date.now();
  if (now - lastProgressUpdate < PROGRESS_UPDATE_INTERVAL && current < total) {
    return;
  }
  lastProgressUpdate = now;

  // Initialize tracking
  if (startTime === null) {
    startTime = now;
    lastUpdateTime = now;
    lastBytesDownloaded = stats.downloadedBytes || 0;
  }

  current = Math.min(current, total);
  const percent = Math.floor((current / total) * 100);
  const barWidth = 20;
  const filled = Math.floor((percent / 100) * barWidth);
  const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
  const { downloaded = 0, skipped = 0, failed = 0, downloadedBytes = 0, totalBytes = 0 } = stats;

  // Calculate download speed
  let speed = 0;
  let eta = Infinity;

  if (lastUpdateTime && stats.downloadedBytes !== undefined) {
    const timeDelta = (now - lastUpdateTime) / 1000; // seconds
    const bytesDelta = stats.downloadedBytes - lastBytesDownloaded;

    if (timeDelta > 0 && bytesDelta > 0) {
      const currentSpeed = bytesDelta / timeDelta; // bytes per second
      speedHistory.push(currentSpeed);

      // Keep only recent history
      if (speedHistory.length > SPEED_HISTORY_SIZE) {
        speedHistory.shift();
      }

      // Calculate average speed
      if (speedHistory.length > 0) {
        speed = speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length;
      }

      // Calculate ETA
      if (speed > 0 && totalBytes > 0) {
        const remainingBytes = totalBytes - stats.downloadedBytes;
        eta = (remainingBytes / speed) * 1000; // milliseconds
      }
    }

    lastBytesDownloaded = stats.downloadedBytes;
    lastUpdateTime = now;
  }

  // Clear the line and write progress
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);

  // Build progress line with size and speed info
  // Compact format to avoid terminal width issues
  let progressLine = `[${bar}] ${percent}% (${current}/${total}) | ✅${downloaded} ⏩${skipped} ❌${failed}`;

  // Add size information if available (compact format)
  // Show size even if totalBytes is 0 (we'll track from actual downloads)
  const downloadedSize = stats.downloadedBytes || 0;
  if (totalBytes > 0) {
    const totalSize = formatFileSize(totalBytes);
    progressLine += ` | ${formatFileSize(downloadedSize)}/${totalSize}`;
  } else if (downloadedSize > 0) {
    // If totalBytes not available, still show downloaded size
    progressLine += ` | ${formatFileSize(downloadedSize)}`;
  }

  // Add speed and ETA if available (compact format)
  if (speed > 0) {
    const speedStr = formatFileSize(speed);
    progressLine += ` | ${speedStr}/s`;
    // Only show ETA if more than 5 seconds and less than 24 hours
    // And if we have totalBytes to calculate remaining
    if (eta !== Infinity && eta > 5000 && eta < 86400000 && totalBytes > 0) {
      const etaStr = formatDuration(eta);
      progressLine += ` | ETA:${etaStr}`;
    }
  }

  process.stdout.write(progressLine);
}

export const logError = (message, options = {}) => log(message, "error", options);
export const logWarn = (message, options = {}) => log(message, "warn", options);
