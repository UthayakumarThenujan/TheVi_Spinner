import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/utils/rateLimit";
import { getAdmin } from "@/lib/auth/session";
import type { AdminUser } from "@/types/user";

export function json<T>(data: T, init?: number | ResponseInit) {
  const res = NextResponse.json(data, typeof init === "number" ? { status: init } : init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: first?.message ?? "Invalid input",
          details: { fields: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        },
      },
      400,
    );
  }
  logger.error("api.unhandled_error", { error: err instanceof Error ? err.stack ?? err.message : String(err) });
  return json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } }, 500);
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export function enforceRateLimit(req: NextRequest, bucket: string, limit: number, windowMs: number) {
  const { ok, retryAfter } = rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs);
  if (!ok) {
    throw new AppError(429, "RATE_LIMITED", `Too many requests. Please wait ${retryAfter}s and try again.`, { retryAfter });
  }
}

export async function parseJson<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
  return schema.parse(body);
}

/** Reject cross-site state-changing requests (CSRF defence in addition to SameSite cookies). */
export function assertSameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new Error();
  } catch {
    throw new AppError(403, "BAD_ORIGIN", "Cross-site request rejected");
  }
}

export async function requireAdmin(req: NextRequest): Promise<AdminUser> {
  assertSameOrigin(req);
  const admin = await getAdmin();
  if (!admin) throw new AppError(401, "UNAUTHORIZED", "Admin login required");
  enforceRateLimit(req, `admin:${admin.id}`, 300, 60_000);
  return admin;
}

type Ctx<P> = { params: Promise<P> };

/** Wrap a route handler with uniform error handling. */
export function route<P = Record<string, never>>(
  fn: (req: NextRequest, ctx: Ctx<P>) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Wrap an admin-only route handler. */
export function adminRoute<P = Record<string, never>>(
  fn: (req: NextRequest, ctx: Ctx<P>, admin: AdminUser) => Promise<Response>,
) {
  return route<P>(async (req, ctx) => {
    const admin = await requireAdmin(req);
    return fn(req, ctx, admin);
  });
}
