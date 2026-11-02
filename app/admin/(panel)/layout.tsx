import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/session";
import { readRepos } from "@/lib/database/repositories";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

/** Server-side guard for every admin page. APIs are guarded separately by adminRoute(). */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  const settings = await readRepos().settings.get();
  return (
    <AdminShell username={admin.username} brand={settings.brandName}>
      {children}
    </AdminShell>
  );
}
