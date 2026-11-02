import { readRepos, withRepos } from "@/lib/database/repositories";
import { AppError, badRequest } from "@/lib/utils/errors";
import { nowIso } from "@/lib/utils/ids";
import type { ResultStatus } from "@/types/result";

export interface ParticipantRow {
  userId: string;
  name: string;
  mobile: string;
  whatsappConfirmed: boolean;
  spinnerId: string;
  spinnerTitle: string;
  registeredAt: string;
  registrationStatus: string;
  resultId: string | null;
  resultCode: string | null;
  offerId: string | null;
  offerName: string | null;
  offerImage: string | null;
  status: ResultStatus | "pending";
  spunAt: string | null;
  redeemedAt: string | null;
}

export interface ParticipantFilters {
  q?: string;
  spinnerId?: string;
  offerId?: string;
  status?: string; // won | lost | redeemed | pending | winners | nonwinners
  from?: string; // yyyy-mm-dd
  to?: string;
  onlySpun?: boolean;
}

export async function listParticipantRows(filters: ParticipantFilters = {}): Promise<ParticipantRow[]> {
  const repos = readRepos();
  const [users, results, spinners, offers] = await Promise.all([
    repos.users.all(),
    repos.results.all(),
    repos.spinners.all(),
    repos.offers.all(),
  ]);
  const spinnerTitle = new Map(spinners.map((s) => [s.id, s.title]));
  const offerById = new Map(offers.map((o) => [o.id, o]));
  const resultByUser = new Map(results.map((r) => [`${r.spinnerId}:${r.userId}`, r]));

  let rows: ParticipantRow[] = users.map((u) => {
    const r = resultByUser.get(`${u.spinnerId}:${u.id}`);
    return {
      userId: u.id,
      name: u.name,
      mobile: u.mobile,
      whatsappConfirmed: u.whatsappConfirmed,
      spinnerId: u.spinnerId,
      spinnerTitle: spinnerTitle.get(u.spinnerId) ?? "(deleted)",
      registeredAt: u.registeredAt,
      registrationStatus: u.status,
      resultId: r?.id ?? null,
      resultCode: r?.code ?? null,
      offerId: r?.offerId ?? null,
      offerName: r?.offerName ?? null,
      offerImage: r ? (offerById.get(r.offerId)?.image ?? r.offerImage) : null,
      status: r?.status ?? "pending",
      spunAt: r?.spunAt ?? null,
      redeemedAt: r?.redeemedAt ?? null,
    };
  });

  const q = filters.q?.trim().toLowerCase();
  if (q) {
    const digits = q.replace(/\D/g, "");
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (digits.length >= 3 && r.mobile.replace(/\D/g, "").includes(digits.replace(/^0/, ""))) ||
        r.resultCode?.toLowerCase().includes(q),
    );
  }
  if (filters.spinnerId) rows = rows.filter((r) => r.spinnerId === filters.spinnerId);
  if (filters.offerId) rows = rows.filter((r) => r.offerId === filters.offerId);
  if (filters.onlySpun) rows = rows.filter((r) => r.resultId);
  switch (filters.status) {
    case "won":
    case "lost":
    case "redeemed":
    case "pending":
      rows = rows.filter((r) => r.status === filters.status);
      break;
    case "winners":
      rows = rows.filter((r) => r.status === "won" || r.status === "redeemed");
      break;
    case "nonwinners":
      rows = rows.filter((r) => r.status === "lost" || r.status === "pending");
      break;
  }
  const dateOf = (r: ParticipantRow) => r.spunAt ?? r.registeredAt;
  if (filters.from) {
    const from = Date.parse(`${filters.from}T00:00:00`);
    if (!Number.isNaN(from)) rows = rows.filter((r) => Date.parse(dateOf(r)) >= from);
  }
  if (filters.to) {
    const to = Date.parse(`${filters.to}T23:59:59.999`);
    if (!Number.isNaN(to)) rows = rows.filter((r) => Date.parse(dateOf(r)) <= to);
  }
  return rows.sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
}

