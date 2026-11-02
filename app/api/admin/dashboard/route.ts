import { adminRoute, json } from "@/lib/http";
import { getDashboard } from "@/lib/services/reportService";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => json(await getDashboard()));
