import { describe, expect, test, vi } from "vitest";
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

    test("computed re-runs when it changes variants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          computed: ({ variants, setVariants, addClass }) => {
            if (variants.size === "lg") {
              setVariants({ color: "red" });
            }
            if (variants.color === "red") {
              addClass("computed-red");
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg red computed-red"),
      });
    });

    test("computed re-runs when setDefaultVariants changes variants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          computed: ({ variants, setDefaultVariants, addClass }) => {
            setDefaultVariants({ color: "red" });
            if (variants.color === "red") {
              setDefaultVariants({ size: "lg" });
            }
            if (variants.size === "lg") {
              addClass("computed-lg");
            }
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("lg red computed-lg"),
      });
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

    test("computed in extended component does not see foreign variant keys", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        computed: ({ variants, addClass }) => {
          // `color` is added by the parent component below — it must not
          // leak into base's `ctx.variants`, whose shape is declared as
          // `{ size }` only.
          if ("color" in (variants as Record<string, unknown>)) {
            addClass("base-saw-foreign");
          } else {
            addClass("base-no-foreign");
          }
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
        }),
      );
      const props = component({ color: "red" });
      expect(getStyleClass(props)).toEqual({
        class: cls("sm base-no-foreign red"),
      });
    });

    test("setDefaultVariants in extended component does not branch on foreign variant keys", () => {
      // Same shape as the test above, but the base's `computed` reaches
      // `setDefaultVariants` — covers the resolveDefaults pass (driving
      // both class output and `getVariants`) rather than the render-time
      // compute path.
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        computed: ({ variants, setDefaultVariants }) => {
          if ("color" in (variants as Record<string, unknown>)) {
            setDefaultVariants({ size: "lg" });
          }
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
        }),
      );
      const props = component({ color: "red" });
      expect(getStyleClass(props)).toEqual({ class: cls("sm red") });
      expect(component.getVariants({ color: "red" })).toEqual({
        size: "sm",
        color: "red",
      });
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

    test("computed re-runs when base component computed changes variants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, active: "" },
        defaultVariants: { size: "sm" },
        computed: ({ variants, setVariants }) => {
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
          computed: ({ variants, setVariants }) => {
            if (variants.size === "lg") {
              setVariants({ color: "red" });
            }
          },
        }),
      );
      const props = component({ active: true });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("base computed setDefaultVariants works after its own setVariants re-run", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          active: "",
          mode: { on: "on" },
        },
        defaultVariants: { size: "sm" },
        computed: ({ variants, setVariants, setDefaultVariants }) => {
          if (variants.active) {
            setVariants({ mode: "on" });
          }
          if (variants.mode === "on") {
            setDefaultVariants({ size: "lg" });
          }
        },
      });
      const component = getModeComponent(mode, cv({ extend: [base] }));
      const props = component({ active: true });
      expect(getStyleClass(props)).toEqual({ class: cls("lg on") });
    });

    test("computed setVariants uses the latest pending value", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          computed: ({ setVariants }) => {
            setVariants({ size: "lg" });
            setVariants({ size: "sm" });
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("child setVariants keeps overriding base setDefaultVariants across re-runs", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
        computed: ({ setDefaultVariants }) => {
          setDefaultVariants({ color: "blue" });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          computed: ({ variants, setVariants }) => {
            if (variants.size === "sm") {
              setVariants({ color: "red" });
            }
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("red sm") });
    });

    test("computed setVariants sticks across re-runs", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
        computed: ({ setDefaultVariants }) => {
          setDefaultVariants({ color: "blue" });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "", blue: "" }, done: "" },
          computed: ({ variants, setVariants }) => {
            if (!variants.done) {
              setVariants({ color: "red", done: true });
            }
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("red") });
    });

    test("base computed setDefaultVariants can override child static defaults after a re-run", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          active: "",
          mode: { on: "on" },
        },
        computed: ({ variants, setVariants, setDefaultVariants }) => {
          if (variants.active) {
            setVariants({ mode: "on" });
          }
          if (variants.mode === "on") {
            setDefaultVariants({ size: "lg" });
          }
        },
      });
      const component = getModeComponent(
        mode,
        cv({ extend: [base], defaultVariants: { size: "sm" } }),
      );
      const props = component({ active: true });
      expect(getStyleClass(props)).toEqual({ class: cls("lg on") });
    });

    test("setVariants from earlier extends overrides setDefaultVariants from later extends", () => {
      const first = cv({
        variants: { color: { red: "first-red", blue: "first-blue" } },
        computed: ({ setVariants }) => {
          setVariants({ color: "red" });
        },
      });
      const second = cv({
        variants: { color: { red: "second-red", blue: "second-blue" } },
        computed: ({ setDefaultVariants }) => {
          setDefaultVariants({ color: "blue" });
        },
      });
      const component = getModeComponent(mode, cv({ extend: [first, second] }));
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("first-red second-red"),
      });
    });

    test("setDefaultVariants from later extends overrides setDefaultVariants from earlier extends", () => {
      const first = cv({
        variants: { color: { red: "first-red", blue: "first-blue" } },
        computed: ({ setDefaultVariants }) => {
          setDefaultVariants({ color: "red" });
        },
      });
      const second = cv({
        variants: { color: { red: "second-red", blue: "second-blue" } },
        computed: ({ setDefaultVariants }) => {
          setDefaultVariants({ color: "blue" });
        },
      });
      const component = getModeComponent(mode, cv({ extend: [first, second] }));
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("first-blue second-blue"),
      });
    });

    test("setDefaultVariants does not override stable setVariants on later passes", () => {
      const base = cv({
        variants: { color: { red: "base-red", blue: "base-blue" } },
        computed: ({ setVariants }) => {
          setVariants({ color: "red" });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "child-red", blue: "child-blue" } },
          computed: ({ variants, setDefaultVariants }) => {
            if (variants.color === "red") {
              setDefaultVariants({ color: "blue" });
            }
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("base-red child-red"),
      });
    });

    test("setDefaultVariants does not override setVariants from a previous pass", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            color: { red: "red", blue: "blue" },
            done: "",
          },
          computed: ({ variants, setVariants, setDefaultVariants }) => {
            if (!variants.done) {
              setVariants({ color: "red", done: true });
            }
            if (variants.done) {
              setDefaultVariants({ color: "blue" });
            }
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("red") });
    });

    test("computed warns when variants keep changing", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          computed: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      try {
        component();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "Maximum computed update iterations exceeded",
          ),
        );
      } finally {
        warn.mockRestore();
      }
    });

    test("computed warning is shared across extended components", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        computed: ({ variants, setVariants }) => {
          setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
        },
      });
      const component = getModeComponent(mode, cv({ extend: [base] }));

      try {
        component();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "Maximum computed update iterations exceeded",
          ),
        );
      } finally {
        warn.mockRestore();
      }
    });

    test("getVariants warns when variants keep changing", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          computed: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      try {
        component.getVariants();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "Maximum computed update iterations exceeded",
          ),
        );
      } finally {
        warn.mockRestore();
      }
    });

    test("computed warning is omitted in production", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const nodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          computed: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      try {
        component();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = nodeEnv;
        warn.mockRestore();
      }
    });

    test("computed warning is omitted without process", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalProcess = globalThis.process;
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          computed: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      try {
        vi.stubGlobal("process", undefined);
        component();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        vi.stubGlobal("process", originalProcess);
        warn.mockRestore();
      }
    });

    test("computed warning is omitted without process.env", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalProcess = globalThis.process;
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          computed: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      try {
        vi.stubGlobal("process", {});
        component();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        vi.stubGlobal("process", originalProcess);
        warn.mockRestore();
      }
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

    test("computed style does not accept numbers", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          // @ts-expect-error
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
        fontSize: expect.toBeOneOf(["20", "20px"]),
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

    test("computed addStyle does not accept numbers", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants, addStyle }) => {
            if (variants.size === "lg") {
              addStyle({
                // @ts-expect-error
                fontSize: 20,
              });
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: expect.toBeOneOf(["20", "20px"]),
      });
    });
  });
}
