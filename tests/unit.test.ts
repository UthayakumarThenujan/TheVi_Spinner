import { describe, it, expect } from "vitest";
import { normalizeSriLankanMobile, maskMobile } from "@/lib/validation/phone";
import { weightedPick } from "@/lib/spin/weightedSelection";
import { registerSchema } from "@/lib/validation/schemas";

describe("normalizeSriLankanMobile", () => {
  it.each([
    ["0771234567", "+94771234567"],
    ["771234567", "+94771234567"],
    ["+94771234567", "+94771234567"],
    ["94771234567", "+94771234567"],
    ["0094771234567", "+94771234567"],
    ["077 123 4567", "+94771234567"],
    ["(077) 123-4567", "+94771234567"],
    ["0701234567", "+94701234567"],
    ["0781234567", "+94781234567"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeSriLankanMobile(input)).toBe(expected);
  });

  it.each(["", "abc", "0112345678", "0731234567", "0791234567", "07712345", "077123456789", "+1 555 123 4567", "0771234567x"])(
    "rejects %s",
    (input) => {
      expect(normalizeSriLankanMobile(input)).toBeNull();
    },
  );

  it("masks numbers", () => {
    expect(maskMobile("+94771234567")).toBe("+94 77 *** 4567");
  });
});

describe("registerSchema names", () => {
  const ok = (name: string) => registerSchema.safeParse({ spinnerId: "s", name, mobile: "0771234567" }).success;
  it.each(["Thenujan Uthayakumar", "සුනිල් පෙරේරා", "ශ්‍රී ලාල්", "தேனுஜன் உதயகுமார்", "Mary-Anne O'Neil"])("accepts %s", (n) => {
    expect(ok(n)).toBe(true);
  });
  it.each(["A", "<script>", "Person 1", "  "])("rejects %s", (n) => {
    expect(ok(n)).toBe(false);
  });
});

describe("weightedPick", () => {
  it("never picks zero-weight items and returns null when nothing is eligible", () => {
    expect(weightedPick([{ weight: 0 }, { weight: -1 }])).toBeNull();
    expect(weightedPick([])).toBeNull();
    const items = [{ id: "a", weight: 0 }, { id: "b", weight: 5 }];
    for (let i = 0; i < 200; i++) expect(weightedPick(items)?.id).toBe("b");
  });

  it("maps the random draw onto cumulative weights", () => {
    const items = [{ id: "a", weight: 1 }, { id: "b", weight: 3 }];
    // scaled weights: a=1000, b=3000
    expect(weightedPick(items, () => 0)?.id).toBe("a");
    expect(weightedPick(items, () => 999)?.id).toBe("a");
    expect(weightedPick(items, () => 1000)?.id).toBe("b");
    expect(weightedPick(items, () => 3999)?.id).toBe("b");
  });

  it("roughly follows the configured odds", () => {
    const items = [{ id: "a", weight: 70 }, { id: "b", weight: 30 }];
    let a = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (weightedPick(items)!.id === "a") a++;
    expect(a / n).toBeGreaterThan(0.67);
    expect(a / n).toBeLessThan(0.73);
  });
});
