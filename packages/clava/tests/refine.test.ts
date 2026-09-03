import { describe, expect, test, vi } from "vitest";
import type { AnyComponent } from "../src/types.ts";
import {
  CONFIGS,
  createCVFromConfig,
  getConfigDescription,
  getConfigMode,
  getConfigTransformClass,
  getModeComponent,
  getStyleClass,
} from "./_utils.ts";

function extendComponent(
  cv: ReturnType<typeof createCVFromConfig>,
  component: AnyComponent,
  depth: number,
) {
  let extended = component;
  for (let i = 0; i < depth; i++) {
    extended = cv({ extend: [extended] });
  }
  return extended;
}

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

    test("refine re-runs when computed defaultVariants change variants", () => {
      const component = getModeComponent(
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
          refine: ({ variants, addClass }) => {
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

    test("refine converges with NaN computed defaultVariants", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            value: (value: number) => (Number.isNaN(value) ? "nan" : null),
          },
          defaultVariants: {
            value: () => Number.NaN,
          },
          refine: ({ variants, addClass }) => {
            if (Number.isNaN(variants.value)) {
              addClass("refine-nan");
            }
          },
        }),
      );

      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("nan refine-nan"),
      });
      expect(component.getVariants()).toEqual({ value: Number.NaN });
      expect(warn).not.toHaveBeenCalled();
    });

    test("computed defaultVariants can clear inherited defaults", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: {
          invert: { true: "invert" },
          offset: (value: boolean | undefined) =>
            value ? "offset" : undefined,
          push: (value: number | undefined) =>
            value === undefined ? undefined : `push-${value}`,
        },
        defaultVariants: {
          offset: (_, variants) => !variants.invert,
          push: (_, variants) => (variants.invert ? 20 : undefined),
        },
      });
      const component = getModeComponent(mode, cv({ extend: [base] }));

      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("offset"),
      });
      expect(component.getVariants()).toEqual({
        offset: true,
      });
      expect(warn).not.toHaveBeenCalled();
    });

    test("computed defaultVariants use inherited defaults as defaultValue", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
          offset: (defaultValue, variants) => {
            calls.layer += 1;
            return variants.invert ? false : defaultValue;
          },
          push: (_, variants) => (variants.invert ? 20 : undefined),
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

      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("layer offset frame control"),
      });
      expect(component.getVariants()).toEqual({
        layer: true,
        offset: true,
        frame: true,
        control: true,
      });
      expect(calls.layer).toBeGreaterThan(0);
      expect(calls.frame).toBeGreaterThan(0);
      expect(calls.control).toBeGreaterThan(0);
      expect(warn).not.toHaveBeenCalled();
    });

    test("computed defaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: {
            color: (defaultValue, variants) =>
              variants.size === "lg" ? "red" : defaultValue,
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("computed defaultVariants do not override props", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: {
            color: () => "red" as const,
          },
        }),
      );
      const props = component({ size: "lg", color: "blue" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg blue") });
    });

    test("computed defaultVariants override extended defaultVariants", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
        defaultVariants: { color: "red" },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: {
            size: "sm",
            color: () => "blue" as const,
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("blue sm") });
    });

    test("parent computed defaultVariants can override child defaultVariants", () => {
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
          defaultVariants: { size: "sm", color: "red" },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("parent computed defaultVariants can depend on child defaults", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, large: "" },
        defaultVariants: {
          size: (defaultValue, variants) =>
            variants.large ? "lg" : defaultValue,
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

    test("computed defaultVariants preserve intermediate defaults", () => {
      const parent = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: {
          size: (defaultValue, variants) =>
            variants.size ? defaultValue : "lg",
        },
      });
      const child = cv({ extend: [parent], defaultVariants: { size: "sm" } });
      const component = getModeComponent(mode, cv({ extend: [child] }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("child computed defaultVariants override parent computed defaultVariants", () => {
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
          defaultVariants: {
            size: () => "sm" as const,
            color: "red",
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm red") });
    });

    test("child computed defaultVariants can preserve parent computed defaultVariants", () => {
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
          defaultVariants: {
            size: (defaultValue) => defaultValue,
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg") });
      expect(component.getVariants()).toEqual({ size: "lg" });
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
          defaultVariants: { size: "sm" },
        }),
      );
      const props = component({ color: "red" });
      expect(getStyleClass(props)).toEqual({
        class: cls("sm base-no-foreign red"),
      });
    });

    test("computed defaultVariants in extended component do not branch on foreign variant keys", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: {
          size: (defaultValue, variants) =>
            "color" in (variants as Record<string, unknown>)
              ? "lg"
              : defaultValue,
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const props = component({ color: "red" });
      expect(getStyleClass(props)).toEqual({ class: cls("sm red") });
      expect(component.getVariants({ color: "red" })).toEqual({
        size: "sm",
        color: "red",
      });
    });

    test("child computed defaultVariants receive refined variants from parent", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" }, small: "" },
        refine: ({ setVariants }) => {
          setVariants({ small: true });
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: {
            size: (defaultValue, variants) =>
              variants.small ? "sm" : defaultValue,
            color: "red",
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

    test("computed defaultVariants work after a setVariants re-run", () => {
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

    test("refine setVariants restores a value it cleared in the same pass", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          refine: ({ setVariants }) => {
            setVariants({ size: undefined });
            setVariants({ size: "sm" });
          },
        }),
      );

      // The second call has to compare against the cleared `undefined` that the
      // first call recorded. Reading the recorded value with `??` instead would
      // fall back to the resolved `"sm"`, drop the restore, and leave the chain
      // flipping between `undefined` and `"sm"` until it hits the run limit.
      expect(getStyleClass(component())).toEqual({ class: cls("sm") });
      expect(warn).not.toHaveBeenCalled();
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

    test("child setVariants keeps overriding base computed defaultVariants across re-runs", () => {
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
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("red sm") });
    });

    test("refine setVariants sticks across computed default re-runs", () => {
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

    test("base computed defaultVariants can override child static defaults after a re-run", () => {
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
      const component = getModeComponent(
        mode,
        cv({ extend: [base], defaultVariants: { size: "sm" } }),
      );
      const props = component({ active: true });
      expect(getStyleClass(props)).toEqual({ class: cls("lg on") });
    });

    test("parent computed defaultVariants fall back to child defaults after a dependency changes", () => {
      const layer = cv({
        variants: {
          a: { one: "one", two: "two" },
          b: { true: "b-true", false: "b-false" },
        },
        defaultVariants: {
          b: true,
          a: (defaultValue, variants) => (variants.b ? "one" : defaultValue),
        },
        refine: ({ variants, setVariants }) => {
          if (variants.b) {
            setVariants({ b: false });
          }
        },
      });
      const component = getModeComponent(
        mode,
        cv({ extend: [layer], defaultVariants: { a: "two" } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("two b-false") });
      expect(component.getVariants()).toEqual({ a: "two", b: false });
    });

    test("setVariants from earlier extends overrides computed defaultVariants from later extends", () => {
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
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("first-red second-red"),
      });
    });

    test("computed defaultVariants from later extends apply to final output", () => {
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
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("first-blue second-blue"),
      });
    });

    test("computed defaultVariants do not override stable setVariants on later passes", () => {
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
            color: (defaultValue, variants) =>
              variants.color === "red" ? "blue" : defaultValue,
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("base-red child-red"),
      });
    });

    test("computed defaultVariants do not override setVariants from a previous pass", () => {
      const component = getModeComponent(
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
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("red") });
    });

    test("stable extension depth does not consume refine iterations", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: { state: { ready: "ready" } },
        refine: ({ variants, setVariants }) => {
          if (!variants.state) {
            setVariants({ state: "ready" });
          }
        },
      });
      const extension = extendComponent(cv, base, 50);
      const component = cv({ extend: [extension] });

      expect(component.getVariants()).toEqual({ state: "ready" });
      expect(warn).not.toHaveBeenCalled();
    });

    test("deep extension retains refine output", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        refine: ({ addClass, addStyle }) => {
          addClass("refined");
          addStyle({ color: "red" });
        },
      });
      const extension = extendComponent(cv, base, 50);
      const component = getModeComponent(mode, cv({ extend: [extension] }));

      expect(getStyleClass(component())).toEqual({
        color: "red",
        class: cls("refined"),
      });
      expect(warn).not.toHaveBeenCalled();
    });

    test("deep oscillating refine extensions still stop at the limit", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      let refineRuns = 0;
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        refine: ({ variants, setVariants }) => {
          refineRuns += 1;
          setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
        },
      });
      const extension = extendComponent(cv, base, 50);
      const component = getModeComponent(mode, cv({ extend: [extension] }));

      component();
      expect(refineRuns).toBe(50);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Maximum refine iterations exceeded"),
      );
    });

    test("refine warns when variants keep changing", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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

      component();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Maximum refine iterations exceeded"),
      );
    });

    test("refine warning is shared across extended components", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        refine: ({ variants, setVariants }) => {
          setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
        },
      });
      const component = getModeComponent(mode, cv({ extend: [base] }));

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
    });

    test("getVariants warns when variants keep changing", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
    });

    test("refine warning is omitted in production", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
      }
    });

    test("refine warning names the variant key that did not stabilize", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
    });

    test("refine warning reports keys that oscillate at different cadences", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
    });

    test("refine warning includes the component creation stack", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
      }
    });

    test("refine warning omits the creation stack when cv ran in production", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
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
        const message = String(warn.mock.calls.at(-1)?.[0]);
        expect(message).toContain("Maximum refine iterations exceeded");
        expect(message).not.toContain("Component created at:");
      } finally {
        vi.unstubAllEnvs();
      }
    });

    test("computed defaultVariants run when explicitly passing undefined", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: {
            color: () => "red" as const,
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
            border: (_value: boolean) => {},
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
            border: (_value: boolean) => {},
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
            border: (_value: boolean) => {},
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
            border: (_value: boolean) => {},
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
            border: (_value: boolean) => {},
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
