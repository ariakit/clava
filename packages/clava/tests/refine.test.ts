import { describe, expect, test, vi } from "vitest";
import { create } from "../src/index.ts";
import type { AnyRecipe } from "../src/types.ts";
import {
  CONFIGS,
  createCVFromConfig,
  getConfigDescription,
  getConfigMode,
  getConfigTransformClass,
  getModeRecipe,
  getStyleClass,
} from "./_utils.ts";

function extendRecipe(
  cv: ReturnType<typeof createCVFromConfig>,
  recipe: AnyRecipe,
  depth: number,
) {
  let extended = recipe;
  for (let i = 0; i < depth; i++) {
    extended = cv({ extend: [extended] });
  }
  return extended;
}

// Older Clava copies expose metadata without `resolveVariants`.
function removeResolveVariants(recipe: AnyRecipe) {
  Reflect.deleteProperty(Reflect.get(recipe, "__meta"), "resolveVariants");
  return recipe;
}

for (const config of Object.values(CONFIGS)) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);
  const createTone = (tone: "loud" | "calm") =>
    cv({
      variants: { tone: { loud: "loud", calm: "calm" } },
      defaultVariants: { tone: () => tone },
    });
  const createReader = () =>
    cv({
      variants: {
        tone: { loud: "reader-loud", calm: "reader-calm" },
        accent: { true: "accent" },
      },
      defaultVariants: {
        accent: (defaultValue, variants) =>
          variants.tone === "loud" ? true : defaultValue,
      },
    });
  const createLeaf = () =>
    cv({ variants: { tone: { loud: "leaf-loud", calm: "leaf-calm" } } });
  const createDisabledValue = () =>
    cv({ extend: [createLeaf()], variants: { tone: { loud: null } } });
  const createDisabledKey = () =>
    cv({ extend: [createLeaf()], variants: { tone: null } });
  const createSibling = (tone: "loud" | "calm") =>
    cv({
      variants: { tone: { loud: "sib-loud", calm: "sib-calm" } },
      defaultVariants: { tone },
    });

  describe(getConfigDescription(config), () => {
    test("refine", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants }) =>
            variants.size === "lg" ? "refine-lg" : null,
        }),
      );
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg refine-lg") });
    });

    test("refine with setVariants", () => {
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("refine re-runs when it changes variants", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg red refine-red"),
      });
    });

    test("refine re-runs when computed defaultVariants change variants", () => {
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
          refine: ({ variants, addClass }) => {
            if (variants.size === "lg") {
              addClass("refine-lg");
            }
          },
        }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({
        class: cls("lg red refine-lg"),
      });
    });

    test("refine converges with NaN computed defaultVariants", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const recipe = getModeRecipe(
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

      const props = recipe();
      expect(getStyleClass(props)).toEqual({
        class: cls("nan refine-nan"),
      });
      expect(recipe.getVariants()).toEqual({ value: Number.NaN });
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
      const recipe = getModeRecipe(mode, cv({ extend: [base] }));

      const props = recipe();
      expect(getStyleClass(props)).toEqual({
        class: cls("offset"),
      });
      expect(recipe.getVariants()).toEqual({
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
      const recipe = getModeRecipe(mode, cv({ extend: [control] }));

      const props = recipe();
      expect(getStyleClass(props)).toEqual({
        class: cls("layer offset frame control"),
      });
      expect(recipe.getVariants()).toEqual({
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
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("computed defaultVariants do not override props", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg", color: "blue" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg blue") });
    });

    test("computed defaultVariants override extended defaultVariants", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
        defaultVariants: { color: "red" },
      });
      const recipe = getModeRecipe(
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
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("blue sm") });
    });

    test("parent computed defaultVariants can override child defaultVariants", () => {
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
          defaultVariants: { size: "sm", color: "red" },
        }),
      );
      const props = recipe();
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
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "sm", color: "red", large: true },
        }),
      );
      const props = recipe();
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
      const recipe = getModeRecipe(mode, cv({ extend: [child] }));
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("child computed defaultVariants override parent computed defaultVariants", () => {
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
          defaultVariants: {
            size: () => "sm" as const,
            color: "red",
          },
        }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("sm red") });
    });

    test("child computed defaultVariants can preserve parent computed defaultVariants", () => {
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
          defaultVariants: {
            size: (defaultValue) => defaultValue,
          },
        }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("lg") });
      expect(recipe.getVariants()).toEqual({ size: "lg" });
    });

    test("refine in extended recipe does not see foreign variant keys", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        refine: ({ variants, addClass }) => {
          // `color` is added by the parent recipe below — it must not
          // leak into base's `ctx.variants`, whose shape is declared as
          // `{ size }` only.
          if ("color" in (variants as Record<string, unknown>)) {
            addClass("base-saw-foreign");
          } else {
            addClass("base-no-foreign");
          }
        },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const props = recipe({ color: "red" });
      expect(getStyleClass(props)).toEqual({
        class: cls("sm base-no-foreign red"),
      });
    });

    test("computed defaultVariants in extended recipe do not branch on foreign variant keys", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: {
          size: (defaultValue, variants) =>
            "color" in (variants as Record<string, unknown>)
              ? "lg"
              : defaultValue,
        },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const props = recipe({ color: "red" });
      expect(getStyleClass(props)).toEqual({ class: cls("sm red") });
      expect(recipe.getVariants({ color: "red" })).toEqual({
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
      const recipe = getModeRecipe(
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
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("sm red") });
    });

    test("refine re-runs when base recipe refine changes variants", () => {
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
      const props = recipe({ active: true });
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
      const recipe = getModeRecipe(mode, cv({ extend: [base] }));
      const props = recipe({ active: true });
      expect(getStyleClass(props)).toEqual({ class: cls("lg on") });
    });

    test("refine setVariants uses the latest pending value", () => {
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
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("refine setVariants restores a value it cleared in the same pass", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const recipe = getModeRecipe(
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
      expect(getStyleClass(recipe())).toEqual({ class: cls("sm") });
      expect(warn).not.toHaveBeenCalled();
    });

    test("refine setVariants clears a variant it has not already assigned", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            tone: { a: "a", b: "b" },
          },
          defaultVariants: { size: "sm", tone: "a" },
          refine: ({ setVariants }) => {
            setVariants({ size: undefined });
            setVariants({ size: "sm" });
            setVariants({ tone: undefined });
          },
        }),
      );

      // The clear-and-restore pair keeps `size` in the record on every pass,
      // so the third call reads `tone` from `ownVariants`. Drop the first call
      // and the record is empty, where a record-only lookup also passes.
      expect(getStyleClass(recipe())).toEqual({ class: cls("sm") });
    });

    test("refine setVariants does not mutate props with plain extends", () => {
      const base = cv({
        variants: { color: { red: "red", blue: "blue" } },
      });
      const recipe = getModeRecipe(
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
      recipe(mutableProps);
      expect(mutableProps).toEqual({ active: true });

      const frozenProps = Object.freeze({ active: true });
      const getProps = () => recipe(frozenProps);
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
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("red sm") });
    });

    test("refine setVariants sticks across computed default re-runs", () => {
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
          variants: { color: { red: "", blue: "" }, done: "" },
          refine: ({ variants, setVariants }) => {
            if (!variants.done) {
              setVariants({ color: "red", done: true });
            }
          },
        }),
      );
      const props = recipe();
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
      const recipe = getModeRecipe(
        mode,
        cv({ extend: [base], defaultVariants: { size: "sm" } }),
      );
      const props = recipe({ active: true });
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
      const recipe = getModeRecipe(
        mode,
        cv({ extend: [layer], defaultVariants: { a: "two" } }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("two b-false") });
      expect(recipe.getVariants()).toEqual({ a: "two", b: false });
    });

    // https://github.com/ariakit/clava/issues/613
    test("computed defaultVariants read their own recipe's result after a base returns defaultValue", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: {
          layer: { transparent: "transparent", on: "on" },
          border: { true: "border" },
        },
        defaultVariants: {
          layer: (defaultValue) => defaultValue,
        },
      });
      const field = cv({
        extend: [base],
        defaultVariants: { layer: "transparent" },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [field],
          defaultVariants: {
            layer: () => "on" as const,
            border: (defaultValue, variants) =>
              variants.layer === "on" ? true : defaultValue,
          },
        }),
      );

      expect(getStyleClass(recipe())).toEqual({ class: cls("on border") });
      expect(recipe.getVariants()).toEqual({ layer: "on", border: true });
      expect(warn).not.toHaveBeenCalled();
    });

    test("extended computed defaultVariants read a later recipe's result after a base returns defaultValue", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: {
          layer: { transparent: "transparent", on: "on" },
        },
        defaultVariants: {
          layer: (defaultValue) => defaultValue,
        },
      });
      const field = cv({
        extend: [base],
        variants: { border: { true: "border" } },
        defaultVariants: {
          layer: "transparent",
          border: (defaultValue, variants) =>
            variants.layer === "on" ? true : defaultValue,
        },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [field],
          defaultVariants: { layer: () => "on" as const },
        }),
      );

      expect(getStyleClass(recipe())).toEqual({ class: cls("on border") });
      expect(recipe.getVariants()).toEqual({ layer: "on", border: true });
      expect(warn).not.toHaveBeenCalled();
    });

    test("extended refine reads a later recipe's computed defaultVariants after a base returns defaultValue", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: {
          layer: { transparent: "transparent", on: "on" },
        },
        defaultVariants: {
          layer: (defaultValue) => defaultValue,
        },
      });
      const field = cv({
        extend: [base],
        variants: { border: { true: "border" } },
        defaultVariants: { layer: "transparent" },
        refine: ({ variants, setVariants }) => {
          if (variants.layer === "on") {
            setVariants({ border: true });
          }
        },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [field],
          defaultVariants: { layer: () => "on" as const },
        }),
      );

      expect(getStyleClass(recipe())).toEqual({ class: cls("on border") });
      expect(recipe.getVariants()).toEqual({ layer: "on", border: true });
      expect(warn).not.toHaveBeenCalled();
    });

    test("extended computed defaultVariants read a later extend's result after a base returns defaultValue", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: {
          layer: { transparent: "transparent", on: "on" },
          border: { true: "border" },
        },
        defaultVariants: {
          layer: (defaultValue) => defaultValue,
        },
      });
      const field = cv({
        extend: [base],
        defaultVariants: {
          layer: "transparent",
          border: (defaultValue, variants) =>
            variants.layer === "on" ? true : defaultValue,
        },
      });
      const raised = cv({
        variants: { layer: { on: "raised" } },
        defaultVariants: { layer: () => "on" as const },
      });
      const recipe = getModeRecipe(mode, cv({ extend: [field, raised] }));

      expect(getStyleClass(recipe())).toEqual({
        class: cls("on border raised"),
      });
      expect(recipe.getVariants()).toEqual({ layer: "on", border: true });
      expect(warn).not.toHaveBeenCalled();
    });

    test("isolated extended computed defaultVariants read a later recipe's result after a base returns defaultValue", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: {
          layer: { transparent: "transparent", on: "on" },
          border: { true: "border" },
        },
        defaultVariants: {
          layer: (defaultValue) => defaultValue,
        },
      });
      const field = cv({
        extend: [base],
        defaultVariants: {
          layer: "transparent",
          border: (defaultValue, variants) =>
            variants.layer === "on" ? true : defaultValue,
        },
      });
      // A recipe from another factory runs `field` as an isolated extend.
      const { cv: isolatedCv } = create({
        transformClass: (className) => className,
      });
      const recipe = getModeRecipe(
        mode,
        isolatedCv({
          extend: [field],
          defaultVariants: { layer: () => "on" as const },
        }),
      );

      expect(getStyleClass(recipe())).toEqual({ class: cls("on border") });
      expect(recipe.getVariants()).toEqual({ layer: "on", border: true });
      expect(warn).not.toHaveBeenCalled();
    });

    test("extended computed defaultVariants keep reading a variant that an extending recipe disables", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const tone = cv({
        variants: {
          tone: { brand: "brand", muted: "muted" },
          accent: { true: "accent" },
        },
        defaultVariants: { tone: () => "brand" as const },
      });
      const first = cv({
        extend: [tone],
        defaultVariants: {
          accent: (defaultValue, variants) =>
            variants.tone === "brand" ? true : defaultValue,
        },
      });
      // `second` computes the tone after `first` runs, but every recipe below
      // removes the tone after each extend, so `first` never reads it.
      const second = cv({
        variants: { tone: { brand: "second-brand" } },
        defaultVariants: { tone: () => "brand" as const },
      });
      const mid = cv({ extend: [first, second] });
      const withoutTone = getModeRecipe(
        mode,
        cv({ extend: [first, second], variants: { tone: null } }),
      );
      const withoutBrand = getModeRecipe(
        mode,
        cv({ extend: [first, second], variants: { tone: { brand: null } } }),
      );
      const nested = getModeRecipe(
        mode,
        cv({ extend: [mid], variants: { tone: null } }),
      );

      expect(getStyleClass(withoutTone())).toEqual({ class: cls("accent") });
      expect(withoutTone.getVariants()).toEqual({ accent: true });
      expect(getStyleClass(withoutBrand())).toEqual({ class: cls("accent") });
      expect(withoutBrand.getVariants()).toEqual({ accent: true });
      expect(getStyleClass(nested())).toEqual({ class: cls("accent") });
      expect(nested.getVariants()).toEqual({ accent: true });
      expect(warn).not.toHaveBeenCalled();
    });

    test("extended computed defaultVariants read a later recipe's result through a recipe that disables another value", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: {
          layer: { transparent: "transparent", on: "on", off: "off" },
          border: { true: "border" },
        },
        defaultVariants: {
          layer: (defaultValue) => defaultValue,
        },
      });
      const field = cv({
        extend: [base],
        defaultVariants: {
          layer: "transparent",
          border: (defaultValue, variants) =>
            variants.layer === "on" ? true : defaultValue,
        },
      });
      const restricted = cv({
        extend: [field],
        variants: { layer: { off: null } },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [restricted],
          defaultVariants: { layer: () => "on" as const },
        }),
      );

      expect(getStyleClass(recipe())).toEqual({ class: cls("on border") });
      expect(recipe.getVariants()).toEqual({ layer: "on", border: true });
      expect(warn).not.toHaveBeenCalled();
    });

    test("extended computed defaultVariants preserve an inherited value that changes in a later pass", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const frame = cv({
        variants: {
          border: { inherit: "border-inherit" },
          weight: { unset: "weight-unset" },
        },
        defaultVariants: {
          weight: (defaultValue, variants) =>
            variants.border === "inherit" ? "unset" : defaultValue,
        },
      });
      const segment = cv({
        extend: [frame],
        defaultVariants: {
          weight: (defaultValue) => defaultValue,
        },
      });
      // `frame` reads the border only from the second pass, so it changes the
      // weight after `segment` already returned the first one.
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [segment],
          defaultVariants: { border: () => "inherit" as const },
        }),
      );

      expect(getStyleClass(recipe())).toEqual({
        class: cls("border-inherit weight-unset"),
      });
      expect(recipe.getVariants()).toEqual({
        border: "inherit",
        weight: "unset",
      });
      expect(warn).not.toHaveBeenCalled();
    });

    test("extended computed defaultVariants keep a value when a later one returns a value its recipe disables", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: {
          size: { sm: "sm", md: "md", lg: "lg" },
          large: { true: "large" },
        },
        defaultVariants: {
          size: (_defaultValue, variants) => (variants.large ? "lg" : "sm"),
        },
      });
      // The size depends on `large`, which this recipe computes after it. This
      // recipe disables `md`, so its own size default never applies.
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: { size: { md: null } },
          defaultVariants: {
            large: () => true,
            // @ts-expect-error this recipe disables `md`
            size:
              // no error
              () => "md" as const,
          },
        }),
      );

      expect(getStyleClass(recipe())).toEqual({ class: cls("lg large") });
      expect(recipe.getVariants()).toEqual({ size: "lg", large: true });
      expect(warn).not.toHaveBeenCalled();
    });

    test("computed defaultVariants read their own key after an extending recipe removes the value written before it", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const tone = cv({
        variants: { tone: { loud: "loud", calm: "calm", quiet: "quiet" } },
        defaultVariants: {
          tone: (defaultValue, variants) =>
            variants.tone === "calm" ? "loud" : defaultValue,
        },
      });
      const first = cv({ extend: [tone] });
      // Only extends with a callback resolve variants in `getVariants`.
      const spacer = cv({
        variants: { gap: { true: "gap" } },
        refine: () => {},
      });
      const last = cv({
        variants: {
          tone: { loud: "last-loud", calm: "last-calm", quiet: "last-quiet" },
        },
        defaultVariants: {
          tone: (_defaultValue, variants) =>
            variants.tone === "loud" ? "quiet" : "calm",
        },
      });
      // `filtered` removes `loud` after `spacer`, before `last` reads its own
      // key, so `last` never sees the value that `tone` wrote.
      const filtered = cv({
        extend: [spacer, last],
        variants: { tone: { loud: null } },
      });
      const recipe = getModeRecipe(mode, cv({ extend: [first, filtered] }));

      expect(getStyleClass(recipe())).toEqual({
        class: cls("calm last-calm"),
      });
      expect(recipe.getVariants()).toEqual({ tone: "calm" });
      expect(warn).not.toHaveBeenCalled();
    });

    test("computed defaultVariants read their own key after an extending recipe removes a later value", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const tones = { a: "a", b: "b", x: "x", y: "y" };
      const first = cv({
        variants: { tone: tones },
        defaultVariants: { tone: () => "a" as const },
      });
      const second = cv({
        variants: { tone: tones },
        defaultVariants: { tone: () => "b" as const },
      });
      // `filtered` removes the value that `second` writes after `first`, so
      // `last` reads neither of them.
      const filtered = cv({
        extend: [second],
        variants: { tone: { b: null } },
      });
      const last = cv({
        variants: { tone: tones },
        defaultVariants: {
          tone: (_defaultValue, variants) =>
            variants.tone === "a" ? "x" : "y",
        },
      });
      const recipe = getModeRecipe(
        mode,
        cv({ extend: [first, filtered, last] }),
      );

      expect(getStyleClass(recipe())).toEqual({ class: cls("y y y") });
      expect(recipe.getVariants()).toEqual({ tone: "y" });
      expect(warn).not.toHaveBeenCalled();
    });

    test("a pruned shared extend does not change computed defaultVariants", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const frame = cv({
        variants: {
          a: { x: "a-x", y: "a-y", z: "a-z" },
          b: { x: "b-x", y: "b-y", z: "b-z" },
        },
        defaultVariants: {
          b: (_defaultValue, variants) =>
            variants.a === "x" ? "x" : variants.b,
        },
      });
      const inner = cv({
        extend: [frame],
        defaultVariants: {
          a: (defaultValue, variants) =>
            variants.b === "z" ? defaultValue : variants.a,
        },
      });
      // These defaults keep the values they read, so the chain can settle on
      // more than one result. The second `frame` is pruned and computes
      // nothing, so the chain settles where it does without it.
      const sibling = cv({
        extend: [frame],
        defaultVariants: { a: "z", b: "z" },
      });
      const mid = cv({ extend: [inner, sibling] });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [mid],
          defaultVariants: {
            a: (defaultValue, variants) =>
              variants.b === "z" ? "x" : defaultValue,
          },
        }),
      );

      expect(getStyleClass(recipe())).toEqual({ class: cls("a-x b-x") });
      expect(recipe.getVariants()).toEqual({ a: "x", b: "x" });
      expect(warn).not.toHaveBeenCalled();
    });

    test("computed defaultVariants warn when a later recipe contradicts them", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: {
          layer: { transparent: "transparent", on: "on" },
        },
        defaultVariants: {
          layer: (defaultValue) => defaultValue,
        },
      });
      const field = cv({
        extend: [base],
        variants: { border: { true: "border" } },
        defaultVariants: {
          layer: "transparent",
          border: (defaultValue, variants) =>
            variants.layer === "on" ? true : defaultValue,
        },
      });
      // A border turns the layer off, and the layer turns the border on, so no
      // pair of values satisfies both recipes.
      const recipe = cv({
        extend: [field],
        defaultVariants: {
          layer: (_defaultValue, variants) =>
            variants.border ? ("transparent" as const) : ("on" as const),
        },
      });

      recipe.getVariants();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Maximum refine iterations exceeded"),
      );
    });

    test("computed defaultVariants read their own key as the value they replace", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const frame = cv({
        variants: {
          border: { inherit: "border-inherit" },
          weight: { unset: "weight-unset" },
        },
        defaultVariants: {
          weight: (defaultValue, variants) =>
            variants.border === "inherit" ? "unset" : defaultValue,
        },
      });
      const segment = cv({
        extend: [frame],
        defaultVariants: {
          weight: (_defaultValue, variants) => variants.weight,
        },
      });
      // `frame` reads the border only from the second pass, after `segment`
      // already kept the first value of `weight` once.
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [segment],
          defaultVariants: { border: () => "inherit" as const },
        }),
      );

      expect(getStyleClass(recipe())).toEqual({
        class: cls("border-inherit weight-unset"),
      });
      expect(recipe.getVariants()).toEqual({
        border: "inherit",
        weight: "unset",
      });
      expect(warn).not.toHaveBeenCalled();
    });

    test("extended computed defaultVariants read a value that a later recipe restores in the first pass", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: {
          layer: { transparent: "transparent", on: "on" },
        },
        defaultVariants: {
          layer: () => "on" as const,
        },
      });
      const field = cv({
        extend: [base],
        variants: { border: { true: "border" } },
        defaultVariants: {
          layer: "transparent",
          border: (defaultValue, variants) =>
            variants.layer === "transparent" ? true : defaultValue,
        },
      });
      // The first pass ends where it started, but `field` read the value that
      // `base` wrote before this recipe restored the static default.
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [field],
          defaultVariants: { layer: () => "transparent" as const },
        }),
      );

      expect(getStyleClass(recipe())).toEqual({
        class: cls("transparent border"),
      });
      expect(recipe.getVariants()).toEqual({
        layer: "transparent",
        border: true,
      });
      expect(warn).not.toHaveBeenCalled();
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
      const recipe = getModeRecipe(mode, cv({ extend: [first, second] }));
      const props = recipe();
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
      const recipe = getModeRecipe(mode, cv({ extend: [first, second] }));
      const props = recipe();
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
      const props = recipe();
      expect(getStyleClass(props)).toEqual({
        class: cls("base-red child-red"),
      });
    });

    test("computed defaultVariants do not override setVariants from a previous pass", () => {
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
      const props = recipe();
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
      const extension = extendRecipe(cv, base, 50);
      const recipe = cv({ extend: [extension] });

      expect(recipe.getVariants()).toEqual({ state: "ready" });
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
      const extension = extendRecipe(cv, base, 50);
      const recipe = getModeRecipe(mode, cv({ extend: [extension] }));

      expect(getStyleClass(recipe())).toEqual({
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
      const extension = extendRecipe(cv, base, 50);
      const recipe = getModeRecipe(mode, cv({ extend: [extension] }));

      recipe();
      expect(refineRuns).toBe(50);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Maximum refine iterations exceeded"),
      );
    });

    test("refine warns when variants keep changing", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          refine: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      recipe();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Maximum refine iterations exceeded"),
      );
    });

    test("refine warning is shared across extended recipes", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
        refine: ({ variants, setVariants }) => {
          setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
        },
      });
      const recipe = getModeRecipe(mode, cv({ extend: [base] }));

      recipe();
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
        expect.stringContaining("Recipe created at:"),
      );
    });

    test("getVariants warns when variants keep changing", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          refine: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      recipe.getVariants();
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
        expect.stringContaining("Recipe created at:"),
      );
    });

    test("refine warning is omitted in production", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv("NODE_ENV", "production");
      const recipe = getModeRecipe(
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
        recipe();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    test("refine warning names the variant key that did not stabilize", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const recipe = getModeRecipe(
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

      recipe();
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
      const recipe = getModeRecipe(
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

      recipe();
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

    test("refine warning includes the recipe creation stack", () => {
      using warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
          refine: ({ variants, setVariants }) => {
            setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
          },
        }),
      );

      recipe();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Recipe created at:"),
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
      const recipe = getModeRecipe(
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
        recipe();
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("Recipe created at:"),
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
      const recipe = getModeRecipe(
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
        recipe();
        const message = String(warn.mock.calls.at(-1)?.[0]);
        expect(message).toContain("Maximum refine iterations exceeded");
        expect(message).not.toContain("Recipe created at:");
      } finally {
        vi.unstubAllEnvs();
      }
    });

    test("computed defaultVariants run when explicitly passing undefined", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg", color: undefined });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("refine with defaultVariants", () => {
      const recipe = getModeRecipe(
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
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("lg refine-lg") });
    });

    test("refine with defaultVariants from extended", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "lg" },
      });
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          refine: ({ variants }) =>
            variants.size === "lg" ? "refine-lg" : null,
        }),
      );
      const props = recipe();
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
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: {
            border: (_value: boolean) => {},
          },
          defaultVariants: { border: false },
        }),
      );
      const props = recipe();
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
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base2],
          variants: {
            border: (_value: boolean) => {},
          },
          defaultVariants: { border: false },
        }),
      );
      const props = recipe();
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
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: {
            border: (_value: boolean) => {},
          },
        }),
      );
      const props = recipe({ border: false });
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
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base],
          variants: {
            border: (_value: boolean) => {},
          },
        }),
      );
      const props = recipe({ border: true });
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
      const recipe = getModeRecipe(
        mode,
        cv({
          extend: [base2],
          variants: {
            border: (_value: boolean) => {},
          },
        }),
      );
      const props = recipe({ border: true });
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("refine with style", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants }) =>
            variants.size === "lg" ? { style: { fontSize: "20px" } } : null,
        }),
      );
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: "20px",
      });
    });

    test("refine with class and style", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          refine: ({ variants }) =>
            variants.size === "lg"
              ? { class: "refine-lg", style: { fontSize: "20px" } }
              : null,
        }),
      );
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg refine-lg"),
        fontSize: "20px",
      });
    });

    test("refine style does not accept numbers", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg refine-lg"),
        fontSize: expect.toBeOneOf(["20", "20px"]),
      });
    });

    test("refine setVariants does not accept invalid keys", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg") });
    });

    test("refine setVariants does not accept invalid values", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      // Invalid value overrides the valid one, resulting in no match
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("refine addClass with string", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg added-lg") });
    });

    test("refine addClass with array", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg added-lg extra-class"),
      });
    });

    test("refine addStyle", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: "20px",
      });
    });

    test("refine addClass combined with return value", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg added-class returned-class"),
      });
    });

    test("refine addStyle combined with return value", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: "20px",
        backgroundColor: "red",
      });
    });

    test("refine addClass and addStyle together", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg added-lg"),
        fontSize: "20px",
      });
    });

    test("refine addClass and addStyle with return value", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg added-lg returned-class"),
        fontSize: "20px",
        backgroundColor: "red",
      });
    });

    test("refine addClass multiple calls", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg first second third"),
      });
    });

    test("refine addStyle multiple calls merges styles", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: "20px",
        backgroundColor: "red",
        color: "blue",
      });
    });

    test("refine addStyle later call overrides earlier", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: "20px",
      });
    });

    test("refine addStyle does not accept numbers", () => {
      const recipe = getModeRecipe(
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
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg"),
        fontSize: expect.toBeOneOf(["20", "20px"]),
      });
    });

    describe("getVariants matches render with disabled values", () => {
      test("filters after an extend without callbacks", () => {
        const plain = cv({ variants: { gap: { true: "gap" } } });
        const filtered = cv({
          extend: [plain, createReader()],
          variants: { tone: { loud: null } },
        });
        const loud = cv({ extend: [createTone("loud"), filtered] });
        expect(loud.getVariants()).toEqual({});
        expect(loud.class()).toBe("");
        const calm = cv({ extend: [createTone("calm"), filtered] });
        expect(calm.getVariants()).toEqual({ tone: "calm" });
        expect(calm.class()).toBe(cls("calm reader-calm"));
      });

      test("filters inside an extend without callbacks", () => {
        const leaf = cv({ variants: { tone: { loud: "leaf", calm: "leaf" } } });
        const filtered = cv({
          extend: [leaf],
          variants: { tone: { loud: null } },
        });
        const loud = cv({
          extend: [createTone("loud"), filtered, createReader()],
        });
        expect(loud.getVariants()).toEqual({});
        expect(loud.class()).toBe("");
        const calm = cv({
          extend: [createTone("calm"), filtered, createReader()],
        });
        expect(calm.getVariants()).toEqual({ tone: "calm" });
        expect(calm.class()).toBe(cls("calm leaf reader-calm"));
      });

      test("filters inside a nested extend without callbacks", () => {
        const leaf = cv({ variants: { tone: { loud: "leaf", calm: "leaf" } } });
        const filtered = cv({
          extend: [leaf],
          variants: { tone: { loud: null } },
        });
        const wrapper = cv({ extend: [filtered] });
        const recipe = cv({
          extend: [createTone("loud"), wrapper, createReader()],
        });
        expect(recipe.getVariants()).toEqual({});
        expect(recipe.class()).toBe("");
      });

      test("resolves through extends from an older copy", () => {
        const plain = removeResolveVariants(
          cv({ variants: { gap: { true: "gap" } } }),
        );
        const tone = removeResolveVariants(createTone("calm"));
        const recipe = cv({ extend: [plain, tone, createReader()] });
        expect(recipe.getVariants()).toEqual({ tone: "calm" });
        expect(recipe.class()).toBe(cls("calm reader-calm"));
      });

      describe("in a chain without callbacks", () => {
        test("removes a sibling default disabled before the sibling", () => {
          const recipe = cv({
            extend: [createDisabledValue(), createSibling("loud")],
          });
          expect(recipe.getVariants()).toEqual({});
          expect(recipe.class()).toBe("");
        });

        // The sibling renders before the value is removed, and render makes
        // one pass here, so its class stays. See
        // https://github.com/ariakit/clava/issues/618#issuecomment-6554922099
        test("removes a sibling default disabled after the sibling", () => {
          const recipe = cv({
            extend: [createSibling("loud"), createDisabledValue()],
          });
          expect(recipe.getVariants()).toEqual({});
          expect(recipe.class()).toBe(cls("sib-loud"));
        });

        test("removes a sibling default of a disabled variant", () => {
          const first = cv({
            extend: [createDisabledKey(), createSibling("loud")],
          });
          expect(first.getVariants()).toEqual({});
          expect(first.class()).toBe("");
          const last = cv({
            extend: [createSibling("loud"), createDisabledKey()],
          });
          expect(last.getVariants()).toEqual({});
          expect(last.class()).toBe(cls("sib-loud"));
        });

        test("removes a disabled value through nested extends", () => {
          const wrapper = cv({ extend: [createDisabledValue()] });
          const recipe = cv({ extend: [wrapper] });
          const variants = recipe.getVariants({
            // @ts-expect-error JavaScript callers can pass a disabled value
            tone:
              // no error
              "loud",
          });
          expect(variants).toEqual({});
        });

        test("removes a disabled value passed as a prop", () => {
          const recipe = cv({ extend: [createDisabledValue()] });
          const variants = recipe.getVariants({
            // @ts-expect-error JavaScript callers can pass a disabled value
            tone:
              // no error
              "loud",
          });
          expect(variants).toEqual({});
        });

        test("keeps values that aren't disabled", () => {
          const recipe = cv({
            extend: [createDisabledValue(), createSibling("calm")],
          });
          expect(recipe.getVariants()).toEqual({ tone: "calm" });
          expect(recipe.class()).toBe(cls("leaf-calm sib-calm"));
        });

        // A recipe filters only after its own extends, so render keeps the
        // value when the recipe that disables it has none.
        test("keeps a value disabled by a recipe without extends", () => {
          const disabled = cv({ variants: { tone: { loud: null } } });
          const recipe = cv({ extend: [disabled, createSibling("loud")] });
          expect(recipe.getVariants()).toEqual({ tone: "loud" });
          expect(recipe.class()).toBe(cls("sib-loud"));
        });

        // A shared base runs once, at its first position. Listed first, it
        // leaves the recipe that disables the variant with no extends.
        test("keeps a variant disabled after a shared base", () => {
          const base = createSibling("loud");
          const disabled = cv({ extend: [base], variants: { tone: null } });
          const baseFirst = cv({ extend: [base, disabled] });
          expect(baseFirst.getVariants()).toEqual({ tone: "loud" });
          expect(baseFirst.class()).toBe(cls("sib-loud"));
          const baseLast = cv({ extend: [disabled, base] });
          expect(baseLast.getVariants()).toEqual({});
          expect(baseLast.class()).toBe("");
        });

        // A value that an extend disables stays removed, unless the recipe
        // defines it again. Both getVariants and render follow this rule.
        describe("value set after the extend that disables it", () => {
          const redeclared = {
            tone: { loud: "top-loud", calm: "top-calm" },
          };

          test("keeps an explicit value the recipe defines again", () => {
            const recipe = cv({
              extend: [createDisabledValue()],
              variants: redeclared,
            });
            expect(recipe.getVariants({ tone: "loud" })).toEqual({
              tone: "loud",
            });
            expect(recipe.class({ tone: "loud" })).toBe(cls("top-loud"));
          });

          test("keeps a static default the recipe defines again", () => {
            const recipe = cv({
              extend: [createDisabledValue()],
              variants: redeclared,
              defaultVariants: { tone: "loud" },
            });
            expect(recipe.getVariants()).toEqual({ tone: "loud" });
            expect(recipe.class()).toBe(cls("top-loud"));
          });

          test("keeps a computed default the recipe defines again", () => {
            const recipe = cv({
              extend: [createDisabledValue()],
              variants: redeclared,
              defaultVariants: { tone: () => "loud" as const },
            });
            expect(recipe.getVariants()).toEqual({ tone: "loud" });
            expect(recipe.class()).toBe(cls("top-loud"));
          });

          test("removes a computed default the recipe doesn't define", () => {
            const recipe = cv({
              extend: [createDisabledValue()],
              variants: { tone: { calm: "top-calm" } },
              defaultVariants: {
                // @ts-expect-error loud stays disabled for this recipe
                tone:
                  // no error
                  () => "loud",
              },
            });
            expect(recipe.getVariants()).toEqual({});
            expect(recipe.class()).toBe("");
          });

          test("keeps a computed default that isn't disabled", () => {
            const recipe = cv({
              extend: [createDisabledValue()],
              variants: redeclared,
              defaultVariants: { tone: () => "calm" as const },
            });
            expect(recipe.getVariants()).toEqual({ tone: "calm" });
            expect(recipe.class()).toBe(cls("leaf-calm top-calm"));
          });

          test("keeps a value from the recipe's own refine", () => {
            const recipe = cv({
              extend: [createDisabledValue()],
              variants: redeclared,
              refine: ({ setVariants }) => setVariants({ tone: "loud" }),
            });
            expect(recipe.getVariants()).toEqual({ tone: "loud" });
            expect(recipe.class()).toBe(cls("top-loud"));
          });

          test("removes a value from a refine that doesn't define it", () => {
            const recipe = cv({
              extend: [createDisabledValue()],
              variants: { tone: { calm: "top-calm" } },
              refine: ({ setVariants }) =>
                setVariants({
                  // @ts-expect-error loud stays disabled for this recipe
                  tone:
                    // no error
                    "loud",
                }),
            });
            expect(recipe.getVariants()).toEqual({});
            expect(recipe.class()).toBe("");
          });

          test("removes a value from a sibling's refine", () => {
            const refined = cv({
              variants: { tone: { loud: "sib-loud", calm: "sib-calm" } },
              refine: ({ setVariants }) => setVariants({ tone: "loud" }),
            });
            const recipe = cv({ extend: [createDisabledValue(), refined] });
            expect(recipe.getVariants()).toEqual({});
            expect(recipe.class()).toBe("");
          });

          test("keeps a value through a nested extend", () => {
            const inner = cv({
              extend: [createDisabledValue()],
              variants: redeclared,
              defaultVariants: { tone: () => "loud" as const },
            });
            const recipe = cv({ extend: [inner] });
            expect(recipe.getVariants()).toEqual({ tone: "loud" });
            expect(recipe.class()).toBe(cls("top-loud"));
          });

          test("removes a value through a nested extend", () => {
            const inner = cv({
              extend: [createDisabledValue()],
              variants: { tone: { calm: "top-calm" } },
              defaultVariants: {
                // @ts-expect-error loud stays disabled for this recipe
                tone:
                  // no error
                  () => "loud",
              },
            });
            const recipe = cv({ extend: [inner] });
            expect(recipe.getVariants()).toEqual({});
            expect(recipe.class()).toBe("");
          });

          test("falls back to the default of a sibling's computed value", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
            const empty = cv({});
            const inner = cv({
              extend: [empty],
              variants: { r: { a: "i-a", c: null } },
            });
            const first = cv({
              extend: [inner],
              defaultVariants: { r: "a" },
            });
            const second = cv({
              variants: { r: { a: "s-a", c: "s-c" } },
              defaultVariants: {
                r: (defaultValue, variants) =>
                  variants.r === "a" ? "c" : defaultValue,
              },
            });
            const recipe = cv({
              extend: [first, second],
              variants: { r: { a: "t-a" } },
            });
            expect(recipe.getVariants()).toEqual({ r: "a" });
            expect(recipe.class()).toBe(cls("i-a s-a t-a"));
            expect(warn).not.toHaveBeenCalled();
            warn.mockRestore();
          });
        });
      });
    });
  });
}
