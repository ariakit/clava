import { describe, expect, expectTypeOf, test } from "vitest";
import {
  CONFIGS,
  createCVFromConfig,
  getConfigDescription,
  getConfigMode,
  getConfigTransformClass,
  getModeRecipe,
  getStyleClass,
} from "./_utils.ts";

for (const config of Object.values(CONFIGS)) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("variant no value empty class", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("variant no value with class", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ class: "foo", variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("foo") });
    });

    test("variant with value", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg") });
    });

    test("variant with value and class", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ class: "foo", variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("foo lg") });
    });

    test("variant with style value", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            color: {
              red: { style: { backgroundColor: "red" } },
              blue: { style: { backgroundColor: "blue" } },
            },
          },
        }),
      );
      const props = recipe({ color: "red" });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
      });
    });

    test("rejects inline style object without style wrapper", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            color: {
              // @ts-expect-error old shape requires `style` wrapper
              red: { backgroundColor: "red" },
            },
          },
        }),
      );
      const props = recipe({ color: "red" });
      expect(getStyleClass(props)).toEqual({
        class: "",
      });
    });

    test("variant with class and style value", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            color: {
              red: { class: "text-red", style: { backgroundColor: "red" } },
              blue: { class: "text-blue", style: { backgroundColor: "blue" } },
            },
          },
        }),
      );
      const props = recipe({ color: "red" });
      expect(getStyleClass(props)).toEqual({
        class: cls("text-red"),
        backgroundColor: "red",
      });
    });

    test("multiple variants", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
        }),
      );
      const props = recipe({ size: "lg", color: "red" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("boolean variant true", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { disabled: { true: "disabled", false: "enabled" } } }),
      );
      const props = recipe({ disabled: true });
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("boolean variant false", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { disabled: { true: "disabled", false: "enabled" } } }),
      );
      const props = recipe({ disabled: false });
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("boolean variant true only false", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { disabled: { true: "disabled" } } }),
      );
      const props = recipe({ disabled: false });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("boolean variant true only true", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { disabled: { true: "disabled" } } }),
      );
      const props = recipe({ disabled: true });
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("boolean variant no value applies false", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { disabled: { true: "disabled", false: "enabled" } } }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("boolean variant false only", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { disabled: { false: "enabled" } } }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("boolean variant false only false", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { disabled: { false: "enabled" } } }),
      );
      const props = recipe({ disabled: false });
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("boolean variant false only true", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { disabled: { false: "enabled" } } }),
      );
      const props = recipe({ disabled: true });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("boolean variant shorthand true", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { disabled: "disabled" } }),
      );
      const props = recipe({ disabled: true });
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("boolean variant shorthand false", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { disabled: "disabled" } }),
      );
      const props = recipe({ disabled: false });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("array variant shorthand", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            interactive: ["interactive", "focusable"],
          },
          defaultVariants: { interactive: true },
        }),
      );
      expectTypeOf(recipe.getVariants()).branded.toEqualTypeOf<{
        interactive?: boolean;
      }>();
      expect(getStyleClass(recipe())).toEqual({
        class: cls("interactive focusable"),
      });
      expect(getStyleClass(recipe({ interactive: false }))).toEqual({
        class: "",
      });
      const props = recipe({
        // @ts-expect-error array shorthand variants are boolean
        interactive:
          // no error
          "interactive",
      });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("variant style does not accept numbers", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: {
            // @ts-expect-error
            size: {
              sm: {
                class: "sm",
                style: { fontSize: 12 },
              },
              lg: { class: "lg", style: { fontSize: "16px" } },
            },
          },
        }),
      );
      const props = recipe({ size: "sm" });
      expect(getStyleClass(props)).toEqual({
        class: cls("sm"),
        fontSize: expect.toBeOneOf(["12", "12px"]),
      });
    });

    test("variant props do not accept invalid values", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = recipe({
        // @ts-expect-error invalid value
        size:
          // no error
          "invalid",
      });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("variant props do not accept invalid keys", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = recipe({
        // @ts-expect-error
        invalidKey: "value",
      });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("defaultVariants", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("defaultVariants overridden by props", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const props = recipe({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg") });
    });

    test("defaultVariants boolean false", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { disabled: { true: "disabled", false: "enabled" } },
          defaultVariants: { disabled: false },
        }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("defaultVariants boolean true", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { disabled: { true: "disabled", false: "enabled" } },
          defaultVariants: { disabled: true },
        }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("defaultVariants boolean shorthand", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { disabled: "disabled" },
          defaultVariants: { disabled: true },
        }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("defaultVariants does not accept invalid keys", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: {
            size: "sm",
            // @ts-expect-error
            invalidKey: "value",
          },
        }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("defaultVariants does not accept invalid values", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: {
            // @ts-expect-error invalid value
            size:
              // no error
              "invalid",
          },
        }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("defaultVariants when explicitly passing undefined", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const props = recipe({ size: undefined });
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("defaultVariants boolean when explicitly passing undefined", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          variants: { disabled: { true: "disabled", false: "enabled" } },
          defaultVariants: { disabled: true },
        }),
      );
      const props = recipe({ disabled: undefined });
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });
  });
}
