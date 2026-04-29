import { describe, expect, test } from "vitest";
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
    test("computed", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants }) =>
            variants.size === "lg" ? "computed-lg" : null,
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg computed-lg") });
    });

    test("computed with setVariants", () => {
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
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("computed with setDefaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          computed: ({ variants, setDefaultVariants }) => {
            if (variants.size === "lg") {
              setDefaultVariants({ color: "red" });
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("computed setDefaultVariants does not override props", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          computed: ({ setDefaultVariants }) => {
            setDefaultVariants({ color: "red" });
          },
        }),
      );
      const props = component({ size: "lg", color: "blue" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg blue") });
    });

    test("computed setDefaultVariants overrides defaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: { size: "sm", color: "red" },
          computed: ({ setDefaultVariants }) => {
            setDefaultVariants({ color: "blue" });
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm blue") });
    });

    test("computed setDefaultVariants overrides extended defaultVariants", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
        defaultVariants: { color: "red" },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          computed: ({ setDefaultVariants }) => {
            setDefaultVariants({ color: "blue" });
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("blue sm") });
    });

    test("computed setDefaultVariants overrides child defaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "sm", color: "red" },
          computed: ({ setDefaultVariants }) => {
            setDefaultVariants({ size: "lg" });
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("computed setDefaultVariants from parent overrides child defaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        computed: ({ setDefaultVariants }) => {
          setDefaultVariants({ size: "lg" });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "sm", color: "red" },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("computed setDefaultVariants from parent overrides child defaultVariants based on props", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, enabled: "" },
        defaultVariants: { size: "sm" },
        computed: ({ variants, setDefaultVariants }) => {
          if (!variants.enabled) return;
          setDefaultVariants({ size: "lg" });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "sm", color: "red" },
        }),
      );
      const props = component({ enabled: true });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("computed receives default variants from child", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, large: "" },
        defaultVariants: { size: "sm" },
        computed: ({ variants, setDefaultVariants }) => {
          if (variants.large) {
            setDefaultVariants({ size: "lg" });
          }
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "sm", color: "red", large: true },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("computed receives default variants from grandchild", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, large: "" },
        defaultVariants: { size: "sm" },
        computed: ({ variants, setDefaultVariants }) => {
          if (variants.large) {
            setDefaultVariants({ size: "lg" });
          }
        },
      });
      const base2 = cv({ extend: [base] });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base2],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "sm", color: "red", large: true },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("computed receives default variants from intermediate component", () => {
      const parent = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        computed: ({ variants, setDefaultVariants }) => {
          if (!variants.size) {
            setDefaultVariants({ size: "lg" });
          }
        },
      });
      const child = cv({ extend: [parent], defaultVariants: { size: "sm" } });
      const component = getModeComponent(mode, cv({ extend: [child] }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("child computed setDefaultVariants overrides parent computed setDefaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        computed: ({ setDefaultVariants }) => {
          setDefaultVariants({ size: "lg" });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "sm", color: "red" },
          computed: ({ setDefaultVariants }) => {
            setDefaultVariants({ size: "sm" });
          },
        }),
      );
      const props = component();
      // Order: parent defaultVariants (sm) -> child defaultVariants (sm)
      //     -> parent computed.setDefaultVariants (lg)
      //     -> child computed.setDefaultVariants (sm)
      expect(getStyleClass(props)).toEqual({ class: cls("sm red") });
    });

    test("child setDefaultVariants receives computed variants from parent", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, small: "" },
        computed: ({ setDefaultVariants }) => {
          setDefaultVariants({ small: true });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "lg", color: "red" },
          computed: ({ variants, setDefaultVariants }) => {
            if (variants.small) {
              setDefaultVariants({ size: "sm" });
            }
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm red") });
    });

    test("computed setDefaultVariants when explicitly passing undefined", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          computed: ({ setDefaultVariants }) => {
            setDefaultVariants({ color: "red" });
          },
        }),
      );
      const props = component({ size: "lg", color: undefined });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("computed with defaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: { size: "lg" },
          computed: ({ variants }) =>
            variants.size === "lg" ? "computed-lg" : null,
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg computed-lg") });
    });

    test("computed with defaultVariants from extended", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "lg" },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          computed: ({ variants }) =>
            variants.size === "lg" ? "computed-lg" : null,
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg computed-lg") });
    });

    test("computed from parent receives boolean default value from overridden variant in child", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          border: { default: "default", true: "border", false: "" },
        },
        defaultVariants: { size: "lg" },
        computed: ({ variants, setVariants }) => {
          expect(variants.border).toBe(false);
          if (!variants.border) {
            setVariants({ size: "sm" });
          }
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          computedVariants: {
            border: (_: boolean) => {},
          },
          defaultVariants: { border: false },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("computed from parent receives boolean default value from overridden variant in grandchild", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          border: { default: "default", true: "border", false: "" },
        },
        defaultVariants: { size: "lg" },
        computed: ({ variants, setVariants }) => {
          expect(variants.border).toBe(false);
          if (!variants.border) {
            setVariants({ size: "sm" });
          }
        },
      });
      const base2 = cv({ extend: [base] });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base2],
          computedVariants: {
            border: (_: boolean) => {},
          },
          defaultVariants: { border: false },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("computed from parent receives false prop from overridden variant in child", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          border: { default: "default", true: "border", false: "" },
        },
        defaultVariants: { size: "lg" },
        computed: ({ variants, setVariants }) => {
          expect(variants.border).toBe(false);
          if (!variants.border) {
            setVariants({ size: "sm" });
          }
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          computedVariants: {
            border: (_: boolean) => {},
          },
        }),
      );
      const props = component({ border: false });
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("computed from parent receives true prop from overridden variant in child", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          border: { default: "default", true: "border", false: "" },
        },
        defaultVariants: { size: "lg" },
        computed: ({ variants, setVariants }) => {
          expect(variants.border).toBe(true);
          if (variants.border) {
            setVariants({ size: "sm" });
          }
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          computedVariants: {
            border: (_: boolean) => {},
          },
        }),
      );
      const props = component({ border: true });
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("computed from parent receives true prop from overridden variant in grandchild", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          border: { default: "default", true: "border", false: "" },
        },
        defaultVariants: { size: "lg" },
        computed: ({ variants, setVariants }) => {
          expect(variants.border).toBe(true);
          if (variants.border) {
            setVariants({ size: "sm" });
          }
        },
      });
      const base2 = cv({ extend: [base] });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base2],
          computedVariants: {
            border: (_: boolean) => {},
          },
        }),
      );
      const props = component({ border: true });
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("computed with style", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants }) =>
            variants.size === "lg" ? { style: { fontSize: "20px" } } : null,
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: "20px",
      });
    });

    test("computed with class and style", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants }) =>
            variants.size === "lg"
              ? { class: "computed-lg", style: { fontSize: "20px" } }
              : null,
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg computed-lg"),
        fontSize: "20px",
      });
    });

    test("computed style accepts numbers", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants }) =>
            variants.size === "lg"
              ? {
                  class: "computed-lg",
                  style: { fontSize: 20 },
                }
              : null,
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg computed-lg"),
        fontSize: "20",
      });
    });

    test("computed setVariants does not accept invalid keys", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ setVariants }) => {
            setVariants({
              // @ts-expect-error
              invalidKey: "value",
            });
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg") });
    });

    test("computed setVariants does not accept invalid values", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ setVariants }) => {
            setVariants({
              // @ts-expect-error invalid value
              size:
                // no error
                "invalid",
            });
          },
        }),
      );
      const props = component({ size: "lg" });
      // Invalid value overrides the valid one, resulting in no match
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("computed addClass with string", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants, addClass }) => {
            if (variants.size === "lg") {
              addClass("added-lg");
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg added-lg") });
    });

    test("computed addClass with array", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants, addClass }) => {
            if (variants.size === "lg") {
              addClass(["added-lg", "extra-class"]);
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg added-lg extra-class"),
      });
    });

    test("computed addStyle", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants, addStyle }) => {
            if (variants.size === "lg") {
              addStyle({ fontSize: "20px" });
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: "20px",
      });
    });

    test("computed addClass combined with return value", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants, addClass }) => {
            if (variants.size === "lg") {
              addClass("added-class");
            }
            return "returned-class";
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg added-class returned-class"),
      });
    });

    test("computed addStyle combined with return value", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants, addStyle }) => {
            if (variants.size === "lg") {
              addStyle({ fontSize: "20px" });
            }
            return { style: { backgroundColor: "red" } };
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: "20px",
        backgroundColor: "red",
      });
    });

    test("computed addClass and addStyle together", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants, addClass, addStyle }) => {
            if (variants.size === "lg") {
              addClass("added-lg");
              addStyle({ fontSize: "20px" });
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg added-lg"),
        fontSize: "20px",
      });
    });

    test("computed addClass and addStyle with return value", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants, addClass, addStyle }) => {
            if (variants.size === "lg") {
              addClass("added-lg");
              addStyle({ fontSize: "20px" });
            }
            return {
              class: "returned-class",
              style: { backgroundColor: "red" },
            };
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg added-lg returned-class"),
        fontSize: "20px",
        backgroundColor: "red",
      });
    });

    test("computed addClass multiple calls", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants, addClass }) => {
            if (variants.size === "lg") {
              addClass("first");
              addClass("second");
              addClass("third");
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg first second third"),
      });
    });

    test("computed addStyle multiple calls merges styles", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants, addStyle }) => {
            if (variants.size === "lg") {
              addStyle({ fontSize: "20px" });
              addStyle({ backgroundColor: "red" });
              addStyle({ color: "blue" });
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: "20px",
        backgroundColor: "red",
        color: "blue",
      });
    });

    test("computed addStyle later call overrides earlier", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants, addStyle }) => {
            if (variants.size === "lg") {
              addStyle({ fontSize: "16px" });
              addStyle({ fontSize: "20px" });
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: "20px",
      });
    });

    test("computed addStyle accepts numbers", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants, addStyle }) => {
            if (variants.size === "lg") {
              addStyle({ fontSize: 20 });
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: "20",
      });
    });
  });
}
