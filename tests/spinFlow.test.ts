import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * End-to-end service tests against a real (temporary) JSON database:
 * concurrency, one-person-one-spin, slot limits, quantities.
 */
const root = await fs.mkdtemp(path.join(os.tmpdir(), "tvs-test-"));
process.env.DISABLE_SEED = "1";

const { createSpinner, createOffer, publishSpinner, changeSpinnerState, deleteSpinner } = await import("@/lib/services/spinnerService");
const { registerParticipant, executeSpin, checkParticipation } = await import("@/lib/spin/spinService");
const { readRepos, withRepos } = await import("@/lib/database/repositories");
const { AppError } = await import("@/lib/utils/errors");

let n = 0;
beforeEach(async () => {
  process.env.DATA_DIR = path.join(root, `db${++n}`);
});
afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const baseOffer = { description: "", type: "text" as const, image: null, color: "#FF6B81", isWinning: true, active: true };

async function setup(max = 10, offers?: { name: string; weight: number; maxWinners: number | null; isWinning?: boolean }[]) {
  const spinner = await createSpinner({ title: "Test Spin", description: "", maxParticipants: max });
  for (const o of offers ?? [
    { name: "A", weight: 50, maxWinners: null },
    { name: "B", weight: 50, maxWinners: null },
  ]) {
    await createOffer(spinner.id, { ...baseOffer, ...o, isWinning: o.isWinning ?? true });
  }
  await publishSpinner(spinner.id);
  return spinner;
}

const mobile = (i: number) => `07${[0, 1, 2, 4, 5, 6, 7, 8][i % 8]}${String(1000000 + i).slice(-7)}`;

async function code(p: Promise<unknown>) {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof AppError ? e.code : String(e);
  }
}

describe("registration", () => {
  it("rejects invalid mobile numbers and duplicate mobiles (in any format)", async () => {
    const s = await setup();
    expect(await code(registerParticipant({ spinnerId: s.id, name: "X Y", mobile: "12345", whatsappConfirmed: false }))).toBe("BAD_REQUEST");

    const first = await registerParticipant({ spinnerId: s.id, name: "Kamal", mobile: "0771234567", whatsappConfirmed: true });
    expect(first.participant.mobile).toBe("+94771234567");
    await executeSpin(s.id, first.token);
    // Same number, different format / device -> rejected
    expect(await code(registerParticipant({ spinnerId: s.id, name: "Kamal 2", mobile: "+94 77 123 4567", whatsappConfirmed: true }))).toBe(
      "ALREADY_PARTICIPATED",
    );
  });

  it("enforces the participant limit under concurrent registrations", async () => {
    const s = await setup(10);
    const outcomes = await Promise.all(
      Array.from({ length: 25 }, (_, i) => code(registerParticipant({ spinnerId: s.id, name: `User ${i}`, mobile: mobile(i), whatsappConfirmed: false }))),
    );
    expect(outcomes.filter((o) => o === "OK")).toHaveLength(10);
    expect(outcomes.filter((o) => o === "FULL")).toHaveLength(15);
    expect(await readRepos().users.countForSpinner(s.id)).toBe(10);
  });

  it("allows the same mobile in a new spinner and keeps old results", async () => {
    const s1 = await setup();
    const r1 = await registerParticipant({ spinnerId: s1.id, name: "Nimal", mobile: "0711111111", whatsappConfirmed: false });
    await executeSpin(s1.id, r1.token);

    const s2 = await setup();
    const r2 = await registerParticipant({ spinnerId: s2.id, name: "Nimal", mobile: "0711111111", whatsappConfirmed: false });
    await executeSpin(s2.id, r2.token);

    const repos = readRepos();
    expect((await repos.spinners.findById(s1.id))?.status).toBe("completed");
    expect(await repos.results.where((r) => r.spinnerId === s1.id)).toHaveLength(1);
    expect(await repos.results.where((r) => r.spinnerId === s2.id)).toHaveLength(1);
    // Old spinner no longer accepts spins
    expect(await code(registerParticipant({ spinnerId: s1.id, name: "Late", mobile: "0712222222", whatsappConfirmed: false }))).toBe("SPINNER_NOT_ACTIVE");
  });

  it("requires WhatsApp confirmation when configured", async () => {
    const s = await createSpinner({
      title: "WA",
      description: "",
      maxParticipants: 5,
      settings: { showWhatsappConfirmation: true, requireWhatsappConfirmation: true },
    });
    await createOffer(s.id, { ...baseOffer, name: "A", weight: 1, maxWinners: null });
    await createOffer(s.id, { ...baseOffer, name: "B", weight: 1, maxWinners: null });
    await publishSpinner(s.id);
    expect(await code(registerParticipant({ spinnerId: s.id, name: "No WA", mobile: "0751234567", whatsappConfirmed: false }))).toBe("BAD_REQUEST");
    expect(await code(registerParticipant({ spinnerId: s.id, name: "With WA", mobile: "0751234567", whatsappConfirmed: true }))).toBe("OK");
  });

  it("blocks registration while paused", async () => {
    const s = await setup();
    await changeSpinnerState(s.id, "pause");
    expect(await code(registerParticipant({ spinnerId: s.id, name: "Paused", mobile: "0761234567", whatsappConfirmed: false }))).toBe("PAUSED");
  });
});

