"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Copy, Rocket, Pause, Play, Archive, Trash2, Pencil, PowerOff, Users, RotateCw, Trophy, Search } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/admin/AdminShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Loading, ErrorBox } from "@/components/shared/Loading";
import { useApi, formatDateTime } from "@/lib/client/useApi";
import { api } from "@/lib/client/api";
import type { Spinner } from "@/types/spinner";

type Row = Spinner & { participantCount: number; spinCount: number; winnerCount: number; offerCount: number };

type Pending = { kind: "publish" | "deactivate" | "archive" | "delete"; spinner: Row } | null;

export default function SpinnersPage() {
  const { data, error, loading, reload } = useApi<{ spinners: Row[] }>("/api/admin/spinners");
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState<"all" | Spinner["status"]>("all");
  const [q, setQ] = useState("");

  function flash(ok: boolean, text: string) {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  }

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      flash(true, success);
      await reload();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const state = (id: string, action: string) => api(`/api/admin/spinners/${id}/state`, { method: "POST", json: { action } });

  async function confirm() {
    if (!pending) return;
    const { kind, spinner } = pending;
    if (kind === "publish") await run(() => api(`/api/admin/spinners/${spinner.id}/publish`, { method: "POST" }), "Spinner published — it is now live on the public link");
    if (kind === "deactivate") await run(() => state(spinner.id, "deactivate"), "Spinner deactivated");
    if (kind === "archive") await run(() => state(spinner.id, "archive"), "Spinner archived");
    if (kind === "delete") await run(() => api(`/api/admin/spinners/${spinner.id}`, { method: "DELETE" }), "Draft deleted");
  }

  const rows = (data?.spinners ?? []).filter(
    (s) => (filter === "all" || s.status === filter) && (!q || s.title.toLowerCase().includes(q.toLowerCase()) || s.id.includes(q)),
  );

  return (
    <>
      <PageHeader
        title="Spinners"
        subtitle="Only one spinner can be active. Publishing a new one replaces the current campaign on the same public link."
        actions={
          <Link href="/admin/spinners/create" className="btn btn-primary">
            <Plus className="h-4 w-4" /> New spinner
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search by title or ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {(["all", "active", "draft", "completed", "archived"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${filter === f ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">No spinners found.</div>
      ) : (
        <div className="grid gap-3">
          {rows.map((s) => (
            <article key={s.id} className={`card p-4 sm:p-5 ${s.status === "active" ? "ring-2 ring-emerald-400" : ""}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/spinners/${s.id}`} className="truncate text-lg font-semibold text-slate-900 hover:text-brand-600">
                      {s.title}
                    </Link>
                    <StatusBadge status={s.status} paused={s.paused} />
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{s.id}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {s.participantCount}/{s.maxParticipants}</span>
                    <span className="inline-flex items-center gap-1"><RotateCw className="h-4 w-4" /> {s.spinCount} spins</span>
                    <span className="inline-flex items-center gap-1"><Trophy className="h-4 w-4" /> {s.winnerCount} winners</span>
                    <span>{s.offerCount} offers</span>
                    <span className="text-slate-400">Created {formatDateTime(s.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/spinners/${s.id}`} className="btn btn-secondary">
                    <Pencil className="h-4 w-4" /> Manage
                  </Link>
                  {s.status !== "active" && s.status !== "archived" && (
                    <button className="btn btn-primary" disabled={busy} onClick={() => setPending({ kind: "publish", spinner: s })}>
                      <Rocket className="h-4 w-4" /> Publish
                    </button>
                  )}
                  {s.status === "active" && (
                    <>
                      <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => state(s.id, s.paused ? "resume" : "pause"), s.paused ? "Participation resumed" : "Participation paused")}>
                        {s.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {s.paused ? "Resume" : "Pause"}
                      </button>
                      <button className="btn btn-secondary" disabled={busy} onClick={() => setPending({ kind: "deactivate", spinner: s })}>
                        <PowerOff className="h-4 w-4" /> Deactivate
                      </button>
                    </>
                  )}
                  <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => api(`/api/admin/spinners/${s.id}/duplicate`, { method: "POST" }), "Spinner duplicated as a new draft")} title="Duplicate">
                    <Copy className="h-4 w-4" /> <span className="sm:hidden lg:inline">Duplicate</span>
                  </button>
                  {s.status === "completed" && (
                    <button className="btn btn-secondary" disabled={busy} onClick={() => setPending({ kind: "archive", spinner: s })}>
                      <Archive className="h-4 w-4" /> Archive
                    </button>
                  )}
                  {s.status === "archived" && (
                    <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => state(s.id, "reopen"), "Spinner restored to completed")}>
                      Restore
                    </button>
                  )}
                  {s.status === "draft" && (
                    <button className="btn btn-ghost text-red-600" disabled={busy} onClick={() => setPending({ kind: "delete", spinner: s })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        busy={busy}
        destructive={pending?.kind === "delete" || pending?.kind === "deactivate"}
        title={
          pending?.kind === "publish"
            ? "Publish this spinner?"
            : pending?.kind === "deactivate"
              ? "Deactivate the live spinner?"
              : pending?.kind === "archive"
                ? "Archive this spinner?"
                : "Delete this draft?"
        }
        message={
          pending?.kind === "publish" ? (
            <>
              <b>{pending.spinner.title}</b> will become the live campaign on the public link. Any currently active spinner will be marked completed (its results are kept).
            </>
          ) : pending?.kind === "deactivate" ? (
            "The public link will show “coming soon” until another spinner is published. Results are kept."
          ) : pending?.kind === "archive" ? (
            "Archived spinners are read-only and hidden from the default view. Results are kept."
          ) : (
            "This permanently deletes the draft and its offers."
          )
        }
        confirmLabel={pending?.kind === "publish" ? "Publish" : pending?.kind === "delete" ? "Delete" : pending?.kind === "archive" ? "Archive" : "Deactivate"}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />

      {toast && (
        <div className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-3 text-sm text-white shadow-lg ${toast.ok ? "bg-emerald-600" : "bg-red-600"}`}>
          {toast.text}
        </div>
      )}
    </>
  );
}
