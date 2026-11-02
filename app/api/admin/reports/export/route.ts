import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/http";
import { listParticipantRows, participantsCsv, spinnerReportCsv } from "@/lib/services/reportService";
import { filtersFrom } from "@/lib/services/filters";
import { badRequest } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

/** GET /api/admin/reports/export?type=participants|winners|spinner[&filters] -> CSV download */
export const GET = adminRoute(async (req, _ctx, admin) => {
  const type = req.nextUrl.searchParams.get("type") ?? "participants";
  const filters = filtersFrom(req);
  let csv: string;
  let name: string;
  if (type === "spinner") {
    if (!filters.spinnerId) throw badRequest("spinnerId is required");
    csv = await spinnerReportCsv(filters.spinnerId);
    name = `spinner-report-${filters.spinnerId}`;
  } else if (type === "winners") {
    csv = participantsCsv(await listParticipantRows({ ...filters, onlySpun: true }));
    name = "spin-results";
  } else {
    csv = participantsCsv(await listParticipantRows(filters));
    name = "participants";
  }
  logger.info("report.exported", { adminId: admin.id, type });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
