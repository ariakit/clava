import { describe, expect, expectTypeOf, test } from "vitest";

import type {
  AnyComponent,
  ComponentResult,
  StyleClassValue,
  HTMLCSSProperties,
  JSXCSSProperties,
  Variants,
  ComputedVariants,
  Component,
} from "./types.ts";

import { cv as cvBase, create } from "./index.ts";
import {
  htmlObjStyleToStyleValue,
  htmlStyleToStyleValue,
  isHTMLObjStyle,
  jsxStyleToStyleValue,
} from "./utils.ts";

const MODES = ["jsx", "html", "htmlObj"] as const;
type Mode = (typeof MODES)[number] | null;

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

function createCVFromConfig<T extends Config>(config: T) {
  const defaultMode = getConfigDefaultMode(config);
  return !defaultMode
    ? cvBase
    : create({ defaultMode, transformClass: getConfigTransformClass(config) })
        .cv;
}

function getModalComponent<
  M extends Mode,
  V extends Variants = {},
  CV extends ComputedVariants = {},
  const E extends AnyComponent[] = [],
>(mode: M, component: Component<V, CV, E, ComponentResult>) {
  if (!mode) return component;
  return component[mode];
}

function getClass(props: ComponentResult) {
  if ("class" in props) return props.class;
  return props.className;
}

function getClassPropertyName(config: Config) {
  const mode = config.mode ?? config.defaultMode;
  if (mode === "jsx") return "className";
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

function getStyleClass(props: ComponentResult): StyleClassValue {
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
        fontSize: 16,
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
              red: { backgroundColor: "red" },
              blue: { backgroundColor: "blue" },
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

    test("variant with class and style value", () => {
      const component = getModalComponent(
        mode,
        cv({
          variants: {
            color: {
              red: { class: "text-red", backgroundColor: "red" },
              blue: { class: "text-blue", backgroundColor: "blue" },
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
              fontSize: value === "sm" ? "12px" : "16px",
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

    test("computed with style", () => {
      const component = getModalComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          computed: ({ variants }) =>
            variants.size === "lg" ? { fontSize: "20px" } : null,
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
              ? { class: "computed-lg", fontSize: "20px" }
              : null,
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({
        class: cls("lg computed-lg"),
        fontSize: "20px",
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
      expect(getStyleClass(props)).toEqual({ class: cls("base-lg base-lg") });
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
      const [variantProps, otherProps] = component.splitProps({
        id: "test",
        size: "lg",
        style: { color: "red" },
        [classNameProp]: "extra",
      });
      expect(variantProps).toEqual({
        size: "lg",
        style: { color: "red" },
        [classNameProp]: "extra",
      });
      expect(otherProps).toEqual({ id: "test" });
    });

    test("onlyVariants splitProps", () => {
      const component = getModalComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const [variantProps, otherProps] = component.onlyVariants.splitProps({
        size: "lg",
        id: "test",
        style: "color: red;",
        [classNameProp]: "extra",
      });
      expect(variantProps).toEqual({ size: "lg" });
      expect(otherProps).toEqual({
        id: "test",
        style: "color: red;",
        [classNameProp]: "extra",
      });
    });

    test("onlyVariants getVariants", () => {
      const component = getModalComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const variants = component.onlyVariants.getVariants({ size: "lg" });
      expect(variants).toEqual({ size: "lg" });
    });

    test("onlyVariants keys", () => {
      const component = cv({
        variants: { size: { sm: "sm" }, color: { red: "red" } },
      });
      expectTypeOf(component.onlyVariants.keys).toExtend<
        ("size" | "color")[]
      >();
      expect(component.onlyVariants.keys).toEqual(
        expect.arrayContaining(["size", "color"]),
      );
    });
  });
}
