import { route, json, enforceRateLimit } from "@/lib/http";
import { checkParticipation, hasMobileParticipated } from "@/lib/spin/spinService";
import { getParticipantToken } from "@/lib/auth/session";
import { badRequest } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/spins/check?spinnerId=...            -> status for this browser's participant cookie
 * GET /api/spins/check?spinnerId=...&mobile=... -> { participated: boolean } only
 */
export const GET = route(async (req) => {
  enforceRateLimit(req, "check", 60, 60_000);
  const spinnerId = req.nextUrl.searchParams.get("spinnerId");
  if (!spinnerId) throw badRequest("spinnerId is required");
  const mobile = req.nextUrl.searchParams.get("mobile");
  if (mobile) {
    enforceRateLimit(req, "check-mobile", 10, 60_000);
    return json({ participated: await hasMobileParticipated(spinnerId, mobile) });
  }
  return json(await checkParticipation(spinnerId, await getParticipantToken()));
});
