import { promises as fs, constants as fsConstants } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { logger } from "@/lib/utils/logger";

/**
 * Minimal JSON-file database.
 *
 * Guarantees (single server):
 *  - All mutations run inside `transaction()`, which is serialized by an in-process
 *    mutex AND a lock file (protects against multiple Node workers on the same disk).
 *  - Files are written atomically (write temp file -> fsync -> rename), so a crash never
 *    leaves a half-written JSON file.
 *  - A transaction only persists if its callback resolves; throwing aborts all changes.
 *
 * Business logic never touches this module directly — it goes through the repositories
 * in this folder, which is the seam for a future PostgreSQL implementation.
 */

export type CollectionName = "users" | "spinners" | "offers" | "spin_results" | "admin" | "settings";

const DEFAULTS: Record<CollectionName, unknown> = {
  users: [],
  spinners: [],
  offers: [],
  spin_results: [],
  admin: [],
  settings: {},
};

export function getDataDir(): string {
  return path.resolve(process.cwd(), process.env.DATA_DIR || "./data");
}

function fileFor(name: CollectionName): string {
  return path.join(getDataDir(), `${name}.json`);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Create a missing collection file, seeding from data/seed/<name>.json when available. */
async function ensureFile(name: CollectionName): Promise<void> {
  const file = fileFor(name);
  if (await exists(file)) return;
  await fs.mkdir(getDataDir(), { recursive: true });
  const seedFile = path.join(process.cwd(), "data", "seed", `${name}.json`);
  let initial = JSON.stringify(DEFAULTS[name], null, 2);
  if (!process.env.DISABLE_SEED && (await exists(seedFile))) {
    initial = await fs.readFile(seedFile, "utf8");
  }
  await atomicWrite(file, initial);
}

async function readRaw<T>(name: CollectionName): Promise<T> {
  await ensureFile(name);
  const text = await retry(() => fs.readFile(fileFor(name), "utf8"));
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    logger.error("db.corrupt_file", { collection: name, error: String(err) });
    throw new Error(`Database file ${name}.json is corrupt`);
  }
}

async function atomicWrite(file: string, content: string): Promise<void> {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  // On Windows rename can transiently fail with EPERM/EBUSY if a reader holds the file.
  await retry(() => fs.rename(tmp, file)).catch(async (err) => {
    await fs.rm(tmp, { force: true });
    throw err;
  });
}

async function retry<T>(fn: () => Promise<T>, attempts = 8): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") throw err;
      lastErr = err;
      await sleep(15 * (i + 1));
    }
  }
  throw lastErr;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ------------------------------------------------------------------ */
/* Locking                                                             */
/* ------------------------------------------------------------------ */

type GlobalWithLock = typeof globalThis & { __tvsDbQueue?: Promise<unknown> };
const g = globalThis as GlobalWithLock;

/** In-process FIFO mutex (survives Next.js hot reloads via globalThis). */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__tvsDbQueue ?? Promise.resolve();
  const run = prev.then(fn, fn);
  g.__tvsDbQueue = run.catch(() => undefined);
  return run;
}

const LOCK_STALE_MS = 15_000;

/** Cross-process lock using an exclusively created lock file. */
async function acquireFileLock(): Promise<() => Promise<void>> {
  await fs.mkdir(getDataDir(), { recursive: true });
  const lockPath = path.join(getDataDir(), ".lock");
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.writeFile(`${process.pid}:${Date.now()}`);
      await handle.close();
      return async () => {
        await fs.rm(lockPath, { force: true });
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          logger.warn("db.stale_lock_removed", { lockPath });
          await fs.rm(lockPath, { force: true });
          continue;
        }
      } catch {
        continue; // lock vanished between open and stat
      }
      if (Date.now() > deadline) throw new Error("Timed out waiting for database lock");
      await sleep(20 + Math.random() * 30);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface Store {
  read<T>(name: CollectionName): Promise<T>;
  write<T>(name: CollectionName, data: T): void;
}

/** Read-only snapshot access (no lock; atomic renames guarantee whole-file reads). */
export const readStore: Store = {
  read: readRaw,
  write() {
    throw new Error("Writes must happen inside db.transaction()");
  },
};

/**
 * Run `fn` with exclusive access to the database. All writes made through the
 * provided store are buffered and flushed atomically (per file) once `fn` resolves.
 */
export function transaction<R>(fn: (store: Store) => Promise<R>): Promise<R> {
  return enqueue(async () => {
    const release = await acquireFileLock();
    try {
      const cache = new Map<CollectionName, unknown>();
      const dirty = new Set<CollectionName>();
      const store: Store = {
        async read<T>(name: CollectionName): Promise<T> {
          if (!cache.has(name)) cache.set(name, await readRaw<T>(name));
          // Hand out a deep copy so aborted transactions never leak mutations.
          return structuredClone(cache.get(name)) as T;
        },
        write<T>(name: CollectionName, data: T) {
          cache.set(name, structuredClone(data));
          dirty.add(name);
        },
      };
      const result = await fn(store);
      for (const name of dirty) {
        await atomicWrite(fileFor(name), JSON.stringify(cache.get(name), null, 2));
      }
      return result;
    } finally {
      await release();
    }
  });
}

export const db = { transaction, readStore };
