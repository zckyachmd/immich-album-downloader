export interface CliArgs {
  _: (string | number)[];
  $0: string;
  all: boolean;
  concurrency?: number;
  exclude?: string;
  "dry-run": boolean;
  "limit-size"?: number;
  "max-retries"?: number;
  only?: string;
  output?: string;
  "base-url"?: string;
  "api-key"?: string;
  interactive: boolean;
  "reset-config": boolean;
  "save-config": boolean;
  force: boolean;
  "resume-failed": boolean;
  verbose: boolean;
  "cleanup-db"?: number;
  "cleanup-db-all": boolean;
  "backup-db"?: string;
  "restore-db"?: string;
  "list-backups": boolean;
  help: boolean;
}

export interface ImmichAsset {
  id: string;
  originalFileName?: string;
  checksum?: string;
  exifInfo?: { fileSizeInByte?: number };
  size?: number;
  fileSize?: number;
  originalSize?: number;
}

export interface ImmichAlbum {
  id: string;
  albumName: string;
  assetCount: number;
  assets?: ImmichAsset[];
}
