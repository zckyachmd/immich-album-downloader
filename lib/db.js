import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { expandPath } from "./helpers.js";

const dbDir = expandPath("media-cache");
const dbPath = path.join(dbDir, "downloads.db");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS downloads (
    asset_id TEXT PRIMARY KEY,
    album_id TEXT,
    status TEXT CHECK(status IN ('downloaded', 'failed', 'skip')),
    checksum TEXT,
    target_dir TEXT,
    downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export async function assetAlreadyDownloaded(
  assetId,
  albumId,
  checksum,
  targetDir
) {
  const row = db
    .prepare(
      `SELECT 1 FROM downloads WHERE asset_id = ? AND album_id = ? AND status = 'downloaded' AND checksum = ? AND target_dir = ?`
    )
    .get(assetId, albumId, checksum, targetDir);
  return !!row;
}

export async function markAssetAsDownloaded(
  assetId,
  albumId,
  checksum,
  targetDir
) {
  db.prepare(
    `
    INSERT OR REPLACE INTO downloads (asset_id, album_id, status, checksum, target_dir)
    VALUES (?, ?, 'downloaded', ?, ?)
  `
  ).run(assetId, albumId, checksum, targetDir);
}

export async function markAssetAsFailed(assetId, albumId) {
  db.prepare(
    `
    INSERT OR REPLACE INTO downloads (asset_id, album_id, status)
    VALUES (?, ?, 'failed')
  `
  ).run(assetId, albumId);
}

export async function getFailedAssets(albumId) {
  const rows = db
    .prepare(
      `
    SELECT asset_id FROM downloads
    WHERE album_id = ? AND status = 'failed'
  `
    )
    .all(albumId);
  return rows.map((row) => row.asset_id);
}

export default db;
