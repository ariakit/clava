import { describe, expect, expectTypeOf, test } from "vitest";
import {
  type Recipe,
  type Variant,
  type VariantProps,
  create,
  cv as cvBase,
  cx,
} from "../src/index.ts";
import {
  CONFIGS,
  createCVFromConfig,
  getConfigDescription,
  getConfigMode,
  getConfigTransformClass,
  getExpectedPropsKeys,
  getModeRecipe,
  getStyle,
  getStyleClass,
} from "./_utils.ts";

test("cv returns a Recipe with inferred variants", () => {
  const button = cvBase({
    variants: { size: { sm: "button-sm", lg: "button-lg" } },
  });

  expectTypeOf(button).toEqualTypeOf<
    Recipe<{ size: { sm: string; lg: string } }>
  >();
  expectTypeOf<VariantProps<typeof button>>().toEqualTypeOf<{
    size?: "sm" | "lg";
  }>();
});

test("cx joins classes and applies factory transforms once", () => {
  expect(cx("button", ["active", false], { disabled: true })).toBe(
    "button active disabled",
  );

  const transformed: string[] = [];
  const { cx: factoryCx } = create({
    transformClass(className) {
      transformed.push(className);
      return `[${className}]`;
    },
  });
  expect(factoryCx("button", ["active", false])).toBe("[button active]");
  expect(transformed).toEqual(["button active"]);
});

