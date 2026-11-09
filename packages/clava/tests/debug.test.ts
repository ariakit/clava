import { afterEach, describe, expect, test, vi } from "vitest";
import { create, cv as packageCv, splitProps } from "../src/index.ts";

const ATTRIBUTE = "data-clava-debug";

// The attribute isn't part of the result types, because it exists only in
// development.
function getDebug(result: object): unknown {
  return Object.getOwnPropertyDescriptor(result, ATTRIBUTE)?.value;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("debug attribute", () => {
  test("is not added outside development by default", () => {
    const recipe = packageCv({ variants: { size: { sm: "sm" } } });
    expect(recipe({ size: "sm" })).not.toHaveProperty(ATTRIBUTE);
    expect(recipe.jsx({ size: "sm" })).not.toHaveProperty(ATTRIBUTE);
    expect(create().cv({ class: "a" }).jsx()).not.toHaveProperty(ATTRIBUTE);
  });

  test("is added by default in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { cv } = create();
    const recipe = cv({ variants: { size: { sm: "sm" } } });
    expect(getDebug(recipe.jsx({ size: "sm" }))).toBe("size='sm'");
  });

  test("is not added in development when debug is false", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { cv } = create({ debug: false });
    const recipe = cv({ variants: { size: { sm: "sm" } } });
    expect(recipe.jsx({ size: "sm" })).not.toHaveProperty(ATTRIBUTE);
  });

  test("is never added in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { cv } = create({ debug: true });
    const recipe = cv({ variants: { size: { sm: "sm" } } });
    expect(recipe({ size: "sm" })).not.toHaveProperty(ATTRIBUTE);
    expect(recipe.jsx({ size: "sm" })).not.toHaveProperty(ATTRIBUTE);
    expect(recipe.html({ size: "sm" })).not.toHaveProperty(ATTRIBUTE);
    expect(recipe.htmlObj({ size: "sm" })).not.toHaveProperty(ATTRIBUTE);
  });

  test("is added to every object output mode", () => {
    const { cv } = create({ debug: true });
    const recipe = cv({
      class: "button",
      style: { color: "red" },
      variants: { size: { sm: "sm" } },
    });
    const expected = "size='sm'";
    const defaultResult = recipe({ size: "sm" });
    const jsxResult = recipe.jsx({ size: "sm" });
    const htmlResult = recipe.html({ size: "sm" });
    const htmlObjResult = recipe.htmlObj({ size: "sm" });
    expect(getDebug(defaultResult)).toBe(expected);
    expect(getDebug(jsxResult)).toBe(expected);
    expect(getDebug(htmlResult)).toBe(expected);
    expect(getDebug(htmlObjResult)).toBe(expected);
    expect(htmlResult).toEqual({
      class: "button sm",
      style: "color: red;",
      [ATTRIBUTE]: expect.any(String),
    });
    expect(recipe.class({ size: "sm" })).toBe("button sm");
    expect(recipe.style({ size: "sm" })).toEqual({ color: "red" });
  });

  test("lists resolved variants in variant key order", () => {
    const { cv } = create({ debug: true });
    const recipe = cv({
      variants: {
        size: { sm: "sm", lg: "lg" },
        tone: (value: string) => ({ style: { color: value } }),
        density: { 1: "dense", 2: "loose" },
        disabled: { true: "disabled", false: "" },
        shape: { round: "round", square: null },
        options: (value: { gap: number }) => ({
          style: { gap: `${value.gap}px` },
        }),
      },
      defaultVariants: { size: "sm", disabled: false },
      refine: ({ variants, setVariants }) => {
        if (variants.density === 2) {
          setVariants({ size: "lg" });
        }
      },
    });
    const result = recipe.jsx({
      density: 2,
      tone: "it's \\ red",
      // @ts-expect-error the disabled value is omitted
      shape:
        // no error
        "square",
      options: { gap: 1 },
    });
    expect(getDebug(result)).toBe(
      "size='lg' tone='it\\'s \\\\ red' density=2 " +
        "disabled=false options={...}",
    );
  });

  test("lists inherited variants of extended recipes", () => {
    const { cv } = create({ debug: true });
    const base = cv({
      variants: { disabled: { true: "disabled", false: "" } },
      defaultVariants: { disabled: false },
    });
    const button = cv({
      extend: [base],
      variants: { size: { sm: "sm", lg: "lg" } },
    });
    expect(getDebug(button.jsx({ size: "lg" }))).toBe(
      "disabled=false size='lg'",
    );
  });

  test("appends a debug value that is passed as a prop", () => {
    const { cv } = create({ debug: true });
    const recipe = cv({ variants: { size: { sm: "sm" } } });
    const result = recipe.jsx({
      size: "sm",
      // @ts-expect-error the debug attribute isn't part of the props type
      [ATTRIBUTE]: "tone='info'",
    });
    expect(getDebug(result)).toBe("size='sm' tone='info'");
  });

  test("joins values without extra spaces when a recipe has no variants", () => {
    const { cv } = create({ debug: true });
    const recipe = cv({ class: "a" });
    expect(getDebug(recipe.jsx())).toBe("");
    expect(
      getDebug(
        recipe.jsx({
          // @ts-expect-error the debug attribute isn't part of the props type
          [ATTRIBUTE]: "tone='info'",
        }),
      ),
    ).toBe("tone='info'");
  });

  test("ignores an inherited debug value", () => {
    const { cv } = create({ debug: true });
    const recipe = cv({ class: "a" });
    const prototype = Object.prototype as Record<string, unknown>;
    prototype[ATTRIBUTE] = "polluted";
    try {
      expect(getDebug(recipe.jsx())).toBe("");
      const [variantProps, rest] = splitProps({ id: "x" }, recipe.jsx);
      expect(Object.hasOwn(variantProps, ATTRIBUTE)).toBe(false);
      expect(Object.hasOwn(rest, ATTRIBUTE)).toBe(false);
    } finally {
      delete prototype[ATTRIBUTE];
    }
  });
});

