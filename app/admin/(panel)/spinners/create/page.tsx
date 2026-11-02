"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/AdminShell";
import { SpinnerForm } from "@/components/admin/SpinnerForm";
import { useApi } from "@/lib/client/useApi";
import type { AppSettings } from "@/types/result";

export default function CreateSpinnerPage() {
  const router = useRouter();
  const { data, loading } = useApi<{ settings: AppSettings }>("/api/admin/settings");
  return (
    <>
      <PageHeader title="Create spinner" subtitle="Create a draft, add offers, preview, then publish." />
      {!loading && (
        <SpinnerForm defaultMax={data?.settings.defaultMaxParticipants ?? 10} onSaved={(s) => router.push(`/admin/spinners/${s.id}?tab=offers`)} />
      )}
    </>
  );
}
