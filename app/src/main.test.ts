import { describe, it, expect } from "vitest";
import { add } from "clava";

describe("app integration", () => {
  it("should be able to use clava library", () => {
    expect(add(2, 3)).toBe(5);
  });
});
