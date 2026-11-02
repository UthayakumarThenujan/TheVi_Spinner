import { route, json } from "@/lib/http";
import { getActivePublicSpinner } from "@/lib/services/spinnerService";

export const dynamic = "force-dynamic";

/** GET /api/spinners/active — the current public campaign (no participant data). */
export const GET = route(async () => {
  const spinner = await getActivePublicSpinner();
  return json({ spinner });
});
