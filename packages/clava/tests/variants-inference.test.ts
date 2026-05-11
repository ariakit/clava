import { describe, expectTypeOf, test } from "vitest";
import { cv } from "../src/index.ts";

describe("variants type inference", () => {
  test("function variant infers parameter type as prop type", () => {
    const button = cv({
      variants: {
        size: (value: number) => `size-${value}`,
      },
    });
    expectTypeOf(button.getVariants()).branded.toEqualTypeOf<{
      size?: number;
    }>();
    button({ size: 3 });
    button({
      // @ts-expect-error string is not assignable to number
      size: "lg",
    });
  });

  test("function variant infers union parameter type", () => {
    const button = cv({
      variants: {
        tone: (value: "info" | "warn") => `tone-${value}`,
      },
    });
    expectTypeOf(button.getVariants()).branded.toEqualTypeOf<{
      tone?: "info" | "warn";
    }>();
    button({ tone: "info" });
    button({ tone: "warn" });
    button({
      // @ts-expect-error "danger" is not in the union
      tone: "danger",
    });
  });

  test("function variant infers boolean parameter type", () => {
    const button = cv({
      variants: {
        active: (value: boolean) => (value ? "active" : "idle"),
      },
    });
    expectTypeOf(button.getVariants()).branded.toEqualTypeOf<{
      active?: boolean;
    }>();
    button({ active: true });
    button({ active: false });
    button({
      // @ts-expect-error string is not assignable to boolean
      active: "yes",
    });
  });

  test("function variant accepts nullable parameter", () => {
    const c = cv({
      variants: {
        color: (value: string | null) => (value ? `c-${value}` : "c-default"),
      },
    });
    expectTypeOf(c.getVariants()).branded.toEqualTypeOf<{
      color?: string | null;
    }>();
    c({ color: "red" });
    c({ color: null });
  });

  test("mixed function and object variants infer independently", () => {
    const c = cv({
      variants: {
        size: (value: number) => `s-${value}`,
        color: { red: "r", blue: "b" },
      },
    });
    expectTypeOf(c.getVariants()).branded.toEqualTypeOf<{
      size?: number;
      color?: "red" | "blue";
    }>();
    c({ size: 3, color: "red" });
    c({
      // @ts-expect-error number expected
      size: "3",
    });
    c({
      // @ts-expect-error "yellow" not in object keys
      color: "yellow",
    });
  });

  test("function variant in child overrides object variant in parent", () => {
    const base = cv({ variants: { size: { sm: "sm", lg: "lg" } } });
    const child = cv({
      extend: [base],
      variants: { size: (value: number) => `s-${value}` },
    });
    expectTypeOf(child.getVariants()).branded.toEqualTypeOf<{
      size?: number;
    }>();
    child({ size: 3 });
    child({
      // @ts-expect-error string is not assignable to number after override
      size: "sm",
    });
  });

  test("object variant in child overrides function variant in parent", () => {
    const base = cv({ variants: { size: (value: number) => `s-${value}` } });
    const child = cv({
      extend: [base],
      variants: { size: { sm: "child-sm", lg: "child-lg" } },
    });
    expectTypeOf(child.getVariants()).branded.toEqualTypeOf<{
      size?: "sm" | "lg";
    }>();
    child({ size: "sm" });
    child({
      // @ts-expect-error number is not assignable to "sm" | "lg" after override
      size: 3,
    });
  });

  test("object variant in child merges with object variant in parent", () => {
    const base = cv({ variants: { size: { sm: "base-sm", md: "base-md" } } });
    const child = cv({
      extend: [base],
      variants: { size: { lg: "child-lg" } },
    });
    expectTypeOf(child.getVariants()).branded.toEqualTypeOf<{
      size?: "sm" | "md" | "lg";
    }>();
    child({ size: "sm" });
    child({ size: "md" });
    child({ size: "lg" });
    child({
      // @ts-expect-error not in merged keys
      size: "xl",
    });
  });

  test("function variant in parent inherits in child without override", () => {
    const base = cv({
      variants: { size: (value: number) => `s-${value}` },
    });
    const child = cv({
      extend: [base],
      variants: { color: { red: "r" } },
    });
    expectTypeOf(child.getVariants()).branded.toEqualTypeOf<{
      size?: number;
      color?: "red";
    }>();
    child({ size: 5, color: "red" });
    child({
      // @ts-expect-error inherited size is still number
      size: "5",
    });
  });

  test("defaultVariants infers types from merged variants", () => {
    cv({
      variants: {
        size: (value: number) => `s-${value}`,
        color: { red: "r", blue: "b" },
      },
      defaultVariants: { size: 3, color: "red" },
    });
    cv({
      variants: { size: (value: number) => `s-${value}` },
      defaultVariants: {
        // @ts-expect-error string is not assignable to number
        size: "3",
      },
    });
  });

  test("refine callback sees function variant param type", () => {
    cv({
      variants: { size: (value: number) => `s-${value}` },
      refine: ({ variants, setVariants }) => {
        expectTypeOf(variants.size).toEqualTypeOf<number | undefined>();
        setVariants({ size: 10 });
        setVariants({
          // @ts-expect-error string not assignable to number
          size: "10",
        });
      },
    });
  });

  test("function variant return type accepts ClassValue and StyleClassValue", () => {
    cv({
      variants: {
        a: (_: number) => "class-a",
        b: (_: number) => null,
        c: (_: number) => undefined,
        d: (_: number) => ["x", "y"],
        e: (_: number) => ({ class: "c", style: { color: "red" } }),
        f: (_: number) => ({ style: { color: "red" } }),
      },
    });
  });

  test("variantKeys includes function variant keys", () => {
    const c = cv({
      variants: {
        size: { sm: "sm" },
        columns: (value: number) => `cols-${value}`,
      },
    });
    expectTypeOf(c.variantKeys).toEqualTypeOf<("size" | "columns")[]>();
  });

  test("intermediate object variant hides grandparent function variant from descendants", () => {
    const base = cv({
      variants: { size: (value: number) => `s-${value}` },
    });
    const middle = cv({
      extend: [base],
      variants: { size: { sm: "middle-sm", md: "middle-md" } },
    });
    // Descendant has no own `size` — it should inherit `middle`'s object,
    // not the grandparent function. The intersection used to leak through.
    const descendant = cv({ extend: [middle] });
    expectTypeOf(descendant.getVariants()).branded.toEqualTypeOf<{
      size?: "sm" | "md";
    }>();
    descendant({ size: "sm" });
    descendant({
      // @ts-expect-error grandparent function is no longer in the chain
      size: 3,
    });
  });

  test("null disables inherited function variant", () => {
    const base = cv({
      variants: {
        size: (value: number) => `s-${value}`,
      },
    });
    const child = cv({
      extend: [base],
      variants: { size: null },
    });
    expectTypeOf(child.getVariants()).branded.toEqualTypeOf<{
      size?: never;
    }>();
    child({
      // @ts-expect-error size was disabled
      size: 1,
    });
  });
});
