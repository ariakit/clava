import { cv as legacyCV } from "clava-legacy";
import { expect, test } from "vitest";
import { cv } from "../src/index.ts";

test("extend components from the previous Clava release", () => {
  const first = legacyCV({
    class: "first",
    variants: { size: { sm: "small" } },
    defaultVariants: { size: "sm" },
    style: { color: "red" },
    refine: () => "refined",
  });
  const second = legacyCV({ class: "second", style: { color: "blue" } });
  const component = cv({
    extend: [first, second, first.jsx],
    class: "current",
  });
  expect(component()).toEqual({
    class: "first second current small refined",
    style: { color: "blue" },
  });
  expect(component.getVariants()).toEqual({ size: "sm" });
});

test("deduplicate a legacy base reached through current components", () => {
  const base = legacyCV({
    class: "base",
    variants: { active: { true: "active" } },
    defaultVariants: { active: true },
  });
  const left = cv({ extend: [base], class: "left" });
  const right = cv({ extend: [base], class: "right" });
  const component = cv({ extend: [left, right] });
  expect(component.class()).toBe("base left right active");
  expect(component.getVariants()).toEqual({ active: true });
});
