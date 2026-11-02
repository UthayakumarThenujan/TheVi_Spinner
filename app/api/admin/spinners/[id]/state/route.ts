import { z } from "zod";
import { adminRoute, json, parseJson } from "@/lib/http";
import { changeSpinnerState } from "@/lib/services/spinnerService";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["deactivate", "pause", "resume", "archive", "reopen"]) });

/** Deactivate / pause / resume / archive / reopen a spinner. */
export const POST = adminRoute<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { action } = await parseJson(req, schema);
  return json({ spinner: await changeSpinnerState(id, action) });
});
