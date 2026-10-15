import { describe, expect, it } from "vitest";
import { safeTarget } from "./safe-redirect";

const base = "https://vikasakson.ua/auth/confirm?token_hash=x";

describe("safeTarget", () => {
  it.each(["/admin", "/admin/contacts?q=1", "/admin/events/abc#top"])("keeps same-site path %s", (next) => {
    expect(safeTarget(next, base).href).toBe(new URL(next, base).href);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "https://evil.com/admin",
    "javascript:alert(1)",
    "http://vikasakson.ua/admin",
  ])("falls back to /admin for %s", (next) => {
    expect(safeTarget(next, base).href).toBe("https://vikasakson.ua/admin");
  });

  it("falls back to /admin when next is missing", () => {
    expect(safeTarget(null, base).href).toBe("https://vikasakson.ua/admin");
  });
});
