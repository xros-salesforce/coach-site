import { describe, expect, it } from "vitest";
import { fitWithin } from "./compress-image";

describe("fitWithin", () => {
  it("scales the longest side down to the limit, keeping the aspect ratio", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("never enlarges small images", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
