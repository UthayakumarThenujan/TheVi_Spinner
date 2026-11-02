export type RegistrationStatus = "registered" | "spun";

/** A participant registration. One record per (mobile, spinnerId). */
export interface Participant {
  id: string;
  name: string;
  /** Normalized E.164 number, e.g. +94771234567 */
  mobile: string;
  spinnerId: string;
  whatsappConfirmed: boolean;
  status: RegistrationStatus;
  /** SHA-256 of the participant token issued at registration. The raw token is never stored. */
  tokenHash: string;
  /** Reserved for future OTP verification. */
  verified: boolean;
  registeredAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  /** scrypt$<salt>$<hash> */
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}
