import { describe, expect, test } from "vitest";
import { create } from "../src/index.ts";
import {
  CONFIGS,
  createCVFromConfig,
  getConfigDescription,
  getConfigMode,
  getConfigTransformClass,
  getModeComponent,
  getStyleClass,
} from "./_utils.ts";

for (const config of Object.values(CONFIGS)) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("extend single component", () => {
      const base = cv({ class: "base", variants: { size: { sm: "sm" } } });
      const component = getModeComponent(
        mode,
        cv({ extend: [base], class: "extended" }),
      );
      const props = component({ size: "sm" });
      expect(getStyleClass(props)).toEqual({ class: cls("base extended sm") });
    });

    test("extend multiple components", () => {
      const base1 = cv({ class: "base1" });
      const base2 = cv({ class: "base2" });
      const component = getModeComponent(
        mode,
        cv({ extend: [base1, base2], class: "extended" }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("base1 base2 extended"),
      });
    });

    test("extend with variant merging", () => {
      const base = cv({ variants: { size: { sm: "base-sm", lg: "base-lg" } } });
      const component = getModeComponent(
        mode,
        cv({ extend: [base], variants: { size: { sm: "extended-sm" } } }),
      );
      const props = component({ size: "sm" });
      expect(getStyleClass(props)).toEqual({
        class: cls("base-sm extended-sm"),
      });
    });

    test("extend with variant merging setting base variant", () => {
      const base = cv({ variants: { size: { sm: "base-sm", lg: "base-lg" } } });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: "extended-sm" } },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("base-lg") });
    });

    test("extend can disable whole variant with null", () => {
      const base = cv({
        variants: { size: { sm: "base-sm", lg: "base-lg" } },
        defaultVariants: { size: "sm" },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: null },
          defaultVariants: {
            // @ts-expect-error disabled variant cannot be set
            size:
              // no error
              "lg",
          },
        }),
      );
      const props = component({
        // @ts-expect-error disabled variant cannot be set
        size:
          // no error
          "lg",
      });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("extend can disable variant value with null", () => {
      const base = cv({
        variants: { size: { sm: "base-sm", lg: "base-lg" } },
        defaultVariants: { size: "sm" },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          defaultVariants: {
            // @ts-expect-error disabled variant value cannot be set
            size:
              // no error
              "sm",
          },
        }),
      );
      const disabledProps = component({
        // @ts-expect-error disabled variant value cannot be set
        size:
          // no error
          "sm",
      });
      expect(getStyleClass(disabledProps)).toEqual({ class: "" });
      const enabledProps = component({ size: "lg" });
      expect(getStyleClass(enabledProps)).toEqual({ class: cls("base-lg") });
    });

    test("extend disabled variant value accepts valid defaultVariants", () => {
      const base = cv({
        variants: {
          size: {
            sm: { class: "base-sm", style: { fontSize: "12px" } },
            lg: { class: "base-lg", style: { fontSize: "16px" } },
          },
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          defaultVariants: { size: "lg" },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("base-lg"),
        fontSize: "16px",
      });
    });

    test("extend disabled variant value with computed setDefaultVariants", () => {
      const base = cv({
        variants: {
          size: {
            sm: { class: "base-sm", style: { fontSize: "12px" } },
            lg: { class: "base-lg", style: { fontSize: "16px" } },
          },
        },
      });
      const validComponent = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          computed: ({ setDefaultVariants }) => {
            setDefaultVariants({ size: "lg" });
          },
        }),
      );
      expect(getStyleClass(validComponent())).toEqual({
        class: cls("base-lg"),
        fontSize: "16px",
      });

      const invalidComponent = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          computed: ({ setDefaultVariants }) => {
            setDefaultVariants({
              // @ts-expect-error disabled variant value cannot be set
              size:
                // no error
                "sm",
            });
          },
        }),
      );
      expect(getStyleClass(invalidComponent())).toEqual({ class: "" });
    });

    test("extend disabled variant value with computed setVariants", () => {
      const base = cv({
        variants: {
          size: {
            sm: { class: "base-sm", style: { fontSize: "12px" } },
            lg: { class: "base-lg", style: { fontSize: "16px" } },
          },
        },
      });
      const validComponent = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          computed: ({ setVariants }) => {
            setVariants({ size: "lg" });
          },
        }),
      );
      expect(getStyleClass(validComponent())).toEqual({
        class: cls("base-lg"),
        fontSize: "16px",
      });

      const invalidComponent = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          computed: ({ setVariants }) => {
            setVariants({
              // @ts-expect-error disabled variant value cannot be set
              size:
                // no error
                "sm",
            });
          },
        }),
      );
      expect(getStyleClass(invalidComponent())).toEqual({ class: "" });
    });

    test("extend inherits defaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
      });
      const component = getModeComponent(mode, cv({ extend: [base] }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("extend override defaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
      });
      const component = getModeComponent(
        mode,
        cv({ extend: [base], defaultVariants: { size: "lg" } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg") });
    });

    test("extend jsx modal component preserves style", () => {
      const base = cv({
        class: "base",
        style: { backgroundColor: "red" },
      });
      const component = getModeComponent(
        mode,
        cv({ extend: [base.jsx], class: "extended" }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("base extended"),
        backgroundColor: "red",
      });
    });

    test("extend html modal component preserves style", () => {
      const base = cv({
        class: "base",
        style: { backgroundColor: "red" },
      });
      const component = getModeComponent(
        mode,
        cv({ extend: [base.html], class: "extended" }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("base extended"),
        backgroundColor: "red",
      });
    });

    test("extend htmlObj modal component preserves style", () => {
      const base = cv({
        class: "base",
        style: { backgroundColor: "red" },
      });
      const component = getModeComponent(
        mode,
        cv({ extend: [base.htmlObj], class: "extended" }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("base extended"),
        backgroundColor: "red",
      });
    });
  });
}

describe("non-idempotent transformClass", () => {
  // A non-idempotent transform: prefixing each word with `tw-`. Applying it
  // twice yields `tw-tw-foo`, so the engine must invoke it exactly once per
  // class word — even when extend chains pipe extended base classes back into
  // a parent's `clsx` and through the same transform at render time.
  const { cv } = create({
    transformClass: (className) =>
      className
        .split(" ")
        .filter(Boolean)
        .map((word) => `tw-${word}`)
        .join(" "),
  });

  test("base class is transformed exactly once across single extend", () => {
    const base = cv({ class: "base" });
    const component = cv({ extend: [base], class: "extended" });
    expect(component().class).toBe("tw-base tw-extended");
  });

  test("base class is transformed exactly once across multi-level extend", () => {
    const base = cv({ class: "base" });
    const middle = cv({ extend: [base], class: "middle" });
    const top = cv({
      extend: [middle],
      class: "top",
      variants: { size: { sm: "sm" } },
    });
    expect(top({ size: "sm" }).class).toBe("tw-base tw-middle tw-top tw-sm");
  });
});
