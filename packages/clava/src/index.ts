import clsx, { type ClassValue as ClsxClassValue } from "clsx";
import type {
  AnyComponent,
  ClassValue,
  Component,
  ComponentProps,
  ComponentResult,
  Computed,
  ComputedVariants,
  ExtendableVariants,
  HTMLObjProps,
  HTMLProps,
  JSXProps,
  MergeVariants,
  ModalComponent,
  SplitPropsFunction,
  StyleClassValue,
  StyleProps,
  StyleValue,
  VariantValues,
  Variants,
} from "./types.ts";
import {
  type Mode,
  getClassPropertyName,
  htmlObjStyleToStyleValue,
  htmlStyleToStyleValue,
  isHTMLObjStyle,
  jsxStyleToStyleValue,
  styleValueToHTMLObjStyle,
  styleValueToHTMLStyle,
  styleValueToJSXStyle,
} from "./utils.ts";

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
      for (const key of ext.variantKeys) {
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
 * When overrideVariantKeys is provided, those variant keys are excluded from the extended
 * component's result (used when current component's computedVariants overrides them).
 */
function processExtended(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  resolvedVariants: Record<string, unknown>,
  overrideVariantKeys: Set<string> = new Set(),
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
      // Filter out variant keys that are being overridden by current component's computedVariants
      const filteredVariants = { ...resolvedVariants };
      for (const key of overrideVariantKeys) {
        delete filteredVariants[key];
      }

      // Get the result with filtered variants (excluding overridden keys)
      const extResult = ext({ ...filteredVariants });

      // Only merge style for non-overridden keys
      const extStyle = normalizeStyle(extResult.style);
      style = { ...style, ...extStyle };

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
  propsVariants: Record<string, unknown>,
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
        // Only apply defaults for variants not explicitly set in props
        for (const [key, value] of Object.entries(newDefaults)) {
          if (propsVariants[key] === undefined) {
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

interface NormalizedSource {
  keys: string[];
  variantKeys: string[];
  defaults: Record<string, unknown>;
  isComponent: boolean;
}

/**
 * Normalizes a key source (array or component) to an object with keys, variantKeys, defaults, and isComponent flag.
 */
function normalizeKeySource(source: unknown): NormalizedSource {
  if (Array.isArray(source)) {
    return {
      keys: source as string[],
      variantKeys: source as string[],
      defaults: {},
      isComponent: false,
    };
  }
  // Components are functions with keys and variantKeys properties
  if (
    source &&
    (typeof source === "object" || typeof source === "function") &&
    "keys" in source &&
    "variantKeys" in source
  ) {
    const keys = [...(source as { keys: string[] }).keys] as string[];
    const variantKeys = [
      ...(source as { variantKeys: string[] }).variantKeys,
    ] as string[];
    const defaults =
      "getVariants" in source
        ? (
            source as { getVariants: () => Record<string, unknown> }
          ).getVariants()
        : {};
    return { keys, variantKeys, defaults, isComponent: true };
  }
  return { keys: [], variantKeys: [], defaults: {}, isComponent: false };
}

/**
 * Splits props into multiple groups based on key sources.
 * Only the first component claims styling props (class/className/style).
 * Subsequent components only receive variant props.
 * Arrays always receive their listed keys but don't claim styling props.
 */
function splitPropsImpl(
  selfKeys: string[],
  selfVariantKeys: string[],
  selfDefaults: Record<string, unknown>,
  selfIsComponent: boolean,
  props: Record<string, unknown>,
  sources: NormalizedSource[],
): Record<string, unknown>[] {
  const allUsedKeys = new Set<string>(selfKeys);
  const results: Record<string, unknown>[] = [];

  // Track if styling has been claimed by a component
  let stylingClaimed = selfIsComponent;

  // Self result with defaults
  const selfResult: Record<string, unknown> = {};
  // First apply defaults
  for (const [key, value] of Object.entries(selfDefaults)) {
    if (selfKeys.includes(key)) {
      selfResult[key] = value;
    }
  }
  // Then override with props
  for (const key of selfKeys) {
    if (key in props) {
      selfResult[key] = props[key];
    }
  }
  results.push(selfResult);

  // Process each source
  for (const source of sources) {
    const sourceResult: Record<string, unknown> = {};

    // Determine which keys this source should use
    // Components use variantKeys if styling has already been claimed
    // Arrays always use their listed keys
    const effectiveKeys =
      source.isComponent && stylingClaimed ? source.variantKeys : source.keys;

    // First apply defaults (only for variant keys if component and styling claimed)
    for (const [key, value] of Object.entries(source.defaults)) {
      if (effectiveKeys.includes(key)) {
        sourceResult[key] = value;
      }
    }

    // Then override with props
    for (const key of effectiveKeys) {
      allUsedKeys.add(key);
      if (key in props) {
        sourceResult[key] = props[key];
      }
    }
    results.push(sourceResult);

    // If this is a component that hasn't claimed styling yet, mark styling as claimed
    if (source.isComponent && !stylingClaimed) {
      stylingClaimed = true;
    }
  }

  // Rest - keys not used by anyone
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!allUsedKeys.has(key)) {
      rest[key] = value;
    }
  }
  results.push(rest);

  return results;
}

/**
 * Splits props into multiple groups based on key sources.
 * Each source gets its own result object containing all its matching keys.
 * The first component source claims styling props (class/className/style).
 * Subsequent components only receive variant props.
 * Arrays receive their listed keys but don't claim styling props.
 * The last element is always the "rest" containing keys not claimed by any source.
 *
 * @example
 * ```ts
 * const [buttonProps, inputProps, rest] = splitProps(
 *   props,
 *   buttonComponent,
 *   inputComponent,
 * );
 * // buttonProps has class/style + button variants
 * // inputProps has only input variants (no class/style)
 * ```
 */
export const splitProps: SplitPropsFunction = ((
  props: Record<string, unknown>,
  source1: unknown,
  ...sources: unknown[]
) => {
  const normalizedSource1 = normalizeKeySource(source1);
  const normalizedSources = sources.map(normalizeKeySource);
  return splitPropsImpl(
    normalizedSource1.keys,
    normalizedSource1.variantKeys,
    normalizedSource1.defaults,
    normalizedSource1.isComponent,
    props,
    normalizedSources,
  );
}) as SplitPropsFunction;

export function create<M extends Mode = "jsx">({
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
        variantProps,
      );
      resolvedVariants = computedResult.updatedVariants;

      // Collect computedVariants keys that will override extended variants
      const computedVariantKeys = new Set<string>(
        config.computedVariants ? Object.keys(config.computedVariants) : [],
      );

      // Process extended components (separates base and variant classes)
      const extendedResult = processExtended(
        config as CVConfig<Variants, ComputedVariants, AnyComponent[]>,
        resolvedVariants,
        computedVariantKeys,
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

      component.variantKeys = variantKeys as (keyof MergedVariants)[];

      component.propKeys = propsKeys as (keyof MergedVariants | keyof R)[];

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
