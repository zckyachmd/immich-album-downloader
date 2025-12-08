import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { expandPath } from "./helpers.js";
import { DatabaseError } from "./errors.js";
import { logError, logWarn } from "./logger.js";

const dbDir = expandPath("media-cache");
const dbPath = path.join(dbDir, "downloads.db");

// Initialize database directory
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true, mode: 0o700 }); // drwx------
  } catch (err) {
    throw new DatabaseError(`Failed to create database directory: ${err.message}`, "init");
  }
}

// Initialize database connection
let db;
try {
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON"); // Enable foreign key constraints

  // Set secure permissions on database file (rw-------)
  try {
    fs.chmodSync(dbPath, 0o600);
  } catch (err) {
    logWarn(`Warning: Could not set database permissions: ${err.message}`);
  }
} catch (err) {
  throw new DatabaseError(`Failed to initialize database: ${err.message}`, "init");
}

// Create schema with error handling
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS downloads (
      asset_id TEXT PRIMARY KEY,
      album_id TEXT NOT NULL,
      status TEXT CHECK(status IN ('downloaded', 'failed', 'skip')) NOT NULL,
      checksum TEXT,
      target_dir TEXT,
      downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      error_message TEXT
    )
  `);

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_album_status
    ON downloads(album_id, status)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_status
    ON downloads(status)
  `);
} catch (err) {
  throw new DatabaseError(`Failed to create database schema: ${err.message}`, "schema");
}

/**
 * Validates database input parameters
 * @param {string} assetId - Asset ID
 * @param {string} albumId - Album ID
 * @throws {DatabaseError} If validation fails
 */
function validateInput(assetId, albumId) {
  if (!assetId || typeof assetId !== "string" || assetId.trim().length === 0) {
    throw new DatabaseError("Invalid assetId: must be a non-empty string", "validation");
  }
  if (!albumId || typeof albumId !== "string" || albumId.trim().length === 0) {
    throw new DatabaseError("Invalid albumId: must be a non-empty string", "validation");
  }
  // Prevent SQL injection by checking for suspicious patterns
  if (assetId.includes(";") || albumId.includes(";")) {
    throw new DatabaseError("Invalid input: contains forbidden characters", "validation");
  }
}

/**
 * Closes database connection gracefully
 * @throws {DatabaseError} If close fails
 */
export function closeDatabase() {
  try {
    if (db) {
      db.close();
      db = null;
    }
  } catch (err) {
    throw new DatabaseError(`Failed to close database: ${err.message}`, "close");
  }
}

/**
 * Performs database integrity check
 * @returns {Promise<boolean>} True if database is healthy
 */
export async function checkDatabaseIntegrity() {
  try {
    if (!db) {
      return false;
    }
    // Run integrity check
    const result = db.prepare("PRAGMA integrity_check").get();
    return result && result.integrity_check === "ok";
  } catch (err) {
    logError(`Database integrity check failed: ${err.message}`);
    return false;
  }
}

export async function assetAlreadyDownloaded(assetId, albumId, checksum, targetDir) {
  try {
    validateInput(assetId, albumId);

    if (!db) {
      throw new DatabaseError("Database connection is not available", "query");
    }

    const stmt = db.prepare(
      `SELECT 1 FROM downloads WHERE asset_id = ? AND album_id = ? AND status = 'downloaded' AND checksum = ? AND target_dir = ?`
    );
    const row = stmt.get(assetId, albumId, checksum, targetDir);
    return !!row;
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(
      `Failed to check if asset is downloaded: ${err.message}`,
      "assetAlreadyDownloaded"
    );
  }
}

export async function markAssetAsDownloaded(assetId, albumId, checksum, targetDir) {
  try {
    validateInput(assetId, albumId);

    if (!db) {
      throw new DatabaseError("Database connection is not available", "update");
    }

    // Validate checksum and targetDir
    if (checksum && (typeof checksum !== "string" || checksum.length > 1000)) {
      throw new DatabaseError(
        "Invalid checksum: must be a string with max 1000 characters",
        "validation"
      );
    }
    if (targetDir && (typeof targetDir !== "string" || targetDir.length > 1000)) {
      throw new DatabaseError(
        "Invalid targetDir: must be a string with max 1000 characters",
        "validation"
      );
    }

    const stmt = db.prepare(
      `INSERT OR REPLACE INTO downloads (asset_id, album_id, status, checksum, target_dir, downloaded_at)
       VALUES (?, ?, 'downloaded', ?, ?, CURRENT_TIMESTAMP)`
    );
    stmt.run(assetId, albumId, checksum || null, targetDir || null);
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(
      `Failed to mark asset as downloaded: ${err.message}`,
      "markAssetAsDownloaded"
    );
  }
}

