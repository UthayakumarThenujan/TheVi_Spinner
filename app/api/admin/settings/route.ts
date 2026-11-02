import { adminRoute, json, parseJson } from "@/lib/http";
import { appSettingsSchema } from "@/lib/validation/schemas";
import { readRepos, withRepos } from "@/lib/database/repositories";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => json({ settings: await readRepos().settings.get() }));

export const PUT = adminRoute(async (req) => {
  const input = await parseJson(req, appSettingsSchema);
  const settings = await withRepos((repos) => repos.settings.save({ ...input, logoUrl: input.logoUrl || null }));
  return json({ settings });
});
