import { route, json, parseJson, enforceRateLimit, assertSameOrigin } from "@/lib/http";
import { loginSchema } from "@/lib/validation/schemas";
import { authenticate, startAdminSession } from "@/lib/auth/session";
import { logger } from "@/lib/utils/logger";
import { AppError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  enforceRateLimit(req, "admin-login", 8, 5 * 60_000);
  const { username, password } = await parseJson(req, loginSchema);
  try {
    const admin = await authenticate(username, password);
    await startAdminSession(admin);
    logger.info("admin.login", { adminId: admin.id });
    return json({ admin: { id: admin.id, username: admin.username } });
  } catch (err) {
    if (err instanceof AppError && err.code === "INVALID_CREDENTIALS") logger.warn("admin.login_failed", { username });
    throw err;
  }
});
