import { adminRoute, json, parseJson } from "@/lib/http";
import { offerInputSchema } from "@/lib/validation/schemas";
import { updateOffer, deleteOffer } from "@/lib/services/spinnerService";

export const dynamic = "force-dynamic";

type P = { id: string; offerId: string };

export const PUT = adminRoute<P>(async (req, { params }) => {
  const { id, offerId } = await params;
  const input = await parseJson(req, offerInputSchema);
  return json({ offer: await updateOffer(id, offerId, input) });
});

export const DELETE = adminRoute<P>(async (_req, { params }) => {
  const { id, offerId } = await params;
  await deleteOffer(id, offerId);
  return json({ ok: true });
});
