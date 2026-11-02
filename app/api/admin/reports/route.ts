import { adminRoute, json } from "@/lib/http";
import { getSpinnerAnalytics } from "@/lib/services/reportService";
import { badRequest } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

/** GET /api/admin/reports?spinnerId=... — analytics for one spinner. */
export const GET = adminRoute(async (req) => {
  const spinnerId = req.nextUrl.searchParams.get("spinnerId");
  if (!spinnerId) throw badRequest("spinnerId is required");
  return json(await getSpinnerAnalytics(spinnerId));
});
