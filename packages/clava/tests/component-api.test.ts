import { describe, expect, expectTypeOf, test } from "vitest";
import { type Variant, create, cv as cvBase } from "../src/index.ts";
import {
  CONFIGS,
  createCVFromConfig,
  getConfigDescription,
  getConfigMode,
  getConfigTransformClass,
  getExpectedPropsKeys,
  getModeComponent,
  getStyle,
} from "./_utils.ts";

for (const config of Object.values(CONFIGS)) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("class method", () => {
      const component = getModeComponent(
        mode,
        cv({ class: "foo", variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const className = component.class({ size: "lg" });
      expect(className).toBe(cls("foo lg"));
    });

    test("style method", () => {
      const component = getModeComponent(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const style = component.style();
      expect(getStyle({ style })).toEqual({ backgroundColor: "red" });
    });

    test("getVariants returns variant values", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const variants = component.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "lg" });
    });

    test("getVariants returns default variants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const variants = component.getVariants();
      expect(variants).toEqual({ size: "sm" });
    });

    test("getVariants omits undefined defaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: undefined },
        }),
      );
      const variants = component.getVariants();
      expect(variants).toStrictEqual({});
      expect(Object.hasOwn(variants, "size")).toBe(false);
    });

    test("getVariants undefined defaultVariants clear inherited defaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
      });
      const component = getModeComponent(
        mode,
        cv({ extend: [base], defaultVariants: { size: undefined } }),
      );
      const variants = component.getVariants();
      expect(variants).toStrictEqual({});
      expect(Object.hasOwn(variants, "size")).toBe(false);
    });

    test("getVariants returns variants set by refine setVariants", () => {
      const component = getModeComponent(
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
      const variants = component.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "lg", color: "red" });
    });

    test("getVariants re-runs when refine changes variants", () => {
      const component = getModeComponent(
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
      const variants = component.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "sm", color: "red" });
    });

    test("getVariants re-runs when computed defaultVariants change variants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: {
            color: () => "red" as const,
            size: ({ defaultValue, variants }) =>
              variants.color === "red" ? "lg" : defaultValue,
          },
        }),
      );
      const variants = component.getVariants();
      expect(variants).toEqual({ size: "lg", color: "red" });
    });

    test("getVariants returns computed defaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: {
            color: ({ defaultValue, variants }) =>
              variants.size === "lg" ? "blue" : defaultValue,
          },
        }),
      );
      const variants = component.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "lg", color: "blue" });
    });

    test("getVariants computed defaultVariants do not override props", () => {
      const component = getModeComponent(
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
      const variants = component.getVariants({ color: "red" });
      expect(variants).toEqual({ color: "red" });
    });

    test("getVariants setVariants overrides props", () => {
      const component = getModeComponent(
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
      const variants = component.getVariants({ color: "red" });
      expect(variants).toEqual({ color: "blue" });
    });

    test("getVariants picks up computed defaultVariants from extended component", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: {
          size: () => "lg" as const,
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { color: "red" },
        }),
      );
      const variants = component.getVariants();
      expect(variants).toEqual({ size: "lg", color: "red" });
    });

    test("getVariants picks up computed defaultVariants from grandparent component", () => {
      const grandparent = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: {
          size: () => "lg" as const,
        },
      });
      const parent = cv({ extend: [grandparent] });
      const component = getModeComponent(
        mode,
        cv({
          extend: [parent],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { color: "red" },
        }),
      );
      const variants = component.getVariants();
      expect(variants).toEqual({ size: "lg", color: "red" });
    });

    test("getVariants re-runs when base component refine changes variants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, active: "" },
        defaultVariants: { size: "sm" },
        refine: ({ variants, setVariants }) => {
          if (variants.active) {
            setVariants({ size: "lg" });
          }
        },
      });
      const component = getModeComponent(
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
      const variants = component.getVariants({ active: true });
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
          size: ({ defaultValue, variants }) =>
            variants.mode === "on" ? "lg" : defaultValue,
        },
        refine: ({ variants, setVariants }) => {
          if (variants.active) {
            setVariants({ mode: "on" });
          }
        },
      });
      const component = getModeComponent(mode, cv({ extend: [base] }));
      const variants = component.getVariants({ active: true });
      expect(variants).toEqual({ size: "lg", active: true, mode: "on" });
    });

    test("getVariants setVariants uses the latest pending value", () => {
      const component = getModeComponent(
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
      const variants = component.getVariants();
      expect(variants).toEqual({ size: "sm" });
    });

    test("getVariants child setVariants keeps overriding base computed defaultVariants across re-runs", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
        defaultVariants: {
          color: () => "blue" as const,
        },
      });
      const component = getModeComponent(
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
      const variants = component.getVariants();
      expect(variants).toEqual({ color: "red", size: "sm" });
    });

    test("getVariants setVariants sticks across computed default re-runs", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
        defaultVariants: {
          color: () => "blue" as const,
        },
      });
      const component = getModeComponent(
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
      const variants = component.getVariants();
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
          size: ({ defaultValue, variants }) =>
            variants.mode === "on" ? "lg" : defaultValue,
        },
        refine: ({ variants, setVariants }) => {
          if (variants.active) {
            setVariants({ mode: "on" });
          }
        },
      });
      const component = getModeComponent(
        mode,
        cv({ extend: [base], defaultVariants: { size: "sm" } }),
      );
      const variants = component.getVariants({ active: true });
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
      const component = getModeComponent(mode, cv({ extend: [first, second] }));
      const variants = component.getVariants();
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
      const component = getModeComponent(mode, cv({ extend: [first, second] }));
      const variants = component.getVariants();
      expect(variants).toEqual({ color: "blue" });
    });

    test("getVariants computed defaultVariants do not override stable setVariants on later passes", () => {
      const base = cv({
        variants: { color: { red: "base-red", blue: "base-blue" } },
        refine: ({ setVariants }) => {
          setVariants({ color: "red" });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "child-red", blue: "child-blue" } },
          defaultVariants: {
            color: ({ defaultValue, variants }) =>
              variants.color === "red" ? "blue" : defaultValue,
          },
        }),
      );
      const variants = component.getVariants();
      expect(variants).toEqual({ color: "red" });
    });

    test("getVariants computed defaultVariants do not override setVariants from a previous pass", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            color: { red: "red", blue: "blue" },
            done: "",
          },
          defaultVariants: {
            color: ({ defaultValue, variants }) =>
              variants.done ? "blue" : defaultValue,
          },
          refine: ({ variants, setVariants }) => {
            if (!variants.done) {
              setVariants({ color: "red", done: true });
            }
          },
        }),
      );
      const variants = component.getVariants();
      expect(variants).toEqual({ color: "red", done: true });
    });

    test("variantKeys property", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm" }, color: { red: "red" } },
        }),
      );
      expectTypeOf(component.variantKeys).toEqualTypeOf<("size" | "color")[]>();
      expect(component.variantKeys).toEqual(["size", "color"]);
    });

    test("propKeys property", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm" }, color: { red: "red" } } }),
      );
      expectTypeOf(component.propKeys).toExtend<
        ("class" | "className" | "style" | "size" | "color")[]
      >();
      expect(component.propKeys).toEqual(
        getExpectedPropsKeys(config, "size", "color"),
      );
    });

    test("propKeys on different modes", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm" } } }),
      );
      expect(component.propKeys).toEqual(getExpectedPropsKeys(config, "size"));
    });
  });
}

