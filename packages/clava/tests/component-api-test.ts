import { describe, expect, expectTypeOf, test } from "vitest";
import { type Variant, cv as cvBase } from "../src/index.ts";
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

    test("getVariants returns variants set by computed setVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          computed: ({ variants, setVariants }) => {
            if (variants.size === "lg") {
              setVariants({ color: "red" });
            }
          },
        }),
      );
      const variants = component.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "lg", color: "red" });
    });

    test("getVariants returns variants set by computed setDefaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          computed: ({ variants, setDefaultVariants }) => {
            if (variants.size === "lg") {
              setDefaultVariants({ color: "blue" });
            }
          },
        }),
      );
      const variants = component.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "lg", color: "blue" });
    });

    test("getVariants setDefaultVariants does not override props", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          computed: ({ setDefaultVariants }) => {
            setDefaultVariants({ color: "blue" });
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
          computed: ({ setVariants }) => {
            setVariants({ color: "blue" });
          },
        }),
      );
      const variants = component.getVariants({ color: "red" });
      expect(variants).toEqual({ color: "blue" });
    });

    test("keys returns props keys", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm" }, color: { red: "red" } } }),
      );
      expectTypeOf(component.keys).toExtend<
        ("class" | "className" | "style" | "size" | "color")[]
      >();
      expect(component.keys).toEqual(
        getExpectedPropsKeys(config, "size", "color"),
      );
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
});
