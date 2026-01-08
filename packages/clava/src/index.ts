import clsx, { type ClassValue as ClsxClassValue } from "clsx";

import type {
  Variants,
  ComputedVariants,
  AnyComponent,
  Component,
  StyleProps,
  ClassValue,
  StyleValue,
  StyleClassValue,
  VariantValues,
  Computed,
  ExtendableVariants,
  MergeVariants,
  ModalComponent,
  ComponentResult,
  JSXProps,
  HTMLProps,
  HTMLObjProps,
  OnlyVariantsComponent,
  ComponentProps,
} from "./types.ts";

import {
  htmlObjStyleToStyleValue,
  htmlStyleToStyleValue,
  isHTMLObjStyle,
  jsxStyleToStyleValue,
  styleValueToHTMLObjStyle,
  styleValueToHTMLStyle,
  styleValueToJSXStyle,
} from "./utils.ts";

const MODES = ["jsx", "html", "htmlObj"] as const;
type Mode = (typeof MODES)[number];

export type { ClassValue, StyleValue, StyleClassValue };

export type VariantProps<T extends Pick<AnyComponent, "getVariants">> =
  ReturnType<T["getVariants"]>;

export interface CVConfig<
  V extends Variants = {},
  CV extends ComputedVariants = {},
  E extends AnyComponent[] = [],
> {
  extend?: E;
  class?: ClassValue;
  style?: StyleValue;
  variants?: ExtendableVariants<V, E>;
  computedVariants?: CV;
  defaultVariants?: VariantValues<MergeVariants<V, CV, E>>;
  computed?: Computed<MergeVariants<V, CV, E>>;
}

interface CreateParams<M extends Mode> {
  defaultMode?: M;
  transformClass?: (className: string) => string;
}

type SplitPropsResult<T, K extends keyof T> = [Pick<T, K>, Omit<T, K>];

/**
 * Checks if a value is a style-class object (has style properties, not just a
 * class value).
 */
function isStyleClassValue(value: unknown): value is StyleClassValue {
  if (typeof value !== "object") return false;
  if (value == null) return false;
  if (Array.isArray(value)) return false;
  return true;
}

/**
 * Converts any style input (string, JSX object, or HTML object) to a
 * normalized StyleValue.
 */
function normalizeStyle(style: unknown): StyleValue {
  if (typeof style === "string") {
    return htmlStyleToStyleValue(style);
  }
  if (typeof style === "object" && style != null) {
    if (isHTMLObjStyle(style as Record<string, unknown>)) {
      return htmlObjStyleToStyleValue(style as Record<string, string | number>);
    }
    return jsxStyleToStyleValue(style as Record<string, string | number>);
  }
  return {};
}

/**
 * Extracts class and style from a style-class value object.
 */
function extractStyleClass(value: StyleClassValue): {
  class: ClassValue;
  style: StyleValue;
} {
  const { class: cls, ...style } = value;
  return { class: cls, style };
}

/**
 * Processes a variant value to extract class and style.
 */
function processVariantValue(value: unknown): {
  class: ClassValue;
  style: StyleValue;
} {
  if (isStyleClassValue(value)) {
    return extractStyleClass(value);
  }
  return { class: value as ClassValue, style: {} };
}

/**
 * Gets all variant keys from a component's config, including extended
 * components.
 */
function collectVariantKeys(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
): string[] {
  const keys = new Set<string>();

  // Collect from extended components
  if (config.extend) {
    for (const ext of config.extend) {
      for (const key of ext.onlyVariants.keys) {
        keys.add(key as string);
      }
    }
  }

  // Collect from variants
  if (config.variants) {
    for (const key of Object.keys(config.variants)) {
      keys.add(key);
    }
  }

  // Collect from computedVariants
  if (config.computedVariants) {
    for (const key of Object.keys(config.computedVariants)) {
      keys.add(key);
    }
  }

  return Array.from(keys);
}

/**
 * Collects default variants from extended components and the current config.
 * Also handles implicit boolean defaults (when only `false` key exists).
 */
