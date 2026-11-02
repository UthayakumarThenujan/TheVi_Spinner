import { route, json } from "@/lib/http";
import { readRepos } from "@/lib/database/repositories";

export const dynamic = "force-dynamic";

/** GET /api/settings — public brand settings. */
export const GET = route(async () => {
  const s = await readRepos().settings.get();
  return json({
    settings: {
      brandName: s.brandName,
      tagline: s.tagline,
      logoUrl: s.logoUrl,
      welcomeTitle: s.welcomeTitle,
      welcomeMessage: s.welcomeMessage,
      ctaLabel: s.ctaLabel,
      whatsappGroupUrl: s.whatsappGroupUrl,
      rules: s.rules,
      comingSoonMessage: s.comingSoonMessage,
    },
  });
});
