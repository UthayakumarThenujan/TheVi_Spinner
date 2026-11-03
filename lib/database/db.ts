import * as fileDb from "./jsonDatabase";
import * as redisDb from "./redisDatabase";
import type { Store } from "./jsonDatabase";

/**
 * Picks the storage backend at runtime:
 *  - Redis when REDIS_URL (redis://) or Upstash REST vars (KV_REST_API_URL/TOKEN) are set;
 *  - otherwise the local JSON files in DATA_DIR (local dev, tests, servers with a persistent disk).
 */
function backend() {
  if (redisDb.redisConfigured()) return redisDb.db;
  if (process.env.VERCEL) {
    throw new Error(
      "No database configured. On Vercel, connect a Redis store (Storage tab) so REDIS_URL " +
        "(or KV_REST_API_URL + KV_REST_API_TOKEN) is set, then redeploy.",
    );
  }
  return fileDb.db;
}

export const db = {
  transaction<R>(fn: (store: Store) => Promise<R>): Promise<R> {
    return backend().transaction(fn);
  },
  get readStore(): Store {
    return backend().readStore;
  },
};
