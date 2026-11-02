import { z } from "zod";
import { adminRoute, json, parseJson } from "@/lib/http";
import { setResultRedeemed } from "@/lib/services/reportService";

export const dynamic = "force-dynamic";

const schema = z.object({ redeemed: z.boolean() });

/** PATCH /api/admin/results/:id — mark a winning result as redeemed (or undo). */
export const PATCH = adminRoute<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { redeemed } = await parseJson(req, schema);
  return json({ result: await setResultRedeemed(id, redeemed) });
});
