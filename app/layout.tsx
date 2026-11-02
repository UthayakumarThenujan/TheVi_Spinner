import type { Metadata, Viewport } from "next";
import "./globals.css";
import { readRepos } from "@/lib/database/repositories";

// Every page reads live data from the JSON database — never prerender at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await readRepos().settings.get();
  return {
    title: { default: `${s.brandName} — Lucky Spin`, template: `%s · ${s.brandName}` },
    description: s.welcomeMessage,
    openGraph: { title: `${s.brandName} — Lucky Spin`, description: s.welcomeMessage, type: "website" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f1147",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
