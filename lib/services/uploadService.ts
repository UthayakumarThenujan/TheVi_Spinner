import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { put, head, BlobNotFoundError } from "@vercel/blob";
import { getDataDir } from "@/lib/database/jsonDatabase";
import { badRequest } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

/**
 * Uploads are stored under DATA_DIR/uploads (NOT /public — files added to /public after
 * `next build` are not served in production) and streamed by app/uploads/[file]/route.ts.
 * When BLOB_READ_WRITE_TOKEN is set (Vercel Blob connected), files go to Vercel Blob
 * instead; the public URL stays `/uploads/<name>` and the route redirects to the blob.
 * SVG is intentionally not accepted (script injection risk).
 */
export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
const blobPath = (name: string) => `uploads/${name}`;
const IMAGE_MAX = 2 * 1024 * 1024;
const AUDIO_MAX = 5 * 1024 * 1024;

const TYPES: Record<string, { ext: string; kind: "image" | "audio"; magic: (b: Buffer) => boolean }> = {
  "image/png": { ext: "png", kind: "image", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { ext: "jpg", kind: "image", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { ext: "webp", kind: "image", magic: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
  "image/gif": { ext: "gif", kind: "image", magic: (b) => b.toString("ascii", 0, 4) === "GIF8" },
  "audio/mpeg": { ext: "mp3", kind: "audio", magic: (b) => b.toString("ascii", 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  "audio/mp3": { ext: "mp3", kind: "audio", magic: (b) => b.toString("ascii", 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  "audio/wav": { ext: "wav", kind: "audio", magic: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE" },
  "audio/x-wav": { ext: "wav", kind: "audio", magic: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE" },
  "audio/ogg": { ext: "ogg", kind: "audio", magic: (b) => b.toString("ascii", 0, 4) === "OggS" },
};

export const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

export function uploadsDir() {
  return path.join(getDataDir(), "uploads");
}

export async function saveUpload(file: File, expected: "image" | "audio"): Promise<{ url: string; size: number; type: string }> {
  const spec = TYPES[file.type];
  if (!spec || spec.kind !== expected) {
    throw badRequest(
      expected === "image" ? "Only PNG, JPG, WEBP or GIF images are allowed" : "Only MP3, WAV or OGG audio files are allowed",
    );
  }
  const max = expected === "image" ? IMAGE_MAX : AUDIO_MAX;
  if (file.size > max) throw badRequest(`File is too large (max ${max / 1024 / 1024} MB)`);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0 || !spec.magic(buf)) throw badRequest("File content does not match its type");

  const name = `${expected}-${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}.${spec.ext}`;
  if (blobConfigured()) {
    await put(blobPath(name), buf, { access: "public", contentType: file.type, addRandomSuffix: false });
  } else {
    await fs.mkdir(uploadsDir(), { recursive: true });
    await fs.writeFile(path.join(uploadsDir(), name), buf);
  }
  logger.info("upload.saved", { name, size: buf.length });
  return { url: `/uploads/${name}`, size: buf.length, type: file.type };
}

const UPLOAD_NAME = /^[A-Za-z0-9_\-]+\.(png|jpe?g|webp|gif|mp3|wav|ogg)$/;

/** Public Vercel Blob URL for an upload name, or null if it doesn't exist. */
export async function resolveBlobUpload(name: string): Promise<string | null> {
  if (!UPLOAD_NAME.test(name)) return null;
  try {
    return (await head(blobPath(name))).url;
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw err;
  }
}

/** Resolve a public upload name to a safe absolute path, or null. */
export function resolveUpload(name: string): string | null {
  if (!UPLOAD_NAME.test(name)) return null;
  const full = path.join(uploadsDir(), name);
  return path.dirname(full) === uploadsDir() ? full : null;
}
