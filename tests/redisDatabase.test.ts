import { describe, it, expect, beforeEach, vi } from "vitest";

/** In-memory stand-in for Upstash Redis covering the commands redisDatabase uses. */
const mem = new Map<string, string>();
vi.mock("@upstash/redis", () => ({
  Redis: class {
    async get(k: string) {
      return mem.get(k) ?? null;
    }
    async set(k: string, v: string, opts?: { nx?: boolean }) {
      if (opts?.nx && mem.has(k)) return null;
      mem.set(k, v);
      return "OK";
    }
    async eval(script: string, keys: string[], args: string[]) {
      if (mem.get(keys[0]) !== args[0]) return 0;
      if (script.includes("DEL")) {
        mem.delete(keys[0]);
        return 1;
      }
      for (let i = 1; i < keys.length; i++) mem.set(keys[i], args[i]);
      return 1;
    }
  },
}));

process.env.KV_REST_API_URL = "https://fake.upstash.io";
process.env.KV_REST_API_TOKEN = "fake";

const { db } = await import("@/lib/database/db");
const { withRepos, readRepos } = await import("@/lib/database/repositories");

beforeEach(() => mem.clear());

describe("redis backend", () => {
  it("is selected when KV env vars are set and returns defaults for empty keys", async () => {
    expect(await db.readStore.read("users")).toEqual([]);
    expect(await db.readStore.read("settings")).toEqual({});
  });

  it("commits writes and releases the lock", async () => {
    await withRepos((r) =>
      r.admins.insert({ id: "a1", username: "Boss", passwordHash: "x", createdAt: "", updatedAt: "" }),
    );
    expect((await readRepos().admins.findByUsername("boss"))?.id).toBe("a1");
    expect(mem.has("tvs:lock")).toBe(false);
  });

  it("rolls back when the transaction throws", async () => {
    await expect(
      withRepos(async (r) => {
        await r.admins.insert({ id: "a1", username: "x", passwordHash: "x", createdAt: "", updatedAt: "" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await readRepos().admins.all()).toEqual([]);
    expect(mem.has("tvs:lock")).toBe(false);
  });

  it("refuses to commit if the lock was lost", async () => {
    await expect(
      withRepos(async (r) => {
        mem.set("tvs:lock", "someone-else");
        await r.admins.insert({ id: "a1", username: "x", passwordHash: "x", createdAt: "", updatedAt: "" });
      }),
    ).rejects.toThrow(/lock expired/);
    expect(mem.has("tvs:admin")).toBe(false);
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
