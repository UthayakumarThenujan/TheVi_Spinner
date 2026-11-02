"use client";

import Link from "next/link";
import { Disc3, Radio, Users, RotateCw, Trophy, Ticket, Plus } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/admin/AdminShell";
import { DashboardStats, StatCard } from "@/components/admin/DashboardStats";
import { GroupedBarChart, HBarChart, SERIES } from "@/components/admin/Charts";
import { Loading, ErrorBox } from "@/components/shared/Loading";
import { useApi, formatDateTime } from "@/lib/client/useApi";
import type { getDashboard } from "@/lib/services/reportService";

type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

export default function DashboardPage() {
  const { data, error, loading, reload } = useApi<Dashboard>("/api/admin/dashboard");

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;
  const { totals, activeSpinner: active } = data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of all Lucky Spin campaigns"
        actions={
          <Link href="/admin/spinners/create" className="btn btn-primary">
            <Plus className="h-4 w-4" /> New spinner
          </Link>
        }
      />
      <DashboardStats>
        <StatCard label="Total Spinners" value={totals.spinners} icon={Disc3} />
        <StatCard
          label="Active Spinner"
          value={active ? <span className="text-lg">{active.paused ? "Paused" : "Live"}</span> : <span className="text-lg text-slate-400">None</span>}
          sub={active?.title ?? "Publish a spinner to go live"}
          icon={Radio}
          accent="text-emerald-600 bg-emerald-50"
        />
        <StatCard label="Registered Users" value={totals.registeredUsers} sub={`${totals.uniqueMobiles} unique mobiles`} icon={Users} accent="text-sky-600 bg-sky-50" />
        <StatCard label="Total Spins" value={totals.spins} icon={RotateCw} accent="text-violet-600 bg-violet-50" />
        <StatCard label="Total Winners" value={totals.winners} sub={`${totals.redeemed} redeemed`} icon={Trophy} accent="text-amber-600 bg-amber-50" />
        <StatCard
          label="Remaining Slots"
          value={active ? active.remainingSlots : "—"}
          sub={active ? `of ${active.maxParticipants} in active spinner` : undefined}
          icon={Ticket}
          accent="text-rose-600 bg-rose-50"
        />
      </DashboardStats>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Daily participation</h2>
          <p className="mb-4 text-xs text-slate-500">Last 14 days</p>
          <GroupedBarChart
            data={data.daily}
            xKey="date"
            series={[
              { key: "registrations", label: "Registrations", color: SERIES[0] },
              { key: "spins", label: "Spins", color: SERIES[1] },
            ]}
            formatX={(v) => new Date(`${v}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          />
        </section>
        <section className="card p-5">
          <h2 className="font-semibold text-slate-900">Winners per spinner</h2>
          <p className="mb-4 text-xs text-slate-500">Latest campaigns</p>
          <HBarChart data={[...data.winnersPerSpinner].reverse().map((w) => ({ label: w.title, value: w.winners, sub: `/ ${w.spins} spins` }))} />
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="font-semibold text-slate-900">Offer distribution</h2>
          <p className="mb-4 truncate text-xs text-slate-500">{data.offerDistributionSpinner ?? "No spinner yet"}</p>
          <HBarChart data={data.offerDistribution.map((o) => ({ label: o.name, value: o.count, color: o.color }))} />
        </section>
        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent spins</h2>
            <Link href="/admin/winners" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No spins yet</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recent.map((r) => (
                <li key={r.userId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{r.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {r.offerName} · {formatDateTime(r.spunAt)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
