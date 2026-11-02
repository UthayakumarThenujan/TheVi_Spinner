import { adminRoute, json } from "@/lib/http";
import { getPreviewSpinner } from "@/lib/services/spinnerService";

export const dynamic = "force-dynamic";

export const GET = adminRoute<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  return json({ spinner: await getPreviewSpinner(id) });
});