for (const config of Object.values(CONFIGS)) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("class method", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ class: "foo", variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const className = recipe.class({ size: "lg" });
      expect(className).toBe(cls("foo lg"));
    });

    test("style method", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const style = recipe.style();
      expect(getStyle({ style })).toEqual({ backgroundColor: "red" });
    });

    test("getVariants returns variant values", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const variants = recipe.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "lg" });
    });

    test("getVariants ignores unknown variant keys", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const variants = recipe.getVariants({
        size: "lg",
        // @ts-expect-error unknown is not a declared variant
        unknown: "value",
      });
      expect(variants).toEqual({ size: "lg" });
    });

    test("getVariants reads non-enumerable declared variant keys", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const props = Object.defineProperty({}, "size", {
        value: "lg",
        enumerable: false,
      });
      expect(recipe.getVariants(props)).toEqual({ size: "lg" });
    });

    test("getVariants excludes unknown variant keys from refine", () => {
      let refinedVariants: Record<string, unknown> | undefined;
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          refine: ({ variants, setVariants }) => {
            refinedVariants = { ...variants };
            setVariants({ color: "red" });
          },
        }),
      );
      const variants = recipe.getVariants({
        size: "lg",
        // @ts-expect-error unknown is not a declared variant
        unknown: "value",
      });
      expect(refinedVariants).toEqual({ size: "lg", color: "red" });
      expect(variants).toEqual({ size: "lg", color: "red" });
    });

    test("getVariants preserves inherited variant keys while ignoring unknown keys", () => {
      const base = cv({
        variants: { tone: { quiet: "quiet", loud: "loud" } },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: "sm", lg: "lg" } },
        }),
      );
      const variants = recipe.getVariants({
        tone: "quiet",
        size: "lg",
        // @ts-expect-error unknown is not a declared variant
        unknown: "value",
      });
      expect(variants).toEqual({ tone: "quiet", size: "lg" });
    });

    test("getVariants filters unknown keys before extended computed defaults", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: () => "sm" as const },
      });
      const recipe = getModeRecipe(mode, cv({ extend: [base] }));
      let unknownReads = 0;
      let inheritedSetterCalls = 0;
      const props = {};
      Object.defineProperty(props, "unknown", {
        enumerable: true,
        get: () => {
          unknownReads += 1;
          return "value";
        },
      });
      Object.defineProperty(props, "__proto__", {
        enumerable: true,
        value: {
          set size(_value: unknown) {
            inheritedSetterCalls += 1;
          },
        },
      });
      Object.defineProperty(props, "size", {
        enumerable: true,
        value: "lg",
      });
      expect(recipe.getVariants(props)).toEqual({ size: "lg" });
      expect(unknownReads).toBe(0);
      expect(inheritedSetterCalls).toBe(0);
    });

    test("resolving copies variant props once when an extend has a computed default", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          intent: { primary: "primary", neutral: "neutral" },
        },
        defaultVariants: {
          intent: (defaultValue, variants) =>
            variants.size === "lg" ? "neutral" : defaultValue,
        },
      });
      const recipe = getModeRecipe(mode, cv({ extend: [base] }));
      // A computed default re-runs the refine chain, so an uncopied props
      // record would read the accessor once per pass. A caller can pass a
      // record whose reads are observable, such as a Solid props proxy handed
      // straight to the recipe, so the count is not an internal detail.
      let intentReads = 0;
      const props = {};
      Object.defineProperty(props, "size", {
        enumerable: true,
        value: "lg",
      });
      Object.defineProperty(props, "intent", {
        enumerable: true,
        get: () => {
          intentReads += 1;
          return undefined;
        },
      });
      expect(getStyleClass(recipe(props))).toEqual({
        class: cls("lg neutral"),
      });
      expect(intentReads).toBe(1);
    });

    test("getVariants copies variant props once when an extend has a computed default", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          intent: { primary: "primary", neutral: "neutral" },
        },
        defaultVariants: {
          intent: (defaultValue, variants) =>
            variants.size === "lg" ? "neutral" : defaultValue,
        },
      });
      const recipe = getModeRecipe(mode, cv({ extend: [base] }));
      // `getVariants` copies the caller's record on its own branch, separate
      // from the one the recipe call uses, so it needs its own coverage.
      let intentReads = 0;
      const props = {};
      Object.defineProperty(props, "size", {
        enumerable: true,
        value: "lg",
      });
      Object.defineProperty(props, "intent", {
        enumerable: true,
        get: () => {
          intentReads += 1;
          return undefined;
        },
      });
      expect(recipe.getVariants(props)).toEqual({
        size: "lg",
        intent: "neutral",
      });
      expect(intentReads).toBe(1);
    });

    test("getVariants returns default variants", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const variants = recipe.getVariants();
      expect(variants).toEqual({ size: "sm" });
    });

    test("getVariants omits undefined defaultVariants", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: undefined },
        }),
      );
      const variants = recipe.getVariants();
      expect(variants).toStrictEqual({});
      expect(Object.hasOwn(variants, "size")).toBe(false);
    });

    test("getVariants undefined defaultVariants clear inherited defaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
      });
      const recipe = getModeRecipe(
        mode,
        cv({ extend: [base], defaultVariants: { size: undefined } }),
      );
      const variants = recipe.getVariants();
      expect(variants).toStrictEqual({});
      expect(Object.hasOwn(variants, "size")).toBe(false);
    });

    test("getVariants returns variants set by refine setVariants", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          refine: ({ variants, setVariants }) => {
            if (variants.size === "lg") {
              setVariants({ color: "red" });
            }
          },
        }),
      );
      const variants = recipe.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "lg", color: "red" });
    });

    test("getVariants re-runs when refine changes variants", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          refine: ({ variants, setVariants }) => {
            if (variants.size === "lg") {
              setVariants({ color: "red" });
            }
            if (variants.color === "red") {
              setVariants({ size: "sm" });
            }
          },
        }),
      );
      const variants = recipe.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "sm", color: "red" });
    });

    test("getVariants re-runs when computed defaultVariants change variants", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: {
            color: () => "red" as const,
            size: (defaultValue, variants) =>
              variants.color === "red" ? "lg" : defaultValue,
          },
        }),
      );
      const variants = recipe.getVariants();
      expect(variants).toEqual({ size: "lg", color: "red" });
    });

    test("getVariants returns computed defaultVariants", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: {
            color: (defaultValue, variants) =>
              variants.size === "lg" ? "blue" : defaultValue,
          },
        }),
      );
      const variants = recipe.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "lg", color: "blue" });
    });

    test("getVariants computed defaultVariants do not override props", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: {
            color: () => "blue" as const,
          },
        }),
      );
      const variants = recipe.getVariants({ color: "red" });
      expect(variants).toEqual({ color: "red" });
    });

    test("getVariants setVariants overrides props", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          refine: ({ setVariants }) => {
            setVariants({ color: "blue" });
          },
        }),
      );
      const variants = recipe.getVariants({ color: "red" });
      expect(variants).toEqual({ color: "blue" });
    });

    test("getVariants picks up computed defaultVariants from extended recipe", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: {
          size: () => "lg" as const,
        },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { color: "red" },
        }),
      );
      const variants = recipe.getVariants();
      expect(variants).toEqual({ size: "lg", color: "red" });
    });

    test("getVariants picks up computed defaultVariants from grandparent recipe", () => {
      const grandparent = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: {
          size: () => "lg" as const,
        },
      });
      const parent = cv({ extend: [grandparent] });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [parent],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { color: "red" },
        }),
      );
      const variants = recipe.getVariants();
      expect(variants).toEqual({ size: "lg", color: "red" });
    });

    test("getVariants re-runs when base recipe refine changes variants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, active: "" },
        defaultVariants: { size: "sm" },
        refine: ({ variants, setVariants }) => {
          if (variants.active) {
            setVariants({ size: "lg" });
          }
        },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          refine: ({ variants, setVariants }) => {
            if (variants.size === "lg") {
              setVariants({ color: "red" });
            }
          },
        }),
      );
      const variants = recipe.getVariants({ active: true });
      expect(variants).toEqual({ size: "lg", active: true, color: "red" });
    });

    test("getVariants preserves computed defaultVariants after a setVariants re-run", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          active: "",
          mode: { on: "on" },
        },
        defaultVariants: {
          size: (defaultValue, variants) =>
            variants.mode === "on" ? "lg" : defaultValue,
        },
        refine: ({ variants, setVariants }) => {
          if (variants.active) {
            setVariants({ mode: "on" });
          }
        },
      });
      const recipe = getModeRecipe(mode, cv({ extend: [base] }));
      const variants = recipe.getVariants({ active: true });
      expect(variants).toEqual({ size: "lg", active: true, mode: "on" });
    });

    test("getVariants setVariants uses the latest pending value", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          refine: ({ setVariants }) => {
            setVariants({ size: "lg" });
            setVariants({ size: "sm" });
          },
        }),
      );
      const variants = recipe.getVariants();
      expect(variants).toEqual({ size: "sm" });
    });

    test("getVariants child setVariants keeps overriding base computed defaultVariants across re-runs", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
        defaultVariants: {
          color: () => "blue" as const,
        },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          refine: ({ variants, setVariants }) => {
            if (variants.size === "sm") {
              setVariants({ color: "red" });
            }
          },
        }),
      );
      const variants = recipe.getVariants();
      expect(variants).toEqual({ color: "red", size: "sm" });
    });

    test("getVariants setVariants sticks across computed default re-runs", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
        defaultVariants: {
          color: () => "blue" as const,
        },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" }, done: "" },
          refine: ({ variants, setVariants }) => {
            if (!variants.done) {
              setVariants({ color: "red", done: true });
            }
          },
        }),
      );
      const variants = recipe.getVariants();
      expect(variants).toEqual({ color: "red", done: true });
    });

    test("getVariants base computed defaultVariants can override child static defaults after a re-run", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          active: "",
          mode: { on: "on" },
        },
        defaultVariants: {
          size: (defaultValue, variants) =>
            variants.mode === "on" ? "lg" : defaultValue,
        },
        refine: ({ variants, setVariants }) => {
          if (variants.active) {
            setVariants({ mode: "on" });
          }
        },
      });
      const recipe = getModeRecipe(
        mode,
        cv({ extend: [base], defaultVariants: { size: "sm" } }),
      );
      const variants = recipe.getVariants({ active: true });
      expect(variants).toEqual({ size: "lg", active: true, mode: "on" });
    });

    test("getVariants setVariants from earlier extends overrides computed defaultVariants from later extends", () => {
      const first = cv({
        variants: { color: { red: "first-red", blue: "first-blue" } },
        refine: ({ setVariants }) => {
          setVariants({ color: "red" });
        },
      });
      const second = cv({
        variants: { color: { red: "second-red", blue: "second-blue" } },
        defaultVariants: {
          color: () => "blue" as const,
        },
      });
      const recipe = getModeRecipe(mode, cv({ extend: [first, second] }));
      const variants = recipe.getVariants();
      expect(variants).toEqual({ color: "red" });
    });

    test("getVariants computed defaultVariants from later extends override earlier extends", () => {
      const first = cv({
        variants: { color: { red: "first-red", blue: "first-blue" } },
        defaultVariants: {
          color: () => "red" as const,
        },
      });
      const second = cv({
        variants: { color: { red: "second-red", blue: "second-blue" } },
        defaultVariants: {
          color: () => "blue" as const,
        },
      });
      const recipe = getModeRecipe(mode, cv({ extend: [first, second] }));
      const variants = recipe.getVariants();
      expect(variants).toEqual({ color: "blue" });
    });

    test("getVariants computed defaultVariants do not override stable setVariants on later passes", () => {
      const base = cv({
        variants: { color: { red: "base-red", blue: "base-blue" } },
        refine: ({ setVariants }) => {
          setVariants({ color: "red" });
        },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "child-red", blue: "child-blue" } },
          defaultVariants: {
            color: (defaultValue, variants) =>
              variants.color === "red" ? "blue" : defaultValue,
          },
        }),
      );
      const variants = recipe.getVariants();
      expect(variants).toEqual({ color: "red" });
    });

    test("getVariants computed defaultVariants do not override setVariants from a previous pass", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            color: { red: "red", blue: "blue" },
            done: "",
          },
          defaultVariants: {
            color: (defaultValue, variants) =>
              variants.done ? "blue" : defaultValue,
          },
          refine: ({ variants, setVariants }) => {
            if (!variants.done) {
              setVariants({ color: "red", done: true });
            }
          },
        }),
      );
      const variants = recipe.getVariants();
      expect(variants).toEqual({ color: "red", done: true });
    });

    test("variantKeys property", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm" }, color: { red: "red" } },
        }),
      );
      expectTypeOf(recipe.variantKeys).toEqualTypeOf<("size" | "color")[]>();
      expect(recipe.variantKeys).toEqual(["size", "color"]);
    });

    test("propKeys property", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { size: { sm: "sm" }, color: { red: "red" } } }),
      );
      expectTypeOf(recipe.propKeys).toExtend<
        ("class" | "className" | "style" | "size" | "color")[]
      >();
      expect(recipe.propKeys).toEqual(
        getExpectedPropsKeys(config, "size", "color"),
      );
    });

    test("propKeys on different modes", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { size: { sm: "sm" } } }),
      );
      expect(recipe.propKeys).toEqual(getExpectedPropsKeys(config, "size"));
    });
  });
}

