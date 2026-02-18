import { describe, expect, expectTypeOf, test } from "vitest";
import {
  type Variant,
  type VariantProps,
  create,
  cv as cvBase,
  splitProps,
} from "./index.ts";
import type {
  AnyComponent,
  CVComponent,
  ComponentResult,
  ComputedVariants,
  HTMLCSSProperties,
  JSXCSSProperties,
  StyleProperty,
  Variants,
} from "./types.ts";
import {
  htmlObjStyleToStyleValue,
  htmlStyleToStyleValue,
  isHTMLObjStyle,
  jsxStyleToStyleValue,
} from "./utils.ts";

const MODES = ["jsx", "html", "htmlObj"] as const;
type Mode = (typeof MODES)[number] | null;

type HTMLProperties<T extends AnyComponent> = VariantProps<T> & {
  id?: string;
  class?: string;
  className?: string;
  style?: StyleProperty;
};

type ConfigParams = NonNullable<Parameters<typeof create>[0]>;

interface Config {
  mode: Mode;
  defaultMode: Mode;
  transformClass?: ConfigParams["transformClass"];
}

type ConfigMode<T extends Config> = NonNullable<T["mode"] | T["defaultMode"]>;

const transformClass = {
  uppercase: (className) => className.toUpperCase(),
} satisfies Record<string, Config["transformClass"]>;

const CONFIGS = {
  default: { mode: null, defaultMode: null },
  jsx: { mode: "jsx", defaultMode: null },
  html: { mode: "html", defaultMode: null },
  htmlObj: { mode: "htmlObj", defaultMode: null },
  htmlDefault: { mode: null, defaultMode: "html" },
  htmlObjDefault: { mode: null, defaultMode: "htmlObj" },
  uppercase: {
    mode: null,
    defaultMode: null,
    transformClass: transformClass.uppercase,
  },
} satisfies Record<string, Config>;

function getConfigMode<T extends Config>(config: T): T["mode"] {
  if (!("mode" in config)) return null;
  return config.mode;
}

function getConfigDefaultMode<T extends Config>(config: T): T["defaultMode"] {
  if (!("defaultMode" in config)) return null;
  return config.defaultMode;
}

function getConfigTransformClass(config: Config) {
  if (!("transformClass" in config) || !config.transformClass) {
    return (className: string) => className;
  }
  return config.transformClass;
}

function getConfigDescription(config: Config) {
  for (const [name, cfg] of Object.entries(CONFIGS)) {
    if (cfg !== config) continue;
    return name;
  }
  return "custom";
}

function createCVFromConfig<T extends Config>(
  config: T,
): T["defaultMode"] & T["transformClass"] extends never
  ? typeof cvBase
  : ReturnType<typeof create>["cv"] {
  const defaultMode = getConfigDefaultMode(config);
  const transformClass = getConfigTransformClass(config);
  const hasTransform = "transformClass" in config && config.transformClass;
  if (!defaultMode && !hasTransform) {
    return cvBase;
  }
  const { cv } = create({ defaultMode: defaultMode ?? "jsx", transformClass });
  return cv as any;
}

function getModalComponent<
  M extends Mode,
  V extends Variants = {},
  CV extends ComputedVariants = {},
  const E extends AnyComponent[] = [],
>(mode: M, component: CVComponent<V, CV, E>) {
  if (!mode) return component;
  return component[mode];
}

function getClass(props: ComponentResult) {
  if ("class" in props) return props.class;
  return props.className;
}

function getClassPropertyName(config: Config) {
  const mode = config.mode ?? config.defaultMode;
  // null defaults to jsx mode
  if (mode === "jsx" || mode === null) return "className";
  return "class";
}

function assertClassProperty<T extends Config>(
  config: T,
  props: ComponentResult,
): asserts props is ConfigMode<T> extends "html" | "htmlObj"
  ? Extract<ComponentResult, { class: string }>
  : Extract<ComponentResult, { className: string }> {
  const mode = config.mode ?? config.defaultMode;
  if (mode === "html" || mode === "htmlObj") {
    if (!("class" in props)) {
      expect.fail(`Expected ${mode} props to have class`);
    }
  } else {
    if (!("className" in props)) {
      expect.fail(`Expected ${mode ?? "jsx"} props to have className`);
    }
  }
}

