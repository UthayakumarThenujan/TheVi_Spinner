import { adminRoute, json } from "@/lib/http";
import { listParticipantRows } from "@/lib/services/reportService";
import { filtersFrom } from "@/lib/services/filters";

export const dynamic = "force-dynamic";

/** All registered participants with their spin results. */
export const GET = adminRoute(async (req) => json({ rows: await listParticipantRows(filtersFrom(req)) }));
