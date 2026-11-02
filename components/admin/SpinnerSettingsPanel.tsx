"use client";

import { useState } from "react";
import { Loader2, Save, Volume2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { FileUpload } from "./ImageUpload";
import type { Spinner, SpinnerSettings } from "@/types/spinner";

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start justify-between gap-4 py-2 ${disabled ? "opacity-50" : ""}`}>
      <span>
        <span className="text-sm font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand-500" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export function SpinnerSettingsPanel({ spinner, onSaved, readOnly }: { spinner: Spinner; onSaved: (s: Spinner) => void; readOnly?: boolean }) {
  const [s, setS] = useState<SpinnerSettings>(spinner.settings);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof SpinnerSettings>(k: K, v: SpinnerSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const soundOff = !s.soundEnabled;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api<{ spinner: Spinner }>(`/api/admin/spinners/${spinner.id}`, {
        method: "PUT",
        json: {
          title: spinner.title,
          description: spinner.description,
          maxParticipants: spinner.maxParticipants,
          startDate: spinner.startDate,
          endDate: spinner.endDate,
          settings: s,
        },
      });
      setMsg({ ok: true, text: "Settings saved" });
      onSaved(res.spinner);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card p-5">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
          <Volume2 className="h-4 w-4" /> Sound
        </h3>
        <div className="divide-y divide-slate-100">
          <Toggle label="Master sound" hint="Turns every sound on or off" checked={s.soundEnabled} onChange={(v) => set("soundEnabled", v)} disabled={readOnly} />
          <Toggle label="Spinning sound" checked={s.spinSound} onChange={(v) => set("spinSound", v)} disabled={readOnly || soundOff} />
          <Toggle label="Winning sound" checked={s.winSound} onChange={(v) => set("winSound", v)} disabled={readOnly || soundOff} />
          <Toggle label="Background music" checked={s.backgroundMusic} onChange={(v) => set("backgroundMusic", v)} disabled={readOnly || soundOff} />
        </div>
        <p className="mt-3 text-xs text-slate-500">Built-in sounds are used unless you upload your own:</p>
        <div className="mt-3 space-y-4">
          <FileUpload kind="audio" label="Custom spinning sound" value={s.spinSoundUrl} onChange={(u) => set("spinSoundUrl", u)} />
          <FileUpload kind="audio" label="Custom winning sound" value={s.winSoundUrl} onChange={(u) => set("winSoundUrl", u)} />
          <FileUpload kind="audio" label="Custom background music" value={s.backgroundMusicUrl} onChange={(u) => set("backgroundMusicUrl", u)} />
        </div>
      </section>

      <div className="space-y-4">
        <section className="card p-5">
          <h3 className="mb-3 font-semibold text-slate-900">Animation &amp; wheel</h3>
          <label className="label" htmlFor="dur">Spin duration: {(s.animationDuration / 1000).toFixed(1)}s</label>
          <input id="dur" type="range" min={2000} max={15000} step={500} className="w-full accent-brand-500" value={s.animationDuration} onChange={(e) => set("animationDuration", Number(e.target.value))} disabled={readOnly} />
          <div className="mt-2 divide-y divide-slate-100">
            <Toggle label="Confetti on win" checked={s.confettiEnabled} onChange={(v) => set("confettiEnabled", v)} disabled={readOnly} />
          </div>
          <span className="label mt-3">Pointer style</span>
          <div className="grid grid-cols-3 gap-2">
            {(["classic", "arrow", "pin"] as const).map((p) => (
              <button
                type="button"
                key={p}
                disabled={readOnly}
                onClick={() => set("pointerStyle", p)}
                className={`rounded-xl border px-3 py-2 text-sm capitalize ${s.pointerStyle === p ? "border-brand-400 bg-brand-50 font-semibold text-brand-700" : "border-slate-200 text-slate-600"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-sm text-slate-700">
              Border / lights
              <input type="color" className="mt-1 block h-9 w-full cursor-pointer rounded-lg border border-slate-200" value={s.wheelBorderColor} onChange={(e) => set("wheelBorderColor", e.target.value)} disabled={readOnly} />
            </label>
            <label className="text-sm text-slate-700">
              Rim / hub
              <input type="color" className="mt-1 block h-9 w-full cursor-pointer rounded-lg border border-slate-200" value={s.wheelCenterColor} onChange={(e) => set("wheelCenterColor", e.target.value)} disabled={readOnly} />
            </label>
          </div>
          <span className="label mt-4">Default segment colors (used when an offer has none)</span>
          <div className="flex flex-wrap gap-2">
            {s.wheelColors.map((c, i) => (
              <input
                key={i}
                type="color"
                value={c}
                disabled={readOnly}
                onChange={(e) => set("wheelColors", s.wheelColors.map((x, j) => (j === i ? e.target.value : x)))}
                className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200"
              />
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h3 className="mb-2 font-semibold text-slate-900">Registration form</h3>
          <p className="mb-2 text-xs text-slate-500">Full name and mobile number are always required.</p>
          <div className="divide-y divide-slate-100">
            <Toggle label="Show WhatsApp group confirmation" checked={s.showWhatsappConfirmation} onChange={(v) => set("showWhatsappConfirmation", v)} disabled={readOnly} />
            <Toggle label="Require WhatsApp confirmation" checked={s.requireWhatsappConfirmation} onChange={(v) => set("requireWhatsappConfirmation", v)} disabled={readOnly || !s.showWhatsappConfirmation} />
          </div>
          <label className="label mt-3" htmlFor="wa">WhatsApp group link (optional, overrides global)</label>
          <input id="wa" className="input" placeholder="https://chat.whatsapp.com/..." value={s.whatsappGroupUrl ?? ""} onChange={(e) => set("whatsappGroupUrl", e.target.value)} disabled={readOnly} />
          <label className="label mt-3" htmlFor="redeem">How to redeem (shown with the result)</label>
          <textarea id="redeem" className="input min-h-20" maxLength={500} value={s.redeemInstructions} onChange={(e) => set("redeemInstructions", e.target.value)} disabled={readOnly} />
        </section>

        {!readOnly && (
          <div className="flex items-center gap-3">
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
            </button>
            {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
