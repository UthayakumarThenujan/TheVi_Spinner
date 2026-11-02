"use client";

import { ParticipantTable } from "./ParticipantTable";

/** Spin results (won / lost / redeemed) — a filtered view of the participant table. */
export function WinnerTable() {
  return <ParticipantTable mode="winners" />;
}