export async function markAssetAsFailed(assetId, albumId, errorMessage = null) {
  try {
    validateInput(assetId, albumId);

    if (!db) {
      throw new DatabaseError("Database connection is not available", "update");
    }

    // Store error message if provided (for debugging)
    // Limit error length to prevent database bloat
    const error = errorMessage
      ? errorMessage.substring(0, 500).replace(/[^\x20-\x7E\n\r\t]/g, "") // Only printable ASCII
      : null;

    const stmt = db.prepare(
      `INSERT OR REPLACE INTO downloads (asset_id, album_id, status, error_message, downloaded_at)
       VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)`
    );
    stmt.run(assetId, albumId, error);
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(`Failed to mark asset as failed: ${err.message}`, "markAssetAsFailed");
  }
}

export async function getFailedAssets(albumId) {
  try {
    if (!albumId || typeof albumId !== "string" || albumId.trim().length === 0) {
      throw new DatabaseError("Invalid albumId: must be a non-empty string", "validation");
    }

    if (!db) {
      throw new DatabaseError("Database connection is not available", "query");
    }

    const stmt = db.prepare(
      `SELECT asset_id FROM downloads
       WHERE album_id = ? AND status = 'failed'
       ORDER BY downloaded_at DESC`
    );
    const rows = stmt.all(albumId);
    return rows.map((row) => row.asset_id);
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(`Failed to get failed assets: ${err.message}`, "getFailedAssets");
  }
}

/**
 * Gets database statistics
 * @returns {Promise<Object>} Database statistics
 */
export async function getDatabaseStats() {
  try {
    if (!db) {
      throw new DatabaseError("Database connection is not available", "query");
    }

    const stats = {
      total: db.prepare("SELECT COUNT(*) as count FROM downloads").get().count,
      downloaded: db
        .prepare("SELECT COUNT(*) as count FROM downloads WHERE status = 'downloaded'")
        .get().count,
      failed: db.prepare("SELECT COUNT(*) as count FROM downloads WHERE status = 'failed'").get()
        .count,
      skipped: db.prepare("SELECT COUNT(*) as count FROM downloads WHERE status = 'skip'").get()
        .count,
    };

    return stats;
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(
      `Failed to get database statistics: ${err.message}`,
      "getDatabaseStats"
    );
  }
}

/**
 * Cleans up old database records
 * @param {Object} options - Cleanup options
 * @param {number} options.daysOld - Delete records older than this many days (default: 90)
 * @param {boolean} options.onlyFailed - Only delete failed records (default: false)
 * @param {string} options.albumId - Only delete records for specific album (optional)
 * @returns {Promise<Object>} Cleanup statistics
 */
export async function cleanupDatabase(options = {}) {
  try {
    if (!db) {
      throw new DatabaseError("Database connection is not available", "cleanup");
    }

    const { daysOld = 90, onlyFailed = false, albumId = null } = options;

    if (daysOld < 0) {
      throw new DatabaseError("daysOld must be >= 0", "validation");
    }

    let deletedCount = 0;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffDateStr = cutoffDate.toISOString();

    if (onlyFailed) {
      // Delete only failed records older than cutoff date
      if (albumId) {
        const stmt = db.prepare(
          `DELETE FROM downloads
           WHERE status = 'failed'
           AND album_id = ?
           AND downloaded_at < ?`
        );
        const result = stmt.run(albumId, cutoffDateStr);
        deletedCount = result.changes;
      } else {
        const stmt = db.prepare(
          `DELETE FROM downloads
           WHERE status = 'failed'
           AND downloaded_at < ?`
        );
        const result = stmt.run(cutoffDateStr);
        deletedCount = result.changes;
      }
    } else {
      // Delete all records older than cutoff date
      if (albumId) {
        const stmt = db.prepare(
          `DELETE FROM downloads
           WHERE album_id = ?
           AND downloaded_at < ?`
        );
        const result = stmt.run(albumId, cutoffDateStr);
        deletedCount = result.changes;
      } else {
        const stmt = db.prepare(
          `DELETE FROM downloads
           WHERE downloaded_at < ?`
        );
        const result = stmt.run(cutoffDateStr);
        deletedCount = result.changes;
      }
    }

    // Vacuum database to reclaim space
    if (deletedCount > 0) {
      db.exec("VACUUM");
    }

    return {
      deleted: deletedCount,
      cutoffDate: cutoffDateStr,
    };
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(`Failed to cleanup database: ${err.message}`, "cleanup");
  }
}

/**
 * Gets statistics for a specific album
 * @param {string} albumId - Album ID
 * @returns {Promise<Object>} Album statistics
 */
