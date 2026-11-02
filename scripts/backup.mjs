#!/usr/bin/env node
/**
 * Snapshot the JSON database + uploads into ./backups/<timestamp>/.
 *   npm run backup
 * Restore: stop the app, copy the snapshot's files back into DATA_DIR, start the app.
 * Schedule this (cron / Task Scheduler) in production, and copy backups off the server.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.env.DATA_DIR || "./data");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.resolve(process.env.BACKUP_DIR || "./backups", stamp);

await fs.mkdir(dest, { recursive: true });
let count = 0;
for (const entry of await fs.readdir(dataDir, { withFileTypes: true })) {
  const src = path.join(dataDir, entry.name);
  if (entry.isFile() && entry.name.endsWith(".json")) {
    await fs.copyFile(src, path.join(dest, entry.name));
    count++;
  } else if (entry.isDirectory() && entry.name === "uploads") {
    await fs.cp(src, path.join(dest, "uploads"), { recursive: true });
  }
}
console.log(`Backed up ${count} JSON files (+ uploads) to ${dest}`);