function collectDefaultVariants(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
): Record<string, unknown> {
  let defaults: Record<string, unknown> = {};

  // Collect from extended components
  if (config.extend) {
    for (const ext of config.extend) {
      const extDefaults = ext.getVariants();
      defaults = { ...defaults, ...extDefaults };
    }
  }

  // Handle implicit boolean defaults from variants
  // If a variant only has a `false` key and no `true` key, default to false
  if (config.variants) {
    for (const [variantName, variantDef] of Object.entries(config.variants)) {
      if (isStyleClassValue(variantDef)) {
        const keys = Object.keys(variantDef);
        const hasFalseOnly = keys.includes("false") && !keys.includes("true");
        if (hasFalseOnly && defaults[variantName] === undefined) {
          defaults[variantName] = false;
        }
      }
    }
  }

  // Override with current config's defaults
  if (config.defaultVariants) {
    defaults = { ...defaults, ...config.defaultVariants };
  }

  return defaults;
}

/**
 * Resolves variant values by merging defaults with provided props.
 */
function resolveVariants(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  props: Record<string, unknown> = {},
): Record<string, unknown> {
  const defaults = collectDefaultVariants(config);
  return { ...defaults, ...props };
}

/**
 * Gets the value for a single variant based on the variant definition and the
 * selected value.
 */
function getVariantResult(
  variantDef: unknown,
  selectedValue: unknown,
): { class: ClassValue; style: StyleValue } {
  // Shorthand variant: `disabled: "disabled-class"` means { true: "..." }
  if (!isStyleClassValue(variantDef)) {
    if (selectedValue === true) {
      return processVariantValue(variantDef);
    }
    return { class: null, style: {} };
  }

  // Object variant: { sm: "...", lg: "..." }
  const key = String(selectedValue);
  const value = (variantDef as Record<string, unknown>)[key];
  if (value === undefined) return { class: null, style: {} };

  return processVariantValue(value);
}

/**
 * Processes extended components and returns base classes and variant classes separately.
 * Base classes should come before current component's base, variant classes come after.
 */
function processExtended(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  resolvedVariants: Record<string, unknown>,
): {
  baseClasses: ClassValue[];
  variantClasses: ClassValue[];
  style: StyleValue;
} {
  const baseClasses: ClassValue[] = [];
  const variantClasses: ClassValue[] = [];
  let style: StyleValue = {};

  if (config.extend) {
    for (const ext of config.extend) {
      // Get the full result with resolved variants for style
      const extResult = ext({ ...resolvedVariants });
      style = { ...style, ...normalizeStyle(extResult.style) };

      // Get base class from internal property (no variants)
      const baseClass = ext._baseClass;
      baseClasses.push(baseClass);

      // Get full class with variants
      const fullClass =
        "className" in extResult ? extResult.className : extResult.class;

      // Extract variant portion (full class minus base class)
      if (fullClass && baseClass) {
        const baseClassSet = new Set(baseClass.split(" ").filter(Boolean));
        const variantPortion = fullClass
          .split(" ")
          .filter((c: string) => c && !baseClassSet.has(c))
          .join(" ");
        if (variantPortion) {
          variantClasses.push(variantPortion);
        }
      } else if (fullClass && !baseClass) {
        variantClasses.push(fullClass);
      }
    }
  }

  return { baseClasses, variantClasses, style };
}

/**
 * Processes all variants (not extended) and returns accumulated class and
 * style.
 */
function processVariants(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  resolvedVariants: Record<string, unknown>,
): { classes: ClassValue[]; style: StyleValue } {
  const classes: ClassValue[] = [];
  let style: StyleValue = {};

  // Process current component's variants
  if (config.variants) {
    for (const [variantName, variantDef] of Object.entries(config.variants)) {
      const selectedValue = resolvedVariants[variantName];
      if (selectedValue === undefined) continue;

      const result = getVariantResult(variantDef, selectedValue);
      classes.push(result.class);
      style = { ...style, ...result.style };
    }
  }

  // Process computedVariants
  if (config.computedVariants) {
    for (const [variantName, computeFn] of Object.entries(
      config.computedVariants,
    )) {
      const selectedValue = resolvedVariants[variantName];
      if (selectedValue === undefined) continue;

      const computedResult = computeFn(selectedValue);
      const result = processVariantValue(computedResult);
      classes.push(result.class);
      style = { ...style, ...result.style };
    }
  }

  return { classes, style };
}

/**
 * Processes the computed function if present.
 */
