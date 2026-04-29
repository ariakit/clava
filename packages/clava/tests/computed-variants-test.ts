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
    test("computedVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          computedVariants: {
            size: (value: "sm" | "lg") => (value === "sm" ? "small" : "large"),
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("large") });
    });

    test("computedVariants with style", () => {
      const component = getModeComponent(
        mode,
        cv({
          computedVariants: {
            size: (value: "sm" | "lg") => ({
              class: value === "sm" ? "small" : "large",
              style: { fontSize: value === "sm" ? "12px" : "16px" },
            }),
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("large"),
        fontSize: "16px",
      });
    });

    test("computedVariants can return another component default result", () => {
      const button = cv({
        variants: {
          size: {
            sm: { class: "button-sm", style: { fontSize: "12px" } },
            lg: { class: "button-lg", style: { fontSize: "16px" } },
          },
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          computedVariants: {
            size: (value: "sm" | "lg") => {
              return button({ size: value });
            },
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("button-lg"),
        fontSize: "16px",
      });
    });

    test("computedVariants overrides extended object variants", () => {
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
          computedVariants: {
            size: (value: "sm" | "lg") => ({
              class: value === "sm" ? "extended-sm" : "extended-lg",
              style: {
                backgroundColor: value === "sm" ? "lightgray" : "gray",
              },
            }),
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("extended-lg"),
        backgroundColor: "gray",
      });
    });

    test("computedVariants overrides extended computedVariants", () => {
      const base = cv({
        computedVariants: {
          size: (value: "sm" | "lg") => ({
            class: value === "sm" ? "base-sm" : "base-lg",
            style: { fontSize: value === "sm" ? "12px" : "16px" },
          }),
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          computedVariants: {
            size: (value: "sm" | "lg") => ({
              class: value === "sm" ? "extended-sm" : "extended-lg",
              style: {
                backgroundColor: value === "sm" ? "lightgray" : "gray",
              },
            }),
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("extended-lg"),
        backgroundColor: "gray",
      });
    });

    test("computedVariants style accepts numbers", () => {
      const component = getModeComponent(
        mode,
        cv({
          computedVariants: {
            size: (value: "sm" | "lg") => ({
              class: value === "sm" ? "small" : "large",
              style: { fontSize: value === "sm" ? 12 : 16 },
            }),
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("large"),
        fontSize: "16",
      });
    });

    test("computedVariants changes extended boolean variant to string", () => {
      const base = cv({
        variants: { disabled: { true: "disabled", false: "enabled" } },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          computedVariants: {
            disabled: (value: "yes" | "no" | "maybe") => {
              if (value === "yes") return "state-disabled";
              if (value === "no") return "state-enabled";
              return "state-pending";
            },
          },
        }),
      );
      component({
        // @ts-expect-error
        disabled: true,
      });
      const props = component({ disabled: "maybe" });
      expect(getStyleClass(props)).toEqual({ class: cls("state-pending") });
    });

    test("computedVariants changes extended string variant to boolean", () => {
      const base = cv({ variants: { size: { sm: "sm", md: "md", lg: "lg" } } });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          computedVariants: {
            size: (value: boolean) => (value ? "size-large" : "size-small"),
          },
        }),
      );
      component({
        // @ts-expect-error
        size: "sm",
      });
      const propsTrue = component({ size: true });
      expect(getStyleClass(propsTrue)).toEqual({ class: cls("size-large") });
      const propsFalse = component({ size: false });
      expect(getStyleClass(propsFalse)).toEqual({ class: cls("size-small") });
    });

    test("computedVariants with number type", () => {
      const component = getModeComponent(
        mode,
        cv({
          computedVariants: {
            columns: (value: number) => ({
              class: `grid-cols-${value}`,
              style: { "--grid-columns": value },
            }),
          },
        }),
      );
      const props = component({ columns: 3 });
      expect(getStyleClass(props)).toEqual({
        class: cls("grid-cols-3"),
        "--grid-columns": "3",
      });
    });

    test("computedVariants with number type returns dynamic styles", () => {
      const component = getModeComponent(
        mode,
        cv({
          computedVariants: {
            gap: (value: number) => ({
              style: { "--gap": `${value * 4}px` },
            }),
            padding: (value: number) => ({
              style: {
                "--padding-x": `${value}px`,
                "--padding-y": `${value * 0.5}px`,
              },
            }),
          },
        }),
      );
      const props = component({ gap: 4, padding: 16 });
      expect(getStyleClass(props)).toEqual({
        class: "",
        "--gap": "16px",
        "--padding-x": "16px",
        "--padding-y": "8px",
      });
    });

    test("computedVariants with nullable type", () => {
      const component = getModeComponent(
        mode,
        cv({
          computedVariants: {
            color: (value: string | null) => ({
              class: value ? `color-${value}` : "color-default",
              style: { "--color": value ?? "inherit" },
            }),
          },
        }),
      );
      const propsWithValue = component({ color: "red" });
      expect(getStyleClass(propsWithValue)).toEqual({
        class: cls("color-red"),
        "--color": "red",
      });
      const propsWithNull = component({ color: null });
      expect(getStyleClass(propsWithNull)).toEqual({
        class: cls("color-default"),
        "--color": "inherit",
      });
    });

    test("computedVariants changes extended variant from string to number", () => {
      const base = cv({
        variants: { size: { sm: "text-sm", md: "text-md", lg: "text-lg" } },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          computedVariants: {
            size: (value: number) => ({
              class: "text-custom",
              style: { fontSize: `${value}px` },
            }),
          },
        }),
      );
      component({
        // @ts-expect-error
        size: "sm",
      });
      const props = component({ size: 18 });
      expect(getStyleClass(props)).toEqual({
        class: cls("text-custom"),
        fontSize: "18px",
      });
    });
  });
}
