import { homedir } from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PathTraversalError, FileSystemError } from "./errors.js";

export function expandPath(p) {
  let resolved = p.startsWith("~") ? path.join(homedir(), p.slice(1)) : path.resolve(p);

  resolved = path.normalize(resolved);

  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }

  return resolved;
}

/**
 * Sanitizes a filename/album name to prevent path traversal
 * @param {string} name - The name to sanitize
 * @returns {string} Sanitized name safe for use in file paths
 * @throws {ValidationError} If name is not a valid string type
 */
export function sanitizeName(name) {
  if (typeof name !== "string" || name.length === 0) {
    return "unnamed";
  }

  return (
    String(name)
      .replace(/[\/\\?%*:|"<>]/g, "-") // Replace invalid chars
      .replace(/\.\./g, "") // Remove path traversal attempts
      .replace(/^\.+/g, "") // Remove leading dots
      .replace(/^-+|-+$/g, "") // Remove leading/trailing dashes
      .replace(/-+/g, "-") // Collapse multiple dashes
      .trim()
      .substring(0, 255) || // Limit length (max filename length)
    "unnamed"
  ); // Fallback if empty
}

/**
 * Validates that a file path stays within the base directory
 * @param {string} filePath - The file path to validate
 * @param {string} baseDir - The base directory
 * @returns {string} The resolved absolute path
 * @throws {PathTraversalError} If path traversal is detected
 */
export function validatePathWithinBase(filePath, baseDir) {
  const resolved = path.resolve(filePath);
  const base = path.resolve(baseDir);

  // Ensure the resolved path is within the base directory
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new PathTraversalError(
      `Path traversal detected: ${filePath} is outside base directory ${baseDir}`,
      filePath
    );
  }

  return resolved;
}

export const calculateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
};

/**
 * Formats bytes to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  if (bytes === Infinity || isNaN(bytes)) return "Unknown";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Formats duration in milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string (e.g., "1h 23m 45s")
 */
export function formatDuration(ms) {
  if (ms === Infinity || isNaN(ms) || ms < 0) return "Unknown";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
