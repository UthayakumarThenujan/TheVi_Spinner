import { PageHeader } from "@/components/admin/AdminShell";
import { WinnerTable } from "@/components/admin/WinnerTable";

export default function WinnersPage() {
  return (
    <>
      <PageHeader title="Winner monitoring" subtitle="Every spin result across all campaigns. Tap a row to view details or mark an offer redeemed." />
      <WinnerTable />
    </>
  );
}
