import { adminRoute, json } from "@/lib/http";
import { publishSpinner } from "@/lib/services/spinnerService";

export const dynamic = "force-dynamic";

/** Makes this the single active spinner; the previously active one becomes "completed". */
export const POST = adminRoute<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  return json({ spinner: await publishSpinner(id) });
});
