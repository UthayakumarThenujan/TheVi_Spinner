import { adminRoute, json } from "@/lib/http";
import { listParticipantRows } from "@/lib/services/reportService";
import { filtersFrom } from "@/lib/services/filters";

export const dynamic = "force-dynamic";

/** Participants who have spun. Use ?status=winners|nonwinners|won|lost|redeemed to split. */
export const GET = adminRoute(async (req) =>
  json({ rows: await listParticipantRows({ ...filtersFrom(req), onlySpun: true }) }),
);
