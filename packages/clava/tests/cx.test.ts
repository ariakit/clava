import { describe, expect, test } from "vitest";
import { create, cx } from "../src/index.ts";

describe("cx", () => {
  test("joins class values", () => {
    expect(
      cx(
        "base",
        ["nested", ["deep", false], null, undefined],
        { active: true, disabled: false },
        1,
        0,
        1n,
        true,
      ),
    ).toBe("base nested deep active 1");
  });

  test("applies transformClass", () => {
    const { cx } = create({
      transformClass: (className) => {
        return className
          .split(" ")
          .filter(Boolean)
          .map((word) => `tw-${word}`)
          .join(" ");
      },
    });

    expect(cx("base", ["nested"], { active: true })).toBe(
      "tw-base tw-nested tw-active",
    );
  });
});
