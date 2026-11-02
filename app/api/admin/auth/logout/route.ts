import { route, json, assertSameOrigin } from "@/lib/http";
import { endAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await endAdminSession();
  return json({ ok: true });
});
