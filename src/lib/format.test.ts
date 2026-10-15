import { describe, expect, it } from "vitest";
import { formatPrice, formatTimeRange, pluralSeats } from "./format";

describe("pluralSeats", () => {
  it.each([
    [1, "1 місце"],
    [2, "2 місця"],
    [4, "4 місця"],
    [5, "5 місць"],
    [11, "11 місць"],
    [12, "12 місць"],
    [14, "14 місць"],
    [21, "21 місце"],
    [22, "22 місця"],
    [0, "0 місць"],
    [111, "111 місць"],
  ])("%i → %s", (n, expected) => {
    expect(pluralSeats(n)).toBe(expected);
  });
});

describe("formatPrice", () => {
  it("shows free events as Безкоштовно", () => {
    expect(formatPrice(null)).toBe("Безкоштовно");
  });

  it("formats hryvnias with a Ukrainian thousands separator", () => {
    // uk-UA groups with a narrow no-break space.
    expect(formatPrice(1500).replace(/\s/g, " ")).toBe("1 500 грн");
    expect(formatPrice("600.00")).toBe("600 грн");
  });
});

describe("formatTimeRange", () => {
  it("shows Kyiv time regardless of the server's time zone", () => {
    expect(formatTimeRange("2026-07-01T06:00:00Z", "2026-07-01T07:30:00Z")).toBe("09:00–10:30");
    expect(formatTimeRange("2026-12-01T07:00:00Z", null)).toBe("09:00");
  });
});