function assertStyleProperty<T extends Config>(
  config: T,
  props: ComponentResult,
): asserts props is ConfigMode<T> extends "html"
  ? Extract<ComponentResult, { style: string }>
  : ConfigMode<T> extends "htmlObj"
    ? Extract<ComponentResult, { style: HTMLCSSProperties }>
    : Extract<ComponentResult, { style: JSXCSSProperties }> {
  if (!("style" in props)) {
    const mode = config.mode ?? config.defaultMode;
    expect.fail(`Expected ${mode ?? "jsx"} props to have style`);
  }
}

function getStyle(props: Pick<ComponentResult, "style">) {
  if (typeof props.style === "string") {
    return htmlStyleToStyleValue(props.style);
  }
  if (typeof props.style === "object") {
    if (isHTMLObjStyle(props.style)) {
      return htmlObjStyleToStyleValue(props.style);
    }
    return jsxStyleToStyleValue(props.style);
  }
  return {};
}

function getStyleClass(props: ComponentResult): Record<string, unknown> {
  return {
    ...getStyle(props),
    class: getClass(props),
  };
}

for (const config of [CONFIGS.default, CONFIGS.jsx, CONFIGS.uppercase]) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("style has correct shape for mode", () => {
      const component = getModalComponent(
        mode,
        cv({ class: "base", style: { backgroundColor: "red" } }),
      );
      const props = component();
      assertClassProperty(config, props);
      expect(props).not.toHaveProperty("class");
      expect(props.className).toBe(cls("base"));
      expect(props.style.backgroundColor).toBe("red");
      expectTypeOf(props.style).toEqualTypeOf<JSXCSSProperties>();
    });

    test("no argument still returns jsx shape", () => {
      const component = getModalComponent(mode, cv());
      const props = component();
      assertClassProperty(config, props);
      expect(props).not.toHaveProperty("class");
      expect(props.className).toBe("");
      expect(props.style).toEqual({});
      expectTypeOf(props.style).toEqualTypeOf<JSXCSSProperties>();
    });
  });
}

for (const config of [CONFIGS.html, CONFIGS.htmlDefault]) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("style has correct shape for mode", () => {
      const component = getModalComponent(
        mode,
        cv({ class: "base", style: { backgroundColor: "red" } }),
      );
      const props = component();
      assertClassProperty(config, props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe(cls("base"));
      expect(props.style).toBe("background-color: red;");
    });

    test("no argument still returns html shape", () => {
      const component = getModalComponent(mode, cv());
      const props = component();
      assertClassProperty(config, props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe("");
      expect(props.style).toBe("");
    });
  });
}

for (const config of [CONFIGS.htmlObj, CONFIGS.htmlObjDefault]) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("style has correct shape for mode", () => {
      const component = getModalComponent(
        mode,
        cv({ class: "base", style: { backgroundColor: "red" } }),
      );
      const props = component();
      assertClassProperty(config, props);
      assertStyleProperty(config, props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe(cls("base"));
      expect(props.style["background-color"]).toBe("red");
      expectTypeOf(props.style).toEqualTypeOf<HTMLCSSProperties>();
    });

    test("no argument still returns htmlObj shape", () => {
      const component = getModalComponent(mode, cv());
      const props = component();
      assertClassProperty(config, props);
      assertStyleProperty(config, props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe("");
      expect(props.style).toEqual({});
      expectTypeOf(props.style).toEqualTypeOf<HTMLCSSProperties>();
    });
  });
}

