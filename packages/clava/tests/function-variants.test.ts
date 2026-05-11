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
    test("function variant", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: (value: "sm" | "lg") => (value === "sm" ? "small" : "large"),
          },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("large") });
    });

    test("function variant with style", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
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

    test("function variant can return another component default result", () => {
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
          variants: {
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

    test("function variant overrides extended object variant", () => {
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
          variants: {
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

    test("function variant overrides extended function variant", () => {
      const base = cv({
        variants: {
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
          variants: {
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

    test("function variant style does not accept numbers", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            // @ts-expect-error
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
        fontSize: expect.toBeOneOf(["16", "16px"]),
      });
    });

    test("function variant changes extended boolean variant to string", () => {
      const base = cv({
        variants: { disabled: { true: "disabled", false: "enabled" } },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: {
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

    test("function variant changes extended string variant to boolean", () => {
      const base = cv({ variants: { size: { sm: "sm", md: "md", lg: "lg" } } });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: {
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

    test("function variant with number type", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            columns: (value: number) => ({
              class: `grid-cols-${value}`,
              style: { "--grid-columns": `${value}` },
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

    test("function variant with number type returns dynamic styles", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
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

    test("function variant with nullable type", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
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

    test("function variant changes extended variant from string to number", () => {
      const base = cv({
        variants: { size: { sm: "text-sm", md: "text-md", lg: "text-lg" } },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: {
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

    test("static and function variants combine within the same component", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: {
            size: { sm: "size-sm", lg: "size-lg" },
            columns: (value: number) => `cols-${value}`,
          },
        }),
      );
      const props = component({ size: "lg", columns: 3 });
      expect(getStyleClass(props)).toEqual({
        class: cls("size-lg cols-3"),
      });
    });

    test("object variant in child replaces extended function variant at runtime", () => {
      const base = cv({
        variants: {
          // The function is typed for `number`; if it ran with a child string,
          // it would emit garbage like `base-fn-sm`. The merged-variant type
          // says the child's object replaces the parent function entirely, so
          // the runtime must skip the parent's function for this key.
          size: (value: number) => `base-fn-${value}`,
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: {
            size: { sm: "child-sm", lg: "child-lg" },
          },
        }),
      );
      const propsSm = component({ size: "sm" });
      expect(getStyleClass(propsSm)).toEqual({ class: cls("child-sm") });
      const propsLg = component({ size: "lg" });
      expect(getStyleClass(propsLg)).toEqual({ class: cls("child-lg") });
    });

    test("object variant in grandchild replaces grandparent function variant at runtime", () => {
      const base = cv({
        variants: { size: (value: number) => `base-fn-${value}` },
      });
      const middle = cv({ extend: [base], class: "middle" });
      const component = getModeComponent(
        mode,
        cv({
          extend: [middle],
          variants: { size: { sm: "gc-sm", lg: "gc-lg" } },
        }),
      );
      const props = component({ size: "sm" });
      expect(getStyleClass(props)).toEqual({ class: cls("middle gc-sm") });
    });

    test("intermediate object variant hides grandparent function from later extends", () => {
      const base = cv({
        variants: { size: (value: number) => `base-fn-${value}` },
      });
      const middle = cv({
        extend: [base],
        variants: { size: { sm: "middle-sm", md: "middle-md" } },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [middle],
          variants: { size: { sm: "child-sm", lg: "child-lg" } },
        }),
      );
      // Middle already replaced the grandparent function with an object, so
      // child sees only objects in the chain — both objects merge by value.
      const props = component({ size: "sm" });
      expect(getStyleClass(props)).toEqual({
        class: cls("middle-sm child-sm"),
      });
    });
  });
}
