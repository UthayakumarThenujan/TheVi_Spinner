"use client";

import { motion } from "framer-motion";
import { CalendarClock, Gift, Users, Sparkles, PauseCircle, Ban, Hourglass } from "lucide-react";
import type { PublicSpinner } from "@/types/spinner";

const AVAILABILITY_COPY: Record<Exclude<PublicSpinner["availability"], "open">, { icon: typeof Ban; text: string }> = {
  full: { icon: Ban, text: "All spin slots have been taken. Watch the WhatsApp group for the next Lucky Spin!" },
  paused: { icon: PauseCircle, text: "Participation is paused for a moment. Please check back soon." },
  not_started: { icon: Hourglass, text: "This Lucky Spin hasn't started yet. Come back when it opens!" },
  ended: { icon: CalendarClock, text: "This Lucky Spin has ended. Stay tuned for the next one!" },
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function CampaignCard({
  spinner,
  ctaLabel,
  onStart,
}: {
  spinner: PublicSpinner;
  ctaLabel: string;
  onStart: () => void;
}) {
  const pct = Math.min(100, Math.round((spinner.participantCount / Math.max(1, spinner.maxParticipants)) * 100));
  const blocked = spinner.availability !== "open" ? AVAILABILITY_COPY[spinner.availability] : null;
  const winningSlots = spinner.segments.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass w-full rounded-3xl p-5 text-white shadow-2xl sm:p-7"
    >
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gold-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold-300">
        <Sparkles className="h-3.5 w-3.5" /> Today&apos;s Lucky Spin
      </div>
      <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">{spinner.title}</h2>
      {spinner.description && <p className="mt-2 text-white/80">{spinner.description}</p>}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/10 p-3">
          <div className="flex items-center gap-1.5 text-xs text-white/70">
            <Users className="h-3.5 w-3.5" /> Slots left
          </div>
          <div className="mt-1 text-2xl font-extrabold text-gold-300">
            {spinner.remainingSlots}
            <span className="text-sm font-medium text-white/60"> / {spinner.maxParticipants}</span>
          </div>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          <div className="flex items-center gap-1.5 text-xs text-white/70">
            <Gift className="h-3.5 w-3.5" /> Prizes on wheel
          </div>
          <div className="mt-1 text-2xl font-extrabold">{winningSlots}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-white/70">
          <span>{spinner.participantCount} joined</span>
          <span>{pct}% full</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-gold-400 to-brand-400"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
      </div>

      {spinner.endDate && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-white/60">
          <CalendarClock className="h-3.5 w-3.5" /> Ends {formatDate(spinner.endDate)}
        </p>
      )}

      {blocked ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-white/10 p-4 text-sm text-white/90">
          <blocked.icon className="mt-0.5 h-5 w-5 shrink-0 text-gold-300" />
          <span>{blocked.text}</span>
        </div>
      ) : (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="btn-shine mt-6 w-full rounded-2xl bg-gradient-to-r from-gold-400 via-gold-500 to-brand-400 px-6 py-4 text-lg font-black tracking-wide text-night-900 shadow-lg shadow-gold-500/30 transition hover:brightness-105"
        >
          {ctaLabel}
        </motion.button>
      )}
    </motion.section>
  );
}
