import type { Store, CollectionName } from "./jsonDatabase";
import { db } from "./jsonDatabase";
import { UniqueConstraintError, notFound } from "@/lib/utils/errors";
import type { Spinner } from "@/types/spinner";
import type { Offer } from "@/types/offer";
import type { Participant, AdminUser } from "@/types/user";
import type { SpinResult, AppSettings } from "@/types/result";

/**
 * Repository layer. Services receive a `Repos` bundle bound to either a read
 * snapshot or a write transaction. To migrate to PostgreSQL, implement the same
 * method signatures over a SQL transaction and swap `withRepos`/`readRepos`.
 */

class CollectionRepo<T extends { id: string }> {
  constructor(
    protected store: Store,
    protected name: CollectionName,
  ) {}

  async all(): Promise<T[]> {
    return this.store.read<T[]>(this.name);
  }

  async findById(id: string): Promise<T | null> {
    return (await this.all()).find((r) => r.id === id) ?? null;
  }

  async getById(id: string, label = "Record"): Promise<T> {
    const r = await this.findById(id);
    if (!r) throw notFound(label);
    return r;
  }

  async where(pred: (r: T) => boolean): Promise<T[]> {
    return (await this.all()).filter(pred);
  }

  protected async checkUnique(_record: T, _rows: T[]): Promise<void> {}

  async insert(record: T): Promise<T> {
    const rows = await this.all();
    if (rows.some((r) => r.id === record.id)) throw new UniqueConstraintError(`${this.name}.id`);
    await this.checkUnique(record, rows);
    rows.push(record);
    this.store.write(this.name, rows);
    return record;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const rows = await this.all();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw notFound();
    const next = { ...rows[idx], ...patch, id } as T;
    await this.checkUnique(next, rows.filter((_, i) => i !== idx));
    rows[idx] = next;
    this.store.write(this.name, rows);
    return next;
  }

  async replaceAll(rows: T[]): Promise<void> {
    this.store.write(this.name, rows);
  }

  async delete(id: string): Promise<void> {
    const rows = await this.all();
    this.store.write(
      this.name,
      rows.filter((r) => r.id !== id),
    );
  }

  async deleteWhere(pred: (r: T) => boolean): Promise<void> {
    const rows = await this.all();
    this.store.write(
      this.name,
      rows.filter((r) => !pred(r)),
    );
  }
}

export class SpinnerRepository extends CollectionRepo<Spinner> {
  constructor(store: Store) {
    super(store, "spinners");
  }
  async findActive(): Promise<Spinner | null> {
    return (await this.all()).find((s) => s.status === "active") ?? null;
  }
  /** Unique: at most one active spinner. */
  protected async checkUnique(record: Spinner, rows: Spinner[]) {
    if (record.status === "active" && rows.some((r) => r.status === "active" && r.id !== record.id)) {
      throw new UniqueConstraintError("spinners.single_active", "Another spinner is already active");
    }
  }
}

export class OfferRepository extends CollectionRepo<Offer> {
  constructor(store: Store) {
    super(store, "offers");
  }
  async forSpinner(spinnerId: string): Promise<Offer[]> {
    return (await this.where((o) => o.spinnerId === spinnerId)).sort((a, b) => a.order - b.order);
  }
}

export class UserRepository extends CollectionRepo<Participant> {
  constructor(store: Store) {
    super(store, "users");
  }
  async findByMobile(spinnerId: string, mobile: string): Promise<Participant | null> {
    return (await this.all()).find((u) => u.spinnerId === spinnerId && u.mobile === mobile) ?? null;
  }
  async findByTokenHash(tokenHash: string): Promise<Participant | null> {
    return (await this.all()).find((u) => u.tokenHash === tokenHash) ?? null;
  }
  async countForSpinner(spinnerId: string): Promise<number> {
    return (await this.where((u) => u.spinnerId === spinnerId)).length;
  }
  /** Unique: (spinnerId, mobile) */
  protected async checkUnique(record: Participant, rows: Participant[]) {
    if (rows.some((r) => r.spinnerId === record.spinnerId && r.mobile === record.mobile)) {
      throw new UniqueConstraintError(
        "users.spinner_mobile",
        "This mobile number has already been registered for this spin",
      );
    }
  }
}

export class ResultRepository extends CollectionRepo<SpinResult> {
  constructor(store: Store) {
    super(store, "spin_results");
  }
  async findForUser(spinnerId: string, userId: string): Promise<SpinResult | null> {
    return (await this.all()).find((r) => r.spinnerId === spinnerId && r.userId === userId) ?? null;
  }
  /** Unique: (spinnerId, userId) and code */
  protected async checkUnique(record: SpinResult, rows: SpinResult[]) {
    if (rows.some((r) => r.spinnerId === record.spinnerId && r.userId === record.userId)) {
      throw new UniqueConstraintError("spin_results.spinner_user", "This participant has already spun");
    }
    if (rows.some((r) => r.code === record.code)) {
      throw new UniqueConstraintError("spin_results.code");
    }
  }
}

export class AdminRepository extends CollectionRepo<AdminUser> {
  constructor(store: Store) {
    super(store, "admin");
  }
  async findByUsername(username: string): Promise<AdminUser | null> {
    const u = username.trim().toLowerCase();
    return (await this.all()).find((a) => a.username.toLowerCase() === u) ?? null;
  }
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
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
    "Only the first participants up to the slot limit can spin.",
    "Winning results are generated securely and cannot be changed.",
    "Show your Result ID to redeem your offer.",
  ],
  comingSoonMessage: "Stay tuned! A new lucky spin is coming soon.",
  defaultMaxParticipants: 10,
  updatedAt: new Date(0).toISOString(),
};

export class SettingsRepository {
  constructor(private store: Store) {}
  async get(): Promise<AppSettings> {
    const raw = await this.store.read<Partial<AppSettings>>("settings");
    return { ...DEFAULT_APP_SETTINGS, ...raw };
  }
  async save(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = { ...(await this.get()), ...patch, updatedAt: new Date().toISOString() };
    this.store.write("settings", next);
    return next;
  }
}

export interface Repos {
  spinners: SpinnerRepository;
  offers: OfferRepository;
  users: UserRepository;
  results: ResultRepository;
  admins: AdminRepository;
  settings: SettingsRepository;
}

function bind(store: Store): Repos {
  return {
    spinners: new SpinnerRepository(store),
    offers: new OfferRepository(store),
    users: new UserRepository(store),
    results: new ResultRepository(store),
    admins: new AdminRepository(store),
    settings: new SettingsRepository(store),
  };
}

/** Serialized read-write unit of work. Throwing rolls back every change. */
export function withRepos<R>(fn: (repos: Repos) => Promise<R>): Promise<R> {
  return db.transaction((store) => fn(bind(store)));
}

/** Lock-free read snapshot. Never use for read-modify-write. */
export function readRepos(): Repos {
  return bind(db.readStore);
}