for (const config of Object.values(CONFIGS)) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("no argument", () => {
      const component = getModalComponent(mode, cv());
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("null class", () => {
      const component = getModalComponent(mode, cv({ class: null }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("empty array class", () => {
      const component = getModalComponent(mode, cv({ class: [] }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("string class", () => {
      const component = getModalComponent(mode, cv({ class: "foo bar" }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar") });
    });

    test("nested array class", () => {
      const component = getModalComponent(
        mode,
        cv({ class: ["foo", ["bar", ["baz"]]] }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar baz") });
    });

    test("nested array class with falsy values", () => {
      const component = getModalComponent(
        mode,
        cv({ class: ["foo", null, ["bar", false, ["baz", 0]]] }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar baz") });
    });

    test("merge class from props", () => {
      const component = getModalComponent(mode, cv({ class: "foo bar" }));
      const props = component({ class: "baz qux" });
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar baz qux") });
    });

    test("merge className from props", () => {
      const component = getModalComponent(mode, cv({ class: "foo bar" }));
      const props = component({ className: "baz qux" });
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar baz qux") });
    });

    test("merge class and className from props", () => {
      const component = getModalComponent(mode, cv({ class: "foo bar" }));
      const props = component({ class: "baz qux", className: "quux corge" });
      expect(getStyleClass(props)).toEqual({
        class: cls("foo bar baz qux quux corge"),
      });
    });

    test("merge null class from props", () => {
      const component = getModalComponent(mode, cv({ class: "foo bar" }));
      const props = component({ class: null });
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar") });
    });

    test("merge null className from props", () => {
      const component = getModalComponent(mode, cv({ class: "foo bar" }));
      const props = component({ className: null });
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar") });
    });

    test("empty style", () => {
      const component = getModalComponent(mode, cv({ style: {} }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("style with properties", () => {
      const component = getModalComponent(
        mode,
        cv({ style: { backgroundColor: "red", fontSize: "16px" } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("style does not accept numbers", () => {
      const component = getModalComponent(
        mode,
        cv({
          style: {
            backgroundColor: "red",
            // @ts-expect-error
            fontSize: 16,
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: expect.toBeOneOf(["16", "16px"]),
      });
    });

    test("style with custom property", () => {
      const component = getModalComponent(
        mode,
        cv({ style: { backgroundColor: "red", "--custom-var": "value" } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        "--custom-var": "value",
      });
    });

    test("merge style from props", () => {
      const component = getModalComponent(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = component({ style: { fontSize: "16px" } });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("merge jsx style from props", () => {
      const component = getModalComponent(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = component({ style: { fontSize: 16 } });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("merge html style from props", () => {
      const component = getModalComponent(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = component({ style: "font-size: 16px" });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("merge htmlObj style from props", () => {
      const component = getModalComponent(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = component({ style: { "font-size": 16 } });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("merge null style from props", () => {
      const component = getModalComponent(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = component({ style: null });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
      });
    });

    test("variant no value empty class", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("variant no value with class", () => {
      const component = getModalComponent(
        mode,
        cv({ class: "foo", variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("foo") });
    });

    test("variant with value", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("lg") });
    });

    test("variant with value and class", () => {
      const component = getModalComponent(
        mode,
        cv({ class: "foo", variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("foo lg") });
    });

    test("variant with style value", () => {
      const component = getModalComponent(
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
      const component = getModalComponent(
        mode,
        cv({
          variants: {
            color: {
              // @ts-expect-error
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
        mode,
        cv({ variants: { disabled: { true: "disabled", false: "enabled" } } }),
      );
      const props = component({ disabled: true });
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("boolean variant false", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { disabled: { true: "disabled", false: "enabled" } } }),
      );
      const props = component({ disabled: false });
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("boolean variant true only false", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { disabled: { true: "disabled" } } }),
      );
      const props = component({ disabled: false });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("boolean variant true only true", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { disabled: { true: "disabled" } } }),
      );
      const props = component({ disabled: true });
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("boolean variant no value applies false", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { disabled: { true: "disabled", false: "enabled" } } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("boolean variant false only", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { disabled: { false: "enabled" } } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("boolean variant false only false", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { disabled: { false: "enabled" } } }),
      );
      const props = component({ disabled: false });
      expect(getStyleClass(props)).toEqual({ class: cls("enabled") });
    });

    test("boolean variant false only true", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { disabled: { false: "enabled" } } }),
      );
      const props = component({ disabled: true });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("boolean variant shorthand true", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { disabled: "disabled" } }),
      );
      const props = component({ disabled: true });
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("boolean variant shorthand false", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { disabled: "disabled" } }),
      );
      const props = component({ disabled: false });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("variant style does not accept numbers", () => {
      const component = getModalComponent(
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
      const props = component({ size: "sm" });
      expect(getStyleClass(props)).toEqual({
        class: cls("sm"),
        fontSize: expect.toBeOneOf(["12", "12px"]),
      });
    });

    test("variant props do not accept invalid values", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props = component({
        // @ts-expect-error
        size: "invalid",
      });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("variant props do not accept invalid keys", () => {
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: {
            // @ts-expect-error
            size: "invalid",
          },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("defaultVariants when explicitly passing undefined", () => {
      const component = getModalComponent(
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
      const component = getModalComponent(
        mode,
        cv({
          variants: { disabled: { true: "disabled", false: "enabled" } },
          defaultVariants: { disabled: true },
        }),
      );
      const props = component({ disabled: undefined });
      expect(getStyleClass(props)).toEqual({ class: cls("disabled") });
    });

    test("computedVariants", () => {
      const component = getModalComponent(
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
      const component = getModalComponent(
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

    test("computedVariants overrides extended object variants", () => {
      const base = cv({
        variants: {
          size: {
            sm: { class: "base-sm", style: { fontSize: "12px" } },
            lg: { class: "base-lg", style: { fontSize: "16px" } },
          },
        },
      });
      const component = getModalComponent(
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
      const component = getModalComponent(
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

    test("computedVariants style does not accept numbers", () => {
      const component = getModalComponent(
        mode,
        cv({
          computedVariants: {
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

    test("computedVariants changes extended boolean variant to string", () => {
      const base = cv({
        variants: { disabled: { true: "disabled", false: "enabled" } },
      });
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
        mode,
        cv({
          computedVariants: {
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

    test("computedVariants with number type returns dynamic styles", () => {
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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

    test("computed", () => {
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(mode, cv({ extend: [child] }));
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ setVariants }) => {
            setVariants({
              // @ts-expect-error
              size: "invalid",
            });
          },
        }),
      );
      const props = component({ size: "lg" });
      // Invalid value overrides the valid one, resulting in no match
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("computed addClass with string", () => {
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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

    test("extend single component", () => {
      const base = cv({ class: "base", variants: { size: { sm: "sm" } } });
      const component = getModalComponent(
        mode,
        cv({ extend: [base], class: "extended" }),
      );
      const props = component({ size: "sm" });
      expect(getStyleClass(props)).toEqual({ class: cls("base extended sm") });
    });

    test("extend multiple components", () => {
      const base1 = cv({ class: "base1" });
      const base2 = cv({ class: "base2" });
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
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
      const component = getModalComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: null },
          defaultVariants: {
            // @ts-expect-error
            size: "lg",
          },
        }),
      );
      const props = component({
        // @ts-expect-error
        size: "lg",
      });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("extend can disable variant value with null", () => {
      const base = cv({
        variants: { size: { sm: "base-sm", lg: "base-lg" } },
        defaultVariants: { size: "sm" },
      });
      const component = getModalComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          defaultVariants: {
            // @ts-expect-error
            size: "sm",
          },
        }),
      );
      const disabledProps = component({
        // @ts-expect-error
        size: "sm",
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
      const component = getModalComponent(
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
      const validComponent = getModalComponent(
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

      const invalidComponent = getModalComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          computed: ({ setDefaultVariants }) => {
            setDefaultVariants({
              // @ts-expect-error
              size: "sm",
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
      const validComponent = getModalComponent(
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

      const invalidComponent = getModalComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          computed: ({ setVariants }) => {
            setVariants({
              // @ts-expect-error
              size: "sm",
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
      const component = getModalComponent(mode, cv({ extend: [base] }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("extend override defaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
      });
      const component = getModalComponent(
        mode,
        cv({ extend: [base], defaultVariants: { size: "lg" } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg") });
    });

    test("class method", () => {
      const component = getModalComponent(
        mode,
        cv({ class: "foo", variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const className = component.class({ size: "lg" });
      expect(className).toBe(cls("foo lg"));
    });

    test("style method", () => {
      const component = getModalComponent(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const style = component.style();
      expect(getStyle({ style })).toEqual({ backgroundColor: "red" });
    });

    test("getVariants returns variant values", () => {
      const component = getModalComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const variants = component.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "lg" });
    });

    test("getVariants returns default variants", () => {
      const component = getModalComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const variants = component.getVariants();
      expect(variants).toEqual({ size: "sm" });
    });

    test("getVariants returns variants set by computed setVariants", () => {
      const component = getModalComponent(
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
      const variants = component.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "lg", color: "red" });
    });

    test("getVariants returns variants set by computed setDefaultVariants", () => {
      const component = getModalComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          computed: ({ variants, setDefaultVariants }) => {
            if (variants.size === "lg") {
              setDefaultVariants({ color: "blue" });
            }
          },
        }),
      );
      const variants = component.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "lg", color: "blue" });
    });

    test("getVariants setDefaultVariants does not override props", () => {
      const component = getModalComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          computed: ({ setDefaultVariants }) => {
            setDefaultVariants({ color: "blue" });
          },
        }),
      );
      const variants = component.getVariants({ color: "red" });
      expect(variants).toEqual({ color: "red" });
    });

    test("getVariants setVariants overrides props", () => {
      const component = getModalComponent(
        mode,
        cv({
          variants: {
            size: { sm: "sm", lg: "lg" },
            color: { red: "red", blue: "blue" },
          },
          computed: ({ setVariants }) => {
            setVariants({ color: "blue" });
          },
        }),
      );
      const variants = component.getVariants({ color: "red" });
      expect(variants).toEqual({ color: "blue" });
    });

    test("keys returns props keys", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm" }, color: { red: "red" } } }),
      );
      expectTypeOf(component.keys).toExtend<
        ("class" | "className" | "style" | "size" | "color")[]
      >();
      expect(component.keys).toEqual([
        getClassPropertyName(config),
        "style",
        "size",
        "color",
      ]);
    });

    test("splitProps separates variant props", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> = {
        id: "test",
        size: "lg",
        style: { color: "red" },
        [classNameProp]: "extra",
      };
      const [variantProps, otherProps] = splitProps(props, component);
      expectTypeOf(variantProps).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(variantProps).toEqual({
        size: "lg",
        style: { color: "red" },
        [classNameProp]: "extra",
      });
      expect(otherProps).toEqual({ id: "test" });
    });

    test("variantKeys splitProps", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> = {
        size: "lg",
        id: "test",
        style: "color: red;",
        [classNameProp]: "extra",
      };
      const [variantProps, otherProps] = splitProps(
        props,
        component.variantKeys,
      );
      expectTypeOf(variantProps).branded.toEqualTypeOf<{
        size?: "sm" | "lg";
      }>();
      expectTypeOf(otherProps).toEqualTypeOf<
        Pick<typeof props, "id" | "style" | "class" | "className">
      >();
      expect(variantProps).toEqual({ size: "lg" });
      expect(otherProps).toEqual({
        id: "test",
        style: "color: red;",
        [classNameProp]: "extra",
      });
    });

    test("variantKeys property", () => {
      const component = getModalComponent(
        mode,
        cv({
          variants: { size: { sm: "sm" }, color: { red: "red" } },
        }),
      );
      expectTypeOf(component.variantKeys).toEqualTypeOf<("size" | "color")[]>();
      expect(component.variantKeys).toEqual(["size", "color"]);
    });

    test("propKeys property", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm" }, color: { red: "red" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      expectTypeOf(component.propKeys).toExtend<
        ("class" | "className" | "style" | "size" | "color")[]
      >();
      expect(component.propKeys).toEqual([
        classNameProp,
        "style",
        "size",
        "color",
      ]);
    });

    test("propKeys on different modes", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      expect(component.propKeys).toEqual([classNameProp, "style", "size"]);
    });

    test("splitProps does not include defaultVariants", () => {
      const component = getModalComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" }, color: { red: "red" } },
          defaultVariants: { size: "sm", color: "red" },
        }),
      );
      const props: HTMLProperties<typeof component> = {
        id: "test",
        size: "lg",
      };
      const [variantProps, otherProps] = splitProps(props, component);
      expectTypeOf(variantProps).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "color" | "style" | "class" | "className">
      >();
      expect(variantProps).toEqual({
        size: "lg",
      });
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with key array as second parameter", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> & { disabled?: boolean } = {
        id: "test",
        size: "lg",
        style: { color: "red" },
        [classNameProp]: "extra",
        disabled: true,
      };
      const [variantProps, extraProps, otherProps] = splitProps(
        props,
        component,
        ["disabled"],
      );
      expectTypeOf(variantProps).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      expect(variantProps).toEqual({
        size: "lg",
        style: { color: "red" },
        [classNameProp]: "extra",
      });
      expectTypeOf(extraProps).branded.toEqualTypeOf<{ disabled?: boolean }>();
      expect(extraProps).toEqual({ disabled: true });
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with another component as parameter", () => {
      const component1 = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const component2 = getModalComponent(
        mode,
        cv({
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { color: "red" },
        }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> = {
        id: "test",
        size: "lg",
        color: "blue",
        [classNameProp]: "extra",
      };
      const [comp1Props, comp2Props, otherProps] = splitProps(
        props,
        component1,
        component2,
      );
      expectTypeOf(comp1Props).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      // First component gets class/style props
      expect(comp1Props).toEqual({
        size: "lg",
        [classNameProp]: "extra",
      });
      // Second component only gets variant props (no class/style)
      expectTypeOf(comp2Props).branded.toEqualTypeOf<
        Pick<typeof props, "color">
      >();
      expect(comp2Props).toEqual({
        color: "blue",
      });
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with component parameter does not include component defaults", () => {
      const component1 = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const component2 = getModalComponent(
        mode,
        cv({
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { color: "red" },
        }),
      );
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> = {
        id: "test",
        size: "lg",
      };
      const [comp1Props, comp2Props, otherProps] = splitProps(
        props,
        component1,
        component2,
      );
      // First component gets variant props
      expect(comp1Props).toEqual({ size: "lg" });
      // Second component gets empty object (no defaults applied)
      expect(comp2Props).toEqual({});
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps second component excludes class and style", () => {
      const component1 = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const component2 = getModalComponent(
        mode,
        cv({ variants: { color: { red: "red", blue: "blue" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> = {
        id: "test",
        size: "lg",
        color: "blue",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      };
      const [comp1Props, comp2Props, otherProps] = splitProps(
        props,
        component1,
        component2,
      );
      expectTypeOf(comp1Props).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      // First component gets class/style
      expect(comp1Props).toEqual({
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      });
      // Second component only gets variant props
      expectTypeOf(comp2Props).branded.toEqualTypeOf<{
        color?: "red" | "blue";
      }>();
      expect(comp2Props).toEqual({ color: "blue" });
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with multiple parameters", () => {
      const component1 = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const component2 = getModalComponent(
        mode,
        cv({ variants: { color: { red: "red", blue: "blue" } } }),
      );
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> & { disabled?: boolean } = {
        id: "test",
        size: "lg",
        color: "blue",
        disabled: true,
      };
      const [comp1Props, extraProps, comp2Props, otherProps] = splitProps(
        props,
        component1,
        ["disabled"],
        component2,
      );
      expectTypeOf(comp1Props).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      expectTypeOf(extraProps).branded.toEqualTypeOf<{ disabled?: boolean }>();
      expectTypeOf(comp2Props).branded.toEqualTypeOf<{
        color?: "red" | "blue";
      }>();
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(comp1Props).toEqual({ size: "lg" });
      expect(extraProps).toEqual({ disabled: true });
      expect(comp2Props).toEqual({ color: "blue" });
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with shared keys between components", () => {
      const component1 = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const component2 = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> = {
        id: "test",
        size: "lg",
      };
      const [comp1Props, comp2Props, otherProps] = splitProps(
        props,
        component1,
        component2,
      );
      expectTypeOf(comp1Props).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      // First component gets class/style + size
      expect(comp1Props).toEqual({ size: "lg" });
      // Second component only gets variant props (size appears in both)
      expectTypeOf(comp2Props).branded.toEqualTypeOf<{
        size?: "sm" | "lg";
      }>();
      expect(comp2Props).toEqual({ size: "lg" });
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with defaultVariants from multiple components does not include defaults", () => {
      const component1 = getModalComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const component2 = getModalComponent(
        mode,
        cv({
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { color: "red" },
        }),
      );
      const [comp1Props, comp2Props, otherProps] = splitProps(
        { id: "test" },
        component1,
        component2,
      );
      // Neither gets defaults - only props that are actually in the input
      expectTypeOf(comp1Props).branded.toEqualTypeOf<{ size?: "sm" | "lg" }>();
      expect(comp1Props).toEqual({});
      expectTypeOf(comp2Props).branded.toEqualTypeOf<{
        color?: "red" | "blue";
      }>();
      expect(comp2Props).toEqual({});
      expectTypeOf(otherProps).toEqualTypeOf<{ id: string }>();
      expect(otherProps).toEqual({ id: "test" });
    });

    test("variantKeys splitProps does not include defaultVariants", () => {
      const component = getModalComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" }, color: { red: "red" } },
          defaultVariants: { size: "sm", color: "red" },
        }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> = {
        id: "test",
        size: "lg",
        [classNameProp]: "extra",
      };
      const [variantProps, otherProps] = splitProps(
        props,
        component.variantKeys,
      );
      // variantKeys is just an array, so no defaults are applied
      expect(variantProps).toEqual({
        size: "lg",
      });
      // color is in variantKeys but not in props, so it's not in either result
      expect(otherProps).toEqual({ id: "test", [classNameProp]: "extra" });
    });

    test("variantKeys splitProps with key array", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> & { disabled?: boolean } = {
        id: "test",
        size: "lg",
        [classNameProp]: "extra",
        disabled: true,
      };
      const [variantProps, extraProps, otherProps] = splitProps(
        props,
        component.variantKeys,
        ["disabled"],
      );
      expectTypeOf(variantProps).branded.toEqualTypeOf<{
        size?: "sm" | "lg";
      }>();
      expect(variantProps).toEqual({ size: "lg" });
      expectTypeOf(extraProps).branded.toEqualTypeOf<{ disabled?: boolean }>();
      expect(extraProps).toEqual({ disabled: true });
      expectTypeOf(otherProps).toEqualTypeOf<
        Pick<typeof props, "id" | "class" | "className" | "style">
      >();
      expect(otherProps).toEqual({ id: "test", [classNameProp]: "extra" });
    });

    test("variantKeys splitProps with component", () => {
      const component1 = getModalComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const component2 = getModalComponent(
        mode,
        cv({
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { color: "red" },
        }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> = {
        id: "test",
        size: "lg",
        color: "blue",
        [classNameProp]: "extra",
      };
      const [comp1Props, comp2Props, otherProps] = splitProps(
        props,
        component1.variantKeys,
        component2.variantKeys,
      );
      expectTypeOf(comp1Props).branded.toEqualTypeOf<{ size?: "sm" | "lg" }>();
      expect(comp1Props).toEqual({ size: "lg" });
      expectTypeOf(comp2Props).branded.toEqualTypeOf<{
        color?: "red" | "blue";
      }>();
      expect(comp2Props).toEqual({ color: "blue" });
      expectTypeOf(otherProps).toEqualTypeOf<
        Pick<typeof props, "id" | "class" | "className" | "style">
      >();
      expect(otherProps).toEqual({ id: "test", [classNameProp]: "extra" });
    });

    test("splitProps with array containing class before component", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> = {
        id: "test",
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      };
      // Array gets class, component still gets class/style (arrays don't claim styling)
      const [arrayProps, compProps, otherProps] = splitProps(
        props,
        [classNameProp],
        component,
      );
      expectTypeOf(arrayProps).branded.toEqualTypeOf<
        Pick<typeof props, "class" | "className">
      >();
      expect(arrayProps).toEqual({ [classNameProp]: "extra" });
      // Component still gets class/style since arrays don't claim them
      expectTypeOf(compProps).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      expect(compProps).toEqual({
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      });
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with array containing class and style before component", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> = {
        id: "test",
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      };
      // Array gets class and style, component still gets class/style (arrays don't claim styling)
      const [arrayProps, compProps, otherProps] = splitProps(
        props,
        [classNameProp, "style"],
        component,
      );
      expectTypeOf(arrayProps).branded.toEqualTypeOf<
        Pick<typeof props, "class" | "className" | "style">
      >();
      expect(arrayProps).toEqual({
        [classNameProp]: "extra",
        style: { backgroundColor: "yellow" },
      });
      // Component still gets class/style since arrays don't claim them
      expectTypeOf(compProps).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      expect(compProps).toEqual({
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      });
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with array after component", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> = {
        id: "test",
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      };
      // Component gets class/style first, array also gets them
      const [compProps, arrayProps, otherProps] = splitProps(props, component, [
        classNameProp,
        "style",
      ]);
      expectTypeOf(compProps).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      expect(compProps).toEqual({
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      });
      expectTypeOf(arrayProps).branded.toEqualTypeOf<
        Pick<typeof props, "class" | "className" | "style">
      >();
      expect(arrayProps).toEqual({
        [classNameProp]: "extra",
        style: { backgroundColor: "yellow" },
      });
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps array before multiple components", () => {
      const component1 = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const component2 = getModalComponent(
        mode,
        cv({ variants: { color: { red: "red", blue: "blue" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> & { disabled?: boolean } = {
        id: "test",
        size: "lg",
        color: "blue",
        disabled: true,
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      };
      // Array doesn't claim styling, so first component (comp1) gets styling
      const [disabledProps, comp1Props, comp2Props, otherProps] = splitProps(
        props,
        ["disabled"],
        component1,
        component2,
      );
      expectTypeOf(disabledProps).branded.toEqualTypeOf<{
        disabled?: boolean;
      }>();
      expect(disabledProps).toEqual({ disabled: true });
      expectTypeOf(comp1Props).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      // First component gets class/style
      expect(comp1Props).toEqual({
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      });
      // Second component only gets variant props
      expectTypeOf(comp2Props).branded.toEqualTypeOf<
        Pick<typeof props, "color">
      >();
      expect(comp2Props).toEqual({ color: "blue" });
      expect(otherProps).toEqual({ id: "test" });
    });
  });
}

describe("Variant utility type", () => {
  test("matches variant keys from another component", () => {
    const base = cvBase({
      variants: { foo: { sm: "foo-sm", lg: "foo-lg" } },
    });
    const component = cvBase({
      extend: [base],
      variants: {
        bar: {
          sm: "bar-sm",
          lg: "bar-lg",
        } satisfies Variant<typeof base, "foo">,
      },
    });
    expect(component({ bar: "sm" }).className).toContain("bar-sm");
  });

  test("rejects invalid variant keys", () => {
    const base = cvBase({
      variants: { foo: { sm: "foo-sm", lg: "foo-lg" } },
    });
    cvBase({
      extend: [base],
      variants: {
        bar: {
          sm: "bar-sm",
          lg: "bar-lg",
          // @ts-expect-error
          xl: "bar-xl",
        } satisfies Variant<typeof base, "foo">,
      },
    });
  });
});
