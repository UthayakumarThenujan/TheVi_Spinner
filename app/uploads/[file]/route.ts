import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { resolveUpload, MIME_BY_EXT } from "@/lib/services/uploadService";
import { notFound } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

/** GET /uploads/:file — serves uploaded images/sounds from DATA_DIR/uploads. */
export const GET = route<{ file: string }>(async (_req, { params }) => {
  const { file } = await params;
  const full = resolveUpload(file);
  if (!full) throw notFound("File");
  let data: Buffer;
  try {
    data = await fs.readFile(full);
  } catch {
    throw notFound("File");
  }
  const ext = path.extname(full).slice(1).toLowerCase();
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
});
