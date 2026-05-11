import { expect } from "vitest";
import { type VariantProps, create, cv as cvBase } from "../src/index.ts";
import type {
  AnyComponent,
  CVComponent,
  ComponentResult,
  HTMLObjProps,
  HTMLProps,
  JSXProps,
  StyleClassProps,
  StyleProperty,
  Variants,
} from "../src/types.ts";
import {
  htmlObjStyleToStyleValue,
  htmlStyleToStyleValue,
  isHTMLObjStyle,
  jsxStyleToStyleValue,
} from "../src/utils.ts";

const MODES = ["jsx", "html", "htmlObj"] as const;
type Mode = (typeof MODES)[number] | null;

export type HTMLProperties<T extends AnyComponent> = VariantProps<T> & {
  id?: string;
  class?: string;
  className?: string;
  style?: StyleProperty;
};

type ConfigParams = NonNullable<Parameters<typeof create>[0]>;

interface Config {
  mode: Mode;
  transformClass?: ConfigParams["transformClass"];
}

const transformClass = {
  uppercase: (className: string) => className.toUpperCase(),
} satisfies Record<string, Config["transformClass"]>;

export const CONFIGS = {
  default: { mode: null },
  jsx: { mode: "jsx" },
  html: { mode: "html" },
  htmlObj: { mode: "htmlObj" },
  uppercase: {
    mode: null,
    transformClass: transformClass.uppercase,
  },
} satisfies Record<string, Config>;

export function getConfigMode<T extends Config>(config: T): T["mode"] {
  if (!("mode" in config)) return null;
  return config.mode;
}

export function getConfigTransformClass(config: Config) {
  if (!("transformClass" in config) || !config.transformClass) {
    return (className: string) => className;
  }
  return config.transformClass;
}

export function getConfigDescription(config: Config) {
  for (const [name, currentConfig] of Object.entries(CONFIGS)) {
    if (currentConfig !== config) continue;
    return name;
  }
  return "custom";
}

export function createCVFromConfig(
  config: Config,
): ReturnType<typeof create>["cv"] {
  const transformClass = getConfigTransformClass(config);
  const hasTransform = "transformClass" in config && config.transformClass;
  if (!hasTransform) {
    return cvBase;
  }
  const { cv } = create({ transformClass });
  return cv;
}

export function getModeComponent<
  M extends Mode,
  V extends Variants = {},
  const E extends AnyComponent[] = [],
>(mode: M, component: CVComponent<V, E>) {
  if (!mode) return component;
  return component[mode];
}

function getClass(props: ComponentResult) {
  if ("class" in props) return props.class;
  return props.className;
}

export function getClassPropertyName(config: Config) {
  const mode = config.mode;
  if (mode === "jsx" || mode === null) return "className";
  return "class";
}

export function getExpectedPropsKeys(config: Config, ...variantKeys: string[]) {
  if (config.mode === null) {
    return ["class", "className", "style", ...variantKeys];
  }
  return [getClassPropertyName(config), "style", ...variantKeys];
}

export function assertDefaultProps(
  props: ComponentResult,
): asserts props is StyleClassProps {
  if (!("class" in props)) {
    expect.fail("Expected default props to have class");
  }
  if (!("style" in props) || typeof props.style !== "object") {
    expect.fail("Expected default props to have style");
  }
}

export function assertJSXProps(
  props: ComponentResult,
): asserts props is JSXProps {
  if (!("className" in props)) {
    expect.fail("Expected jsx props to have className");
  }
  if (!("style" in props) || typeof props.style !== "object") {
    expect.fail("Expected jsx props to have style");
  }
}

export function assertHTMLProps(
  props: ComponentResult,
): asserts props is HTMLProps {
  if (!("class" in props)) {
    expect.fail("Expected html props to have class");
  }
  if (!("style" in props) || typeof props.style !== "string") {
    expect.fail("Expected html props to have style");
  }
}

export function assertHTMLObjProps(
  props: ComponentResult,
): asserts props is HTMLObjProps {
  if (!("class" in props)) {
    expect.fail("Expected htmlObj props to have class");
  }
  if (!("style" in props) || typeof props.style !== "object") {
    expect.fail("Expected htmlObj props to have style");
  }
}

export function getStyle(props: Pick<ComponentResult, "style">) {
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

export function getStyleClass(props: ComponentResult): Record<string, unknown> {
  return {
    ...getStyle(props),
    class: getClass(props),
  };
}
