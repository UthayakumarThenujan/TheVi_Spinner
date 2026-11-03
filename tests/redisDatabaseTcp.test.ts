import { describe, it, expect, beforeEach, vi } from "vitest";

/** In-memory stand-in for the node-redis client (REDIS_URL connections). */
const mem = new Map<string, string>();
vi.mock("redis", () => ({
  createClient: () => ({
    isOpen: false,
    on() {},
    async connect() {
      this.isOpen = true;
    },
    async get(k: string) {
      return mem.get(k) ?? null;
    },
    async set(k: string, v: string, opts?: { condition?: string }) {
      if (opts?.condition === "NX" && mem.has(k)) return null;
      mem.set(k, v);
      return "OK";
    },
    async eval(script: string, { keys, arguments: args }: { keys: string[]; arguments: string[] }) {
      if (mem.get(keys[0]) !== args[0]) return 0;
      if (script.includes("DEL")) return mem.delete(keys[0]) ? 1 : 0;
      for (let i = 1; i < keys.length; i++) mem.set(keys[i], args[i]);
      return 1;
    },
  }),
}));

delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
process.env.REDIS_URL = "redis://fake:6379";

const { withRepos, readRepos } = await import("@/lib/database/repositories");

beforeEach(() => mem.clear());

describe("redis backend over REDIS_URL", () => {
  it("commits, reads back and releases the lock", async () => {
    await withRepos((r) =>
      r.admins.insert({ id: "a1", username: "Boss", passwordHash: "x", createdAt: "", updatedAt: "" }),
    );
    expect((await readRepos().admins.findByUsername("boss"))?.id).toBe("a1");
    expect(JSON.parse(mem.get("tvs:admin")!)).toHaveLength(1);
    expect(mem.has("tvs:lock")).toBe(false);
  });

  it("serializes concurrent transactions", async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        withRepos((r) =>
          r.admins.insert({ id: `a${i}`, username: `u${i}`, passwordHash: "x", createdAt: "", updatedAt: "" }),
        ),
      ),
    );
    expect((await readRepos().admins.all()).length).toBe(10);
  });
});
