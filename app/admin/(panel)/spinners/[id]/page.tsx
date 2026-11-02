"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Rocket, Pause, Play, PowerOff, Eye, Copy } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/admin/AdminShell";
import { SpinnerForm } from "@/components/admin/SpinnerForm";
import { OfferManager } from "@/components/admin/OfferManager";
import { SpinnerSettingsPanel } from "@/components/admin/SpinnerSettingsPanel";
import { SpinnerAnalytics } from "@/components/admin/SpinnerAnalytics";
import { SpinExperience } from "@/components/user/SpinExperience";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Loading, ErrorBox } from "@/components/shared/Loading";
import { useApi, formatDateTime } from "@/lib/client/useApi";
import { api } from "@/lib/client/api";
import type { Spinner, PublicSpinner } from "@/types/spinner";
import type { Offer } from "@/types/offer";

const TABS = ["details", "offers", "settings", "preview", "analytics"] as const;
type Tab = (typeof TABS)[number];

export default function SpinnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(search.get("tab") ?? "") ? (search.get("tab") as Tab) : "details");
  const { data, error, loading, reload, setData } = useApi<{ spinner: Spinner; offers: Offer[]; participantCount: number }>(`/api/admin/spinners/${id}`);
  const [preview, setPreview] = useState<PublicSpinner | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (tab !== "preview") return;
    setPreview(null);
    api<{ spinner: PublicSpinner }>(`/api/admin/spinners/${id}/preview`)
      .then((r) => setPreview(r.spinner))
      .catch((e) => setMsg({ ok: false, text: e.message }));
  }, [tab, id, data]);

  function selectTab(t: Tab) {
    setTab(t);
    router.replace(`/admin/spinners/${id}?tab=${t}`, { scroll: false });
  }

  async function act(fn: () => Promise<unknown>, text: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text });
      await reload();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setBusy(false);
      setConfirmPublish(false);
    }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;
  const { spinner, offers } = data;
  const readOnly = spinner.status === "archived";
  const state = (action: string) => api(`/api/admin/spinners/${id}/state`, { method: "POST", json: { action } });

  return (
    <>
      <Link href="/admin/spinners" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> All spinners
      </Link>
      <PageHeader
        title={spinner.title}
        subtitle={`${spinner.id} · ${data.participantCount}/${spinner.maxParticipants} participants · updated ${formatDateTime(spinner.updatedAt)}`}
        actions={
          <>
            <StatusBadge status={spinner.status} paused={spinner.paused} />
            {spinner.status !== "active" && !readOnly && (
              <button className="btn btn-primary" onClick={() => setConfirmPublish(true)} disabled={busy}>
                <Rocket className="h-4 w-4" /> Publish
              </button>
            )}
            {spinner.status === "active" && (
              <>
                <button className="btn btn-secondary" disabled={busy} onClick={() => act(() => state(spinner.paused ? "resume" : "pause"), spinner.paused ? "Participation resumed" : "Participation paused")}>
                  {spinner.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {spinner.paused ? "Resume" : "Pause now"}
                </button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => act(() => state("deactivate"), "Spinner deactivated")}>
                  <PowerOff className="h-4 w-4" /> Deactivate
                </button>
              </>
            )}
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={async () => {
                const r = await api<{ spinner: Spinner }>(`/api/admin/spinners/${id}/duplicate`, { method: "POST" });
                router.push(`/admin/spinners/${r.spinner.id}`);
              }}
            >
              <Copy className="h-4 w-4" /> Duplicate
            </button>
          </>
        }
      />
      {msg && <p className={`mb-4 rounded-xl p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      {readOnly && <p className="mb-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">This spinner is archived and read-only.</p>}

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => selectTab(t)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium capitalize ${tab === t ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <SpinnerForm key={spinner.updatedAt} spinner={spinner} disabled={readOnly} onSaved={(s) => setData({ ...data, spinner: s })} />
      )}
      {tab === "offers" && (
        <OfferManager spinnerId={id} offers={offers} readOnly={readOnly} onChange={(o) => setData({ ...data, offers: o })} />
      )}
      {tab === "settings" && (
        <SpinnerSettingsPanel key={spinner.updatedAt} spinner={spinner} readOnly={readOnly} onSaved={(s) => setData({ ...data, spinner: s })} />
      )}
      {tab === "preview" && (
        <div className="bg-festive rounded-3xl px-4 py-8">
          <p className="mb-4 flex items-center justify-center gap-2 text-center text-sm text-white/80">
            <Eye className="h-4 w-4" /> Preview only — spins here are random and nothing is saved.
          </p>
          <div className="mx-auto max-w-xl">
            {preview ? (
              preview.segments.length ? (
                <SpinExperience key={JSON.stringify(preview.settings) + preview.segments.length} initialSpinner={preview} ctaLabel="SPIN" shareUrl="" preview />
              ) : (
                <p className="text-center text-white">Add offers to preview the wheel.</p>
              )
            ) : (
              <Loading />
            )}
          </div>
        </div>
      )}
      {tab === "analytics" && <SpinnerAnalytics spinnerId={id} />}

      <ConfirmDialog
        open={confirmPublish}
        busy={busy}
        title="Publish this spinner?"
        message="It will immediately become the live campaign on the permanent public link. The currently active spinner (if any) will be marked completed; its results are kept."
        confirmLabel="Publish"
        onConfirm={() => act(() => api(`/api/admin/spinners/${id}/publish`, { method: "POST" }), "Published! The public link now shows this spinner.")}
        onCancel={() => setConfirmPublish(false)}
      />
    </>
  );
}
