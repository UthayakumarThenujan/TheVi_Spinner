"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Phone, User, MessageCircle, ArrowLeft } from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
import type { PublicSpinner } from "@/types/spinner";

export interface RegisteredParticipant {
  id: string;
  name: string;
  spinnerId: string;
}

/** Mirrors the server rule so users get instant feedback; the server re-validates. */
function looksLikeSriLankanMobile(v: string) {
  const d = v.replace(/[\s\-().+]/g, "");
  return /^(0094|94|0)?7[0-24-8]\d{7}$/.test(d);
}

export function RegistrationForm({
  spinner,
  whatsappGroupUrl,
  onRegistered,
  onAlreadyParticipated,
  onBack,
}: {
  spinner: PublicSpinner;
  whatsappGroupUrl?: string;
  onRegistered: (p: RegisteredParticipant) => void;
  onAlreadyParticipated: (message: string) => void;
  onBack: () => void;
}) {
  const { settings } = spinner;
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; mobile?: string; whatsapp?: string }>({});
  const groupUrl = settings.whatsappGroupUrl || whatsappGroupUrl;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const fe: typeof fieldErrors = {};
    if (name.trim().length < 2) fe.name = "Please enter your full name";
    if (!looksLikeSriLankanMobile(mobile)) fe.mobile = "Enter a valid Sri Lankan mobile number, e.g. 077 123 4567";
    if (settings.showWhatsappConfirmation && settings.requireWhatsappConfirmation && !confirmed)
      fe.whatsapp = "Please join our WhatsApp group and confirm";
    setFieldErrors(fe);
    if (Object.keys(fe).length) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ participant: RegisteredParticipant }>("/api/users/register", {
        method: "POST",
        json: { spinnerId: spinner.id, name, mobile, whatsappConfirmed: confirmed },
      });
      onRegistered(res.participant);
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_PARTICIPATED") {
        onAlreadyParticipated(err.message);
        return;
      }
      if (err instanceof ApiError && err.details?.field) {
        setFieldErrors({ [err.details.field === "whatsappConfirmed" ? "whatsapp" : (err.details.field as string)]: err.message });
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={submit}
      noValidate
      className="w-full rounded-3xl bg-white p-5 text-slate-900 shadow-2xl sm:p-7"
    >
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h2 className="text-2xl font-extrabold">Enter your details</h2>
      <p className="mt-1 text-sm text-slate-500">One spin per mobile number for <b>{spinner.title}</b>.</p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="name" className="label">Full Name</label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="name"
              className="input pl-9 text-base"
              autoComplete="name"
              placeholder="e.g. Thenujan Uthayakumar"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!fieldErrors.name}
            />
          </div>
          {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
        </div>

        <div>
          <label htmlFor="mobile" className="label">Mobile Number (WhatsApp)</label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="mobile"
              className="input pl-9 text-base"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="077 123 4567"
              value={mobile}
              maxLength={20}
              onChange={(e) => setMobile(e.target.value)}
              aria-invalid={!!fieldErrors.mobile}
            />
          </div>
          {fieldErrors.mobile && <p className="mt-1 text-xs text-red-600">{fieldErrors.mobile}</p>}
        </div>

        {settings.showWhatsappConfirmation && (
          <div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand-500"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                I confirm that I have joined our WhatsApp Announcement Group.
                {settings.requireWhatsappConfirmation && <span className="text-red-500"> *</span>}
              </span>
            </label>
            {groupUrl && (
              <a
                href={groupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:underline"
              >
                <MessageCircle className="h-4 w-4" /> Join the WhatsApp group
              </a>
            )}
            {fieldErrors.whatsapp && <p className="mt-1 text-xs text-red-600">{fieldErrors.whatsapp}</p>}
          </div>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-400 px-6 py-4 text-lg font-extrabold text-white shadow-lg shadow-brand-500/30 transition hover:brightness-105 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        Continue to Spin
      </button>
      <p className="mt-3 text-center text-xs text-slate-400">Your number is only used to verify one spin per person.</p>
    </motion.form>
  );
}
