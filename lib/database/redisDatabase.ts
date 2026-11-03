import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import { createClient } from "redis";
import { logger } from "@/lib/utils/logger";
import { COLLECTION_DEFAULTS, type CollectionName, type Store } from "./jsonDatabase";

/**
 * Upstash Redis backend (used on serverless hosts such as Vercel, where the local
 * filesystem is not shared or persistent).
 *
 * Each collection is stored as one JSON string under `<prefix><name>`, mirroring the
 * JSON-file layout. Mutations are serialized across ALL server instances by a Redis
 * lock (SET NX PX). Commits run as a single Lua script that first checks the lock is
 * still ours, then writes every changed collection — so a commit is all-or-nothing and
 * can never land after the lock has expired and been taken by someone else.
 */

/* ------------------------------------------------------------------ */
/* Connection: Upstash REST (KV_REST_API_*) or plain redis:// (REDIS_URL) */
/* ------------------------------------------------------------------ */

function restUrl() {
  return process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
}
function restToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
}
function tcpUrl() {
  return process.env.REDIS_URL || process.env.KV_URL;
}
export function redisConfigured(): boolean {
  return Boolean((restUrl() && restToken()) || tcpUrl());
}

/** The few commands this module needs, over either client. */
interface KV {
  get(key: string): Promise<string | null>;
  /** SET key value NX PX ttl — true when the key was set. */
  setNxPx(key: string, value: string, ttlMs: number): Promise<boolean>;
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

function upstashKV(): KV {
  const r = new Redis({ url: restUrl()!, token: restToken()!, automaticDeserialization: false });
  return {
    get: (k) => r.get<string>(k),
    setNxPx: async (k, v, ms) => (await r.set(k, v, { nx: true, px: ms })) === "OK",
    eval: (s, keys, args) => r.eval(s, keys, args),
  };
}

function tcpKV(): KV {
  const client = createClient({ url: tcpUrl()! });
  client.on("error", (err) => logger.error("db.redis_error", { error: String(err) }));
  let ready: Promise<unknown> | null = null;
  const conn = async () => {
    if (!client.isOpen) ready ??= client.connect().catch((err) => ((ready = null), Promise.reject(err)));
    await ready;
    return client;
  };
  return {
    get: async (k) => (await (await conn()).get(k)) as string | null,
    setNxPx: async (k, v, ms) =>
      (await (await conn()).set(k, v, { condition: "NX", expiration: { type: "PX", value: ms } })) === "OK",
    eval: async (s, keys, args) => (await conn()).eval(s, { keys, arguments: args }),
  };
}

const PREFIX = () => process.env.REDIS_PREFIX || "tvs:";
const keyFor = (name: CollectionName) => `${PREFIX()}${name}`;
const lockKey = () => `${PREFIX()}lock`;

type GlobalWithRedis = typeof globalThis & { __tvsKV?: KV; __tvsRedisQueue?: Promise<unknown> };
const g = globalThis as GlobalWithRedis;

function redis(): KV {
  g.__tvsKV ??= restUrl() && restToken() ? upstashKV() : tcpKV();
  return g.__tvsKV;
}

async function readRaw<T>(name: CollectionName): Promise<T> {
  const text = await redis().get(keyFor(name));
  if (text == null) return structuredClone(COLLECTION_DEFAULTS[name]) as T;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    logger.error("db.corrupt_key", { collection: name, error: String(err) });
    throw new Error(`Database key ${name} is corrupt`);
  }
}

/* ------------------------------------------------------------------ */
/* Locking                                                             */
/* ------------------------------------------------------------------ */

const LOCK_TTL_MS = 15_000;

const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end
return 0`;

/** KEYS[1] = lock, KEYS[2..] = collections; ARGV[1] = lock token, ARGV[2..] = JSON values. */
const COMMIT_SCRIPT = `
if redis.call("GET", KEYS[1]) ~= ARGV[1] then return 0 end
for i = 2, #KEYS do redis.call("SET", KEYS[i], ARGV[i]) end
return 1`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function acquireLock(): Promise<string> {
  const token = crypto.randomUUID();
  const deadline = Date.now() + 10_000;
  for (;;) {
    if (await redis().setNxPx(lockKey(), token, LOCK_TTL_MS)) return token;
    if (Date.now() > deadline) throw new Error("Timed out waiting for database lock");
    await sleep(25 + Math.random() * 50);
  }
}

async function releaseLock(token: string) {
  try {
    await redis().eval(RELEASE_SCRIPT, [lockKey()], [token]);
  } catch (err) {
    // The lock expires on its own; don't mask the transaction's real outcome.
    logger.warn("db.lock_release_failed", { error: String(err) });
  }
}

/** In-process FIFO queue so one instance doesn't contend with itself for the Redis lock. */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__tvsRedisQueue ?? Promise.resolve();
  const run = prev.then(fn, fn);
  g.__tvsRedisQueue = run.catch(() => undefined);
  return run;
}

/* ------------------------------------------------------------------ */
/* Public API (same shape as jsonDatabase)                             */
/* ------------------------------------------------------------------ */

export const readStore: Store = {
  read: readRaw,
  write() {
    throw new Error("Writes must happen inside db.transaction()");
  },
};

export function transaction<R>(fn: (store: Store) => Promise<R>): Promise<R> {
  return enqueue(async () => {
    const token = await acquireLock();
    try {
      const cache = new Map<CollectionName, unknown>();
      const dirty = new Set<CollectionName>();
      const store: Store = {
        async read<T>(name: CollectionName): Promise<T> {
          if (!cache.has(name)) cache.set(name, await readRaw<T>(name));
          return structuredClone(cache.get(name)) as T;
        },
        write<T>(name: CollectionName, data: T) {
          cache.set(name, structuredClone(data));
          dirty.add(name);
        },
      };
      const result = await fn(store);
      if (dirty.size > 0) {
        const names = [...dirty];
        const committed = await redis().eval(
          COMMIT_SCRIPT,
          [lockKey(), ...names.map(keyFor)],
          [token, ...names.map((n) => JSON.stringify(cache.get(n)))],
        );
        if (Number(committed) !== 1) throw new Error("Database lock expired before commit; please retry");
      }
      return result;
    } finally {
      await releaseLock(token);
    }
  });
}

export const db = { transaction, readStore };
