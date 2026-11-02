"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X, Music } from "lucide-react";
import { uploadFile } from "@/lib/client/api";

export function FileUpload({
  value,
  onChange,
  kind = "image",
  label,
}: {
  value: string | null | undefined;
  onChange: (url: string) => void;
  kind?: "image" | "audio";
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    const max = kind === "image" ? 2 : 5;
    if (file.size > max * 1024 * 1024) {
      setError(`File is too large (max ${max} MB)`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { url } = await uploadFile(file, kind);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex items-center gap-3">
        {value ? (
          kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Preview" className="h-20 w-20 rounded-xl border border-slate-200 bg-slate-50 object-contain" />
          ) : (
            <audio src={value} controls className="h-10 max-w-[220px]" />
          )
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-slate-300">
            {kind === "image" ? <ImagePlus className="h-7 w-7" /> : <Music className="h-7 w-7" />}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {value ? "Replace" : "Upload"}
          </button>
          {value && (
            <button type="button" className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline" onClick={() => onChange("")}>
              <X className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          className="hidden"
          accept={kind === "image" ? "image/png,image/jpeg,image/webp,image/gif" : "audio/mpeg,audio/wav,audio/ogg"}
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">{kind === "image" ? "PNG, JPG, WEBP or GIF · max 2 MB" : "MP3, WAV or OGG · max 5 MB"}</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
