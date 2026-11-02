import { adminRoute, json, parseJson } from "@/lib/http";
import { spinnerInputSchema } from "@/lib/validation/schemas";
import { listSpinners, createSpinner } from "@/lib/services/spinnerService";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => json({ spinners: await listSpinners() }));

export const POST = adminRoute(async (req) => {
  const input = await parseJson(req, spinnerInputSchema);
  return json({ spinner: await createSpinner(input) }, 201);
});
