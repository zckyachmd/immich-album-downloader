import { homedir } from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export function expandPath(p) {
  let resolved = p.startsWith("~")
    ? path.join(homedir(), p.slice(1))
    : path.resolve(p);

  resolved = path.normalize(resolved);

  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }

  return resolved;
}

export function sanitizeName(name) {
  return String(name)
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/-+/g, "-")
    .trim();
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