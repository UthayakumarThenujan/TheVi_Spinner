import { Gift, ListChecks, MessageCircle, Sparkles } from "lucide-react";
import { getActivePublicSpinner } from "@/lib/services/spinnerService";
import { readRepos } from "@/lib/database/repositories";
import { SpinExperience } from "@/components/user/SpinExperience";
import { Footer } from "@/components/shared/Footer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [spinner, settings] = await Promise.all([getActivePublicSpinner(), readRepos().settings.get()]);

  return (
    <main className="bg-festive relative min-h-dvh overflow-x-hidden text-white">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 pb-10 pt-6 sm:pt-10">
        {/* Brand */}
        <header className="flex w-full items-center gap-3">
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt={settings.brandName} className="h-11 w-11 rounded-xl bg-white object-contain p-1" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-brand-400 text-night-900">
              <Sparkles className="h-6 w-6" />
            </div>
          )}
          <div>
            <p className="text-lg font-extrabold leading-tight">{settings.brandName}</p>
            <p className="text-xs text-white/60">{settings.tagline}</p>
          </div>
        </header>

        {/* Welcome banner */}
        <section className="mt-6 w-full text-center">
          <h1 className="bg-gradient-to-r from-gold-300 via-white to-brand-200 bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-4xl">
            {settings.welcomeTitle}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-white/80">{settings.welcomeMessage}</p>
          {settings.whatsappGroupUrl && (
            <a
              href={settings.whatsappGroupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/20 px-3 py-1.5 text-sm font-semibold text-[#7CF0A8] hover:bg-[#25D366]/30"
            >
              <MessageCircle className="h-4 w-4" /> Join our WhatsApp group
            </a>
          )}
        </section>

        <div className="mt-6 w-full">
          {spinner ? (
            <SpinExperience
              key={spinner.id}
              initialSpinner={spinner}
              ctaLabel={settings.ctaLabel}
              whatsappGroupUrl={settings.whatsappGroupUrl}
              shareUrl={settings.publicUrl}
            />
          ) : (
            <div className="glass rounded-3xl p-8 text-center">
              <Gift className="mx-auto h-14 w-14 text-gold-300" />
              <p className="mt-4 text-xl font-bold">{settings.comingSoonMessage}</p>
              <p className="mt-2 text-sm text-white/70">Keep an eye on our WhatsApp announcement group.</p>
            </div>
          )}
        </div>

        {/* Rules */}
        {settings.rules.length > 0 && (
          <section className="glass mt-8 w-full rounded-3xl p-5">
            <h3 className="flex items-center gap-2 font-bold">
              <ListChecks className="h-5 w-5 text-gold-300" /> Rules &amp; Conditions
            </h3>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-white/80">
              {settings.rules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
          </section>
        )}
        <Footer brand={settings.brandName} />
      </div>
    </main>
  );
}
