import { z } from "zod";

const hexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color like #FF6B81");
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
  .nullable()
  .optional();
/** Only our own upload URLs (or empty) may be referenced. */
const uploadUrl = z
  .string()
  .regex(/^\/uploads\/[A-Za-z0-9_\-]+\.(png|jpe?g|webp|gif|mp3|wav|ogg)$/, "Invalid upload reference")
  .or(z.literal(""))
  .nullable()
  .optional();

export const registerSchema = z.object({
  spinnerId: z.string().min(1).max(64),
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(80, "Name is too long")
    // Letters/marks in any script (Sinhala, Tamil, English…) incl. ZWJ/ZWNJ used in Sinhala conjuncts.
    .regex(/^[\p{L}\p{M}][\p{L}\p{M}‌‍ .'\-]*$/u, "Please use letters only in your name"),
  mobile: z.string().trim().min(9, "Please enter your mobile number").max(20),
  whatsappConfirmed: z.boolean().optional().default(false),
});

export const spinSchema = z.object({ spinnerId: z.string().min(1).max(64) });

export const spinnerSettingsSchema = z.object({
  soundEnabled: z.boolean(),
  spinSound: z.boolean(),
  winSound: z.boolean(),
  backgroundMusic: z.boolean(),
  spinSoundUrl: uploadUrl,
  winSoundUrl: uploadUrl,
  backgroundMusicUrl: uploadUrl,
  animationDuration: z.number().int().min(2000).max(15000),
  confettiEnabled: z.boolean(),
  pointerStyle: z.enum(["classic", "arrow", "pin"]),
  wheelColors: z.array(hexColor).min(2).max(12),
  wheelBorderColor: hexColor,
  wheelCenterColor: hexColor,
  showWhatsappConfirmation: z.boolean(),
  requireWhatsappConfirmation: z.boolean(),
  whatsappGroupUrl: z.string().trim().url().or(z.literal("")).optional(),
  redeemInstructions: z.string().trim().max(500),
});

export const spinnerInputSchema = z
  .object({
    title: z.string().trim().min(3, "Title is required").max(100),
    description: z.string().trim().max(500).default(""),
    maxParticipants: z.number().int().min(1).max(100000),
    startDate: isoDate,
    endDate: isoDate,
    settings: spinnerSettingsSchema.partial().optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || Date.parse(v.startDate) < Date.parse(v.endDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export const offerInputSchema = z.object({
  name: z.string().trim().min(1, "Offer name is required").max(60),
  description: z.string().trim().max(300).default(""),
  type: z.enum(["image", "text", "both"]),
  image: uploadUrl,
  color: hexColor,
  weight: z.number().min(0).max(1_000_000),
  maxWinners: z.number().int().min(0).max(1_000_000).nullable(),
  isWinning: z.boolean().default(true),
  active: z.boolean().default(true),
});

export const appSettingsSchema = z.object({
  brandName: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(120),
  logoUrl: uploadUrl,
  welcomeTitle: z.string().trim().max(120),
  welcomeMessage: z.string().trim().max(400),
  ctaLabel: z.string().trim().min(1).max(30),
  publicUrl: z.string().trim().url().or(z.literal("")),
  whatsappGroupUrl: z.string().trim().url().or(z.literal("")),
  rules: z.array(z.string().trim().min(1).max(200)).max(15),
  comingSoonMessage: z.string().trim().max(200),
  defaultMaxParticipants: z.number().int().min(1).max(100000),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10, "Use at least 10 characters").max(200),
});
