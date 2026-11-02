import { route, json, parseJson, enforceRateLimit, assertSameOrigin } from "@/lib/http";
import { registerSchema } from "@/lib/validation/schemas";
import { registerParticipant } from "@/lib/spin/spinService";
import { setParticipantCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** POST /api/users/register — register a participant and issue a spin authorization cookie. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  enforceRateLimit(req, "register", 10, 60_000);
  const input = await parseJson(req, registerSchema);
  const { participant, resumed } = await registerParticipant(input).then(async (out) => {
    await setParticipantCookie(out.token);
    return out;
  });
  return json(
    { participant: { id: participant.id, name: participant.name, spinnerId: participant.spinnerId }, resumed },
    resumed ? 200 : 201,
  );
});
