import { adminRoute, json, parseJson } from "@/lib/http";
import { spinnerInputSchema } from "@/lib/validation/schemas";
import { getSpinnerWithOffers, updateSpinner, deleteSpinner } from "@/lib/services/spinnerService";

export const dynamic = "force-dynamic";

export const GET = adminRoute<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  return json(await getSpinnerWithOffers(id));
});

export const PUT = adminRoute<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const input = await parseJson(req, spinnerInputSchema);
  return json({ spinner: await updateSpinner(id, input) });
});

/** Only drafts without participants can be deleted; everything else is archived. */
export const DELETE = adminRoute<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  await deleteSpinner(id);
  return json({ ok: true });
});
