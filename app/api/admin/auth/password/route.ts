import { adminRoute, json, parseJson, enforceRateLimit } from "@/lib/http";
import { changePasswordSchema } from "@/lib/validation/schemas";
import { changeAdminPassword, startAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const POST = adminRoute(async (req, _ctx, admin) => {
  enforceRateLimit(req, "admin-password", 5, 5 * 60_000);
  const { currentPassword, newPassword } = await parseJson(req, changePasswordSchema);
  const updated = await changeAdminPassword(admin.id, currentPassword, newPassword);
  // Re-issue this session; all other sessions are invalidated by the password version.
  await startAdminSession(updated);
  return json({ ok: true });
});
