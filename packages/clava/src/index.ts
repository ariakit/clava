import clsx, { type ClassValue as ClsxClassValue } from "clsx";
import type {
  AnyComponent,
  CVComponent,
  ClassValue,
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

// Internal metadata stored on components but hidden from public types
interface ComponentMeta {
  baseClass: string;
  resolveDefaults: (
    childDefaults: Record<string, unknown>,
    userProps?: Record<string, unknown>,
  ) => Record<string, unknown>;
}

const META_KEY = "__meta";

// Sentinel value used to signal "skip this variant" when a child's
// computedVariants overrides a parent's variant. Using a Symbol ensures it
// can't conflict with any user-provided value (including null).
const SKIP_VARIANT = Symbol("skipVariant");

// Dynamic property access on function requires cast through unknown
function getComponentMeta(component: AnyComponent): ComponentMeta | undefined {
  return (component as unknown as Record<string, unknown>)[META_KEY] as
    | ComponentMeta
    | undefined;
}

function setComponentMeta(component: AnyComponent, meta: ComponentMeta): void {
  (component as unknown as Record<string, unknown>)[META_KEY] = meta;
}

/**
 * Mutates target by assigning all properties from source. Avoids object spread
 * overhead in hot paths where we're building up a result object.
 */
function assign<T extends object>(target: T, source: T): void {
  for (const key of Object.keys(source)) {
    (target as Record<string, unknown>)[key] = (
      source as Record<string, unknown>
    )[key];
  }
}

export type {
  ClassValue,
  StyleValue,
  StyleClassValue,
  JSXProps,
  HTMLProps,
  HTMLObjProps,
  CVComponent,
};

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
 * Converts any style input (string, JSX object, or HTML object) to a normalized
 * StyleValue.
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
 * Extracts class and style from a variant value (either a class value or a
 * style-class object).
 */
function extractClassAndStyle(value: unknown): {
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
 * Collects static default variants from extended components and the current
 * config. Also handles implicit boolean defaults (when only `false` key
 * exists).
 */
function collectStaticDefaults(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  // Collect static defaults from extended components
  if (config.extend) {
    for (const ext of config.extend) {
      Object.assign(defaults, ext.getVariants());
    }
  }

  // Handle implicit boolean defaults from variants
  // If a variant has a `false` key, default to false when no value is provided
  if (config.variants) {
    for (const [variantName, variantDef] of Object.entries(config.variants)) {
      if (!isStyleClassValue(variantDef)) continue;
      const keys = Object.keys(variantDef);
      const hasFalse = keys.includes("false");
      if (hasFalse && !defaults[variantName]) {
        defaults[variantName] = false;
      }
    }
  }

  // Override with current config's static defaults
  if (config.defaultVariants) {
    Object.assign(defaults, config.defaultVariants);
  }

  return defaults;
}

/**
 * Collects default variants from extended components and the current config.
 * This includes both static defaults and computed defaults (from
 * setDefaultVariants in extended components' computed functions). Priority:
 * parent static < child static < parent computed < child computed.
 */
function collectDefaultVariants(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  propsVariants: Record<string, unknown> = {},
): Record<string, unknown> {
  // Start with static defaults (parent static < child static)
  const defaults = collectStaticDefaults(config);

  // Apply computed defaults from extended components
  // Parent's setDefaultVariants should override child's static defaults
  if (!config.extend) return defaults;

  const childStaticDefaults = config.defaultVariants || {};
  for (const ext of config.extend) {
    const meta = getComponentMeta(ext);
    if (!meta) continue;
    Object.assign(
      defaults,
      meta.resolveDefaults(childStaticDefaults, propsVariants),
    );
  }

  return defaults;
}

/**
 * Filters out keys with undefined values from an object.
 */
function filterUndefined(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    result[key] = value;
  }
  return result;
}

/**
 * Resolves variant values by merging defaults with provided props. Props with
 * undefined values are filtered out so they don't override defaults.
 */
function resolveVariants(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  props: Record<string, unknown> = {},
): Record<string, unknown> {
  const defaults = collectDefaultVariants(config, props);
  return { ...defaults, ...filterUndefined(props) };
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
      return extractClassAndStyle(variantDef);
    }
    return { class: null, style: {} };
  }

  // Object variant: { sm: "...", lg: "..." }
  const key = String(selectedValue);
  const value = (variantDef as Record<string, unknown>)[key];
  if (value === undefined) return { class: null, style: {} };

  return extractClassAndStyle(value);
}

/**
 * Extracts classes from fullClass that are not in baseClass. Uses string
 * comparison optimization: if fullClass starts with baseClass, just take the
 * suffix.
 */
function extractVariantClasses(fullClass: string, baseClass: string): string {
  if (!fullClass) return "";
  if (!baseClass) return fullClass;

  // Fast path: fullClass starts with baseClass (common case)
  if (fullClass.startsWith(baseClass)) {
    return fullClass.slice(baseClass.length).trim();
  }

  // Slow path: need to diff the class sets
  const baseClassSet = new Set(baseClass.split(" ").filter(Boolean));
  return fullClass
    .split(" ")
    .filter((c) => c && !baseClassSet.has(c))
    .join(" ");
}

