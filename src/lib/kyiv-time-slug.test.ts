import { describe, expect, it } from "vitest";
import { fromKyivInput, toKyivInput } from "./kyiv-time";
import { slugify } from "./slug";

describe("Kyiv time conversion", () => {
  it("handles summer time (UTC+3)", () => {
    expect(fromKyivInput("2026-07-01T09:00")).toBe("2026-07-01T06:00:00.000Z");
    expect(toKyivInput("2026-07-01T06:00:00.000Z")).toBe("2026-07-01T09:00");
  });

  it("handles winter time (UTC+2)", () => {
    expect(fromKyivInput("2026-12-01T09:00")).toBe("2026-12-01T07:00:00.000Z");
    expect(toKyivInput("2026-12-01T07:00:00Z")).toBe("2026-12-01T09:00");
  });

  it("round-trips the days around the DST switches", () => {
    for (const local of ["2026-03-28T12:00", "2026-03-29T12:00", "2026-10-24T12:00", "2026-10-25T12:00"]) {
      expect(toKyivInput(fromKyivInput(local))).toBe(local);
    }
  });

  it("rejects malformed input", () => {
    expect(fromKyivInput("")).toBeNull();
    expect(fromKyivInput("01.07.2026 09:00")).toBeNull();
    expect(toKyivInput(null)).toBe("");
  });
});

describe("slugify", () => {
  it("transliterates Ukrainian per the official rules", () => {
    expect(slugify("Ранок з мамами")).toBe("ranok-z-mamamy");
    expect(slugify("Харчування без дієт: майстер-клас")).toBe("kharchuvannia-bez-diiet-maister-klas");
    expect(slugify("Юлія та Яна в Їжакевичах")).toBe("yuliia-ta-yana-v-yizhakevychakh");
    expect(slugify("Згорання жиру")).toBe("zghorannia-zhyru");
    expect(slugify("Об'єм і сила")).toBe("obiem-i-syla");
  });

  it("produces URL-safe output", () => {
    expect(slugify("  Коучинг «Сильна мама» 2026!  ")).toBe("kouchynh-sylna-mama-2026");
    expect(slugify("Fitness Day")).toBe("fitness-day");
    expect(slugify("!!!")).toBe("");
  });
});