test("propKeys are mode-specific", () => {
  const component = cvBase({
    variants: { size: { sm: "sm", md: "md" } },
  });

  expectTypeOf(component.propKeys).toEqualTypeOf<
    ("class" | "className" | "style" | "size")[]
  >();
  expectTypeOf(component.jsx.propKeys).toEqualTypeOf<
    ("className" | "style" | "size")[]
  >();
  expectTypeOf(component.html.propKeys).toEqualTypeOf<
    ("class" | "style" | "size")[]
  >();
  expectTypeOf(component.htmlObj.propKeys).toEqualTypeOf<
    ("class" | "style" | "size")[]
  >();

  expect(component.propKeys).toEqual(["class", "className", "style", "size"]);
  expect(component.jsx.propKeys).toEqual(["className", "style", "size"]);
  expect(component.html.propKeys).toEqual(["class", "style", "size"]);
  expect(component.htmlObj.propKeys).toEqual(["class", "style", "size"]);
});

test("cx joins class values", () => {
  const { cx } = create({
    transformClass: (className) => `(${className})`,
  });

  expect(
    cx("foo", 1n, ["bar", false, [2n, "baz", 0]], {
      qux: true,
      quux: false,
    }),
  ).toBe("(foo bar baz qux)");
});

test("cx ignores inherited class map keys", () => {
  const { cx } = create();
  const classMap = Object.create({ inherited: true }) as Record<
    string,
    unknown
  >;
  classMap.own = true;

  expect(cx(classMap)).toBe("own");
  expect(cvBase({ class: classMap })().class).toBe("own");
});

describe("Variant utility type", () => {
  test("matches variant keys from another component", () => {
    const base = cvBase({
      variants: { foo: { sm: "foo-sm", lg: "foo-lg" } },
    });
    const component = cvBase({
      extend: [base],
      variants: {
        bar: {
          sm: "bar-sm",
          lg: "bar-lg",
        } satisfies Variant<typeof base, "foo">,
      },
    });
    expect(component({ bar: "sm" }).class).toContain("bar-sm");
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

  test("rejects standalone class object maps", () => {
    const base = cvBase({
      variants: { foo: { sm: "foo-sm", lg: "foo-lg" } },
    });
    cvBase({
      extend: [base],
      variants: {
        bar: {
          // @ts-expect-error class object maps must use a `class` wrapper
          sm: { "bar-sm": true },
          lg: ["bar-lg", { "bar-active": true }],
        } satisfies Variant<typeof base, "foo">,
      },
    });
  });
});
