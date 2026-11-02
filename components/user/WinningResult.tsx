"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { PartyPopper, Share2, Ticket, Frown, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { SpinResult } from "@/types/result";

export interface ResultView {
  result: SpinResult;
  offerDescription: string;
  participantName: string;
  spinnerTitle: string;
}

export function WinningResult({
  view,
  confetti,
  redeemInstructions,
  shareUrl,
}: {
  view: ResultView;
  confetti: boolean;
  redeemInstructions: string;
  shareUrl: string;
}) {
  const { result, participantName, spinnerTitle, offerDescription } = view;
  const won = result.status !== "lost";
  const firstName = participantName.split(" ")[0];
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!won || !confetti) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    import("canvas-confetti").then(({ default: fire }) => {
      if (cancelled) return;
      const colors = ["#FFD43B", "#FF6B81", "#9775FA", "#4DABF7", "#69DB7C"];
      fire({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors });
      const end = Date.now() + 1800;
      const frame = () => {
        fire({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors });
        fire({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors });
        if (Date.now() < end && !cancelled) requestAnimationFrame(frame);
      };
      frame();
    });
    return () => {
      cancelled = true;
    };
  }, [won, confetti]);

  const shareText = won
    ? `🎉 I just won "${result.offerName}" in the ${spinnerTitle} Lucky Spin! Result ID: ${result.code}. Try your luck: ${shareUrl}`
    : `I just tried the ${spinnerTitle} Lucky Spin! Try your luck: ${shareUrl}`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 20 }}
      className="w-full overflow-hidden rounded-3xl bg-white text-center text-slate-900 shadow-2xl"
    >
      <div className={`px-5 pb-6 pt-7 ${won ? "bg-gradient-to-br from-gold-300 via-gold-400 to-brand-300" : "bg-gradient-to-br from-slate-200 to-slate-300"}`}>
        <motion.div
          initial={{ rotate: -20, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ delay: 0.15, type: "spring" }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow"
        >
          {won ? <PartyPopper className="h-8 w-8 text-brand-500" /> : <Frown className="h-8 w-8 text-slate-500" />}
        </motion.div>
        <h2 className="mt-3 text-2xl font-black text-night-900">
          {won ? `Congratulations, ${firstName}!` : `So close, ${firstName}!`}
        </h2>
        <p className="mt-1 text-sm font-medium text-night-800/80">{spinnerTitle}</p>
      </div>

      <div className="px-5 pb-6 pt-5 sm:px-7">
        {result.offerImage && won && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.offerImage} alt={result.offerName} className="mx-auto -mt-14 mb-3 h-24 w-24 rounded-2xl border-4 border-white bg-white object-contain shadow-lg" />
        )}
        <p className="text-sm text-slate-500">{won ? "You have won" : "You landed on"}</p>
        <p className="mt-1 text-3xl font-black text-brand-600">{result.offerName}{won ? "!" : ""}</p>
        {offerDescription && <p className="mt-2 text-sm text-slate-600">{offerDescription}</p>}

        <button
          onClick={copyCode}
          className="mx-auto mt-5 flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-2 font-mono text-lg font-bold tracking-widest text-slate-800 hover:bg-slate-50"
          title="Copy Result ID"
        >
          <Ticket className="h-5 w-5 text-brand-500" />
          {result.code}
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-400" />}
        </button>
        <p className="mt-1 text-xs text-slate-400">Result ID · {new Date(result.spunAt).toLocaleString()}</p>

        {won ? (
          <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-left text-sm text-emerald-900">
            <p className="font-semibold">How to redeem</p>
            <p className="mt-1">{redeemInstructions}</p>
          </div>
        ) : (
          <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Better luck next time! Stay in our WhatsApp group for the next Lucky Spin.
          </p>
        )}

        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3.5 font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-105"
        >
          <Share2 className="h-5 w-5" /> Share on WhatsApp
        </a>
      </div>
    </motion.div>
  );
}
