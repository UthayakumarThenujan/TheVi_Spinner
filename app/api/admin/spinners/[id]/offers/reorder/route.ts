import { z } from "zod";
import { adminRoute, json, parseJson } from "@/lib/http";
import { reorderOffers } from "@/lib/services/spinnerService";

export const dynamic = "force-dynamic";

const schema = z.object({ order: z.array(z.string().min(1)).max(32) });

export const POST = adminRoute<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { order } = await parseJson(req, schema);
  return json({ offers: await reorderOffers(id, order) });
});
