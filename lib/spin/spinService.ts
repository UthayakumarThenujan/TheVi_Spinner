import { withRepos, readRepos, type Repos } from "@/lib/database/repositories";
import { computeAvailability, toSegments, defaultSpinnerSettings } from "@/lib/services/spinnerService";
import { normalizeSriLankanMobile } from "@/lib/validation/phone";
import { weightedPick } from "./weightedSelection";
import { AppError, badRequest, UniqueConstraintError } from "@/lib/utils/errors";
import { newId, newResultCode, newToken, nowIso, sha256 } from "@/lib/utils/ids";
import { logger } from "@/lib/utils/logger";
import type { Participant } from "@/types/user";
import type { Spinner } from "@/types/spinner";
import type { SpinResult } from "@/types/result";

export const ALREADY_PARTICIPATED_MESSAGE =
  "You have already participated in this Lucky Spin. Each participant is allowed only one spin.";

const AVAILABILITY_ERRORS = {
  paused: new AppError(423, "PAUSED", "Participation is paused right now. Please check back soon."),
  not_started: new AppError(403, "NOT_STARTED", "This Lucky Spin has not started yet."),
  ended: new AppError(403, "ENDED", "This Lucky Spin has ended."),
  full: new AppError(409, "FULL", "All spin slots have been taken for this Lucky Spin."),
} as const;

async function requireActiveSpinner(repos: Repos, spinnerId: string): Promise<Spinner> {
  const spinner = await repos.spinners.findById(spinnerId);
  if (!spinner || spinner.status !== "active") {
    throw new AppError(404, "SPINNER_NOT_ACTIVE", "This Lucky Spin is no longer active. Please refresh the page.");
  }
  return spinner;
}

export interface RegisterInput {
  spinnerId: string;
  name: string;
  mobile: string;
  whatsappConfirmed: boolean;
}

export interface RegisterOutcome {
  participant: Participant;
  /** Raw participant token — returned once, stored only as a hash. */
  token: string;
  resumed: boolean;
}

/**
 * Register a participant for a spinner.
 * Enforces: valid mobile, active spinner, open availability, slot limit,
 * and the (spinnerId, mobile) unique constraint.
 */
export async function registerParticipant(input: RegisterInput): Promise<RegisterOutcome> {
  const mobile = normalizeSriLankanMobile(input.mobile);
  if (!mobile) {
    throw badRequest("Please enter a valid Sri Lankan mobile number (e.g. 077 123 4567)", { field: "mobile" });
  }

  return withRepos(async (repos) => {
    const spinner = await requireActiveSpinner(repos, input.spinnerId);
    const settings = { ...defaultSpinnerSettings(), ...spinner.settings };
    if (settings.showWhatsappConfirmation && settings.requireWhatsappConfirmation && !input.whatsappConfirmed) {
      throw badRequest("Please confirm that you have joined our WhatsApp Announcement Group", { field: "whatsappConfirmed" });
    }

    const existing = await repos.users.findByMobile(spinner.id, mobile);
    if (existing) {
      if (existing.status === "spun" || (await repos.results.findForUser(spinner.id, existing.id))) {
        throw new AppError(409, "ALREADY_PARTICIPATED", ALREADY_PARTICIPATED_MESSAGE);
      }
      // Registered but never spun (e.g. closed the tab): issue a fresh token so the
      // same person can continue. Still exactly one result possible for this number.
      const availability = computeAvailability(spinner, 0);
      if (availability !== "open") throw AVAILABILITY_ERRORS[availability as keyof typeof AVAILABILITY_ERRORS];
      const token = newToken();
      const participant = await repos.users.update(existing.id, { tokenHash: sha256(token), updatedAt: nowIso() });
      logger.info("participant.resumed", { spinnerId: spinner.id, userId: existing.id });
      return { participant, token, resumed: true };
    }

    const count = await repos.users.countForSpinner(spinner.id);
    const availability = computeAvailability(spinner, count);
    if (availability !== "open") throw AVAILABILITY_ERRORS[availability];

    const token = newToken();
    const ts = nowIso();
    const participant: Participant = {
      id: newId("user"),
      name: input.name.replace(/\s+/g, " ").trim(),
      mobile,
      spinnerId: spinner.id,
      whatsappConfirmed: Boolean(input.whatsappConfirmed),
      status: "registered",
      tokenHash: sha256(token),
      verified: false,
      registeredAt: ts,
      updatedAt: ts,
    };
    try {
      await repos.users.insert(participant);
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        throw new AppError(409, "ALREADY_PARTICIPATED", ALREADY_PARTICIPATED_MESSAGE);
      }
      throw err;
    }
    logger.info("participant.registered", { spinnerId: spinner.id, userId: participant.id });
    return { participant, token, resumed: false };
  });
}

export interface SpinOutcome {
  result: SpinResult;
  offerDescription: string;
  segmentIndex: number;
  participantName: string;
  spinnerTitle: string;
  /** true when this request did not create the result (double click / second tab). */
  replay: boolean;
}

/**
 * Execute the spin. The server picks the offer (CSPRNG, weights, remaining quantities),
 * persists the immutable result, and only then returns it for the wheel to animate to.
 */
