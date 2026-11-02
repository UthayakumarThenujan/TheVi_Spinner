"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import type { PublicSegment, SpinnerSettings, PointerStyle } from "@/types/spinner";

export interface LuckyWheelHandle {
  /** Animate the wheel so `index` stops under the pointer. Resolves when the wheel stops. */
  spinTo(index: number): Promise<void>;
  /** Snap instantly to a segment (e.g. when restoring a finished result). */
  snapTo(index: number): void;
}

interface Props {
  segments: PublicSegment[];
  settings: SpinnerSettings;
  onTick?: () => void;
  centerLabel?: string;
  className?: string;
}

const SIZE = 400;
const C = SIZE / 2;
const R = 184;

function polar(angleDeg: number, radius: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: C + radius * Math.cos(a), y: C + radius * Math.sin(a) };
}

function slicePath(start: number, end: number) {
  const p0 = polar(start, R);
  const p1 = polar(end, R);
  const large = end - start > 180 ? 1 : 0;
  return `M ${C} ${C} L ${p0.x} ${p0.y} A ${R} ${R} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
}

/** Pick black or white text for a background color. */
function readableText(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1f1147" : "#ffffff";
}

function truncate(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export const LuckyWheel = forwardRef<LuckyWheelHandle, Props>(function LuckyWheel(
  { segments, settings, onTick, centerLabel = "SPIN", className },
  ref,
) {
  const rotation = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const lastTick = useRef(0);
  const n = Math.max(segments.length, 1);
  const angle = 360 / n;

  useImperativeHandle(
    ref,
    () => ({
      spinTo(index: number) {
        return new Promise<void>((resolve) => {
          const current = rotation.get();
          const center = index * angle + angle / 2;
          // Land somewhere inside the segment (not dead center) so it feels natural.
          const jitter = (Math.random() - 0.5) * angle * 0.6;
          const desired = (((360 - center - jitter) % 360) + 360) % 360;
          const currentMod = ((current % 360) + 360) % 360;
          const fullTurns = reduceMotion ? 1 : Math.max(5, Math.round(settings.animationDuration / 1000) + 2);
          const target = current + fullTurns * 360 + ((desired - currentMod + 360) % 360);
          const duration = reduceMotion ? 1.2 : settings.animationDuration / 1000;
          lastTick.current = Math.floor(current / angle);
          animate(rotation, target, {
            duration,
            ease: [0.12, 0.8, 0.18, 1],
            onUpdate: (v) => {
              const t = Math.floor(v / angle);
              if (t !== lastTick.current) {
                lastTick.current = t;
                onTick?.();
              }
            },
            onComplete: () => resolve(),
          });
        });
      },
      snapTo(index: number) {
        const center = index * angle + angle / 2;
        rotation.set(360 - center);
      },
    }),
    [angle, onTick, reduceMotion, rotation, settings.animationDuration],
  );

  const slices = useMemo(() => {
    const fontSize = n <= 4 ? 20 : n <= 6 ? 17 : n <= 8 ? 15 : n <= 12 ? 12 : 10;
    const maxChars = n <= 6 ? 16 : n <= 10 ? 14 : 11;
    const chord = 2 * (R * 0.72) * Math.sin(((angle / 2) * Math.PI) / 180);
    const imgSize = Math.min(64, chord * 0.62);
    return segments.map((s, i) => {
      const start = i * angle;
      const center = start + angle / 2;
      const color = s.color || settings.wheelColors[i % settings.wheelColors.length];
      const showImage = (s.type === "image" || s.type === "both") && !!s.image;
      const showText = s.type !== "image" || !s.image;
      return { s, i, start, end: start + angle, center, color, text: readableText(color), showImage, showText, fontSize, maxChars, imgSize };
    });
  }, [segments, angle, n, settings.wheelColors]);

  const bulbs = Array.from({ length: 24 }, (_, i) => polar((360 / 24) * i, R + 8));

  return (
    <div className={`relative mx-auto aspect-square w-full max-w-[min(92vw,460px)] ${className ?? ""}`}>
      {/* glow */}
      <div className="absolute inset-[6%] rounded-full bg-gold-400/30 blur-2xl" aria-hidden />
      {/* rim + lights */}
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)]" aria-hidden>
        <circle cx={C} cy={C} r={R + 14} fill={settings.wheelCenterColor} />
        <circle cx={C} cy={C} r={R + 3} fill={settings.wheelBorderColor} />
        {bulbs.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={3.6} fill={i % 2 ? "#FFE08A" : "#ffffff"} className={i % 2 ? "animate-pulse" : ""} />
        ))}
      </svg>
      {/* rotating segments */}
      <motion.div className="absolute inset-0" style={{ rotate: rotation }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" role="img" aria-label="Lucky spin wheel">
          <g>
            {slices.map(({ s, i, start, end, center, color, text, showImage, showText, fontSize, maxChars, imgSize }) => (
              <g key={s.id}>
                <path d={slicePath(start, end)} fill={color} stroke={settings.wheelBorderColor} strokeWidth={2} />
                <g transform={`rotate(${center} ${C} ${C})`}>
                  {showImage && (
                    <image
                      href={s.image!}
                      x={C - imgSize / 2}
                      y={C - R * 0.86}
                      width={imgSize}
                      height={imgSize}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  )}
                  {showText && (
                    <text
                      x={C}
                      y={showImage ? C - R * 0.86 + imgSize + 8 : C - R * 0.9}
                      transform={`rotate(90 ${C} ${showImage ? C - R * 0.86 + imgSize + 8 : C - R * 0.9})`}
                      fill={text}
                      fontSize={showImage ? fontSize * 0.85 : fontSize}
                      fontWeight={800}
                      dominantBaseline="middle"
                      textAnchor="start"
                      style={{ letterSpacing: "0.02em" }}
                    >
                      {truncate(s.name, showImage ? Math.max(8, maxChars - 5) : maxChars)}
                    </text>
                  )}
                </g>
                <title>{`${i + 1}. ${s.name}`}</title>
              </g>
            ))}
          </g>
        </svg>
      </motion.div>
      {/* hub */}
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <circle cx={C} cy={C} r={38} fill={settings.wheelBorderColor} />
        <circle cx={C} cy={C} r={32} fill={settings.wheelCenterColor} />
        <text x={C} y={C + 1} textAnchor="middle" dominantBaseline="middle" fill="#FFE08A" fontWeight={900} fontSize={14} letterSpacing="0.08em">
          {centerLabel}
        </text>
      </svg>
      <Pointer style={settings.pointerStyle} />
    </div>
  );
});

function Pointer({ style }: { style: PointerStyle }) {
  const common = "absolute left-1/2 top-0 z-10 -translate-x-1/2 drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)]";
  if (style === "arrow") {
    return (
      <svg className={`${common} -top-1 h-12 w-10`} viewBox="0 0 40 48" aria-hidden>
        <path d="M20 46 L4 10 Q20 0 36 10 Z" fill="#FFD43B" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    );
  }
  if (style === "pin") {
    return (
      <svg className={`${common} -top-3 h-14 w-10`} viewBox="0 0 40 56" aria-hidden>
        <path d="M20 54 C20 54 4 30 4 20 A16 16 0 1 1 36 20 C36 30 20 54 20 54 Z" fill="#F43F64" stroke="#fff" strokeWidth="3" />
        <circle cx="20" cy="20" r="6" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg className={`${common} -top-2 h-12 w-9`} viewBox="0 0 36 48" aria-hidden>
      <path d="M18 46 L3 6 L33 6 Z" fill="#F43F64" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="18" cy="10" r="4" fill="#fff" />
    </svg>
  );
}
