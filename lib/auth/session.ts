import crypto from "node:crypto";
import { cookies } from "next/headers";
import { readRepos, withRepos } from "@/lib/database/repositories";
import { hashPassword, verifyPassword, safeEqual } from "./password";
import { AppError } from "@/lib/utils/errors";
import { newId, nowIso, sha256 } from "@/lib/utils/ids";
import { logger } from "@/lib/utils/logger";
import type { AdminUser } from "@/types/user";

export const ADMIN_COOKIE = "tvs_admin";
export const PARTICIPANT_COOKIE = "tvs_pt";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set (32+ chars) in production");
    }
    return "dev-only-insecure-session-secret-change-me-0000";
  }
  return s;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

interface SessionPayload {
  sub: string;
  usr: string;
  /** password version: changes when the password changes, invalidating old sessions */
  pwv: string;
  exp: number;
}

function encode(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const passwordVersion = (admin: AdminUser) => sha256(admin.passwordHash).slice(0, 16);

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Validate credentials. Bootstraps the first admin from env vars when admin.json is empty. */
export async function authenticate(username: string, password: string): Promise<AdminUser> {
  const repos = readRepos();
  let admin = await repos.admins.findByUsername(username);

  if (!admin && (await repos.admins.all()).length === 0) {
    const envUser = process.env.ADMIN_USERNAME;
    const envPass = process.env.ADMIN_PASSWORD;
    if (envUser && envPass && safeEqual(username.toLowerCase(), envUser.toLowerCase()) && safeEqual(password, envPass)) {
      admin = await withRepos(async (tx) => {
        const again = await tx.admins.findByUsername(envUser);
        if (again) return again;
        const ts = nowIso();
        const created: AdminUser = {
          id: newId("admin"),
          username: envUser,
          passwordHash: await hashPassword(envPass),
          createdAt: ts,
          updatedAt: ts,
        };
        await tx.admins.insert(created);
        logger.info("admin.bootstrapped", { username: envUser });
        return created;
      });
      return admin;
    }
  }

  // Always run a hash comparison to reduce user-enumeration timing differences.
  const ok = await verifyPassword(password, admin?.passwordHash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
  if (!admin || !ok) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid username or password");
  return admin;
}

export async function startAdminSession(admin: AdminUser) {
  const jar = await cookies();
  const token = encode({
    sub: admin.id,
    usr: admin.username,
    pwv: passwordVersion(admin),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
  jar.set(ADMIN_COOKIE, token, { ...cookieBase, sameSite: "strict", maxAge: SESSION_TTL_SECONDS });
}

export async function endAdminSession() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

/** Returns the admin for the current request or null. */
export async function getAdmin(): Promise<AdminUser | null> {
  const jar = await cookies();
  const payload = decode(jar.get(ADMIN_COOKIE)?.value);
  if (!payload) return null;
  const admin = await readRepos().admins.findById(payload.sub);
  if (!admin || passwordVersion(admin) !== payload.pwv) return null;
  return admin;
}

export async function changeAdminPassword(adminId: string, current: string, next: string): Promise<AdminUser> {
  const updated = await withRepos(async (repos) => {
    const admin = await repos.admins.getById(adminId, "Admin");
    if (!(await verifyPassword(current, admin.passwordHash))) {
      throw new AppError(400, "INVALID_PASSWORD", "Current password is incorrect");
    }
    return repos.admins.update(adminId, { passwordHash: await hashPassword(next), updatedAt: nowIso() });
  });
  logger.info("admin.password_changed", { adminId });
  return updated;
}

/* ---------------------------- participants ---------------------------- */

export async function setParticipantCookie(token: string) {
  const jar = await cookies();
  jar.set(PARTICIPANT_COOKIE, token, { ...cookieBase, maxAge: 60 * 60 * 24 * 30 });
}

export async function getParticipantToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(PARTICIPANT_COOKIE)?.value;
}