// Matches a wrapper component that renders another component with the output
// of its own recipe, like `<Clickable {...button.jsx(props)} />`.
function setupWrapper(debug: boolean) {
  const { cv } = create({ debug });
  const clickable = cv({
    class: "clickable",
    variants: { disabled: { true: "disabled", false: "" } },
    defaultVariants: { disabled: false },
  });
  const button = create({ debug: true }).cv({
    variants: { size: { sm: "sm", lg: "lg" } },
  });
  const buttonOutput = button.jsx({ size: "lg" });
  return { clickable, buttonOutput };
}

describe("debug attribute with splitProps", () => {
  test("routes an incoming value to the recipe that claims styling props", () => {
    const { clickable, buttonOutput } = setupWrapper(true);
    const props = { id: "button", ...buttonOutput };
    const [variantProps, rest] = splitProps(props, clickable.jsx);
    // The rest props keep the value, and the recipe output, spread after
    // them, replaces it with the combined value.
    expect(rest).toEqual({
      id: "button",
      [ATTRIBUTE]: getDebug(buttonOutput),
    });
    expect({ ...rest, ...clickable.jsx(variantProps) }).toEqual({
      id: "button",
      className: "clickable lg",
      style: {},
      [ATTRIBUTE]: expect.any(String),
    });
    expect(getDebug(clickable.jsx(variantProps))).toBe(
      "disabled=false size='lg'",
    );
  });

  test("routes an incoming value to a later recipe that claims styling props", () => {
    const { clickable, buttonOutput } = setupWrapper(true);
    const props = { id: "button", ...buttonOutput };
    const [ids, variantProps, rest] = splitProps(props, ["id"], clickable.jsx);
    expect(ids).toEqual({ id: "button" });
    expect(rest).toEqual({ [ATTRIBUTE]: getDebug(buttonOutput) });
    expect(variantProps[ATTRIBUTE as keyof typeof variantProps]).toBe(
      getDebug(buttonOutput),
    );
  });

  test("keeps an incoming value in the rest props without debug", () => {
    const { clickable, buttonOutput } = setupWrapper(false);
    const props = { id: "button", ...buttonOutput };
    const [variantProps, rest] = splitProps(props, clickable.jsx);
    expect(rest).toEqual({
      id: "button",
      [ATTRIBUTE]: getDebug(buttonOutput),
    });
    expect(clickable.jsx(variantProps)).not.toHaveProperty(ATTRIBUTE);
  });
});