describe("spinning", () => {
  it("creates exactly one immutable result even with concurrent double-clicks / tabs", async () => {
    const s = await setup();
    const { token } = await registerParticipant({ spinnerId: s.id, name: "Clicker", mobile: "0779999999", whatsappConfirmed: false });
    const outcomes = await Promise.all(Array.from({ length: 12 }, () => executeSpin(s.id, token)));
    const ids = new Set(outcomes.map((o) => o.result.id));
    expect(ids.size).toBe(1);
    expect(outcomes.filter((o) => !o.replay)).toHaveLength(1);
    expect(await readRepos().results.where((r) => r.spinnerId === s.id)).toHaveLength(1);
    const check = await checkParticipation(s.id, token);
    expect(check.spun).toBe(true);
  });

  it("rejects spins without a valid participant token", async () => {
    const s = await setup();
    expect(await code(executeSpin(s.id, undefined))).toBe("NOT_REGISTERED");
    expect(await code(executeSpin(s.id, "forged-token"))).toBe("NOT_REGISTERED");
  });

  it("respects offer quantities under concurrent spins", async () => {
    const s = await setup(30, [
      { name: "Jackpot", weight: 1000, maxWinners: 2 },
      { name: "Consolation", weight: 1, maxWinners: null },
    ]);
    const regs = [];
    for (let i = 0; i < 20; i++) {
      regs.push(await registerParticipant({ spinnerId: s.id, name: `P ${i}`, mobile: mobile(i), whatsappConfirmed: false }));
    }
    const outcomes = await Promise.all(regs.map((r) => executeSpin(s.id, r.token)));
    const jackpots = outcomes.filter((o) => o.result.offerName === "Jackpot");
    expect(jackpots).toHaveLength(2);
    const jackpot = (await readRepos().offers.forSpinner(s.id)).find((o) => o.name === "Jackpot")!;
    expect(jackpot.remainingQuantity).toBe(0);
    // segmentIndex points at the wheel segment of the selected offer
    for (const o of outcomes) expect(o.segmentIndex).toBe(o.result.offerName === "Jackpot" ? 0 : 1);
  });

  it("records no-prize segments as lost", async () => {
    const s = await setup(5, [
      { name: "Nothing", weight: 1, maxWinners: null, isWinning: false },
      { name: "Never", weight: 0, maxWinners: null },
    ]);
    const { token } = await registerParticipant({ spinnerId: s.id, name: "Unlucky", mobile: "0721234567", whatsappConfirmed: false });
    const out = await executeSpin(s.id, token);
    expect(out.result.status).toBe("lost");
    expect(out.result.offerName).toBe("Nothing");
  });

  it("returns NO_OFFERS when every prize is exhausted, without consuming the participant's spin", async () => {
    const s = await setup(5, [
      { name: "Only", weight: 1, maxWinners: 1 },
      { name: "Zero", weight: 0, maxWinners: null },
    ]);
    const a = await registerParticipant({ spinnerId: s.id, name: "First", mobile: "0741234567", whatsappConfirmed: false });
    const b = await registerParticipant({ spinnerId: s.id, name: "Second", mobile: "0741234568", whatsappConfirmed: false });
    await executeSpin(s.id, a.token);
    expect(await code(executeSpin(s.id, b.token))).toBe("NO_OFFERS");
    expect((await checkParticipation(s.id, b.token)).spun).toBe(false);
  });
});

describe("spinner lifecycle & database", () => {
  it("keeps exactly one active spinner", async () => {
    const a = await setup();
    const b = await setup();
    const active = (await readRepos().spinners.all()).filter((s) => s.status === "active");
    expect(active.map((s) => s.id)).toEqual([b.id]);
    expect((await readRepos().spinners.findById(a.id))?.status).toBe("completed");
  });

  it("only deletes drafts", async () => {
    const live = await setup();
    expect(await code(deleteSpinner(live.id))).toBe("NOT_DRAFT");
    const draft = await createSpinner({ title: "Draft", description: "", maxParticipants: 3 });
    expect(await code(deleteSpinner(draft.id))).toBe("OK");
  });

  it("rolls back a transaction that throws", async () => {
    await setup();
    const before = (await readRepos().spinners.all()).length;
    await expect(
      withRepos(async (repos) => {
        await repos.spinners.update((await repos.spinners.all())[0].id, { title: "changed" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const after = await readRepos().spinners.all();
    expect(after).toHaveLength(before);
    expect(after[0].title).toBe("Test Spin");
  });
});
