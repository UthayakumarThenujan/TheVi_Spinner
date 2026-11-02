import { adminRoute, json, parseJson } from "@/lib/http";
import { offerInputSchema } from "@/lib/validation/schemas";
import { createOffer } from "@/lib/services/spinnerService";
import { readRepos } from "@/lib/database/repositories";

export const dynamic = "force-dynamic";

export const GET = adminRoute<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  return json({ offers: await readRepos().offers.forSpinner(id) });
});

export const POST = adminRoute<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const input = await parseJson(req, offerInputSchema);
  return json({ offer: await createOffer(id, input) }, 201);
});