function computeExtendedStyles(
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
  const style: StyleValue = {};

  if (!config.extend) return { baseClasses, variantClasses, style };

  for (const ext of config.extend) {
    // Filter out variant keys that are being overridden by computedVariants
    // Set to SKIP_VARIANT sentinel (not delete) to prevent the parent from
    // applying its implicit boolean default
    const filteredVariants = { ...resolvedVariants };
    for (const key of overrideVariantKeys) {
      filteredVariants[key] = SKIP_VARIANT;
    }

    const extResult = ext(filteredVariants);
    assign(style, normalizeStyle(extResult.style));

    // Get base class from internal metadata (no variants)
    const meta = getComponentMeta(ext);
    const baseClass = meta?.baseClass ?? "";
    baseClasses.push(baseClass);

    // Get full class with variants
    const fullClass =
      "className" in extResult ? extResult.className : extResult.class;

    const variantPortion = extractVariantClasses(fullClass, baseClass);
    if (variantPortion) {
      variantClasses.push(variantPortion);
    }
  }

  return { baseClasses, variantClasses, style };
}

/**
 * Computes class and style from the component's own variants and
 * computedVariants (not extended components).
 */
function computeVariantStyles(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  resolvedVariants: Record<string, unknown>,
): { classes: ClassValue[]; style: StyleValue } {
  const classes: ClassValue[] = [];
  const style: StyleValue = {};

  // Process current component's variants
  if (config.variants) {
    for (const [variantName, variantDef] of Object.entries(config.variants)) {
      const selectedValue = resolvedVariants[variantName];
      if (selectedValue === undefined) continue;

      const result = getVariantResult(variantDef, selectedValue);
      classes.push(result.class);
      assign(style, result.style);
    }
  }

  // Process computedVariants
  if (config.computedVariants) {
    for (const [variantName, computeFn] of Object.entries(
      config.computedVariants,
    )) {
      const selectedValue = resolvedVariants[variantName];
      if (selectedValue === undefined) continue;
      // Skip SKIP_VARIANT sentinel (used when a child's computedVariants
      // overrides a parent's variant)
      if (selectedValue === SKIP_VARIANT) continue;

      const computedResult = computeFn(selectedValue);
      const result = extractClassAndStyle(computedResult);
      classes.push(result.class);
      assign(style, result.style);
    }
  }

  return { classes, style };
}

/**
 * Runs the computed function if present, returning classes, styles, and updated
 * variants.
 */
function runComputedFunction(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  resolvedVariants: Record<string, unknown>,
  propsVariants: Record<string, unknown>,
): {
  classes: ClassValue[];
  style: StyleValue;
  updatedVariants: Record<string, unknown>;
} {
  const classes: ClassValue[] = [];
  const style: StyleValue = {};
  const updatedVariants = { ...resolvedVariants };

  if (!config.computed) {
    return { classes, style, updatedVariants };
  }

  const context = {
    variants: resolvedVariants,
    setVariants: (newVariants: VariantValues<Record<string, unknown>>) => {
      Object.assign(updatedVariants, newVariants);
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
    const result = extractClassAndStyle(computedResult);
    classes.push(result.class);
    assign(style, result.style);
  }

  return { classes, style, updatedVariants };
}

interface NormalizedSource {
  keys: string[];
  variantKeys: string[];
  defaults: Record<string, unknown>;
  isComponent: boolean;
}

const EMPTY_SOURCE: NormalizedSource = {
  keys: [],
  variantKeys: [],
  defaults: {},
  isComponent: false,
};

/**
 * Normalizes a key source (array or component) to an object with keys,
 * variantKeys, defaults, and isComponent flag.
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

  if (!source) return EMPTY_SOURCE;
  if (typeof source !== "object" && typeof source !== "function") {
    return EMPTY_SOURCE;
  }
  if (!("keys" in source)) return EMPTY_SOURCE;
  if (!("variantKeys" in source)) return EMPTY_SOURCE;

  // Source is a component with keys and variantKeys properties
  const typed = source as {
    keys: string[];
    variantKeys: string[];
    getVariants?: () => Record<string, unknown>;
  };
  return {
    keys: [...typed.keys],
    variantKeys: [...typed.variantKeys],
    defaults: typed.getVariants?.() ?? {},
    isComponent: true,
  };
}

/**
 * Splits props into multiple groups based on key sources. Only the first
 * component claims styling props (class/className/style). Subsequent components
 * only receive variant props. Arrays always receive their listed keys but don't
 * claim styling props.
 */
function splitPropsImpl(
  selfKeys: string[],
  selfIsComponent: boolean,
  props: Record<string, unknown>,
  sources: NormalizedSource[],
): Record<string, unknown>[] {
  const allUsedKeys = new Set<string>(selfKeys);
  const results: Record<string, unknown>[] = [];

  // Track if styling has been claimed by a component
  let stylingClaimed = selfIsComponent;

  // Self result
  const selfResult: Record<string, unknown> = {};
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
 * Splits props into multiple groups based on key sources. Each source gets its
 * own result object containing all its matching keys. The first component
 * source claims styling props (class/className/style). Subsequent components
 * only receive variant props. Arrays receive their listed keys but don't claim
 * styling props. The last element is always the "rest" containing keys not
 * claimed by any source.
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
    normalizedSource1.isComponent,
    props,
    normalizedSources,
  );
}) as SplitPropsFunction;

