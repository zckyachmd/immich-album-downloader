import fs from "fs";
import path from "path";
import { Database } from "bun:sqlite";
import { expandPath } from "./helpers";
import { DatabaseError, toErrorMessage } from "./errors";
import { logError, logWarn } from "./logger";

const dbDir = expandPath("data");
const dbPath = path.join(dbDir, "downloads.db");

// Initialize database directory
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true, mode: 0o700 }); // drwx------
  } catch (err) {
    throw new DatabaseError(`Failed to create database directory: ${toErrorMessage(err)}`, "init");
  }
}

// Initialize database connection
let db: Database | null;
try {
  db = new Database(dbPath);
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON"); // Enable foreign key constraints

  // Set secure permissions on database file (rw-------)
  try {
    fs.chmodSync(dbPath, 0o600);
  } catch (err) {
    logWarn(`Warning: Could not set database permissions: ${toErrorMessage(err)}`);
  }
} catch (err) {
  throw new DatabaseError(`Failed to initialize database: ${toErrorMessage(err)}`, "init");
}

interface TableInfoRow {
  pk: number;
  name: string;
}

// Create schema with error handling
try {
  // An asset can belong to multiple albums in Immich. The table must be
  // keyed on (asset_id, album_id) so a download recorded for one album
  // doesn't overwrite/erase the record for the same asset in another album.
  // Older databases were created with asset_id alone as the primary key;
  // migrate them in place instead of silently losing per-album history.
  const existingPk = db
    .prepare("PRAGMA table_info(downloads)")
    .all()
    .filter((col) => (col as TableInfoRow).pk > 0) as TableInfoRow[];
  const needsMigration =
    existingPk.length > 0 && !(existingPk.length === 2 && existingPk.some((c) => c.name === "album_id"));

  if (needsMigration) {
    db.run("BEGIN TRANSACTION");
    try {
      db.run("ALTER TABLE downloads RENAME TO downloads_old_pk_migration");
      db.run(`
        CREATE TABLE downloads (
          asset_id TEXT NOT NULL,
          album_id TEXT NOT NULL,
          status TEXT CHECK(status IN ('downloaded', 'failed', 'skip')) NOT NULL,
          checksum TEXT,
          target_dir TEXT,
          downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          error_message TEXT,
          PRIMARY KEY (asset_id, album_id)
        )
      `);
      db.run(`
        INSERT INTO downloads (asset_id, album_id, status, checksum, target_dir, downloaded_at, error_message)
        SELECT asset_id, album_id, status, checksum, target_dir, downloaded_at, error_message
        FROM downloads_old_pk_migration
      `);
      db.run("DROP TABLE downloads_old_pk_migration");
      db.run("COMMIT");
    } catch (migrationErr) {
      db.run("ROLLBACK");
      throw migrationErr;
    }
  } else {
    db.run(`
      CREATE TABLE IF NOT EXISTS downloads (
        asset_id TEXT NOT NULL,
        album_id TEXT NOT NULL,
        status TEXT CHECK(status IN ('downloaded', 'failed', 'skip')) NOT NULL,
        checksum TEXT,
        target_dir TEXT,
        downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        error_message TEXT,
        PRIMARY KEY (asset_id, album_id)
      )
    `);
  }

  // Create index for faster queries
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_album_status
    ON downloads(album_id, status)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_status
    ON downloads(status)
  `);
} catch (err) {
  throw new DatabaseError(`Failed to create database schema: ${toErrorMessage(err)}`, "schema");
}

function validateInput(assetId: string, albumId: string): void {
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

export function closeDatabase(): void {
  try {
    if (db) {
      db.close();
      db = null;
    }
  } catch (err) {
    throw new DatabaseError(`Failed to close database: ${toErrorMessage(err)}`, "close");
  }
}

export async function checkDatabaseIntegrity(): Promise<boolean> {
  try {
    if (!db) {
      return false;
    }
    // Run integrity check
    const result = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string } | null;
    return result?.integrity_check === "ok";
  } catch (err) {
    logError(`Database integrity check failed: ${toErrorMessage(err)}`);
    return false;
  }
}

export async function assetAlreadyDownloaded(
  assetId: string,
  albumId: string,
  checksum: string | null,
  targetDir: string | null
): Promise<boolean> {
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
      `Failed to check if asset is downloaded: ${toErrorMessage(err)}`,
      "assetAlreadyDownloaded"
    );
  }
}

export async function markAssetAsDownloaded(
  assetId: string,
  albumId: string,
  checksum: string | null | undefined,
  targetDir: string | null | undefined
): Promise<void> {
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
      `Failed to mark asset as downloaded: ${toErrorMessage(err)}`,
      "markAssetAsDownloaded"
    );
  }
}

export async function markAssetAsFailed(
  assetId: string,
  albumId: string,
  errorMessage: string | null = null
): Promise<void> {
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
    throw new DatabaseError(`Failed to mark asset as failed: ${toErrorMessage(err)}`, "markAssetAsFailed");
  }
}

export async function getFailedAssets(albumId: string): Promise<string[]> {
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
    const rows = stmt.all(albumId) as Array<{ asset_id: string }>;
    return rows.map((row) => row.asset_id);
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(`Failed to get failed assets: ${toErrorMessage(err)}`, "getFailedAssets");
  }
}

export interface DatabaseStats {
  total: number;
  downloaded: number;
  failed: number;
  skipped: number;
}

function getCount(query: string, ...params: string[]): number {
  if (!db) {
    throw new DatabaseError("Database connection is not available", "query");
  }
  const row = db.prepare(query).get(...params) as { count: number } | null;
  return row?.count ?? 0;
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  try {
    if (!db) {
      throw new DatabaseError("Database connection is not available", "query");
    }

    return {
      total: getCount("SELECT COUNT(*) as count FROM downloads"),
      downloaded: getCount("SELECT COUNT(*) as count FROM downloads WHERE status = 'downloaded'"),
      failed: getCount("SELECT COUNT(*) as count FROM downloads WHERE status = 'failed'"),
      skipped: getCount("SELECT COUNT(*) as count FROM downloads WHERE status = 'skip'"),
    };
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(`Failed to get database statistics: ${toErrorMessage(err)}`, "getDatabaseStats");
  }
}

export interface CleanupOptions {
  daysOld?: number;
  onlyFailed?: boolean;
  albumId?: string | null;
}

export interface CleanupResult {
  deleted: number;
  cutoffDate: string;
}

export async function cleanupDatabase(options: CleanupOptions = {}): Promise<CleanupResult> {
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
      db.run("VACUUM");
    }

    return {
      deleted: deletedCount,
      cutoffDate: cutoffDateStr,
    };
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(`Failed to cleanup database: ${toErrorMessage(err)}`, "cleanup");
  }
}

export async function getAlbumStats(albumId: string): Promise<DatabaseStats> {
  try {
    if (!albumId || typeof albumId !== "string" || albumId.trim().length === 0) {
      throw new DatabaseError("Invalid albumId: must be a non-empty string", "validation");
    }

    if (!db) {
      throw new DatabaseError("Database connection is not available", "query");
    }

    return {
      total: getCount("SELECT COUNT(*) as count FROM downloads WHERE album_id = ?", albumId),
      downloaded: getCount(
        "SELECT COUNT(*) as count FROM downloads WHERE album_id = ? AND status = 'downloaded'",
        albumId
      ),
      failed: getCount(
        "SELECT COUNT(*) as count FROM downloads WHERE album_id = ? AND status = 'failed'",
        albumId
      ),
      skipped: getCount(
        "SELECT COUNT(*) as count FROM downloads WHERE album_id = ? AND status = 'skip'",
        albumId
      ),
    };
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(`Failed to get album statistics: ${toErrorMessage(err)}`, "getAlbumStats");
  }
}

export async function backupDatabase(backupPath: string | null = null): Promise<string> {
  try {
    if (!db) {
      throw new DatabaseError("Database connection is not available", "backup");
    }

    // Generate backup filename if not provided
    let resolvedBackupPath = backupPath;
    if (!resolvedBackupPath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      resolvedBackupPath = path.join(dbDir, `downloads.db.backup.${timestamp}`);
    }

    // Ensure backup directory exists
    const backupDir = path.dirname(resolvedBackupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    }

    // Use file copy for backup (works with WAL mode)
    // SQLite allows concurrent reads, so this is safe
    // We copy both the main database file and WAL file if it exists
    fs.copyFileSync(dbPath, resolvedBackupPath);

    // Also copy WAL file if it exists (for complete backup)
    const walPath = dbPath + "-wal";
    const walBackupPath = resolvedBackupPath + "-wal";
    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, walBackupPath);
    }

    // Set secure permissions on backup file
    try {
      fs.chmodSync(resolvedBackupPath, 0o600);
    } catch (err) {
      logWarn(`Warning: Could not set backup file permissions: ${toErrorMessage(err)}`);
    }

    return resolvedBackupPath;
  } catch (err) {
    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(`Failed to backup database: ${toErrorMessage(err)}`, "backup");
  }
}

export async function restoreDatabase(backupPath: string, createBackup = true): Promise<string | null> {
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
    } catch {
      throw new DatabaseError(
        `Invalid backup file (not a valid SQLite database): ${backupPath}`,
        "validation"
      );
    }

    let preRestoreBackup: string | null = null;

    // Create backup of current database before restore
    if (createBackup && db && fs.existsSync(dbPath)) {
      try {
        preRestoreBackup = await backupDatabase();
      } catch (err) {
        logWarn(`Warning: Could not create backup before restore: ${toErrorMessage(err)}`);
      }
    }

    // Close current database connection
    if (db) {
      db.close();
      db = null;
    }

    // Copy backup file to database path
    fs.copyFileSync(backupPath, dbPath);

    // Set secure permissions
    try {
      fs.chmodSync(dbPath, 0o600);
    } catch (err) {
      logWarn(`Warning: Could not set database permissions: ${toErrorMessage(err)}`);
    }

    // Reopen database connection
    db = new Database(dbPath);
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA foreign_keys = ON");

    return preRestoreBackup;
  } catch (err) {
    // Try to reopen database if restore failed
    if (!db) {
      try {
        db = new Database(dbPath);
        db.run("PRAGMA journal_mode = WAL");
        db.run("PRAGMA foreign_keys = ON");
      } catch {
        // Ignore reopen errors
      }
    }

    if (err instanceof DatabaseError) {
      throw err;
    }
    throw new DatabaseError(`Failed to restore database: ${toErrorMessage(err)}`, "restore");
  }
}

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  created: Date;
  modified: Date;
}

export async function listBackups(): Promise<BackupInfo[]> {
  try {
    if (!fs.existsSync(dbDir)) {
      return [];
    }

    const files = fs.readdirSync(dbDir);
    const backups = files
      .filter((file) => file.startsWith("downloads.db.backup."))
      .map((file): BackupInfo => {
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
      .sort((a, b) => b.created.getTime() - a.created.getTime()); // Sort by creation date, newest first

    return backups;
  } catch (err) {
    throw new DatabaseError(`Failed to list backups: ${toErrorMessage(err)}`, "listBackups");
  }
}

export default db;
