import { route, json } from "@/lib/http";
import { getPublicSpinner } from "@/lib/services/spinnerService";
import { notFound } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

/** GET /api/spinners/:id — public details of an active spinner. */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const spinner = await getPublicSpinner(id);
  if (!spinner) throw notFound("Spinner");
  return json({ spinner });
});
