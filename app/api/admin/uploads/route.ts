import { adminRoute, json, enforceRateLimit } from "@/lib/http";
import { saveUpload } from "@/lib/services/uploadService";
import { badRequest } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

/** POST multipart/form-data { file, kind: "image" | "audio" } */
export const POST = adminRoute(async (req) => {
  enforceRateLimit(req, "upload", 30, 60_000);
  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("Expected multipart form data");
  const file = form.get("file");
  const kind = form.get("kind") === "audio" ? "audio" : "image";
  if (!(file instanceof File)) throw badRequest("No file uploaded");
  return json(await saveUpload(file, kind), 201);
});
