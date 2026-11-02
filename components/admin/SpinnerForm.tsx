"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { api } from "@/lib/client/api";
import { toLocalInput, fromLocalInput } from "@/lib/client/useApi";
import type { Spinner } from "@/types/spinner";

export interface SpinnerFormValues {
  title: string;
  description: string;
  maxParticipants: number;
  startDate: string | null;
  endDate: string | null;
}

/** Create or edit the core details of a spinner. */
export function SpinnerForm({
  spinner,
  defaultMax = 10,
  onSaved,
  disabled,
}: {
  spinner?: Spinner;
  defaultMax?: number;
  onSaved: (s: Spinner) => void;
  disabled?: boolean;
}) {
  const [title, setTitle] = useState(spinner?.title ?? "");
  const [description, setDescription] = useState(spinner?.description ?? "");
  const [maxParticipants, setMax] = useState(spinner?.maxParticipants ?? defaultMax);
  const [start, setStart] = useState(toLocalInput(spinner?.startDate));
  const [end, setEnd] = useState(toLocalInput(spinner?.endDate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const body = {
      title,
      description,
      maxParticipants: Number(maxParticipants),
      startDate: fromLocalInput(start),
      endDate: fromLocalInput(end),
      ...(spinner ? { settings: spinner.settings } : {}),
    };
    try {
      const res = spinner
        ? await api<{ spinner: Spinner }>(`/api/admin/spinners/${spinner.id}`, { method: "PUT", json: body })
        : await api<{ spinner: Spinner }>("/api/admin/spinners", { method: "POST", json: body });
      setSaved(true);
      onSaved(res.spinner);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="title">Spinner title</label>
        <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="November Lucky Spin" required maxLength={100} disabled={disabled} />
      </div>
      <div>
        <label className="label" htmlFor="desc">Description</label>
        <textarea id="desc" className="input min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Win exclusive offers!" maxLength={500} disabled={disabled} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="max">Maximum participants</label>
          <input id="max" type="number" min={1} className="input" value={maxParticipants} onChange={(e) => setMax(Number(e.target.value))} required disabled={disabled} />
        </div>
        <div>
          <label className="label" htmlFor="start">Start date (optional)</label>
          <input id="start" type="datetime-local" className="input" value={start} onChange={(e) => setStart(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label className="label" htmlFor="end">End date (optional)</label>
          <input id="end" type="datetime-local" className="input" value={end} onChange={(e) => setEnd(e.target.value)} disabled={disabled} />
        </div>
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={busy || disabled}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {spinner ? "Save details" : "Create spinner"}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved</span>}
      </div>
    </form>
  );
}
