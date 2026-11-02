import { adminRoute, json } from "@/lib/http";
import { duplicateSpinner } from "@/lib/services/spinnerService";

export const dynamic = "force-dynamic";

export const POST = adminRoute<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  return json({ spinner: await duplicateSpinner(id) }, 201);
});
