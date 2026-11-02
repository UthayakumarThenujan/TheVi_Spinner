import { route, json, parseJson, enforceRateLimit, assertSameOrigin } from "@/lib/http";
import { spinSchema } from "@/lib/validation/schemas";
import { executeSpin } from "@/lib/spin/spinService";
import { getParticipantToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** POST /api/spins — server selects, persists and returns the result. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  enforceRateLimit(req, "spin", 20, 60_000);
  const { spinnerId } = await parseJson(req, spinSchema);
  const outcome = await executeSpin(spinnerId, await getParticipantToken());
  return json(outcome, outcome.replay ? 200 : 201);
});