export async function getAlbumStats(albumId) {
  try {
    if (!albumId || typeof albumId !== "string" || albumId.trim().length === 0) {
      throw new DatabaseError("Invalid albumId: must be a non-empty string", "validation");
    }

    if (!db) {
      throw new DatabaseError("Database connection is not available", "query");
    }

    const stats = {
      total: db.prepare("SELECT COUNT(*) as count FROM downloads WHERE album_id = ?").get(albumId)
        .count,
      downloaded: db
        .prepare(
          "SELECT COUNT(*) as count FROM downloads WHERE album_id = ? AND status = 'downloaded'"
        )
        .get(albumId).count,
      failed: db
        .prepare("SELECT COUNT(*) as count FROM downloads WHERE album_id = ? AND status = 'failed'")
        .get(albumId).count,
      skipped: db
        .prepare("SELECT COUNT(*) as count FROM downloads WHERE album_id = ? AND status = 'skip'")
        .get(albumId).count,
    };

    return stats;
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(`Failed to get album statistics: ${err.message}`, "getAlbumStats");
  }
}

/**
 * Creates a backup of the database
 * @param {string} backupPath - Optional custom backup path (default: downloads.db.backup.YYYY-MM-DD_HH-MM-SS)
 * @returns {Promise<string>} Path to the backup file
 */
export async function backupDatabase(backupPath = null) {
  try {
    if (!db) {
      throw new DatabaseError("Database connection is not available", "backup");
    }

    // Generate backup filename if not provided
    if (!backupPath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      backupPath = path.join(dbDir, `downloads.db.backup.${timestamp}`);
    }

    // Ensure backup directory exists
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    }

    // Use file copy for backup (works with WAL mode)
    // SQLite allows concurrent reads, so this is safe
    // We copy both the main database file and WAL file if it exists
    fs.copyFileSync(dbPath, backupPath);

    // Also copy WAL file if it exists (for complete backup)
    const walPath = dbPath + "-wal";
    const walBackupPath = backupPath + "-wal";
    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, walBackupPath);
    }

    // Set secure permissions on backup file
    try {
      fs.chmodSync(backupPath, 0o600);
    } catch (err) {
      logWarn(`Warning: Could not set backup file permissions: ${err.message}`);
    }

    return backupPath;
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(`Failed to backup database: ${err.message}`, "backup");
  }
}

/**
 * Restores database from a backup file
 * @param {string} backupPath - Path to the backup file
 * @param {boolean} createBackup - Create backup of current database before restore (default: true)
 * @returns {Promise<string>} Path to the pre-restore backup (if created)
 */
export async function restoreDatabase(backupPath, createBackup = true) {
  try {
    if (!backupPath || typeof backupPath !== "string") {
      throw new DatabaseError("Invalid backupPath: must be a non-empty string", "validation");
    }

    if (!fs.existsSync(backupPath)) {
      throw new DatabaseError(`Backup file not found: ${backupPath}`, "validation");
    }

    // Validate backup file is a valid SQLite database
    try {
      const testDb = new Database(backupPath);
      testDb.prepare("SELECT 1").get();
      testDb.close();
    } catch (err) {
      throw new DatabaseError(
        `Invalid backup file (not a valid SQLite database): ${backupPath}`,
        "validation"
      );
    }

    let preRestoreBackup = null;

    // Create backup of current database before restore
    if (createBackup && db && fs.existsSync(dbPath)) {
      try {
        preRestoreBackup = await backupDatabase();
      } catch (err) {
        logWarn(`Warning: Could not create backup before restore: ${err.message}`);
      }
    }

    // Close current database connection
    if (db && db.open) {
      db.close();
      db = null;
    }

    // Copy backup file to database path
    fs.copyFileSync(backupPath, dbPath);

    // Set secure permissions
    try {
      fs.chmodSync(dbPath, 0o600);
    } catch (err) {
      logWarn(`Warning: Could not set database permissions: ${err.message}`);
    }

    // Reopen database connection
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    return preRestoreBackup;
  } catch (err) {
    // Try to reopen database if restore failed
    if (!db || !db.open) {
      try {
        db = new Database(dbPath);
        db.pragma("journal_mode = WAL");
        db.pragma("foreign_keys = ON");
      } catch (reopenErr) {
        // Ignore reopen errors
      }
    }

    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(`Failed to restore database: ${err.message}`, "restore");
  }
}

/**
 * Lists available backup files
 * @returns {Promise<Array<Object>>} Array of backup file info
 */
export async function listBackups() {
  try {
    if (!fs.existsSync(dbDir)) {
      return [];
    }

    const files = fs.readdirSync(dbDir);
    const backups = files
      .filter((file) => file.startsWith("downloads.db.backup."))
      .map((file) => {
        const filePath = path.join(dbDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
        };
      })
      .sort((a, b) => b.created - a.created); // Sort by creation date, newest first

    return backups;
  } catch (err) {
    throw new DatabaseError(`Failed to list backups: ${err.message}`, "listBackups");
  }
}

export default db;
