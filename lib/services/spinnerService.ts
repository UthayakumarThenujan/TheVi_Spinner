import { readRepos, withRepos, type Repos } from "@/lib/database/repositories";
import { AppError, badRequest } from "@/lib/utils/errors";
import { newId, nowIso } from "@/lib/utils/ids";
import { logger } from "@/lib/utils/logger";
import type {
  Spinner,
  SpinnerSettings,
  PublicSpinner,
  PublicSegment,
  SpinnerAvailability,
  SpinnerStatus,
} from "@/types/spinner";
import type { Offer } from "@/types/offer";
import type { z } from "zod";
import type { spinnerInputSchema, offerInputSchema } from "@/lib/validation/schemas";

export const DEFAULT_WHEEL_COLORS = ["#FF6B81", "#FFA94D", "#FFD43B", "#69DB7C", "#4DABF7", "#9775FA", "#F783AC", "#38D9A9"];

export function defaultSpinnerSettings(): SpinnerSettings {
  return {
    soundEnabled: true,
    spinSound: true,
    winSound: true,
    backgroundMusic: false,
    spinSoundUrl: "",
    winSoundUrl: "",
    backgroundMusicUrl: "",
    animationDuration: 6000,
    confettiEnabled: true,
    pointerStyle: "classic",
    wheelColors: DEFAULT_WHEEL_COLORS,
    wheelBorderColor: "#FFFFFF",
    wheelCenterColor: "#1F1147",
    showWhatsappConfirmation: true,
    requireWhatsappConfirmation: false,
    whatsappGroupUrl: "",
    redeemInstructions: "Show this screen and your Result ID at our store or send it to us on WhatsApp to redeem your offer.",
  };
}

/* ------------------------------------------------------------------ */
/* Public view                                                         */
/* ------------------------------------------------------------------ */

export function computeAvailability(spinner: Spinner, participantCount: number, now = Date.now()): SpinnerAvailability {
  if (spinner.paused) return "paused";
  if (spinner.startDate && now < Date.parse(spinner.startDate)) return "not_started";
  if (spinner.endDate && now > Date.parse(spinner.endDate)) return "ended";
  if (participantCount >= spinner.maxParticipants) return "full";
  return "open";
}

export function toSegments(offers: Offer[], settings: SpinnerSettings): PublicSegment[] {
  return offers
    .filter((o) => o.active)
    .sort((a, b) => a.order - b.order)
    .map((o, i) => ({
      id: o.id,
      name: o.name,
      description: o.description,
      type: o.type,
      image: o.image,
      color: o.color || settings.wheelColors[i % settings.wheelColors.length],
    }));
}

async function buildPublic(repos: Repos, spinner: Spinner): Promise<PublicSpinner> {
  const offers = await repos.offers.forSpinner(spinner.id);
  const participantCount = await repos.users.countForSpinner(spinner.id);
  const settings = { ...defaultSpinnerSettings(), ...spinner.settings };
  return {
    id: spinner.id,
    title: spinner.title,
    description: spinner.description,
    maxParticipants: spinner.maxParticipants,
    participantCount,
    remainingSlots: Math.max(0, spinner.maxParticipants - participantCount),
    startDate: spinner.startDate,
    endDate: spinner.endDate,
    paused: spinner.paused,
    availability: computeAvailability(spinner, participantCount),
    // strip nothing sensitive: settings contain only presentation config
    settings,
    segments: toSegments(offers, settings),
  };
}

export async function getActivePublicSpinner(): Promise<PublicSpinner | null> {
  const repos = readRepos();
  const spinner = await repos.spinners.findActive();
  return spinner ? buildPublic(repos, spinner) : null;
}

/** Public detail for a spinner id; only active spinners are exposed publicly. */
export async function getPublicSpinner(id: string): Promise<PublicSpinner | null> {
  const repos = readRepos();
  const spinner = await repos.spinners.findById(id);
  if (!spinner || spinner.status !== "active") return null;
  return buildPublic(repos, spinner);
}

/** Admin preview of any spinner (ignores status). */
export async function getPreviewSpinner(id: string): Promise<PublicSpinner> {
  const repos = readRepos();
  const spinner = await repos.spinners.getById(id, "Spinner");
  return buildPublic(repos, spinner);
}

/* ------------------------------------------------------------------ */
/* Admin: spinners                                                     */
/* ------------------------------------------------------------------ */

type SpinnerInput = z.infer<typeof spinnerInputSchema>;
type OfferInput = z.infer<typeof offerInputSchema>;

export async function listSpinners() {
  const repos = readRepos();
  const [spinners, users, results, offers] = await Promise.all([
    repos.spinners.all(),
    repos.users.all(),
    repos.results.all(),
    repos.offers.all(),
  ]);
  return spinners
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((s) => ({
      ...s,
      participantCount: users.filter((u) => u.spinnerId === s.id).length,
      spinCount: results.filter((r) => r.spinnerId === s.id).length,
      winnerCount: results.filter((r) => r.spinnerId === s.id && r.status !== "lost").length,
      offerCount: offers.filter((o) => o.spinnerId === s.id).length,
    }));
}

