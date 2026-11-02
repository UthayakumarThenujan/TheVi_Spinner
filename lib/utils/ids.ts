import crypto from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I confusion

function randomChars(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

/** Unique, sortable-ish record id: <prefix>_<time36><random> */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(5).toString("hex")}`;
}

/** Human friendly winning code, e.g. TVS-7K2Q-9MXA */
export function newResultCode(): string {
  return `TVS-${randomChars(4)}-${randomChars(4)}`;
}

export function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}