export async function setResultRedeemed(resultId: string, redeemed: boolean) {
  return withRepos(async (repos) => {
    const r = await repos.results.getById(resultId, "Result");
    if (r.status === "lost") throw badRequest("This result did not win an offer");
    return repos.results.update(resultId, {
      status: redeemed ? "redeemed" : "won",
      redeemedAt: redeemed ? nowIso() : null,
    });
  });
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export async function getDashboard() {
  const repos = readRepos();
  const [spinners, users, results, offers] = await Promise.all([
    repos.spinners.all(),
    repos.users.all(),
    repos.results.all(),
    repos.offers.all(),
  ]);
  const active = spinners.find((s) => s.status === "active") ?? null;
  const activeParticipants = active ? users.filter((u) => u.spinnerId === active.id).length : 0;

  // Daily participation: last 14 days
  const days: { date: string; registrations: number; spins: number; winners: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), registrations: 0, spins: 0, winners: 0 });
  }
  const dayIdx = new Map(days.map((d, i) => [d.date, i]));
  for (const u of users) {
    const i = dayIdx.get(dayKey(u.registeredAt));
    if (i !== undefined) days[i].registrations++;
  }
  for (const r of results) {
    const i = dayIdx.get(dayKey(r.spunAt));
    if (i !== undefined) {
      days[i].spins++;
      if (r.status !== "lost") days[i].winners++;
    }
  }

  const winnersPerSpinner = [...spinners]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
    .reverse()
    .map((s) => ({
      spinnerId: s.id,
      title: s.title,
      winners: results.filter((r) => r.spinnerId === s.id && r.status !== "lost").length,
      spins: results.filter((r) => r.spinnerId === s.id).length,
    }));

  const focusSpinnerId = active?.id ?? winnersPerSpinner.at(-1)?.spinnerId ?? null;
  const offerDistribution = focusSpinnerId
    ? offers
        .filter((o) => o.spinnerId === focusSpinnerId)
        .sort((a, b) => a.order - b.order)
        .map((o) => ({
          offerId: o.id,
          name: o.name,
          color: o.color,
          count: results.filter((r) => r.offerId === o.id).length,
        }))
    : [];

  return {
    totals: {
      spinners: spinners.length,
      registeredUsers: users.length,
      uniqueMobiles: new Set(users.map((u) => u.mobile)).size,
      spins: results.length,
      winners: results.filter((r) => r.status !== "lost").length,
      redeemed: results.filter((r) => r.status === "redeemed").length,
    },
    activeSpinner: active
      ? {
          id: active.id,
          title: active.title,
          paused: active.paused,
          maxParticipants: active.maxParticipants,
          participants: activeParticipants,
          remainingSlots: Math.max(0, active.maxParticipants - activeParticipants),
          spins: results.filter((r) => r.spinnerId === active.id).length,
        }
      : null,
    daily: days,
    winnersPerSpinner,
    offerDistribution,
    offerDistributionSpinner: spinners.find((s) => s.id === focusSpinnerId)?.title ?? null,
    recent: (await listParticipantRows({ onlySpun: true })).slice(0, 6),
  };
}

