import { afterEach, expect, test } from "vitest";
import { cv } from "../src/index.ts";

const proto = Object.prototype as Record<string, unknown>;

afterEach(() => {
  for (const key of Object.keys(proto)) {
    delete proto[key];
  }
});

test("getVariants ignores keys inherited from Object.prototype", () => {
  proto.size = "lg";
  const component = cv({
    variants: { size: { sm: "sm", lg: "lg" } },
    defaultVariants: { size: "sm" },
  });
  expect(component.getVariants({})).toEqual({ size: "sm" });
});

test("render ignores keys inherited from Object.prototype", () => {
  proto.size = "lg";
  const component = cv({
    variants: { size: { sm: "sm", lg: "lg" } },
    defaultVariants: { size: "sm" },
  });
  expect(component({}).class).toBe("sm");
});

test("extend's resolveDefaults ignores polluted prototype on parent's refine", () => {
  // Base's refine branches on its own variants.size — if the polluted "size"
  // key leaks into resolveDefaultsFn's resolvedVariants, the refine callback
  // would see size = "lg" instead of the staticDefault "sm" and emit the
  // lg-specific class.
  proto.size = "lg";
  const base = cv({
    variants: { size: { sm: "sm", lg: "lg" } },
    defaultVariants: { size: "sm" },
    refine: ({ variants, addClass }) => {
      if (variants.size === "lg") {
        addClass("base-lg-detected");
      }
    },
  });
  const child = cv({ extend: [base], class: "child" });
  expect(child({}).class).not.toContain("base-lg-detected");
});
