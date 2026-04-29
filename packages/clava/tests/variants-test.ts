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
    test("variant no value empty class", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("variant no value with class", () => {
      const component = getModeComponent(
        mode,
        cv({ class: "foo", variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("foo") });
    });

    test("variant with value", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg") });
    });

    test("variant with value and class", () => {
      const component = getModeComponent(
        mode,
        cv({ class: "foo", variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("foo lg") });
    });

    test("variant with style value", () => {
      const component = getModeComponent(
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
      const props = component({ color: "red" });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
      });
    });

    test("rejects inline style object without style wrapper", () => {
      const component = getModeComponent(
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
      const props = component({ color: "red" });
      expect(getStyleClass(props)).toEqual({
        class: "",
      });
    });

    test("variant with class and style value", () => {
      const component = getModeComponent(
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
      const props = component({ color: "red" });
      expect(getStyleClass(props)).toEqual({
        class: cls("text-red"),
        backgroundColor: "red",
      });
    });

    test("multiple variants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
        }),
      );
      const props = component({ size: "lg", color: "red" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg red") });
    });

    test("boolean variant true", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { disabled: { true: "disabled", false: "enabled" } } }),
      );
      const props = component({ disabled: true });
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("boolean variant false", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { disabled: { true: "disabled", false: "enabled" } } }),
      );
      const props = component({ disabled: false });
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("boolean variant true only false", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { disabled: { true: "disabled" } } }),
      );
      const props = component({ disabled: false });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("boolean variant true only true", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { disabled: { true: "disabled" } } }),
      );
      const props = component({ disabled: true });
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("boolean variant no value applies false", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { disabled: { true: "disabled", false: "enabled" } } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("boolean variant false only", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { disabled: { false: "enabled" } } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("boolean variant false only false", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { disabled: { false: "enabled" } } }),
      );
      const props = component({ disabled: false });
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("boolean variant false only true", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { disabled: { false: "enabled" } } }),
      );
      const props = component({ disabled: true });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("boolean variant shorthand true", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { disabled: "disabled" } }),
      );
      const props = component({ disabled: true });
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("boolean variant shorthand false", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { disabled: "disabled" } }),
      );
      const props = component({ disabled: false });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("variant style accepts custom property numbers", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: {
              sm: {
                class: "sm",
                style: { fontSize: "12px", "--size": 1 },
              },
              lg: { class: "lg", style: { fontSize: "16px" } },
            },
          },
        }),
      );
      const props = component({ size: "sm" });
      expect(getStyleClass(props)).toEqual({
        class: cls("sm"),
        fontSize: "12px",
        "--size": "1",
      });
    });

    test("variant style does not accept number lengths", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            // @ts-expect-error number lengths should use explicit units
            size: {
              sm: {
                class: "sm",
                style: {
                  fontSize: 12,
                },
              },
              lg: { class: "lg", style: { fontSize: "16px" } },
            },
          },
        }),
      );
      const props = component({ size: "sm" });
      expect(getStyleClass(props)).toEqual({
        class: cls("sm"),
        fontSize: expect.toBeOneOf(["12", "12px"]),
      });
    });

    test("variant props do not accept invalid values", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = component({
        // @ts-expect-error invalid value
        size:
          // no error
          "invalid",
      });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("variant props do not accept invalid keys", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = component({
        // @ts-expect-error
        invalidKey: "value",
      });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("defaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("defaultVariants overridden by props", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg") });
    });

    test("defaultVariants boolean false", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { disabled: { true: "disabled", false: "enabled" } },
          defaultVariants: { disabled: false },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("defaultVariants boolean true", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { disabled: { true: "disabled", false: "enabled" } },
          defaultVariants: { disabled: true },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("defaultVariants boolean shorthand", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { disabled: "disabled" },
          defaultVariants: { disabled: true },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("defaultVariants does not accept invalid keys", () => {
      const component = getModeComponent(
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
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("defaultVariants does not accept invalid values", () => {
      const component = getModeComponent(
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
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("defaultVariants when explicitly passing undefined", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const props = component({ size: undefined });
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("defaultVariants boolean when explicitly passing undefined", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { disabled: { true: "disabled", false: "enabled" } },
          defaultVariants: { disabled: true },
        }),
      );
      const props = component({ disabled: undefined });
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });
  });
}
