"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Volume2, VolumeX, ShieldCheck, AlertCircle } from "lucide-react";
import { LuckyWheel, type LuckyWheelHandle } from "./LuckyWheel";
import { CampaignCard } from "./CampaignCard";
import { RegistrationForm, type RegisteredParticipant } from "./RegistrationForm";
import { WinningResult, type ResultView } from "./WinningResult";
import { api, ApiError } from "@/lib/client/api";
import { SoundEngine } from "@/lib/client/sound";
import type { PublicSpinner } from "@/types/spinner";

type Phase = "loading" | "intro" | "register" | "ready" | "spinning" | "result" | "already";

interface SpinResponse extends ResultView {
  segmentIndex: number;
  replay: boolean;
}

interface CheckResponse {
  registered: boolean;
  spun: boolean;
  participantName?: string;
  result?: ResultView | null;
}

export function SpinExperience({
  initialSpinner,
  ctaLabel,
  whatsappGroupUrl,
  shareUrl,
  preview = false,
}: {
  initialSpinner: PublicSpinner;
  ctaLabel: string;
  whatsappGroupUrl?: string;
  shareUrl: string;
  /** Admin preview: no registration, client-side random demo spin, nothing is saved. */
  preview?: boolean;
}) {
  const router = useRouter();
  const [spinner, setSpinner] = useState(initialSpinner);
  const [phase, setPhase] = useState<Phase>(preview ? "ready" : "loading");
  const [participant, setParticipant] = useState<RegisteredParticipant | null>(null);
  const [result, setResult] = useState<ResultView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [restored, setRestored] = useState(false);
  const wheelRef = useRef<LuckyWheelHandle>(null);
  const spinLock = useRef(false);
  // Keyed on the serialized settings so slot-count polling doesn't recreate the engine.
  const settingsKey = JSON.stringify(spinner.settings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sound = useMemo(() => new SoundEngine(JSON.parse(settingsKey)), [settingsKey]);

  useEffect(() => {
    setMuted(sound.isMuted);
    return () => sound.dispose();
  }, [sound]);

  // Restore state for this browser (reloads / multiple tabs).
  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    api<CheckResponse>(`/api/spins/check?spinnerId=${encodeURIComponent(spinner.id)}`)
      .then((c) => {
        if (cancelled) return;
        if (c.spun && c.result) {
          setResult(c.result);
          setRestored(true);
          setRestored(true);
          setPhase("result");
        } else if (c.registered) {
          setParticipant({ id: "", name: c.participantName ?? "", spinnerId: spinner.id });
          setPhase("ready");
        } else setPhase("intro");
      })
      .catch(() => !cancelled && setPhase("intro"));
    return () => {
      cancelled = true;
    };
  }, [spinner.id, preview]);

  // Keep slot counts fresh; reload when a new campaign is published.
  useEffect(() => {
    if (preview || (phase !== "intro" && phase !== "register")) return;
    const t = setInterval(async () => {
      try {
        const { spinner: latest } = await api<{ spinner: PublicSpinner | null }>("/api/spinners/active");
        if (!latest || latest.id !== spinner.id) router.refresh();
        else setSpinner(latest);
      } catch {
        /* offline: ignore */
      }
    }, 15000);
    return () => clearInterval(t);
  }, [phase, preview, router, spinner.id]);

  const onTick = useCallback(() => sound.tick(), [sound]);

  function userGesture() {
    sound.unlock();
    sound.startBackground();
  }

  async function spin() {
    if (spinLock.current) return; // double-click guard (server is idempotent too)
    spinLock.current = true;
    userGesture();
    setError(null);
    setPhase("spinning");
    try {
      if (preview) {
        const idx = Math.floor(Math.random() * spinner.segments.length);
        sound.spinStart();
        await wheelRef.current?.spinTo(idx);
        const seg = spinner.segments[idx];
        sound.win(true);
        setResult({
          result: {
            id: "preview",
            code: "TVS-PREV-IEW0",
            userId: "preview",
            spinnerId: spinner.id,
            offerId: seg.id,
            offerName: seg.name,
            offerImage: seg.image,
            status: "won",
            spunAt: new Date().toISOString(),
          },
          offerDescription: seg.description,
          participantName: "Preview User",
          spinnerTitle: spinner.title,
        });
        setPhase("result");
        return;
      }
      const res = await api<SpinResponse>("/api/spins", { method: "POST", json: { spinnerId: spinner.id } });
      if (res.replay) {
        // Already spun (another tab / double submit): show the stored result.
        if (res.segmentIndex >= 0) wheelRef.current?.snapTo(res.segmentIndex);
        setResult(res);
        setPhase("result");
        return;
      }
      sound.spinStart();
      if (res.segmentIndex >= 0) await wheelRef.current?.spinTo(res.segmentIndex);
      sound.win(res.result.status !== "lost");
      setResult(res);
      setPhase("result");
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_PARTICIPATED") {
        setMessage(err.message);
        setPhase("already");
      } else if (err instanceof ApiError && err.code === "NOT_REGISTERED") {
        setPhase("register");
      } else {
        setError(err instanceof Error ? err.message : "Spin failed. Please try again.");
        setPhase("ready");
      }
    } finally {
      spinLock.current = false;
    }
  }

  function toggleMute() {
    sound.setMuted(!muted);
    setMuted(!muted);
    if (muted) sound.startBackground();
  }

  const showWheel = phase === "ready" || phase === "spinning" || (phase === "result" && !restored);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {spinner.settings.soundEnabled && (
        <button
          onClick={toggleMute}
          className="fixed right-4 top-4 z-30 rounded-full bg-white/15 p-2.5 text-white backdrop-blur hover:bg-white/25"
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      )}

      {phase === "loading" && <Loader2 className="my-16 h-10 w-10 animate-spin text-white/70" />}

      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <motion.div key="intro" exit={{ opacity: 0, y: -10 }} className="w-full">
            <CampaignCard
              spinner={spinner}
              ctaLabel={ctaLabel}
              onStart={() => {
                userGesture();
                setPhase("register");
              }}
            />
          </motion.div>
        )}
        {phase === "register" && (
          <motion.div key="register" exit={{ opacity: 0, y: -10 }} className="w-full">
            <RegistrationForm
              spinner={spinner}
              whatsappGroupUrl={whatsappGroupUrl}
              onBack={() => setPhase("intro")}
              onRegistered={(p) => {
                setParticipant(p);
                setPhase("ready");
              }}
              onAlreadyParticipated={(m) => {
                setMessage(m);
                setPhase("already");
              }}
            />
          </motion.div>
        )}
        {phase === "already" && (
          <motion.div
            key="already"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full rounded-3xl bg-white p-6 text-center shadow-2xl"
          >
            <ShieldCheck className="mx-auto h-12 w-12 text-brand-500" />
            <h2 className="mt-3 text-xl font-extrabold text-slate-900">Already participated</h2>
            <p className="mt-2 text-slate-600">
              {message ?? "You have already participated in this Lucky Spin. Each participant is allowed only one spin."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {showWheel && (
        <div className="flex w-full flex-col items-center gap-5">
          {phase !== "result" && (
            <div className="text-center text-white">
              <p className="text-sm uppercase tracking-widest text-gold-300">{spinner.title}</p>
              {participant?.name && <p className="mt-1 text-lg font-bold">Good luck, {participant.name.split(" ")[0]}!</p>}
            </div>
          )}
          <LuckyWheel ref={wheelRef} segments={spinner.segments} settings={spinner.settings} onTick={onTick} className={phase === "result" ? "max-w-[260px] opacity-90" : ""} />
          {error && (
            <p className="flex items-center gap-2 rounded-xl bg-red-500/90 px-4 py-2 text-sm text-white">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}
          {phase !== "result" && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={spin}
              disabled={phase === "spinning"}
              className="btn-shine w-full max-w-sm rounded-2xl bg-gradient-to-r from-gold-400 via-gold-500 to-brand-400 px-6 py-4 text-xl font-black tracking-wider text-night-900 shadow-xl shadow-gold-500/30 disabled:opacity-70"
            >
              {phase === "spinning" ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Spinning…
                </span>
              ) : (
                "SPIN NOW"
              )}
            </motion.button>
          )}
        </div>
      )}

      {phase === "result" && result && (
        <WinningResult
          view={result}
          confetti={spinner.settings.confettiEnabled}
          redeemInstructions={spinner.settings.redeemInstructions}
          shareUrl={shareUrl}
        />
      )}
      {preview && phase === "result" && (
        <button
          className="btn btn-secondary"
          onClick={() => {
            setResult(null);
            setPhase("ready");
          }}
        >
          Spin preview again
        </button>
      )}
    </div>
  );
}
