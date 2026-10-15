import { describe, expect, it } from "vitest";
import { contactFilters, searchTerm } from "./filters";

describe("contactFilters", () => {
  it("reads page searchParams, ignoring arrays and empty values", () => {
    expect(contactFilters({ q: "олена", interest: ["a", "b"], consent: "1" })).toEqual({
      q: "олена",
      interest: undefined,
      consent: true,
    });
    expect(contactFilters({ q: "" })).toEqual({ q: undefined, interest: undefined, consent: false });
  });

  it("reads URLSearchParams the same way (CSV export link)", () => {
    expect(contactFilters(new URLSearchParams("interest=training&consent=0"))).toEqual({
      q: undefined,
      interest: "training",
      consent: false,
    });
  });
});

describe("searchTerm", () => {
  it("removes characters that would change the database filter", () => {
    expect(searchTerm("a,b)(c*%\\d")).toBe("a b  c   d");
    expect(searchTerm("email.ilike.*x*,full_name.eq.y")).toBe("email.ilike. x  full_name.eq.y");
    expect(searchTerm('Олена "Сильна"')).toBe("Олена  Сильна");
  });

  it("returns undefined for blank input", () => {
    expect(searchTerm("  ,  ")).toBeUndefined();
    expect(searchTerm(undefined)).toBeUndefined();
  });
});
