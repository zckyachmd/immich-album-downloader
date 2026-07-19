import path from "path";
import fs from "fs";
import {
  backupDatabase,
  cleanupDatabase,
  closeDatabase,
  listBackups,
  restoreDatabase,
} from "../lib/db";
import { expandPath, formatFileSize } from "../lib/helpers";
import { log, logError, logWarn } from "../lib/logger.js";

export async function handleDatabaseCommand(argv) {
  if (argv["cleanup-db"] !== undefined) {
    const daysOld = argv["cleanup-db"];
    const onlyFailed = !argv["cleanup-db-all"];

    try {
      log(`💾 Creating backup before cleanup...`);
      const backupPath = await backupDatabase();
      log(`✅ Backup created: ${backupPath}`);
    } catch (err) {
      logWarn(`⚠️  Could not create backup before cleanup: ${err.message}`);
    }

    log(`🧹 Cleaning up database records older than ${daysOld} days...`);
    log(`   Mode: ${onlyFailed ? "Failed records only" : "All records"}`);

    try {
      const result = await cleanupDatabase({ daysOld, onlyFailed });
      log(`✅ Cleanup completed: ${result.deleted} record(s) deleted`);
      log(`   Cutoff date: ${new Date(result.cutoffDate).toLocaleString()}`);
      closeDatabase();
      process.exit(0);
    } catch (err) {
      logError(`❌ Database cleanup failed: ${err.message}`);
      closeDatabase();
      process.exit(1);
    }
  }

  if (argv["backup-db"] !== undefined) {
    let backupPath = argv["backup-db"];

    if (backupPath.endsWith("/") || backupPath.endsWith("\\")) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      backupPath = path.join(expandPath(backupPath), `downloads.db.backup.${timestamp}`);
    }

    log(`💾 Creating database backup...`);

    try {
      const result = await backupDatabase(backupPath);
      const stats = fs.statSync(result);
      log(`✅ Backup created successfully: ${result}`);
      log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
      closeDatabase();
      process.exit(0);
    } catch (err) {
      logError(`❌ Database backup failed: ${err.message}`);
      closeDatabase();
      process.exit(1);
    }
  }

  if (argv["restore-db"] !== undefined) {
    const backupPath = argv["restore-db"];

    log(`⚠️  WARNING: This will replace the current database with the backup!`);
    log(`📂 Restoring from: ${backupPath}`);

    try {
      const preRestoreBackup = await restoreDatabase(backupPath, true);
      if (preRestoreBackup) {
        log(`✅ Pre-restore backup created: ${preRestoreBackup}`);
      }
      log(`✅ Database restored successfully from: ${backupPath}`);
      closeDatabase();
      process.exit(0);
    } catch (err) {
      logError(`❌ Database restore failed: ${err.message}`);
      closeDatabase();
      process.exit(1);
    }
  }

  if (argv["list-backups"]) {
    log(`📋 Listing database backups...`);

    try {
      const backups = await listBackups();

      if (backups.length === 0) {
        log(`📭 No backups found.`);
      } else {
        log(`\nFound ${backups.length} backup(s):\n`);
        backups.forEach((backup, index) => {
          log(`${index + 1}. ${backup.filename}`);
          log(`   Path: ${backup.path}`);
          log(`   Size: ${formatFileSize(backup.size)}`);
          log(`   Created: ${backup.created.toLocaleString()}`);
          log(``);
        });
      }

      closeDatabase();
      process.exit(0);
    } catch (err) {
      logError(`❌ Failed to list backups: ${err.message}`);
      closeDatabase();
      process.exit(1);
    }
  }
}