export async function getSpinnerAnalytics(spinnerId: string) {
  const repos = readRepos();
  const spinner = await repos.spinners.findById(spinnerId);
  if (!spinner) throw new AppError(404, "NOT_FOUND", "Spinner not found");
  const [users, results, offers] = await Promise.all([
    repos.users.where((u) => u.spinnerId === spinnerId),
    repos.results.where((r) => r.spinnerId === spinnerId),
    repos.offers.forSpinner(spinnerId),
  ]);

  const perOffer = offers.map((o) => {
    const wins = results.filter((r) => r.offerId === o.id).length;
    return {
      offerId: o.id,
      name: o.name,
      color: o.color,
      image: o.image,
      isWinning: o.isWinning,
      active: o.active,
      weight: o.weight,
      maxWinners: o.maxWinners,
      remainingQuantity: o.remainingQuantity,
      count: wins,
      redeemed: results.filter((r) => r.offerId === o.id && r.status === "redeemed").length,
      percentage: results.length ? Math.round((wins / results.length) * 1000) / 10 : 0,
    };
  });
  const totalWeight = offers.filter((o) => o.active).reduce((s, o) => s + o.weight, 0);

  // Timeline: hourly buckets if all activity is within 48h, else daily.
  const stamps = [...users.map((u) => u.registeredAt), ...results.map((r) => r.spunAt)].sort();
  const span = stamps.length ? Date.parse(stamps.at(-1)!) - Date.parse(stamps[0]) : 0;
  const hourly = span <= 48 * 3600_000;
  const keyOf = (iso: string) => (hourly ? `${iso.slice(0, 13)}:00` : iso.slice(0, 10));
  const buckets = new Map<string, { registrations: number; spins: number }>();
  for (const u of users) {
    const k = keyOf(u.registeredAt);
    const b = buckets.get(k) ?? { registrations: 0, spins: 0 };
    b.registrations++;
    buckets.set(k, b);
  }
  for (const r of results) {
    const k = keyOf(r.spunAt);
    const b = buckets.get(k) ?? { registrations: 0, spins: 0 };
    b.spins++;
    buckets.set(k, b);
  }
  const timeline = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, v]) => ({ bucket, ...v }));

  return {
    spinner: { id: spinner.id, title: spinner.title, status: spinner.status, maxParticipants: spinner.maxParticipants },
    participants: users.length,
    spins: results.length,
    winners: results.filter((r) => r.status !== "lost").length,
    redeemed: results.filter((r) => r.status === "redeemed").length,
    remainingSlots: Math.max(0, spinner.maxParticipants - users.length),
    pendingSpins: users.length - results.length,
    perOffer: perOffer.map((p) => ({
      ...p,
      configuredOdds: p.active && totalWeight > 0 ? Math.round((p.weight / totalWeight) * 1000) / 10 : 0,
    })),
    timeline,
    timelineGranularity: hourly ? "hour" : "day",
  };
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // Neutralize spreadsheet formula injection
  // (plain numbers such as +94771234567 are safe and left untouched)
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function participantsCsv(rows: ParticipantRow[]): string {
  return toCsv(
    ["User ID", "Name", "Mobile", "WhatsApp Confirmed", "Spinner ID", "Spinner", "Registered At", "Spin Date", "Winning Offer", "Result ID", "Result Code", "Status", "Redeemed At"],
    rows.map((r) => [
      r.userId,
      r.name,
      r.mobile,
      r.whatsappConfirmed ? "yes" : "no",
      r.spinnerId,
      r.spinnerTitle,
      r.registeredAt,
      r.spunAt ?? "",
      r.offerName ?? "",
      r.resultId ?? "",
      r.resultCode ?? "",
      r.status,
      r.redeemedAt ?? "",
    ]),
  );
}

export async function spinnerReportCsv(spinnerId: string): Promise<string> {
  const a = await getSpinnerAnalytics(spinnerId);
  const rows = await listParticipantRows({ spinnerId });
  const summary = toCsv(
    ["Metric", "Value"],
    [
      ["Spinner", a.spinner.title],
      ["Spinner ID", a.spinner.id],
      ["Status", a.spinner.status],
      ["Max participants", a.spinner.maxParticipants],
      ["Registered", a.participants],
      ["Spins", a.spins],
      ["Winners", a.winners],
      ["Redeemed", a.redeemed],
      ["Remaining slots", a.remainingSlots],
    ],
  );
  const offers = toCsv(
    ["Offer ID", "Offer", "Weight", "Configured odds %", "Times won", "Actual %", "Max winners", "Remaining", "Redeemed"],
    a.perOffer.map((o) => [o.offerId, o.name, o.weight, o.configuredOdds, o.count, o.percentage, o.maxWinners ?? "unlimited", o.remainingQuantity ?? "unlimited", o.redeemed]),
  );
  return [summary, "", offers.replace(/^﻿/, ""), "", participantsCsv(rows).replace(/^﻿/, "")].join("\r\n");
}
