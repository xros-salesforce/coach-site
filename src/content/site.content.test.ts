// Content readiness check, run before going live: `npm run check:content`.
// Lists every «…» placeholder still left in site.ts (pages hide them, but they should be filled in).
import { describe, expect, it } from "vitest";
import { placeholders } from "./placeholders";
import { about, gallery, nav, pillars, services, site } from "./site";

describe.skipIf(!process.env.CHECK_CONTENT)("site content is ready to publish", () => {
  it("has no «…» placeholders left in src/content/site.ts", () => {
    expect(placeholders({ site, about, services, pillars, gallery, nav })).toEqual([]);
  });
});
