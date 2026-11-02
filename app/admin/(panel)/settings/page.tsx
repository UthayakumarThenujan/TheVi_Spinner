"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, KeyRound, Plus, Trash2, Link2 } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminShell";
import { FileUpload } from "@/components/admin/ImageUpload";
import { Loading, ErrorBox } from "@/components/shared/Loading";
import { useApi } from "@/lib/client/useApi";
import { api } from "@/lib/client/api";
import type { AppSettings } from "@/types/result";

export default function SettingsPage() {
  const { data, error, loading, reload } = useApi<{ settings: AppSettings }>("/api/admin/settings");
  const [s, setS] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (data) setS(data.settings);
  }, [data]);

  if (loading && !s) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!s) return null;
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setS({ ...s, [k]: v });

  async function save() {
    if (!s) return;
    setBusy(true);
    setMsg(null);
    try {
      const { updatedAt: _ignored, ...body } = s;
      void _ignored;
      await api("/api/admin/settings", { method: "PUT", json: { ...body, rules: s.rules.filter((r) => r.trim()) } });
      setMsg({ ok: true, text: "Settings saved" });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) {
      setPwMsg({ ok: false, text: "New passwords do not match" });
      return;
    }
    setPwBusy(true);
    setPwMsg(null);
    try {
      await api("/api/admin/auth/password", { method: "POST", json: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } });
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      setPwMsg({ ok: true, text: "Password changed. Other sessions have been signed out." });
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Brand, landing page copy and defaults" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold text-slate-900">Brand</h2>
          <div>
            <label className="label" htmlFor="brand">Application name</label>
            <input id="brand" className="input" value={s.brandName} onChange={(e) => set("brandName", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="tag">Tagline</label>
            <input id="tag" className="input" value={s.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </div>
          <FileUpload label="Logo" value={s.logoUrl} onChange={(u) => set("logoUrl", u || null)} />
          <div>
            <label className="label" htmlFor="url">Public URL (used in WhatsApp share messages)</label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="url" className="input pl-9" value={s.publicUrl} onChange={(e) => set("publicUrl", e.target.value)} placeholder="https://yourdomain.com" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="wa">WhatsApp announcement group link</label>
            <input id="wa" className="input" value={s.whatsappGroupUrl} onChange={(e) => set("whatsappGroupUrl", e.target.value)} placeholder="https://chat.whatsapp.com/..." />
          </div>
          <div>
            <label className="label" htmlFor="max">Default maximum participants for new spinners</label>
            <input id="max" type="number" min={1} className="input" value={s.defaultMaxParticipants} onChange={(e) => set("defaultMaxParticipants", Number(e.target.value))} />
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-semibold text-slate-900">Landing page</h2>
          <div>
            <label className="label" htmlFor="wt">Welcome title</label>
            <input id="wt" className="input" value={s.welcomeTitle} onChange={(e) => set("welcomeTitle", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="wm">Welcome message</label>
            <textarea id="wm" className="input min-h-20" value={s.welcomeMessage} onChange={(e) => set("welcomeMessage", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="cta">Button label</label>
              <input id="cta" className="input" value={s.ctaLabel} maxLength={30} onChange={(e) => set("ctaLabel", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="soon">“No active spinner” message</label>
              <input id="soon" className="input" value={s.comingSoonMessage} onChange={(e) => set("comingSoonMessage", e.target.value)} />
            </div>
          </div>
          <div>
            <span className="label">Rules &amp; conditions</span>
            <div className="space-y-2">
              {s.rules.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input" value={r} onChange={(e) => set("rules", s.rules.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button className="btn btn-ghost px-2 text-red-600" onClick={() => set("rules", s.rules.filter((_, j) => j !== i))} aria-label="Remove rule">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button className="btn btn-secondary" onClick={() => set("rules", [...s.rules, ""])} disabled={s.rules.length >= 15}>
                <Plus className="h-4 w-4" /> Add rule
              </button>
            </div>
          </div>
        </section>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>

      <form onSubmit={changePassword} className="card mt-8 max-w-lg space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <KeyRound className="h-4 w-4" /> Change admin password
        </h2>
        <input type="password" className="input" placeholder="Current password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
        <input type="password" className="input" placeholder="New password (min 10 characters)" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={10} />
        <input type="password" className="input" placeholder="Confirm new password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
        {pwMsg && <p className={`text-sm ${pwMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{pwMsg.text}</p>}
        <button className="btn btn-primary" disabled={pwBusy}>
          {pwBusy && <Loader2 className="h-4 w-4 animate-spin" />} Update password
        </button>
      </form>
    </>
  );
}
