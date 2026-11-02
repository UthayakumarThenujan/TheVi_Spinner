#!/usr/bin/env node
/**
 * Generate demo data.
 *
 *   npm run seed                 -> resets runtime data in DATA_DIR (default ./data); keeps admin.json
 *   node scripts/seed.mjs --out data/seed   -> regenerates the committed seed files
 *
 * When a runtime JSON file is missing, the app auto-copies it from data/seed/.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = path.resolve(outIdx >= 0 ? args[outIdx + 1] : process.env.DATA_DIR || "./data");

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const H = 3600_000;
const D = 24 * H;
const rid = (p) => `${p}_${crypto.randomBytes(6).toString("hex")}`;
const code = () => {
  const A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const part = () => Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join("");
  return `TVS-${part()}-${part()}`;
};

const baseSettings = {
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
  wheelColors: ["#FF6B81", "#FFA94D", "#FFD43B", "#69DB7C", "#4DABF7", "#9775FA", "#F783AC", "#38D9A9"],
  wheelBorderColor: "#FFFFFF",
  wheelCenterColor: "#1F1147",
  showWhatsappConfirmation: true,
  requireWhatsappConfirmation: false,
  whatsappGroupUrl: "",
  redeemInstructions: "Show this screen and your Result ID at our store, or send it to us on WhatsApp to redeem your offer.",
};

const active = {
  id: "spin_demo_active",
  title: "November Lucky Spin",
  description: "Spin the wheel and win exclusive offers from Thevi Spinner! Only 10 lucky spins today.",
  status: "active",
  paused: false,
  maxParticipants: 10,
  startDate: null,
  endDate: null,
  settings: baseSettings,
  publishedAt: iso(2 * H),
  createdAt: iso(3 * H),
  updatedAt: iso(2 * H),
};
const past = {
  id: "spin_demo_past",
  title: "October Festive Spin",
  description: "Our Deepavali special spin.",
  status: "completed",
  paused: false,
  maxParticipants: 10,
  startDate: iso(4 * D),
  endDate: iso(3 * D),
  settings: baseSettings,
  publishedAt: iso(4 * D),
  createdAt: iso(5 * D),
  updatedAt: iso(3 * D),
};

const mkOffer = (spinnerId, order, name, color, weight, maxWinners, extra = {}) => ({
  id: `offer_${spinnerId.replace("spin_", "")}_${order}`,
  spinnerId,
  name,
  description: extra.description ?? "",
  type: "text",
  image: null,
  color,
  weight,
  maxWinners,
  remainingQuantity: maxWinners,
  isWinning: extra.isWinning ?? true,
  active: true,
  order,
  createdAt: iso(3 * H),
  updatedAt: iso(3 * H),
});

const offers = [
  mkOffer(active.id, 0, "Rs. 200 OFF", "#FF6B81", 30, 5, { description: "Rs. 200 off on purchases above Rs. 1500." }),
  mkOffer(active.id, 1, "Free Delivery", "#FFA94D", 25, null, { description: "Free island-wide delivery on your next order." }),
  mkOffer(active.id, 2, "10% OFF", "#FFD43B", 20, 4, { description: "10% off your next order." }),
  mkOffer(active.id, 3, "Free Gift", "#69DB7C", 8, 2, { description: "A surprise gift with your next order." }),
  mkOffer(active.id, 4, "Rs. 500 OFF", "#4DABF7", 4, 1, { description: "Rs. 500 off on purchases above Rs. 3000." }),
  mkOffer(active.id, 5, "Better Luck", "#9775FA", 13, null, { isWinning: false, description: "Not this time — try the next Lucky Spin!" }),
  mkOffer(past.id, 0, "Rs. 100 OFF", "#FF6B81", 40, null),
  mkOffer(past.id, 1, "Free Sweets Box", "#FFD43B", 20, 3),
  mkOffer(past.id, 2, "15% OFF", "#4DABF7", 20, 3),
  mkOffer(past.id, 3, "Try Again", "#9775FA", 20, null, { isWinning: false }),
];

const names = ["Kavindu Perera", "Nimasha Silva", "Tharindu Fernando", "Dilini Jayasuriya", "Arjun Rajan", "Fathima Rizna", "Sajith Kumara", "Harini Selvam"];
const users = [];
const results = [];
const pastOffers = offers.filter((o) => o.spinnerId === past.id);
names.forEach((name, i) => {
  const regAt = iso(4 * D - i * 40 * 60_000);
  const spunAt = iso(4 * D - i * 40 * 60_000 - 60_000);
  const user = {
    id: rid("user"),
    name,
    mobile: `+9477${String(1000000 + i * 1371).padStart(7, "0")}`,
    spinnerId: past.id,
    whatsappConfirmed: true,
    status: "spun",
    tokenHash: crypto.createHash("sha256").update(crypto.randomBytes(16)).digest("hex"),
    verified: false,
    registeredAt: regAt,
    updatedAt: spunAt,
  };
  users.push(user);
  const offer = pastOffers[i % pastOffers.length];
  if (offer.remainingQuantity !== null) offer.remainingQuantity--;
  results.push({
    id: rid("result"),
    code: code(),
    userId: user.id,
    spinnerId: past.id,
    offerId: offer.id,
    offerName: offer.name,
    offerImage: null,
    status: offer.isWinning ? (i < 2 ? "redeemed" : "won") : "lost",
    spunAt,
    redeemedAt: offer.isWinning && i < 2 ? iso(3 * D) : null,
  });
});

const settings = {
  brandName: "Thevi Spinner",
  tagline: "Spin. Win. Smile.",
  logoUrl: null,
  welcomeTitle: "Welcome to Our Lucky Spin!",
  welcomeMessage: "Join our WhatsApp announcement group and get a chance to win exclusive offers!",
  ctaLabel: "TRY YOUR LUCK",
  publicUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  whatsappGroupUrl: "",
  rules: [
    "One spin per mobile number for each Lucky Spin campaign.",
    "Only the first 10 participants can spin.",
    "Winning results are generated securely and cannot be changed.",
    "Show your Result ID to redeem your offer within 7 days.",
  ],
  comingSoonMessage: "Stay tuned! A new lucky spin is coming soon.",
  defaultMaxParticipants: 10,
  updatedAt: iso(0),
};

await fs.mkdir(outDir, { recursive: true });
const write = (name, data) => fs.writeFile(path.join(outDir, `${name}.json`), JSON.stringify(data, null, 2));
await write("spinners", [past, active]);
await write("offers", offers);
await write("users", users);
await write("spin_results", results);
await write("settings", settings);
try {
  await fs.access(path.join(outDir, "admin.json"));
} catch {
  await write("admin", []);
}
console.log(`Demo data written to ${outDir}`);
