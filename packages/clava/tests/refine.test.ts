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
    test("refine", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants }) =>
            variants.size === "lg" ? "refine-lg" : null,
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg refine-lg") });
    });

    test("refine with setVariants", () => {
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
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("refine re-runs when it changes variants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          refine: ({ variants, setVariants, addClass }) => {
            if (variants.size === "lg") {
              setVariants({ color: "red" });
            }
            if (variants.color === "red") {
              addClass("refine-red");
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg red refine-red"),
      });
    });

    test("refine re-runs when setDefaultVariants changes variants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          refine: ({ variants, setDefaultVariants, addClass }) => {
            setDefaultVariants({ color: "red" });
            if (variants.color === "red") {
              setDefaultVariants({ size: "lg" });
            }
            if (variants.size === "lg") {
              addClass("refine-lg");
            }
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("lg red refine-lg"),
      });
    });

    test("refine converges with NaN setDefaultVariants", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            value: (value: number) => (Number.isNaN(value) ? "nan" : null),
          },
          refine: ({ variants, setDefaultVariants, addClass }) => {
            setDefaultVariants({ value: Number.NaN });
            if (Number.isNaN(variants.value)) {
              addClass("refine-nan");
            }
          },
        }),
      );

      try {
        const props = component();
        expect(getStyleClass(props)).toEqual({
          class: cls("nan refine-nan"),
        });
        expect(component.getVariants()).toEqual({ value: Number.NaN });
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    test("refine converges with undefined setDefaultVariants", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: {
          invert: { true: "invert" },
          offset: (value: boolean | undefined) =>
            value ? "offset" : undefined,
          push: (value: number | undefined) =>
            value === undefined ? undefined : `push-${value}`,
        },
        refine: ({ variants, setDefaultVariants }) => {
          setDefaultVariants({
            offset: !variants.invert,
            push: variants.invert ? 20 : undefined,
          });
        },
      });
      const component = getModeComponent(mode, cv({ extend: [base] }));

      try {
        const props = component();
        expect(getStyleClass(props)).toEqual({
          class: cls("offset"),
        });
        expect(component.getVariants()).toEqual({
          offset: true,
          push: undefined,
        });
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    test("refine converges with undefined setDefaultVariants in nested extends", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const calls = {
        layer: 0,
        frame: 0,
        control: 0,
      };
      const layer = cv({
        variants: {
          layer: { true: "layer" },
          invert: { true: "invert" },
          offset: (value: boolean | undefined) =>
            value ? "offset" : undefined,
          push: (value: number | undefined) =>
            value === undefined ? undefined : `push-${value}`,
        },
        defaultVariants: {
          layer: true,
        },
        refine: ({ variants, setDefaultVariants }) => {
          calls.layer += 1;
          setDefaultVariants({
            offset: !variants.invert,
            push: variants.invert ? 20 : undefined,
          });
        },
      });
      const frame = cv({
        extend: [layer],
        variants: {
          frame: { true: "frame" },
        },
        defaultVariants: {
          frame: true,
        },
        refine: () => {
          calls.frame += 1;
        },
      });
      const control = cv({
        extend: [frame],
        variants: {
          control: { true: "control" },
        },
        defaultVariants: {
          control: true,
          offset: true,
        },
        refine: () => {
          calls.control += 1;
        },
      });
      const component = getModeComponent(mode, cv({ extend: [control] }));

      try {
        const props = component();
        expect(getStyleClass(props)).toEqual({
          class: cls("layer offset frame control"),
        });
        expect(calls).toEqual({
          layer: 2,
          frame: 2,
          control: 2,
        });
        calls.layer = 0;
        calls.frame = 0;
        calls.control = 0;
        expect(component.getVariants()).toEqual({
          layer: true,
          offset: true,
          push: undefined,
          frame: true,
          control: true,
        });
        expect(calls).toEqual({
          layer: 2,
          frame: 2,
          control: 2,
        });
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    test("refine with setDefaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          refine: ({ variants, setDefaultVariants }) => {
            if (variants.size === "lg") {
              setDefaultVariants({ color: "red" });
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("refine setDefaultVariants does not override props", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          refine: ({ setDefaultVariants }) => {
            setDefaultVariants({ color: "red" });
          },
        }),
      );
      const props = component({ size: "lg", color: "blue" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg blue") });
    });

    test("refine setDefaultVariants overrides defaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: { size: "sm", color: "red" },
          refine: ({ setDefaultVariants }) => {
            setDefaultVariants({ color: "blue" });
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm blue") });
    });

    test("refine setDefaultVariants overrides extended defaultVariants", () => {
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
          refine: ({ setDefaultVariants }) => {
            setDefaultVariants({ color: "blue" });
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("blue sm") });
    });

    test("refine setDefaultVariants overrides child defaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "sm", color: "red" },
          refine: ({ setDefaultVariants }) => {
            setDefaultVariants({ size: "lg" });
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("refine setDefaultVariants from parent overrides child defaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        refine: ({ setDefaultVariants }) => {
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

    test("refine setDefaultVariants from parent overrides child defaultVariants based on props", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, enabled: "" },
        defaultVariants: { size: "sm" },
        refine: ({ variants, setDefaultVariants }) => {
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

    test("refine receives default variants from child", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, large: "" },
        defaultVariants: { size: "sm" },
        refine: ({ variants, setDefaultVariants }) => {
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

    test("refine receives default variants from grandchild", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, large: "" },
        defaultVariants: { size: "sm" },
        refine: ({ variants, setDefaultVariants }) => {
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

    test("refine receives default variants from intermediate component", () => {
      const parent = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        refine: ({ variants, setDefaultVariants }) => {
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

    test("child refine setDefaultVariants overrides parent refine setDefaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        refine: ({ setDefaultVariants }) => {
          setDefaultVariants({ size: "lg" });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "sm", color: "red" },
          refine: ({ setDefaultVariants }) => {
            setDefaultVariants({ size: "sm" });
          },
        }),
      );
      const props = component();
      // Order: parent defaultVariants (sm) -> child defaultVariants (sm)
      //     -> parent refine.setDefaultVariants (lg)
      //     -> child refine.setDefaultVariants (sm)
      expect(getStyleClass(props)).toEqual({ class: cls("sm red") });
    });

    test("refine in extended component does not see foreign variant keys", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        refine: ({ variants, addClass }) => {
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
      // Same shape as the test above, but the base's `refine` reaches
      // `setDefaultVariants` — covers the resolveDefaults pass (driving
      // both class output and `getVariants`) rather than the render-time
      // compute path.
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        refine: ({ variants, setDefaultVariants }) => {
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

    test("child setDefaultVariants receives refined variants from parent", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, small: "" },
        refine: ({ setDefaultVariants }) => {
          setDefaultVariants({ small: true });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "lg", color: "red" },
          refine: ({ variants, setDefaultVariants }) => {
            if (variants.small) {
              setDefaultVariants({ size: "sm" });
            }
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm red") });
    });

    test("refine re-runs when base component refine changes variants", () => {
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
      const props = component({ active: true });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("base refine setDefaultVariants works after its own setVariants re-run", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          active: "",
          mode: { on: "on" },
        },
        defaultVariants: { size: "sm" },
        refine: ({ variants, setVariants, setDefaultVariants }) => {
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

    test("refine setVariants uses the latest pending value", () => {
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
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("refine setVariants does not mutate props with plain extends", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { active: "" },
          refine: ({ variants, setVariants }) => {
            if (variants.active) {
              setVariants({ color: "red" });
            }
          },
        }),
      );
      const mutableProps = { active: true };
      component(mutableProps);
      expect(mutableProps).toEqual({ active: true });

      const frozenProps = Object.freeze({ active: true });
      const getProps = () => component(frozenProps);
      expect(getProps).not.toThrow();
      expect(getStyleClass(getProps())).toEqual({ class: cls("red") });
    });

    test("child setVariants keeps overriding base setDefaultVariants across re-runs", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
        refine: ({ setDefaultVariants }) => {
          setDefaultVariants({ color: "blue" });
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
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("red sm") });
    });

    test("refine setVariants sticks across re-runs", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
        refine: ({ setDefaultVariants }) => {
          setDefaultVariants({ color: "blue" });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "", blue: "" }, done: "" },
          refine: ({ variants, setVariants }) => {
            if (!variants.done) {
              setVariants({ color: "red", done: true });
            }
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("red") });
    });

    test("base refine setDefaultVariants can override child static defaults after a re-run", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          active: "",
          mode: { on: "on" },
        },
        refine: ({ variants, setVariants, setDefaultVariants }) => {
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
        refine: ({ setVariants }) => {
          setVariants({ color: "red" });
        },
      });
      const second = cv({
        variants: { color: { red: "second-red", blue: "second-blue" } },
        refine: ({ setDefaultVariants }) => {
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
        refine: ({ setDefaultVariants }) => {
          setDefaultVariants({ color: "red" });
        },
      });
      const second = cv({
        variants: { color: { red: "second-red", blue: "second-blue" } },
        refine: ({ setDefaultVariants }) => {
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
        refine: ({ setVariants }) => {
          setVariants({ color: "red" });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "child-red", blue: "child-blue" } },
          refine: ({ variants, setDefaultVariants }) => {
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
          refine: ({ variants, setVariants, setDefaultVariants }) => {
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

    test("refine warns when variants keep changing", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          refine: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      try {
        component();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("Maximum refine iterations exceeded"),
        );
      } finally {
        warn.mockRestore();
      }
    });

    test("refine warning is shared across extended components", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        refine: ({ variants, setVariants }) => {
          setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
        },
      });
      const component = getModeComponent(mode, cv({ extend: [base] }));

      try {
        component();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("Maximum refine iterations exceeded"),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringMatching(
            /Variant\(s\) that did not stabilize: [^\n]*\bsize\b/,
          ),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringMatching(
            /Latest variant changes before warning: [^\n]*\bsize: "(sm|lg)" -> "(sm|lg)"/,
          ),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("Component created at:"),
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
          refine: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      try {
        component.getVariants();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("Maximum refine iterations exceeded"),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringMatching(
            /Variant\(s\) that did not stabilize: [^\n]*\bsize\b/,
          ),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringMatching(
            /Latest variant changes before warning: [^\n]*\bsize: "(sm|lg)" -> "(sm|lg)"/,
          ),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("Component created at:"),
        );
      } finally {
        warn.mockRestore();
      }
    });

    test("refine warning is omitted in production", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv("NODE_ENV", "production");
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          refine: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      try {
        component();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
        warn.mockRestore();
      }
    });

    test("refine warning names the variant key that did not stabilize", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: { size: "sm", color: "red" },
          refine: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      try {
        component();
        expect(warn).toHaveBeenCalledWith(
          expect.stringMatching(
            /Variant\(s\) that did not stabilize: [^\n]*\bsize\b/,
          ),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.not.stringMatching(
            /Variant\(s\) that did not stabilize: [^\n]*\bcolor\b/,
          ),
        );
      } finally {
        warn.mockRestore();
      }
    });

    test("refine warning reports keys that oscillate at different cadences", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      // `size` flips every iteration, `color` flips every other iteration, so
      // the final pair may agree on one of them — the warning must still name
      // both keys because each contributed to a transition.
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: { size: "sm", color: "red" },
          refine: ({ variants, setVariants }) => {
            setVariants({
              size: variants.size === "sm" ? "lg" : "sm",
              color:
                variants.size === "sm"
                  ? variants.color === "red"
                    ? "blue"
                    : "red"
                  : variants.color,
            });
          },
        }),
      );

      try {
        component();
        expect(warn).toHaveBeenCalledWith(
          expect.stringMatching(
            /Variant\(s\) that did not stabilize: [^\n]*\bsize\b/,
          ),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringMatching(
            /Variant\(s\) that did not stabilize: [^\n]*\bcolor\b/,
          ),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringMatching(
            /Latest variant changes before warning: [^\n]*\bsize\b[^\n]*\bcolor\b/,
          ),
        );
      } finally {
        warn.mockRestore();
      }
    });

    test("refine warning includes the component creation stack", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          refine: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      try {
        component();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("Component created at:"),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("refine.test.ts"),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.not.stringContaining("node_modules"),
        );
      } finally {
        warn.mockRestore();
      }
    });

    test("refine warning fallback stack skips internal creation frames", () => {
      const ErrorWithCaptureStackTrace = Error as ErrorConstructor & {
        captureStackTrace?: (
          targetObject: object,
          constructorOpt?: Function,
        ) => void;
      };
      const captureStackTrace = ErrorWithCaptureStackTrace.captureStackTrace;
      Reflect.deleteProperty(ErrorWithCaptureStackTrace, "captureStackTrace");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          refine: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      try {
        component();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("Component created at:"),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("refine.test.ts"),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.not.stringContaining("captureCreationFrame"),
        );
      } finally {
        if (captureStackTrace) {
          ErrorWithCaptureStackTrace.captureStackTrace = captureStackTrace;
        }
        warn.mockRestore();
      }
    });

    test("refine warning omits the creation stack when cv ran in production", () => {
      let captured = "";
      const warn = vi
        .spyOn(console, "warn")
        .mockImplementation((message: unknown) => {
          captured = String(message);
        });
      vi.stubEnv("NODE_ENV", "production");
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          refine: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      try {
        vi.unstubAllEnvs();
        component();
        expect(captured).toContain("Maximum refine iterations exceeded");
        expect(captured).not.toContain("Component created at:");
      } finally {
        vi.unstubAllEnvs();
        warn.mockRestore();
      }
    });

    test("refine setDefaultVariants when explicitly passing undefined", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          refine: ({ setDefaultVariants }) => {
            setDefaultVariants({ color: "red" });
          },
        }),
      );
      const props = component({ size: "lg", color: undefined });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("refine with defaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: { size: "lg" },
          refine: ({ variants }) =>
            variants.size === "lg" ? "refine-lg" : null,
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg refine-lg") });
    });

    test("refine with defaultVariants from extended", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "lg" },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          refine: ({ variants }) =>
            variants.size === "lg" ? "refine-lg" : null,
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg refine-lg") });
    });

    test("refine from parent receives boolean default value from overridden variant in child", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          border: { default: "default", true: "border", false: "" },
        },
        defaultVariants: { size: "lg" },
        refine: ({ variants, setVariants }) => {
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
          variants: {
            border: (_: boolean) => {},
          },
          defaultVariants: { border: false },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("refine from parent receives boolean default value from overridden variant in grandchild", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          border: { default: "default", true: "border", false: "" },
        },
        defaultVariants: { size: "lg" },
        refine: ({ variants, setVariants }) => {
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
          variants: {
            border: (_: boolean) => {},
          },
          defaultVariants: { border: false },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("refine from parent receives false prop from overridden variant in child", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          border: { default: "default", true: "border", false: "" },
        },
        defaultVariants: { size: "lg" },
        refine: ({ variants, setVariants }) => {
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
          variants: {
            border: (_: boolean) => {},
          },
        }),
      );
      const props = component({ border: false });
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("refine from parent receives true prop from overridden variant in child", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          border: { default: "default", true: "border", false: "" },
        },
        defaultVariants: { size: "lg" },
        refine: ({ variants, setVariants }) => {
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
          variants: {
            border: (_: boolean) => {},
          },
        }),
      );
      const props = component({ border: true });
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("refine from parent receives true prop from overridden variant in grandchild", () => {
      const base = cv({
        variants: {
          size: { sm: "sm", lg: "lg" },
          border: { default: "default", true: "border", false: "" },
        },
        defaultVariants: { size: "lg" },
        refine: ({ variants, setVariants }) => {
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
          variants: {
            border: (_: boolean) => {},
          },
        }),
      );
      const props = component({ border: true });
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("refine with style", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants }) =>
            variants.size === "lg" ? { style: { fontSize: "20px" } } : null,
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: "20px",
      });
    });

    test("refine with class and style", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants }) =>
            variants.size === "lg"
              ? { class: "refine-lg", style: { fontSize: "20px" } }
              : null,
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg refine-lg"),
        fontSize: "20px",
      });
    });

    test("refine style does not accept numbers", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          // @ts-expect-error
          refine: ({ variants }) =>
            variants.size === "lg"
              ? {
                  class: "refine-lg",
                  style: { fontSize: 20 },
                }
              : null,
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg refine-lg"),
        fontSize: expect.toBeOneOf(["20", "20px"]),
      });
    });

    test("refine setVariants does not accept invalid keys", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ setVariants }) => {
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

    test("refine setVariants does not accept invalid values", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ setVariants }) => {
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

    test("refine addClass with string", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants, addClass }) => {
            if (variants.size === "lg") {
              addClass("added-lg");
            }
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg added-lg") });
    });

    test("refine addClass with array", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants, addClass }) => {
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

    test("refine addStyle", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants, addStyle }) => {
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

    test("refine addClass combined with return value", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants, addClass }) => {
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

    test("refine addStyle combined with return value", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants, addStyle }) => {
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

    test("refine addClass and addStyle together", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants, addClass, addStyle }) => {
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

    test("refine addClass and addStyle with return value", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants, addClass, addStyle }) => {
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

    test("refine addClass multiple calls", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants, addClass }) => {
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

    test("refine addStyle multiple calls merges styles", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants, addStyle }) => {
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

    test("refine addStyle later call overrides earlier", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants, addStyle }) => {
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

    test("refine addStyle does not accept numbers", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants, addStyle }) => {
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
