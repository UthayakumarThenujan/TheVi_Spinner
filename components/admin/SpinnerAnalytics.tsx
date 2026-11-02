"use client";

import { Download, Users, RotateCw, Trophy, Ticket } from "lucide-react";
import { useApi } from "@/lib/client/useApi";
import { GroupedBarChart, HBarChart, SERIES } from "./Charts";
import { StatCard } from "./DashboardStats";
import { Loading, ErrorBox } from "@/components/shared/Loading";
import type { getSpinnerAnalytics } from "@/lib/services/reportService";

type Analytics = Awaited<ReturnType<typeof getSpinnerAnalytics>>;

export function SpinnerAnalytics({ spinnerId }: { spinnerId: string }) {
  const { data, error, loading, reload } = useApi<Analytics>(`/api/admin/reports?spinnerId=${encodeURIComponent(spinnerId)}`);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <a href={`/api/admin/reports/export?type=spinner&spinnerId=${encodeURIComponent(spinnerId)}`} className="btn btn-secondary">
          <Download className="h-4 w-4" /> Download full report (CSV)
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Registered" value={data.participants} sub={`${data.pendingSpins} not spun yet`} icon={Users} accent="text-sky-600 bg-sky-50" />
        <StatCard label="Completed spins" value={data.spins} icon={RotateCw} accent="text-violet-600 bg-violet-50" />
        <StatCard label="Winners" value={data.winners} sub={`${data.redeemed} redeemed`} icon={Trophy} accent="text-amber-600 bg-amber-50" />
        <StatCard label="Remaining slots" value={data.remainingSlots} sub={`of ${data.spinner.maxParticipants}`} icon={Ticket} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h3 className="mb-4 font-semibold text-slate-900">Winners per offer</h3>
          <HBarChart data={data.perOffer.map((o) => ({ label: o.name, value: o.count, color: o.color, sub: `(${o.percentage}%)` }))} />
        </section>
        <section className="card p-5">
          <h3 className="font-semibold text-slate-900">Participation timeline</h3>
          <p className="mb-4 text-xs text-slate-500">Per {data.timelineGranularity}</p>
          {data.timeline.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No activity yet</p>
          ) : (
            <GroupedBarChart
              data={data.timeline}
              xKey="bucket"
              series={[
                { key: "registrations", label: "Registrations", color: SERIES[0] },
                { key: "spins", label: "Spins", color: SERIES[1] },
              ]}
              formatX={(v) => {
                const s = String(v);
                // buckets are UTC: "YYYY-MM-DDTHH:00" (hourly) or "YYYY-MM-DD" (daily)
                const d = new Date(s.length > 10 ? `${s}:00Z` : `${s}T00:00:00Z`);
                return data.timelineGranularity === "hour"
                  ? d.toLocaleTimeString(undefined, { hour: "numeric" })
                  : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              }}
            />
          )}
        </section>
      </div>

      <section className="card overflow-x-auto p-5">
        <h3 className="mb-3 font-semibold text-slate-900">Offer quantities</h3>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Offer</th>
              <th>Configured odds</th>
              <th>Times won</th>
              <th>Actual %</th>
              <th>Remaining</th>
              <th>Redeemed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.perOffer.map((o) => (
              <tr key={o.offerId}>
                <td className="py-2">
                  <span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: o.color }} />
                  {o.name}
                  {!o.isWinning && <span className="ml-1 text-xs text-slate-400">(no prize)</span>}
                </td>
                <td>{o.configuredOdds}%</td>
                <td>{o.count}</td>
                <td>{o.percentage}%</td>
                <td>{o.maxWinners === null ? "Unlimited" : `${o.remainingQuantity} / ${o.maxWinners}`}</td>
                <td>{o.redeemed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