export async function getSpinnerWithOffers(id: string) {
  const repos = readRepos();
  const spinner = await repos.spinners.getById(id, "Spinner");
  const offers = await repos.offers.forSpinner(id);
  const participantCount = await repos.users.countForSpinner(id);
  return { spinner: { ...spinner, settings: { ...defaultSpinnerSettings(), ...spinner.settings } }, offers, participantCount };
}

export async function createSpinner(input: SpinnerInput): Promise<Spinner> {
  return withRepos(async (repos) => {
    const ts = nowIso();
    const spinner: Spinner = {
      id: newId("spin"),
      title: input.title,
      description: input.description ?? "",
      status: "draft",
      paused: false,
      maxParticipants: input.maxParticipants,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      settings: { ...defaultSpinnerSettings(), ...(input.settings ?? {}) } as SpinnerSettings,
      publishedAt: null,
      createdAt: ts,
      updatedAt: ts,
    };
    await repos.spinners.insert(spinner);
    logger.info("spinner.created", { spinnerId: spinner.id });
    return spinner;
  });
}

export async function updateSpinner(id: string, input: SpinnerInput): Promise<Spinner> {
  return withRepos(async (repos) => {
    const current = await repos.spinners.getById(id, "Spinner");
    if (current.status === "archived") throw badRequest("Archived spinners cannot be edited");
    const settings = { ...defaultSpinnerSettings(), ...current.settings, ...(input.settings ?? {}) } as SpinnerSettings;
    return repos.spinners.update(id, {
      title: input.title,
      description: input.description ?? "",
      maxParticipants: input.maxParticipants,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      settings,
      updatedAt: nowIso(),
    });
  });
}

export async function duplicateSpinner(id: string): Promise<Spinner> {
  return withRepos(async (repos) => {
    const src = await repos.spinners.getById(id, "Spinner");
    const ts = nowIso();
    const copy: Spinner = {
      ...structuredClone(src),
      id: newId("spin"),
      title: `${src.title} (Copy)`.slice(0, 100),
      status: "draft",
      paused: false,
      publishedAt: null,
      createdAt: ts,
      updatedAt: ts,
    };
    await repos.spinners.insert(copy);
    for (const o of await repos.offers.forSpinner(id)) {
      await repos.offers.insert({
        ...o,
        id: newId("offer"),
        spinnerId: copy.id,
        remainingQuantity: o.maxWinners,
        createdAt: ts,
        updatedAt: ts,
      });
    }
    logger.info("spinner.duplicated", { from: id, to: copy.id });
    return copy;
  });
}

/**
 * Publish = make this the single active spinner. Any previously active spinner is
 * moved to "completed" — its participants and results are never touched.
 */
export async function publishSpinner(id: string): Promise<Spinner> {
  return withRepos(async (repos) => {
    const spinner = await repos.spinners.getById(id, "Spinner");
    if (spinner.status === "archived") throw badRequest("Archived spinners cannot be published");
    const offers = (await repos.offers.forSpinner(id)).filter((o) => o.active);
    if (offers.length < 2) throw badRequest("Add at least 2 active offers before publishing");
    if (!offers.some((o) => o.weight > 0)) throw badRequest("At least one active offer needs a weight above 0");
    const ts = nowIso();
    const current = await repos.spinners.findActive();
    if (current && current.id !== id) {
      await repos.spinners.update(current.id, { status: "completed", updatedAt: ts });
    }
    const updated = await repos.spinners.update(id, { status: "active", paused: false, publishedAt: ts, updatedAt: ts });
    logger.info("spinner.published", { spinnerId: id, replaced: current?.id ?? null });
    return updated;
  });
}

export type SpinnerAction = "deactivate" | "pause" | "resume" | "archive" | "reopen";

export async function changeSpinnerState(id: string, action: SpinnerAction): Promise<Spinner> {
  return withRepos(async (repos) => {
    const s = await repos.spinners.getById(id, "Spinner");
    const ts = nowIso();
    const transitions: Record<SpinnerAction, () => Partial<Spinner>> = {
      deactivate: () => {
        if (s.status !== "active") throw badRequest("Only the active spinner can be deactivated");
        return { status: "completed" as SpinnerStatus, paused: false };
      },
      pause: () => {
        if (s.status !== "active") throw badRequest("Only the active spinner can be paused");
        return { paused: true };
      },
      resume: () => {
        if (s.status !== "active") throw badRequest("Only the active spinner can be resumed");
        return { paused: false };
      },
      archive: () => {
        if (s.status === "active") throw badRequest("Deactivate the spinner before archiving it");
        return { status: "archived" as SpinnerStatus };
      },
      reopen: () => {
        if (s.status !== "archived" && s.status !== "completed") throw badRequest("Only completed or archived spinners can be reopened");
        return { status: "completed" as SpinnerStatus };
      },
    };
    const patch = transitions[action]();
    logger.info("spinner.state_changed", { spinnerId: id, action });
    return repos.spinners.update(id, { ...patch, updatedAt: ts });
  });
}

