export type ResultStatus = "won" | "lost" | "redeemed";

/** Immutable spin outcome (only `status`/`redeemedAt` change when an admin marks it redeemed). */
export interface SpinResult {
  id: string;
  /** Short human friendly code shown to the winner, e.g. TVS-7K2Q-9MXA */
  code: string;
  userId: string;
  spinnerId: string;
  offerId: string;
  offerName: string;
  offerImage: string | null;
  status: ResultStatus;
  spunAt: string;
  redeemedAt?: string | null;
}

export interface AppSettings {
  brandName: string;
  tagline: string;
  logoUrl: string | null;
  welcomeTitle: string;
  welcomeMessage: string;
  ctaLabel: string;
  publicUrl: string;
  whatsappGroupUrl: string;
  rules: string[];
  comingSoonMessage: string;
  defaultMaxParticipants: number;
  updatedAt: string;
}
