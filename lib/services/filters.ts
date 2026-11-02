import type { NextRequest } from "next/server";
import type { ParticipantFilters } from "./reportService";

export function filtersFrom(req: NextRequest): ParticipantFilters {
  const p = req.nextUrl.searchParams;
  const get = (k: string) => p.get(k)?.trim() || undefined;
  return {
    q: get("q"),
    spinnerId: get("spinnerId"),
    offerId: get("offerId"),
    status: get("status"),
    from: get("from"),
    to: get("to"),
  };
}