test("propKeys are mode-specific", () => {
  const recipe = cvBase({
    variants: { size: { sm: "sm", md: "md" } },
  });

  expectTypeOf(recipe.propKeys).toEqualTypeOf<
    ("class" | "className" | "style" | "size")[]
  >();
  expectTypeOf(recipe.jsx.propKeys).toEqualTypeOf<
    ("className" | "style" | "size")[]
  >();
  expectTypeOf(recipe.html.propKeys).toEqualTypeOf<
    ("class" | "style" | "size")[]
  >();
  expectTypeOf(recipe.htmlObj.propKeys).toEqualTypeOf<
    ("class" | "style" | "size")[]
  >();

  expect(recipe.propKeys).toEqual(["class", "className", "style", "size"]);
  expect(recipe.jsx.propKeys).toEqual(["className", "style", "size"]);
  expect(recipe.html.propKeys).toEqual(["class", "style", "size"]);
  expect(recipe.htmlObj.propKeys).toEqual(["class", "style", "size"]);
});

describe("Variant utility type", () => {
  test("matches variant keys from another recipe", () => {
    const base = cvBase({
      variants: { foo: { sm: "foo-sm", lg: "foo-lg" } },
    });
    const recipe = cvBase({
      extend: [base],
      variants: {
        bar: {
          sm: "bar-sm",
          lg: "bar-lg",
        } satisfies Variant<typeof base, "foo">,
      },
    });
    expect(recipe({ bar: "sm" }).class).toContain("bar-sm");
  });

  test("rejects invalid variant keys", () => {
    const base = cvBase({
      variants: { foo: { sm: "foo-sm", lg: "foo-lg" } },
    });
    cvBase({
      extend: [base],
      variants: {
        bar: {
          sm: "bar-sm",
          lg: "bar-lg",
          // @ts-expect-error
          xl: "bar-xl",
        } satisfies Variant<typeof base, "foo">,
      },
    });
  });
});
