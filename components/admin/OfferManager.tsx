"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2, Gift, Infinity as InfinityIcon } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FileUpload } from "./ImageUpload";
import { api } from "@/lib/client/api";
import type { Offer, OfferType } from "@/types/offer";

const PALETTE = ["#FF6B81", "#FFA94D", "#FFD43B", "#69DB7C", "#4DABF7", "#9775FA", "#F783AC", "#38D9A9", "#1F1147", "#FFFFFF"];

interface Draft {
  name: string;
  description: string;
  type: OfferType;
  image: string;
  color: string;
  weight: number;
  limited: boolean;
  maxWinners: number;
  isWinning: boolean;
  active: boolean;
}

function toDraft(o?: Offer, index = 0): Draft {
  return {
    name: o?.name ?? "",
    description: o?.description ?? "",
    type: o?.type ?? "text",
    image: o?.image ?? "",
    color: o?.color ?? PALETTE[index % 8],
    weight: o?.weight ?? 10,
    limited: o ? o.maxWinners !== null : false,
    maxWinners: o?.maxWinners ?? 5,
    isWinning: o?.isWinning ?? true,
    active: o?.active ?? true,
  };
}

export function OfferManager({
  spinnerId,
  offers,
  readOnly,
  onChange,
}: {
  spinnerId: string;
  offers: Offer[];
  readOnly?: boolean;
  onChange: (offers: Offer[]) => void;
}) {
  const [editing, setEditing] = useState<Offer | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);

  const activeWeight = offers.filter((o) => o.active).reduce((s, o) => s + o.weight, 0);

  function open(o?: Offer) {
    setDraft(toDraft(o, offers.length));
    setError(null);
    setEditing(o ?? "new");
  }

  async function refresh() {
    const res = await api<{ offers: Offer[] }>(`/api/admin/spinners/${spinnerId}/offers`);
    onChange(res.offers);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name: draft.name,
      description: draft.description,
      type: draft.type,
      image: draft.type === "text" ? "" : draft.image,
      color: draft.color,
      weight: Number(draft.weight),
      maxWinners: draft.limited ? Number(draft.maxWinners) : null,
      isWinning: draft.isWinning,
      active: draft.active,
    };
    try {
      if (editing === "new") await api(`/api/admin/spinners/${spinnerId}/offers`, { method: "POST", json: body });
      else if (editing) await api(`/api/admin/spinners/${spinnerId}/offers/${editing.id}`, { method: "PUT", json: body });
      await refresh();
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...offers];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next); // optimistic
    try {
      const res = await api<{ offers: Offer[] }>(`/api/admin/spinners/${spinnerId}/offers/reorder`, {
        method: "POST",
        json: { order: next.map((o) => o.id) },
      });
      onChange(res.offers);
    } catch {
      await refresh();
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/admin/spinners/${spinnerId}/offers/${deleting.id}`, { method: "DELETE" });
      await refresh();
      setDeleting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">Wheel segments / offers</h2>
          <p className="text-xs text-slate-500">Order here = order on the wheel (clockwise from the pointer). Odds = weight ÷ total active weight.</p>
        </div>
        {!readOnly && (
          <button className="btn btn-primary" onClick={() => open()} disabled={offers.length >= 16}>
            <Plus className="h-4 w-4" /> Add offer
          </button>
        )}
      </div>
      {error && !editing && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {offers.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">
          <Gift className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm">No offers yet. Add at least 2 to publish.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {offers.map((o, i) => (
            <li key={o.id} className={`flex items-center gap-3 py-3 ${o.active ? "" : "opacity-50"}`}>
              {!readOnly && (
                <div className="flex flex-col">
                  <button className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === offers.length - 1} aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200" style={{ background: o.color }}>
                {o.image && o.type !== "text" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.image} alt="" className="h-10 w-10 object-contain" />
                ) : (
                  <span className="text-xs font-bold text-white mix-blend-difference">{i + 1}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">
                  {o.name}
                  {!o.isWinning && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">no prize</span>}
                  {!o.active && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">inactive</span>}
                </p>
                <p className="text-xs text-slate-500">
                  Weight {o.weight}
                  {o.active && activeWeight > 0 ? ` · ${((o.weight / activeWeight) * 100).toFixed(1)}% odds` : ""}
                  {" · "}
                  {o.maxWinners === null ? (
                    <span className="inline-flex items-center gap-0.5">
                      <InfinityIcon className="h-3 w-3" /> unlimited
                    </span>
                  ) : (
                    <span className={o.remainingQuantity === 0 ? "font-semibold text-red-600" : ""}>
                      {o.remainingQuantity}/{o.maxWinners} left
                    </span>
                  )}
                </p>
              </div>
              {!readOnly && (
                <div className="flex gap-1">
                  <button className="btn btn-ghost px-2" onClick={() => open(o)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="btn btn-ghost px-2 text-red-600" onClick={() => setDeleting(o)} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} title={editing === "new" ? "Add offer" : "Edit offer"} onClose={() => setEditing(null)}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label" htmlFor="oname">Offer name</label>
            <input id="oname" className="input" value={draft.name} maxLength={60} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Rs. 200 OFF" />
          </div>
          <div>
            <label className="label" htmlFor="odesc">Description</label>
            <textarea id="odesc" className="input" value={draft.description} maxLength={300} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Valid on purchases above Rs. 2000" />
          </div>
          <div>
            <span className="label">Segment shows</span>
            <div className="grid grid-cols-3 gap-2">
              {(["text", "image", "both"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setDraft({ ...draft, type: t })}
                  className={`rounded-xl border px-3 py-2 text-sm capitalize ${draft.type === t ? "border-brand-400 bg-brand-50 font-semibold text-brand-700" : "border-slate-200 text-slate-600"}`}
                >
                  {t === "both" ? "Image + text" : t}
                </button>
              ))}
            </div>
          </div>
          {draft.type !== "text" && <FileUpload label="Offer image" value={draft.image} onChange={(url) => setDraft({ ...draft, image: url })} />}
          <div>
            <span className="label">Segment color</span>
            <div className="flex flex-wrap items-center gap-2">
              {PALETTE.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setDraft({ ...draft, color: c })}
                  className={`h-8 w-8 rounded-full border-2 ${draft.color.toLowerCase() === c.toLowerCase() ? "border-slate-900 ring-2 ring-slate-300" : "border-slate-200"}`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
              <input type="color" className="h-8 w-10 cursor-pointer rounded border border-slate-200" value={draft.color.length === 7 ? draft.color : "#ff6b81"} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="oweight">Winning weight</label>
              <input id="oweight" type="number" min={0} step="any" className="input" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })} />
              <p className="mt-1 text-xs text-slate-400">0 = shown on wheel but never selected</p>
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <input type="checkbox" className="accent-brand-500" checked={draft.limited} onChange={(e) => setDraft({ ...draft, limited: e.target.checked })} />
                Limit quantity
              </label>
              <input type="number" min={0} className="input" disabled={!draft.limited} value={draft.maxWinners} onChange={(e) => setDraft({ ...draft, maxWinners: Number(e.target.value) })} />
              <p className="mt-1 text-xs text-slate-400">Max times this offer can be won</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              Active (show on wheel)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={!draft.isWinning} onChange={(e) => setDraft({ ...draft, isWinning: !e.target.checked })} />
              “No prize” segment (e.g. Better luck next time)
            </label>
          </div>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save offer
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        destructive
        busy={busy}
        title="Remove this offer?"
        message={<>“{deleting?.name}” will be removed from the wheel. Offers that were already won cannot be deleted — deactivate them instead.</>}
        confirmLabel="Remove"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
