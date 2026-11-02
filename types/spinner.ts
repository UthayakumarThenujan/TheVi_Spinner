export type SpinnerStatus = "draft" | "active" | "completed" | "archived";

export type PointerStyle = "classic" | "arrow" | "pin";

export interface SpinnerSettings {
  /** Master sound toggle. When false no sound plays regardless of the individual toggles. */
  soundEnabled: boolean;
  spinSound: boolean;
  winSound: boolean;
  backgroundMusic: boolean;
  /** Optional uploaded audio files. When empty, built-in synthesized sounds are used. */
  spinSoundUrl?: string;
  winSoundUrl?: string;
  backgroundMusicUrl?: string;
  /** Wheel spin duration in milliseconds. */
  animationDuration: number;
  confettiEnabled: boolean;
  pointerStyle: PointerStyle;
  /** Palette used for segments without their own color. */
  wheelColors: string[];
  wheelBorderColor: string;
  wheelCenterColor: string;
  /** Registration form */
  showWhatsappConfirmation: boolean;
  requireWhatsappConfirmation: boolean;
  whatsappGroupUrl?: string;
  /** Message shown with the result explaining how to redeem. */
  redeemInstructions: string;
}

export interface Spinner {
  id: string;
  title: string;
  description: string;
  status: SpinnerStatus;
  /** Participation can be paused instantly without unpublishing. */
  paused: boolean;
  maxParticipants: number;
  startDate: string | null;
  endDate: string | null;
  settings: SpinnerSettings;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Shape exposed to the public site. Contains no participant data. */
export interface PublicSpinner {
  id: string;
  title: string;
  description: string;
  maxParticipants: number;
  participantCount: number;
  remainingSlots: number;
  startDate: string | null;
  endDate: string | null;
  paused: boolean;
  /** open | full | paused | not_started | ended */
  availability: SpinnerAvailability;
  settings: SpinnerSettings;
  segments: PublicSegment[];
}

export type SpinnerAvailability = "open" | "full" | "paused" | "not_started" | "ended";

export interface PublicSegment {
  id: string;
  name: string;
  description: string;
  type: "image" | "text" | "both";
  image: string | null;
  color: string;
}