export async function executeSpin(spinnerId: string, token: string | undefined): Promise<SpinOutcome> {
  if (!token) throw new AppError(401, "NOT_REGISTERED", "Please register before spinning.");
  const tokenHash = sha256(token);

  return withRepos(async (repos) => {
    const participant = await repos.users.findByTokenHash(tokenHash);
    if (!participant || participant.spinnerId !== spinnerId) {
      throw new AppError(401, "NOT_REGISTERED", "Please register before spinning.");
    }
    const spinner = await requireActiveSpinner(repos, spinnerId);
    const settings = { ...defaultSpinnerSettings(), ...spinner.settings };
    const allOffers = await repos.offers.forSpinner(spinnerId);
    const segments = toSegments(allOffers, settings);

    // Re-check: one immutable result per participant per spinner.
    const prior = await repos.results.findForUser(spinnerId, participant.id);
    if (prior) {
      return {
        result: prior,
        offerDescription: allOffers.find((o) => o.id === prior.offerId)?.description ?? "",
        segmentIndex: segments.findIndex((s) => s.id === prior.offerId),
        participantName: participant.name,
        spinnerTitle: spinner.title,
        replay: true,
      };
    }
    // Defence in depth: any other registration with this mobile that already spun.
    const sameMobile = await repos.users.where(
      (u) => u.spinnerId === spinnerId && u.mobile === participant.mobile && u.id !== participant.id,
    );
    if (sameMobile.length) throw new AppError(409, "ALREADY_PARTICIPATED", ALREADY_PARTICIPATED_MESSAGE);

    // Availability (except "full": this participant already owns a slot, see rank check).
    const availability = computeAvailability(spinner, 0);
    if (availability !== "open") throw AVAILABILITY_ERRORS[availability as keyof typeof AVAILABILITY_ERRORS];

    // Slot check: participant must be within the first `maxParticipants` registrations.
    const registrations = (await repos.users.where((u) => u.spinnerId === spinnerId)).sort((a, b) =>
      a.registeredAt === b.registeredAt ? a.id.localeCompare(b.id) : a.registeredAt.localeCompare(b.registeredAt),
    );
    const rank = registrations.findIndex((u) => u.id === participant.id);
    if (rank < 0 || rank >= spinner.maxParticipants) throw AVAILABILITY_ERRORS.full;
    const spinsDone = (await repos.results.where((r) => r.spinnerId === spinnerId)).length;
    if (spinsDone >= spinner.maxParticipants) throw AVAILABILITY_ERRORS.full;

    const eligible = allOffers.filter(
      (o) => o.active && o.weight > 0 && (o.remainingQuantity === null || o.remainingQuantity > 0),
    );
    const offer = weightedPick(eligible);
    if (!offer) {
      logger.warn("spin.no_eligible_offers", { spinnerId });
      throw new AppError(409, "NO_OFFERS", "All offers for this Lucky Spin have been claimed. Please check back later.");
    }

    if (offer.remainingQuantity !== null) {
      await repos.offers.update(offer.id, { remainingQuantity: offer.remainingQuantity - 1, updatedAt: nowIso() });
    }

    const ts = nowIso();
    const result: SpinResult = {
      id: newId("result"),
      code: newResultCode(),
      userId: participant.id,
      spinnerId,
      offerId: offer.id,
      offerName: offer.name,
      offerImage: offer.image,
      status: offer.isWinning ? "won" : "lost",
      spunAt: ts,
      redeemedAt: null,
    };
    // Unique constraint (spinnerId, userId) enforced in the repository.
    await repos.results.insert(result);
    await repos.users.update(participant.id, { status: "spun", updatedAt: ts });

    logger.info("spin.completed", { spinnerId, userId: participant.id, resultId: result.id, offerId: offer.id, status: result.status });
    return {
      result,
      offerDescription: offer.description,
      segmentIndex: segments.findIndex((s) => s.id === offer.id),
      participantName: participant.name,
      spinnerTitle: spinner.title,
      replay: false,
    };
  });
}

/** Participation status for the token holder (cookie) — used to restore state across tabs/reloads. */
export async function checkParticipation(spinnerId: string, token: string | undefined) {
  const repos = readRepos();
  if (!token) return { registered: false, spun: false } as const;
  const participant = await repos.users.findByTokenHash(sha256(token));
  if (!participant || participant.spinnerId !== spinnerId) return { registered: false, spun: false } as const;
  const result = await repos.results.findForUser(spinnerId, participant.id);
  const spinner = await repos.spinners.findById(spinnerId);
  const offer = result ? await repos.offers.findById(result.offerId) : null;
  return {
    registered: true,
    spun: Boolean(result),
    participantName: participant.name,
    result: result
      ? {
          result,
          offerDescription: offer?.description ?? "",
          participantName: participant.name,
          spinnerTitle: spinner?.title ?? "",
        }
      : null,
  };
}

/** Check by mobile number — returns only a boolean, never personal data. */
export async function hasMobileParticipated(spinnerId: string, mobileInput: string): Promise<boolean> {
  const mobile = normalizeSriLankanMobile(mobileInput);
  if (!mobile) throw badRequest("Invalid mobile number");
  const repos = readRepos();
  const user = await repos.users.findByMobile(spinnerId, mobile);
  if (!user) return false;
  return Boolean(await repos.results.findForUser(spinnerId, user.id));
}