function processComputed(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  resolvedVariants: Record<string, unknown>,
): {
  classes: ClassValue[];
  style: StyleValue;
  updatedVariants: Record<string, unknown>;
} {
  const classes: ClassValue[] = [];
  let style: StyleValue = {};
  let updatedVariants = { ...resolvedVariants };

  if (config.computed) {
    const context = {
      variants: resolvedVariants,
      setVariants: (newVariants: VariantValues<Record<string, unknown>>) => {
        updatedVariants = { ...updatedVariants, ...newVariants };
      },
      setDefaultVariants: (
        newDefaults: VariantValues<Record<string, unknown>>,
      ) => {
        // Only apply defaults for variants not already set
        for (const [key, value] of Object.entries(newDefaults)) {
          if (resolvedVariants[key] === undefined) {
            updatedVariants[key] = value;
          }
        }
      },
    };

    const computedResult = config.computed(context);
    if (computedResult != null) {
      const result = processVariantValue(computedResult);
      classes.push(result.class);
      style = { ...style, ...result.style };
    }
  }

  return { classes, style, updatedVariants };
}

/**
 * Splits props into variant/style props and other props.
 */
function splitPropsImpl<T extends Record<string, unknown>>(
  keys: string[],
  props: T,
): [Partial<T>, Partial<T>] {
  const keySet = new Set(keys);
  const variantProps: Partial<T> = {};
  const otherProps: Partial<T> = {};

  for (const [key, value] of Object.entries(props)) {
    if (keySet.has(key)) {
      (variantProps as Record<string, unknown>)[key] = value;
    } else {
      (otherProps as Record<string, unknown>)[key] = value;
    }
  }

  return [variantProps, otherProps];
}

