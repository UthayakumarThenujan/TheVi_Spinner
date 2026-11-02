"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Search, X, CheckCircle2, Undo2, Loader2, Eye } from "lucide-react";
import { useApi, formatDateTime } from "@/lib/client/useApi";
import { api } from "@/lib/client/api";
import { StatusBadge } from "./AdminShell";
import { Modal } from "@/components/shared/Modal";
import { Loading, ErrorBox } from "@/components/shared/Loading";
import type { ParticipantRow } from "@/lib/services/reportService";
import type { Spinner } from "@/types/spinner";
import type { Offer } from "@/types/offer";

function formatMobile(e164: string) {
  const m = /^\+94(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+94 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/**
 * Shared table for /admin/participants (all registrations) and /admin/winners (spun only).
 * Filters are applied server-side; the same query string drives the CSV export.
 */
export function ParticipantTable({ mode }: { mode: "participants" | "winners" }) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [spinnerId, setSpinnerId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<ParticipantRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ) p.set("q", debouncedQ);
    if (spinnerId) p.set("spinnerId", spinnerId);
    if (offerId) p.set("offerId", offerId);
    if (status) p.set("status", status);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [debouncedQ, spinnerId, offerId, status, from, to]);

  const endpoint = mode === "winners" ? "/api/admin/winners" : "/api/admin/users";
  const { data, error, loading, reload } = useApi<{ rows: ParticipantRow[] }>(`${endpoint}?${query}`);
  const { data: spinners } = useApi<{ spinners: Spinner[] }>("/api/admin/spinners");
  const { data: offerData } = useApi<{ offers: Offer[] }>(spinnerId ? `/api/admin/spinners/${spinnerId}/offers` : null);

  const rows = data?.rows ?? [];
  const hasFilters = q || spinnerId || offerId || status || from || to;

  async function toggleRedeemed(r: ParticipantRow) {
    if (!r.resultId) return;
    setBusyId(r.resultId);
    try {
      await api(`/api/admin/results/${r.resultId}`, { method: "PATCH", json: { redeemed: r.status !== "redeemed" } });
      await reload();
      setDetail(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  const statusTabs =
    mode === "winners"
      ? [
          ["", "All spins"],
          ["winners", "Winners"],
          ["nonwinners", "Non-winners"],
          ["redeemed", "Redeemed"],
        ]
      : [
          ["", "All"],
          ["pending", "Not spun"],
          ["winners", "Winners"],
          ["nonwinners", "Non-winners"],
        ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
        {statusTabs.map(([v, label]) => (
          <button
            key={v}
            onClick={() => setStatus(v)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${status === v ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Name, mobile or result code" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          className="input"
          value={spinnerId}
          onChange={(e) => {
            setSpinnerId(e.target.value);
            setOfferId("");
          }}
        >
          <option value="">All spinners</option>
          {spinners?.spinners.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <select className="input" value={offerId} onChange={(e) => setOfferId(e.target.value)} disabled={!spinnerId}>
          <option value="">{spinnerId ? "All offers" : "Select a spinner first"}</option>
          {offerData?.offers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {loading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "record" : "records"}`}
          {hasFilters && (
            <button
              className="ml-3 inline-flex items-center gap-1 text-brand-600 hover:underline"
              onClick={() => {
                setQ("");
                setSpinnerId("");
                setOfferId("");
                setStatus("");
                setFrom("");
                setTo("");
              }}
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </p>
        <a className="btn btn-secondary" href={`/api/admin/reports/export?type=${mode === "winners" ? "winners" : "participants"}&${query}`}>
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </div>

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">No records match.</div>
      ) : (
        <>
          {/* desktop table */}
          <div className="card hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Spinner</th>
                  <th className="px-4 py-3">Spin date</th>
                  <th className="px-4 py-3">Winning offer</th>
                  <th className="px-4 py-3">Result ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.name}</p>
                      <p className="font-mono text-[11px] text-slate-400">{r.userId}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatMobile(r.mobile)}</td>
                    <td className="max-w-[180px] truncate px-4 py-3">{r.spinnerTitle}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(r.spunAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.offerImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.offerImage} alt="" className="h-8 w-8 rounded-lg border border-slate-200 object-contain" />
                        )}
                        <span>{r.offerName ?? "—"}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{r.resultCode ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button className="btn btn-ghost px-2" onClick={() => setDetail(r)} aria-label="View details">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* mobile cards */}
          <ul className="space-y-2 lg:hidden">
            {rows.map((r) => (
              <li key={r.userId}>
                <button onClick={() => setDetail(r)} className="card flex w-full items-center gap-3 p-4 text-left">
                  {r.offerImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.offerImage} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 object-contain" />
                  ) : (
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-slate-900">{r.name}</p>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-xs text-slate-500">{formatMobile(r.mobile)}</p>
                    <p className="truncate text-xs text-slate-500">
                      {r.offerName ?? "Not spun"} · {r.spinnerTitle}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal open={!!detail} title="Participant details" onClose={() => setDetail(null)}>
        {detail && (
          <div className="space-y-4">
            {detail.offerImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.offerImage} alt="" className="mx-auto h-24 w-24 rounded-2xl border border-slate-200 object-contain" />
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {(
                [
                  ["Name", detail.name],
                  ["Mobile", formatMobile(detail.mobile)],
                  ["User ID", detail.userId],
                  ["WhatsApp confirmed", detail.whatsappConfirmed ? "Yes" : "No"],
                  ["Spinner", detail.spinnerTitle],
                  ["Registered", formatDateTime(detail.registeredAt)],
                  ["Spin date", formatDateTime(detail.spunAt)],
                  ["Winning offer", detail.offerName ?? "—"],
                  ["Result ID", detail.resultId ?? "—"],
                  ["Result code", detail.resultCode ?? "—"],
                  ["Redeemed at", formatDateTime(detail.redeemedAt)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="break-all font-medium text-slate-900">{v}</dd>
                </div>
              ))}
              <dt className="text-slate-500">Status</dt>
              <dd>
                <StatusBadge status={detail.status} />
              </dd>
            </dl>
            {(detail.status === "won" || detail.status === "redeemed") && detail.resultId && (
              <button
                className={`btn w-full ${detail.status === "won" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => toggleRedeemed(detail)}
                disabled={busyId === detail.resultId}
              >
                {busyId === detail.resultId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : detail.status === "won" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Undo2 className="h-4 w-4" />
                )}
                {detail.status === "won" ? "Mark as redeemed" : "Undo redeemed"}
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
