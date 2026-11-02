export type OfferType = "image" | "text" | "both";

export interface Offer {
  id: string;
  spinnerId: string;
  name: string;
  description: string;
  type: OfferType;
  image: string | null;
  color: string;
  /** Relative weight used by the weighted random selection (>= 0). */
  weight: number;
  /** null = unlimited */
  maxWinners: number | null;
  /** null = unlimited. Decremented atomically on every win. */
  remainingQuantity: number | null;
  /** When false this segment is a "Better luck next time" style slot: landing on it is recorded as "lost". */
  isWinning: boolean;
  active: boolean;
  /** Segment order on the wheel (ascending). */
  order: number;
  createdAt: string;
  updatedAt: string;
}