export function create<M extends Mode>({
  defaultMode = "jsx" as M,
  transformClass = (className) => className,
}: CreateParams<M> = {}) {
  const cx = (...classes: ClsxClassValue[]) => transformClass(clsx(...classes));

  const cv = <
    V extends Variants = {},
    CV extends ComputedVariants = {},
    const E extends AnyComponent[] = [],
  >(
    config: CVConfig<V, CV, E> = {},
  ): Component<V, CV, E, StyleProps[M]> => {
    type MergedVariants = MergeVariants<V, CV, E>;

    const variantKeys = collectVariantKeys(
      config as CVConfig<Variants, ComputedVariants, AnyComponent[]>,
    );

    const getClassPropertyName = (mode: Mode) =>
      mode === "jsx" ? "className" : "class";

    const getPropsKeys = (mode: Mode) => [
      getClassPropertyName(mode),
      "style",
      ...variantKeys,
    ];

    const computeResult = (
      props: ComponentProps<MergedVariants> = {},
    ): { className: string; style: StyleValue } => {
      const allClasses: ClassValue[] = [];
      let allStyle: StyleValue = {};

      // Extract variant props from input
      const variantProps: Record<string, unknown> = {};
      for (const key of variantKeys) {
        if (key in props) {
          variantProps[key] = (props as Record<string, unknown>)[key];
        }
      }

      // Resolve variants with defaults
      let resolvedVariants = resolveVariants(
        config as CVConfig<Variants, ComputedVariants, AnyComponent[]>,
        variantProps,
      );

      // Process computed first to potentially update variants
      const computedResult = processComputed(
        config as CVConfig<Variants, ComputedVariants, AnyComponent[]>,
        resolvedVariants,
      );
      resolvedVariants = computedResult.updatedVariants;

      // Process extended components (separates base and variant classes)
      const extendedResult = processExtended(
        config as CVConfig<Variants, ComputedVariants, AnyComponent[]>,
        resolvedVariants,
      );

      // 1. Extended base classes first
      allClasses.push(...extendedResult.baseClasses);
      allStyle = { ...allStyle, ...extendedResult.style };

      // 2. Current component's base class
      allClasses.push(config.class);

      // 3. Add base style
      if (config.style) {
        allStyle = { ...allStyle, ...config.style };
      }

      // 4. Extended variant classes
      allClasses.push(...extendedResult.variantClasses);

      // 5. Current component's variants
      const variantsResult = processVariants(
        config as CVConfig<Variants, ComputedVariants, AnyComponent[]>,
        resolvedVariants,
      );
      allClasses.push(...variantsResult.classes);
      allStyle = { ...allStyle, ...variantsResult.style };

      // Add computed results
      allClasses.push(...computedResult.classes);
      allStyle = { ...allStyle, ...computedResult.style };

      // Merge class from props
      if ("class" in props) {
        allClasses.push(props.class);
      }
      if ("className" in props) {
        allClasses.push(props.className);
      }

      // Merge style from props
      if (props.style != null) {
        allStyle = { ...allStyle, ...normalizeStyle(props.style) };
      }

      return {
        className: cx(...(allClasses as ClsxClassValue[])),
        style: allStyle,
      };
    };

    const createModalComponent = <R extends ComponentResult>(
      mode: Mode,
    ): ModalComponent<MergedVariants, R> => {
      const propsKeys = getPropsKeys(mode);

      const component = ((props: ComponentProps<MergedVariants> = {}) => {
        const { className, style } = computeResult(props);

        if (mode === "jsx") {
          return { className, style: styleValueToJSXStyle(style) } as R;
        }
        if (mode === "html") {
          return {
            class: className,
            style: styleValueToHTMLStyle(style),
          } as R;
        }
        // htmlObj
        return {
          class: className,
          style: styleValueToHTMLObjStyle(style),
        } as R;
      }) as ModalComponent<MergedVariants, R>;

      component.class = (props: ComponentProps<MergedVariants> = {}) => {
        return computeResult(props).className;
      };

      component.style = ((props: ComponentProps<MergedVariants> = {}) => {
        const { style } = computeResult(props);
        if (mode === "jsx") return styleValueToJSXStyle(style);
        if (mode === "html") return styleValueToHTMLStyle(style);
        return styleValueToHTMLObjStyle(style);
      }) as ModalComponent<MergedVariants, R>["style"];

      component.getVariants = (
        variants?: VariantValues<MergedVariants>,
      ): VariantValues<MergedVariants> => {
        return resolveVariants(
          config as CVConfig<Variants, ComputedVariants, AnyComponent[]>,
          variants as VariantValues<Record<string, unknown>>,
        ) as VariantValues<MergedVariants>;
      };

      component.keys = propsKeys as (keyof MergedVariants | keyof R)[];

      component.splitProps = <T extends Record<string, unknown>>(
        props: T,
      ): SplitPropsResult<T, Extract<keyof T, (typeof propsKeys)[number]>> => {
        return splitPropsImpl(propsKeys, props) as SplitPropsResult<
          T,
          Extract<keyof T, (typeof propsKeys)[number]>
        >;
      };

      component.onlyVariants = {
        getVariants: (
          variants?: VariantValues<MergedVariants>,
        ): VariantValues<MergedVariants> => {
          return resolveVariants(
            config as CVConfig<Variants, ComputedVariants, AnyComponent[]>,
            variants as VariantValues<Record<string, unknown>>,
          ) as VariantValues<MergedVariants>;
        },
        keys: variantKeys as (keyof MergedVariants)[],
        splitProps: <T extends Record<string, unknown>>(
          props: T,
        ): SplitPropsResult<
          T,
          Extract<keyof T, (typeof variantKeys)[number]>
        > =>
          splitPropsImpl(variantKeys, props) as SplitPropsResult<
            T,
            Extract<keyof T, (typeof variantKeys)[number]>
          >,
      } as OnlyVariantsComponent<MergedVariants>;

      // Compute base class (without variants) - includes extended base classes
      const extendedBaseClasses: ClassValue[] = [];
      if (config.extend) {
        for (const ext of config.extend) {
          extendedBaseClasses.push(ext._baseClass);
        }
      }
      component._baseClass = cx(
        ...(extendedBaseClasses as ClsxClassValue[]),
        config.class as ClsxClassValue,
      );

      return component;
    };

    // Create the default modal component
    const defaultComponent = createModalComponent<StyleProps[M]>(defaultMode);

    // Create all modal variants
    const jsxComponent = createModalComponent<JSXProps>("jsx");
    const htmlComponent = createModalComponent<HTMLProps>("html");
    const htmlObjComponent = createModalComponent<HTMLObjProps>("htmlObj");

    // Build the final component
    const component = defaultComponent as Component<V, CV, E, StyleProps[M]>;
    component.jsx = jsxComponent;
    component.html = htmlComponent;
    component.htmlObj = htmlObjComponent;

    return component;
  };

  return { cv, cx };
}

export const { cv, cx } = create();
