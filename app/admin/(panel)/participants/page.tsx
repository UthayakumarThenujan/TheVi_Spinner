import { PageHeader } from "@/components/admin/AdminShell";
import { ParticipantTable } from "@/components/admin/ParticipantTable";

export default function ParticipantsPage() {
  return (
    <>
      <PageHeader title="Participants" subtitle="Everyone who registered, including people who have not spun yet." />
      <ParticipantTable mode="participants" />
    </>
  );
}