/**
 * Creates the resolveDefaults function for a component. This function returns
 * only the variants set via setDefaultVariants in the computed function. Used
 * by child components to get parent's computed defaults.
 */
function createResolveDefaults(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
): ComponentMeta["resolveDefaults"] {
  return (childDefaults, userProps = {}) => {
    // Get static defaults (including from extended components)
    const staticDefaults = collectStaticDefaults(config);

    // Merge: parent static < child static < user props
    // This is what parent's computed will see in `variants`
    const resolvedVariants = {
      ...staticDefaults,
      ...filterUndefined(childDefaults),
      ...filterUndefined(userProps),
    };

    // Track which keys are set via setDefaultVariants
    const computedDefaults: Record<string, unknown> = {};

    // Propagate to extended components so their computed functions can run
    // This allows grandparent computed functions to see grandchild defaults
    if (config.extend) {
      for (const ext of config.extend) {
        const meta = getComponentMeta(ext);
        if (!meta) continue;
        Object.assign(
          computedDefaults,
          meta.resolveDefaults(childDefaults, userProps),
        );
      }
    }

    if (config.computed) {
      config.computed({
        variants: resolvedVariants as VariantValues<Record<string, unknown>>,
        setVariants: () => {
          // Not relevant for collecting defaults
        },
        setDefaultVariants: (newDefaults) => {
          // Only apply defaults for variants not explicitly set by user
          // (child's static defaults should not block setDefaultVariants)
          for (const [key, value] of Object.entries(newDefaults)) {
            if (userProps[key] === undefined) {
              computedDefaults[key] = value;
            }
          }
        },
      });
    }

    return computedDefaults;
  };
}

/**
 * Creates the cv and cx functions.
 */
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
  ): CVComponent<V, CV, E, StyleProps[M]> => {
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
      const allStyle: StyleValue = {};

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
      const computedResult = runComputedFunction(
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
      const extendedResult = computeExtendedStyles(
        config as CVConfig<Variants, ComputedVariants, AnyComponent[]>,
        resolvedVariants,
        computedVariantKeys,
      );

      // 1. Extended base classes first
      allClasses.push(...extendedResult.baseClasses);
      assign(allStyle, extendedResult.style);

      // 2. Current component's base class
      allClasses.push(config.class);

      // 3. Add base style
      if (config.style) {
        assign(allStyle, config.style);
      }

      // 4. Extended variant classes
      allClasses.push(...extendedResult.variantClasses);

      // 5. Current component's variants
      const variantsResult = computeVariantStyles(
        config as CVConfig<Variants, ComputedVariants, AnyComponent[]>,
        resolvedVariants,
      );
      allClasses.push(...variantsResult.classes);
      assign(allStyle, variantsResult.style);

      // Add computed results
      allClasses.push(...computedResult.classes);
      assign(allStyle, computedResult.style);

      // Merge class from props
      if ("class" in props) {
        allClasses.push(props.class);
      }
      if ("className" in props) {
        allClasses.push(props.className);
      }

      // Merge style from props
      if (props.style != null) {
        assign(allStyle, normalizeStyle(props.style));
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
          const meta = getComponentMeta(ext);
          extendedBaseClasses.push(meta?.baseClass ?? "");
        }
      }
      const baseClass = cx(
        ...(extendedBaseClasses as ClsxClassValue[]),
        config.class as ClsxClassValue,
      );

      // Store internal metadata hidden from public types
      setComponentMeta(component, {
        baseClass,
        resolveDefaults: createResolveDefaults(
          config as CVConfig<Variants, ComputedVariants, AnyComponent[]>,
        ),
      });

      return component;
    };

    // Create the default modal component
    const defaultComponent = createModalComponent<StyleProps[M]>(defaultMode);

    // Create all modal variants
    const jsxComponent = createModalComponent<JSXProps>("jsx");
    const htmlComponent = createModalComponent<HTMLProps>("html");
    const htmlObjComponent = createModalComponent<HTMLObjProps>("htmlObj");

    // Build the final component
    const component = defaultComponent as CVComponent<V, CV, E, StyleProps[M]>;
    component.jsx = jsxComponent;
    component.html = htmlComponent;
    component.htmlObj = htmlObjComponent;

    return component;
  };

  return { cv, cx };
}

export const { cv, cx } = create();