export async function deleteSpinner(id: string): Promise<void> {
  await withRepos(async (repos) => {
    const s = await repos.spinners.getById(id, "Spinner");
    if (s.status !== "draft") throw new AppError(409, "NOT_DRAFT", "Only draft spinners can be deleted. Archive it instead.");
    if ((await repos.users.countForSpinner(id)) > 0) {
      throw new AppError(409, "HAS_PARTICIPANTS", "This spinner has participants and cannot be deleted");
    }
    await repos.offers.deleteWhere((o) => o.spinnerId === id);
    await repos.spinners.delete(id);
    logger.info("spinner.deleted", { spinnerId: id });
  });
}

/* ------------------------------------------------------------------ */
/* Admin: offers                                                       */
/* ------------------------------------------------------------------ */

async function assertEditable(repos: Repos, spinnerId: string) {
  const s = await repos.spinners.getById(spinnerId, "Spinner");
  if (s.status === "archived") throw badRequest("Archived spinners cannot be edited");
  return s;
}

export async function createOffer(spinnerId: string, input: OfferInput): Promise<Offer> {
  return withRepos(async (repos) => {
    await assertEditable(repos, spinnerId);
    const existing = await repos.offers.forSpinner(spinnerId);
    if (existing.length >= 16) throw badRequest("A wheel can have at most 16 segments");
    const ts = nowIso();
    const offer: Offer = {
      id: newId("offer"),
      spinnerId,
      name: input.name,
      description: input.description ?? "",
      type: input.type,
      image: input.image || null,
      color: input.color,
      weight: input.weight,
      maxWinners: input.maxWinners,
      remainingQuantity: input.maxWinners,
      isWinning: input.isWinning,
      active: input.active,
      order: existing.length ? Math.max(...existing.map((o) => o.order)) + 1 : 0,
      createdAt: ts,
      updatedAt: ts,
    };
    if ((offer.type === "image" || offer.type === "both") && !offer.image) {
      throw badRequest("Upload an image for image offers, or choose the Text type");
    }
    return repos.offers.insert(offer);
  });
}

export async function updateOffer(spinnerId: string, offerId: string, input: OfferInput): Promise<Offer> {
  return withRepos(async (repos) => {
    await assertEditable(repos, spinnerId);
    const offer = await repos.offers.getById(offerId, "Offer");
    if (offer.spinnerId !== spinnerId) throw badRequest("Offer does not belong to this spinner");
    const results = await repos.results.where((r) => r.offerId === offerId);
    const awarded = results.filter((r) => r.status !== "lost").length;
    if (input.maxWinners !== null && input.maxWinners < awarded) {
      throw badRequest(`Already awarded ${awarded} times; max winners cannot be lower than that`);
    }
    const image = input.image || null;
    if ((input.type === "image" || input.type === "both") && !image) {
      throw badRequest("Upload an image for image offers, or choose the Text type");
    }
    return repos.offers.update(offerId, {
      name: input.name,
      description: input.description ?? "",
      type: input.type,
      image,
      color: input.color,
      weight: input.weight,
      maxWinners: input.maxWinners,
      remainingQuantity: input.maxWinners === null ? null : input.maxWinners - awarded,
      isWinning: input.isWinning,
      active: input.active,
      updatedAt: nowIso(),
    });
  });
}

export async function deleteOffer(spinnerId: string, offerId: string): Promise<void> {
  await withRepos(async (repos) => {
    await assertEditable(repos, spinnerId);
    const offer = await repos.offers.getById(offerId, "Offer");
    if (offer.spinnerId !== spinnerId) throw badRequest("Offer does not belong to this spinner");
    const used = await repos.results.where((r) => r.offerId === offerId);
    if (used.length > 0) {
      throw new AppError(409, "OFFER_IN_USE", "This offer has already been won. Deactivate it instead of deleting.");
    }
    await repos.offers.delete(offerId);
  });
}

export async function reorderOffers(spinnerId: string, orderedIds: string[]): Promise<Offer[]> {
  return withRepos(async (repos) => {
    await assertEditable(repos, spinnerId);
    const offers = await repos.offers.forSpinner(spinnerId);
    const ids = new Set(offers.map((o) => o.id));
    if (orderedIds.length !== ids.size || !orderedIds.every((id) => ids.has(id))) {
      throw badRequest("Order must contain every offer of this spinner exactly once");
    }
    const all = await repos.offers.all();
    const ts = nowIso();
    for (const o of all) {
      const idx = orderedIds.indexOf(o.id);
      if (idx >= 0) {
        o.order = idx;
        o.updatedAt = ts;
      }
    }
    await repos.offers.replaceAll(all);
    return all.filter((o) => o.spinnerId === spinnerId).sort((a, b) => a.order - b.order);
  });
}
