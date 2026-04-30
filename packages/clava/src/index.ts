import clsx, { type ClassValue as ClsxClassValue } from "clsx";
import type {
  AnyComponent,
  CVComponent,
  ClassValue,
  ComponentProps,
  Computed,
  ComputedVariants,
  ExtendableVariants,
  HTMLObjProps,
  HTMLProps,
  JSXProps,
  MergeVariants,
  ModalComponent,
  SplitPropsFunction,
  StyleClassProps,
  StyleClassValue,
  StyleValue,
  VariantValues,
  Variants,
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

// Internal metadata stored on components but hidden from public types
interface ComponentMeta {
  baseClass: string;
  staticDefaults: Record<string, unknown>;
  resolveDefaults: (
    childDefaults: Record<string, unknown>,
    userProps?: Record<string, unknown>,
  ) => Record<string, unknown>;
}

const META_KEY = "__meta";

// Symbol property used to pass skip keys through the props object without
// polluting the actual variant values. This allows the computed function to
// see actual variant values while still skipping styling for overridden keys.
const SKIP_STYLE_KEYS = Symbol("skipStyleKeys");
const SKIP_STYLE_VARIANT_VALUES = Symbol("skipStyleVariantValues");

// eslint-disable-next-line @typescript-eslint/unbound-method
const hasOwn = Object.prototype.hasOwnProperty;

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
  for (const key in source) {
    if (!hasOwn.call(source, key)) continue;
    (target as Record<string, unknown>)[key] = (
      source as Record<string, unknown>
    )[key];
  }
}

export type {
  ClassValue,
  StyleValue,
  StyleClassProps,
  StyleClassValue,
  JSXProps,
  HTMLProps,
  HTMLObjProps,
  CVComponent,
};

export type VariantProps<T extends Pick<AnyComponent, "getVariants">> =
  ReturnType<T["getVariants"]>;

// Variant props expose booleans, but variant object keys are always strings.
type VariantKey<T> = T extends boolean ? "true" | "false" : Extract<T, string>;

export type Variant<
  T extends Pick<AnyComponent, "getVariants">,
  K extends keyof VariantProps<T>,
> = Record<
  VariantKey<NonNullable<VariantProps<T>[K]>>,
  ClassValue | StyleClassValue
>;

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

interface CreateParams {
  transformClass?: (className: string) => string;
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object") return false;
  if (value == null) return false;
  if (Array.isArray(value)) return false;
  return true;
}

/**
 * Checks if a value is a style-class object (`{ style, class? }`).
 */
function isStyleClassValue(value: unknown): value is StyleClassValue {
  if (!isRecordObject(value)) return false;
  return "style" in value || "class" in value;
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
 * Pre-extracts the class and (normalized) style from a variant value once at
 * component creation time. Returns `null` if the value contributes nothing.
 */
interface PrebuiltValue {
  class: ClassValue;
  style: StyleValue | null;
}

function extractStyleClassPrebuilt(value: StyleClassValue): PrebuiltValue {
  const styleNorm = normalizeStyle(value.style);
  return {
    class: value.class ?? null,
    style: styleNorm && Object.keys(styleNorm).length > 0 ? styleNorm : null,
  };
}

function extractClassAndStylePrebuilt(value: unknown): PrebuiltValue {
  if (isStyleClassValue(value)) {
    return extractStyleClassPrebuilt(value);
  }
  if (isRecordObject(value)) {
    return { class: null, style: null };
  }
  return { class: value as ClassValue, style: null };
}

/**
 * Gets all variant keys from a component's config, including extended
 * components.
 */
function collectVariantKeys(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
): string[] {
  const keys = new Set<string>();

  if (config.extend) {
    for (const ext of config.extend) {
      const extKeys = ext.variantKeys as readonly string[];
      for (let i = 0; i < extKeys.length; i++) {
        keys.add(extKeys[i]);
      }
    }
  }

  if (config.variants) {
    for (const key in config.variants) {
      if (!hasOwn.call(config.variants, key)) continue;
      const variant = (config.variants as Record<string, unknown>)[key];
      if (variant === null) {
        keys.delete(key);
        continue;
      }
      keys.add(key);
    }
  }

  if (config.computedVariants) {
    for (const key in config.computedVariants) {
      if (!hasOwn.call(config.computedVariants, key)) continue;
      keys.add(key);
    }
  }

  return Array.from(keys);
}

function isVariantDisabled(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  key: string,
): boolean {
  return config.variants?.[key] === null;
}

function getVariantValueKey(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  return undefined;
}

function isVariantValueDisabled(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  key: string,
  value: unknown,
): boolean {
  const valueKey = getVariantValueKey(value);
  if (valueKey == null) return false;
  const variant = config.variants?.[key];
  if (!isRecordObject(variant)) return false;
  return variant[valueKey] === null;
}

function collectDisabledVariantKeys(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
): Set<string> {
  const keys = new Set<string>();
  if (!config.variants) return keys;
  for (const key in config.variants) {
    if (!hasOwn.call(config.variants, key)) continue;
    if ((config.variants as Record<string, unknown>)[key] === null) {
      keys.add(key);
    }
  }
  return keys;
}

function collectDisabledVariantValues(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
): Record<string, Set<string>> {
  const values: Record<string, Set<string>> = {};
  if (!config.variants) return values;
  for (const key in config.variants) {
    if (!hasOwn.call(config.variants, key)) continue;
    const variant = (config.variants as Record<string, unknown>)[key];
    if (!isRecordObject(variant)) continue;
    let bucket: Set<string> | undefined;
    for (const variantValue in variant) {
      if (!hasOwn.call(variant, variantValue)) continue;
      if (variant[variantValue] !== null) continue;
      if (!bucket) {
        bucket = new Set<string>();
        values[key] = bucket;
      }
      bucket.add(variantValue);
    }
  }
  return values;
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

interface NormalizedSource {
  keys: string[];
  variantKeys: string[];
  isComponent: boolean;
}

const EMPTY_SOURCE: NormalizedSource = {
  keys: [],
  variantKeys: [],
  isComponent: false,
};

function normalizeKeySource(source: unknown): NormalizedSource {
  if (Array.isArray(source)) {
    return {
      keys: source as string[],
      variantKeys: source as string[],
      isComponent: false,
    };
  }

  if (!source) return EMPTY_SOURCE;
  if (typeof source !== "object" && typeof source !== "function") {
    return EMPTY_SOURCE;
  }
  if (!("keys" in source)) return EMPTY_SOURCE;
  if (!("variantKeys" in source)) return EMPTY_SOURCE;

  // Component-provided arrays are immutable metadata — reference directly.
  const typed = source as {
    keys: string[];
    variantKeys: string[];
  };
  return {
    keys: typed.keys,
    variantKeys: typed.variantKeys,
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
  const sourcesLength = sources.length;
  const results: Record<string, unknown>[] = [];
  let stylingClaimed = selfIsComponent;

  const selfResult: Record<string, unknown> = {};
  const selfKeysLength = selfKeys.length;
  for (let i = 0; i < selfKeysLength; i++) {
    const key = selfKeys[i];
    if (key !== undefined && key in props) {
      selfResult[key] = props[key];
    }
  }
  results.push(selfResult);

  // Track effective key arrays for the rest computation — for typical inputs
  // a linear scan beats building a Set up-front.
  const effectiveKeyArrays: string[][] = [selfKeys];

  for (let s = 0; s < sourcesLength; s++) {
    const source = sources[s];
    if (source === undefined) continue;
    const sourceResult: Record<string, unknown> = {};

    const effectiveKeys =
      source.isComponent && stylingClaimed ? source.variantKeys : source.keys;

    const effectiveKeysLength = effectiveKeys.length;
    for (let i = 0; i < effectiveKeysLength; i++) {
      const key = effectiveKeys[i];
      if (key !== undefined && key in props) {
        sourceResult[key] = props[key];
      }
    }
    results.push(sourceResult);
    effectiveKeyArrays.push(effectiveKeys);

    if (source.isComponent && !stylingClaimed) {
      stylingClaimed = true;
    }
  }

  const rest: Record<string, unknown> = {};
  const propKeys = Object.keys(props);
  const propKeysLength = propKeys.length;
  const groupCount = sourcesLength + 1;
  outer: for (let i = 0; i < propKeysLength; i++) {
    const key = propKeys[i];
    if (key === undefined) continue;
    for (let g = 0; g < groupCount; g++) {
      const arr = effectiveKeyArrays[g];
      if (arr === undefined) continue;
      const arrLength = arr.length;
      for (let j = 0; j < arrLength; j++) {
        if (arr[j] === key) continue outer;
      }
    }
    rest[key] = props[key];
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
 */
export const splitProps: SplitPropsFunction = ((
  props: Record<string, unknown>,
  source1: unknown,
  ...sources: unknown[]
) => {
  const normalizedSource1 = normalizeKeySource(source1);
  const sourcesLength = sources.length;
  const normalizedSources: NormalizedSource[] = [];
  for (let i = 0; i < sourcesLength; i++) {
    normalizedSources.push(normalizeKeySource(sources[i]));
  }
  return splitPropsImpl(
    normalizedSource1.keys,
    normalizedSource1.isComponent,
    props,
    normalizedSources,
  );
}) as SplitPropsFunction;

/**
 * A pre-built variant. Maps variant value keys (or the literal "true"/"false"
 * strings for boolean variants) to PrebuiltValue. Includes a "shorthand"
 * fallback when the variant is a single class value (treated as `{ true: ... }`).
 */
interface PrebuiltVariant {
  // For object variants: map of value -> prebuilt class/style
  values: Record<string, PrebuiltValue> | null;
  // For shorthand variants: the value to use when selectedValue is true
  shorthand: PrebuiltValue | null;
  // Set of value keys that are disabled (value === null in the original variant
  // definition)
  disabledValues: Set<string> | null;
  // True if the original variant key is disabled (variant === null) - skip
  // styling entirely
  disabled: boolean;
}

function buildPrebuiltVariant(variantDef: unknown): PrebuiltVariant {
  if (variantDef === null) {
    return {
      values: null,
      shorthand: null,
      disabledValues: null,
      disabled: true,
    };
  }
  if (!isRecordObject(variantDef)) {
    return {
      values: null,
      shorthand: extractClassAndStylePrebuilt(variantDef),
      disabledValues: null,
      disabled: false,
    };
  }
  const values: Record<string, PrebuiltValue> = {};
  let disabledValues: Set<string> | null = null;
  for (const key in variantDef) {
    if (!hasOwn.call(variantDef, key)) continue;
    const value = variantDef[key];
    if (value === null) {
      if (!disabledValues) disabledValues = new Set<string>();
      disabledValues.add(key);
      continue;
    }
    values[key] = extractClassAndStylePrebuilt(value);
  }
  return {
    values,
    shorthand: null,
    disabledValues,
    disabled: false,
  };
}

/**
 * Creates the resolveDefaults function for a component. This function returns
 * only the variants set via setDefaultVariants in the computed function. Used
 * by child components to get parent's computed defaults.
 */
function createResolveDefaults(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  staticDefaults: Record<string, unknown>,
): ComponentMeta["resolveDefaults"] {
  const computed = config.computed;
  const extend = config.extend;
  return (childDefaults, userProps = {}) => {
    // Merge: parent static < child static < user props
    // This is what parent's computed will see in `variants`
    const resolvedVariants: Record<string, unknown> = {};
    Object.assign(resolvedVariants, staticDefaults);
    for (const key in childDefaults) {
      if (!hasOwn.call(childDefaults, key)) continue;
      const v = childDefaults[key];
      if (v === undefined) continue;
      resolvedVariants[key] = v;
    }
    for (const key in userProps) {
      if (!hasOwn.call(userProps, key)) continue;
      const v = userProps[key];
      if (v === undefined) continue;
      resolvedVariants[key] = v;
    }

    // Track which keys are set via setDefaultVariants
    const computedDefaults: Record<string, unknown> = {};

    // Propagate to extended components so their computed functions can run
    if (extend) {
      for (const ext of extend) {
        const meta = getComponentMeta(ext);
        if (!meta) continue;
        const extDefaults = meta.resolveDefaults(childDefaults, userProps);
        for (const k in extDefaults) {
          if (hasOwn.call(extDefaults, k)) {
            computedDefaults[k] = extDefaults[k];
          }
        }
      }
    }

    if (computed) {
      computed({
        variants: resolvedVariants as VariantValues<Record<string, unknown>>,
        setVariants: () => {},
        setDefaultVariants: (newDefaults) => {
          for (const key in newDefaults) {
            if (!hasOwn.call(newDefaults, key)) continue;
            const value = (newDefaults as Record<string, unknown>)[key];
            if (userProps[key] !== undefined) continue;
            if (isVariantDisabled(config, key)) continue;
            if (isVariantValueDisabled(config, key, value)) continue;
            computedDefaults[key] = value;
          }
        },
        addClass: () => {},
        addStyle: () => {},
      });
    }

    return computedDefaults;
  };
}

/**
 * Creates the cv and cx functions.
 */
export function create({
  transformClass = (className) => className,
}: CreateParams = {}) {
  const cx = (...classes: ClsxClassValue[]) => transformClass(clsx(...classes));

  const cv = <
    V extends Variants = {},
    CV extends ComputedVariants = {},
    const E extends AnyComponent[] = [],
  >(
    config: CVConfig<V, CV, E> = {},
  ): CVComponent<V, CV, E> => {
    type MergedVariants = MergeVariants<V, CV, E>;

    // ----- Pre-computed at creation time -----
    const variantKeys = collectVariantKeys(config);
    const disabledVariantKeys = collectDisabledVariantKeys(config);
    const disabledVariantValues = collectDisabledVariantValues(config);
    const hasDisabledVariantKeys = disabledVariantKeys.size > 0;
    const hasDisabledVariantValues =
      Object.keys(disabledVariantValues).length > 0;
    const hasAnyDisabled = hasDisabledVariantKeys || hasDisabledVariantValues;

    const inputPropsKeys = ["class", "className", "style", ...variantKeys];

    const extend = config.extend;
    const hasExtend = !!extend && extend.length > 0;
    const variants = config.variants;
    const computedVariantsCfg = config.computedVariants;
    const computed = config.computed;
    const baseStyle = config.style;
    const baseClass: ClassValue =
      config.class === undefined ? null : (config.class as ClassValue);

    // Pre-build variant entries for fast iteration. For each variant key in
    // `variants`, we have a name and a PrebuiltVariant with normalized values.
    const variantEntryNames: string[] = [];
    const variantEntryDefs: PrebuiltVariant[] = [];
    if (variants) {
      for (const name in variants) {
        if (!hasOwn.call(variants, name)) continue;
        const variant = (variants as Record<string, unknown>)[name];
        if (variant === null) continue;
        variantEntryNames.push(name);
        variantEntryDefs.push(buildPrebuiltVariant(variant));
      }
    }
    const variantEntryCount = variantEntryNames.length;

    // Pre-built computed-variants entries.
    const computedVariantNames: string[] = [];
    const computedVariantFns: Array<(value: unknown) => unknown> = [];
    if (computedVariantsCfg) {
      for (const name in computedVariantsCfg) {
        if (!hasOwn.call(computedVariantsCfg, name)) continue;
        computedVariantNames.push(name);
        computedVariantFns.push(
          (computedVariantsCfg as Record<string, (value: unknown) => unknown>)[
            name
          ] as (value: unknown) => unknown,
        );
      }
    }
    const computedVariantCount = computedVariantNames.length;

    // Pre-compute static defaults. Includes:
    // - extended components' static defaults
    // - implicit boolean defaults (variants with a `false` key default to false)
    // - this config's defaultVariants (overriding the above)
    // Then filtered through disabled-variants.
    const staticDefaults: Record<string, unknown> = {};
    if (extend) {
      for (const ext of extend) {
        const meta = getComponentMeta(ext);
        if (meta) Object.assign(staticDefaults, meta.staticDefaults);
      }
    }
    if (variants) {
      for (const name in variants) {
        if (!hasOwn.call(variants, name)) continue;
        const variantDef = (variants as Record<string, unknown>)[name];
        if (!isRecordObject(variantDef)) continue;
        if (
          hasOwn.call(variantDef, "false") &&
          staticDefaults[name] === undefined
        ) {
          staticDefaults[name] = false;
        }
      }
    }
    if (config.defaultVariants) {
      Object.assign(staticDefaults, config.defaultVariants);
    }
    if (hasAnyDisabled) {
      // Filter disabled variants in-place
      for (const key in staticDefaults) {
        if (!hasOwn.call(staticDefaults, key)) continue;
        if (disabledVariantKeys.has(key)) {
          delete staticDefaults[key];
          continue;
        }
        if (hasDisabledVariantValues) {
          const value = staticDefaults[key];
          const valueKey = getVariantValueKey(value);
          if (valueKey != null && disabledVariantValues[key]?.has(valueKey)) {
            delete staticDefaults[key];
          }
        }
      }
    }

    // Pre-build extended component info, so we don't have to call
    // `getComponentMeta` per render.
    const extEntries: AnyComponent[] = extend ? (extend as AnyComponent[]) : [];
    const extBaseClassesArr: string[] = [];
    const extMetas: (ComponentMeta | undefined)[] = [];
    if (extend) {
      for (const ext of extend) {
        const meta = getComponentMeta(ext);
        extMetas.push(meta);
        extBaseClassesArr.push(meta?.baseClass ?? "");
      }
    }
    const extCount = extEntries.length;

    // Inlined "filter disabled" - mutates `out` adding only allowed entries.
    // Most components have no disabled variants, in which case we can skip
    // the filter entirely.
    function filterDisabledInto(
      input: Record<string, unknown>,
      out: Record<string, unknown>,
    ): void {
      if (!hasAnyDisabled) {
        for (const key in input) {
          if (hasOwn.call(input, key)) out[key] = input[key];
        }
        return;
      }
      for (const key in input) {
        if (!hasOwn.call(input, key)) continue;
        if (disabledVariantKeys.has(key)) continue;
        const value = input[key];
        if (hasDisabledVariantValues) {
          const valueKey = getVariantValueKey(value);
          if (valueKey != null && disabledVariantValues[key]?.has(valueKey)) {
            continue;
          }
        }
        out[key] = value;
      }
    }

    // Pre-create default-variants resolver which is referenced during the hot
    // path through extended components' meta. The closure captures
    // staticDefaults, extend, computed, etc.
    const resolveDefaultsFn = createResolveDefaults(config, staticDefaults);

    // Resolve variants: defaults -> computed defaults from extended -> props.
    function resolveVariantsHot(
      propsVariants: Record<string, unknown>,
    ): Record<string, unknown> {
      // Start with static defaults
      const defaults: Record<string, unknown> = {};
      Object.assign(defaults, staticDefaults);

      // Apply computed defaults from extended components
      if (hasExtend) {
        for (let i = 0; i < extCount; i++) {
          const meta = extMetas[i];
          if (!meta) continue;
          const extComputed = meta.resolveDefaults(defaults, propsVariants);
          for (const k in extComputed) {
            if (hasOwn.call(extComputed, k)) {
              defaults[k] = extComputed[k];
            }
          }
        }
      }

      // Now merge: defaults < propsVariants (filter undefined)
      // Apply propsVariants on top
      for (const k in propsVariants) {
        if (!hasOwn.call(propsVariants, k)) continue;
        const v = propsVariants[k];
        if (v === undefined) continue;
        defaults[k] = v;
      }

      // Filter disabled
      const result: Record<string, unknown> = {};
      filterDisabledInto(defaults, result);
      return result;
    }

    // Hot path: build a fresh result.
    const computeResult = (
      props: ComponentProps<MergedVariants> = {},
    ): { className: string; style: StyleValue } => {
      // Extract skip style keys from props (set by child's computedVariants)
      const skipStyleKeysIn = (props as Record<symbol, unknown>)[
        SKIP_STYLE_KEYS
      ] as Set<string> | undefined;
      const skipStyleVariantValuesIn = (props as Record<symbol, unknown>)[
        SKIP_STYLE_VARIANT_VALUES
      ] as Record<string, Set<string>> | undefined;

      // Extract variant props from input. Also remember the propsVariants for
      // computed-defaults application.
      const variantProps: Record<string, unknown> = {};
      for (let i = 0; i < variantKeys.length; i++) {
        const key = variantKeys[i];
        if (key in props) {
          variantProps[key] = (props as Record<string, unknown>)[key];
        }
      }

      // Resolve variants with defaults
      let resolvedVariants = resolveVariantsHot(variantProps);

      // Run computed function (may update variants and emit class/style)
      let computedClassesArr: ClassValue[] | null = null;
      let computedStyleObj: StyleValue | null = null;

      if (computed) {
        const updatedVariants: Record<string, unknown> = {};
        Object.assign(updatedVariants, resolvedVariants);
        const cClasses: ClassValue[] = [];
        let cStyle: StyleValue | null = null;
        const ctx = {
          variants: resolvedVariants as VariantValues<Record<string, unknown>>,
          setVariants: (
            newVariants: VariantValues<Record<string, unknown>>,
          ) => {
            const filtered: Record<string, unknown> = {};
            filterDisabledInto(
              newVariants as Record<string, unknown>,
              filtered,
            );
            Object.assign(updatedVariants, filtered);
          },
          setDefaultVariants: (
            newDefaults: VariantValues<Record<string, unknown>>,
          ) => {
            for (const key in newDefaults) {
              if (!hasOwn.call(newDefaults, key)) continue;
              if (variantProps[key] !== undefined) continue;
              if (disabledVariantKeys.has(key)) continue;
              const value = (newDefaults as Record<string, unknown>)[key];
              const valueKey = getVariantValueKey(value);
              if (
                valueKey != null &&
                disabledVariantValues[key]?.has(valueKey)
              ) {
                continue;
              }
              updatedVariants[key] = value;
            }
          },
          addClass: (className: ClassValue) => {
            cClasses.push(className);
          },
          addStyle: (newStyle: StyleValue) => {
            if (!cStyle) cStyle = {};
            assign(cStyle, newStyle);
          },
        };
        const result = computed(ctx);
        if (result != null) {
          const r = extractClassAndStylePrebuilt(result);
          if (r.class != null) cClasses.push(r.class);
          if (r.style) {
            if (!cStyle) cStyle = {};
            assign(cStyle, r.style);
          }
        }
        // Apply filterDisabled to updatedVariants
        const filteredUpdated: Record<string, unknown> = {};
        filterDisabledInto(updatedVariants, filteredUpdated);
        resolvedVariants = filteredUpdated;
        computedClassesArr = cClasses;
        computedStyleObj = cStyle;
      }

      // Compute skip-style sets for the extended components and current
      // component. Only allocate when needed.
      const hasSkipKeys = !!skipStyleKeysIn || disabledVariantKeys.size > 0;
      let currentVariantKeys: Set<string> | null = null;
      if (hasSkipKeys) {
        currentVariantKeys = new Set<string>();
        if (skipStyleKeysIn) {
          for (const k of skipStyleKeysIn) currentVariantKeys.add(k);
        }
        for (const k of disabledVariantKeys) currentVariantKeys.add(k);
      }
      // computedVariantKeys is currentVariantKeys + computedVariants names
      let computedVariantKeysSet: Set<string> | null = null;
      if (hasExtend) {
        if (currentVariantKeys || computedVariantNames.length > 0) {
          computedVariantKeysSet = new Set<string>();
          if (currentVariantKeys) {
            for (const k of currentVariantKeys) computedVariantKeysSet.add(k);
          }
          for (let i = 0; i < computedVariantNames.length; i++) {
            computedVariantKeysSet.add(computedVariantNames[i]);
          }
        }
      }

      // computedVariantValues = mergeDisabledVariantValues(skipIn, disabledValues)
      let computedVariantValues: Record<string, Set<string>> | null = null;
      const hasInValues = !!skipStyleVariantValuesIn;
      const disabledValuesKeys = Object.keys(disabledVariantValues);
      const hasDisabledValues = disabledValuesKeys.length > 0;
      if (hasExtend && (hasInValues || hasDisabledValues)) {
        computedVariantValues = {};
        if (hasInValues) {
          for (const k in skipStyleVariantValuesIn) {
            if (!hasOwn.call(skipStyleVariantValuesIn, k)) continue;
            const set = new Set<string>();
            for (const v of skipStyleVariantValuesIn[k]) {
              set.add(v);
            }
            computedVariantValues[k] = set;
          }
        }
        for (let i = 0; i < disabledValuesKeys.length; i++) {
          const k = disabledValuesKeys[i];
          let bucket = computedVariantValues[k];
          if (!bucket) {
            bucket = new Set<string>();
            computedVariantValues[k] = bucket;
          }
          for (const v of disabledVariantValues[k]) bucket.add(v);
        }
      }

      // ----- Build classes/styles in proper order -----
      // 1. Extended base classes & their styles (with skip applied)
      // 2. Current base class & base style
      // 3. Extended variant classes
      // 4. Current variants
      // 5. computed results
      // 6. props.class / props.className
      // 7. props.style
      const allClasses: ClassValue[] = [];
      const allStyle: StyleValue = {};

      // Process extended components
      if (hasExtend) {
        const hasSkipForExt =
          (computedVariantKeysSet && computedVariantKeysSet.size > 0) ||
          (computedVariantValues &&
            Object.keys(computedVariantValues).length > 0);

        const extVariantClasses: ClassValue[] = [];

        for (let i = 0; i < extCount; i++) {
          const ext = extEntries[i];
          const extBaseClass = extBaseClassesArr[i];
          let propsForExt: Record<string | symbol, unknown>;
          if (hasSkipForExt) {
            propsForExt = {};
            // Copy resolvedVariants
            for (const k in resolvedVariants) {
              if (hasOwn.call(resolvedVariants, k)) {
                propsForExt[k] = resolvedVariants[k];
              }
            }
            if (computedVariantKeysSet && computedVariantKeysSet.size > 0) {
              propsForExt[SKIP_STYLE_KEYS] = computedVariantKeysSet;
            }
            if (
              computedVariantValues &&
              Object.keys(computedVariantValues).length > 0
            ) {
              propsForExt[SKIP_STYLE_VARIANT_VALUES] = computedVariantValues;
            }
          } else {
            propsForExt = resolvedVariants as Record<string | symbol, unknown>;
          }

          const extResult = ext(
            propsForExt as ComponentProps<Record<string, unknown>>,
          );
          // ext is always a default-mode CV component invoked directly here, so
          // its style is already in normalized StyleValue form (camelCase). No
          // need to call normalizeStyle.
          if (extResult.style && typeof extResult.style === "object") {
            assign(allStyle, extResult.style as StyleValue);
          }

          allClasses.push(extBaseClass);
          const fullClass =
            "className" in extResult ? extResult.className : extResult.class;
          const variantPortion = extractVariantClasses(fullClass, extBaseClass);
          if (variantPortion) extVariantClasses.push(variantPortion);
        }

        // 2. Current base class
        allClasses.push(baseClass);
        if (baseStyle) assign(allStyle, baseStyle);

        // 4. Extended variant classes
        for (let i = 0; i < extVariantClasses.length; i++) {
          allClasses.push(extVariantClasses[i]);
        }
      } else {
        // No extends: just current base
        allClasses.push(baseClass);
        if (baseStyle) assign(allStyle, baseStyle);
      }

      // 5. Current component's variants (skip keys overridden)
      // Walk pre-built variant entries
      for (let i = 0; i < variantEntryCount; i++) {
        const variantName = variantEntryNames[i];
        const variant = variantEntryDefs[i];
        if (variant.disabled) continue;
        if (currentVariantKeys && currentVariantKeys.has(variantName)) continue;
        const selectedValue = resolvedVariants[variantName];
        if (selectedValue === undefined) continue;
        const selectedKey = getVariantValueKey(selectedValue);
        // disabled values from current config:
        if (
          variant.disabledValues &&
          selectedKey != null &&
          variant.disabledValues.has(selectedKey)
        ) {
          continue;
        }
        // skipVariantValues comes from skipStyleVariantValuesIn (only relevant
        // if this is being called as an extended component). For top-level it
        // would be undefined.
        if (
          skipStyleVariantValuesIn &&
          selectedKey != null &&
          skipStyleVariantValuesIn[variantName]?.has(selectedKey)
        ) {
          continue;
        }

        if (variant.values) {
          if (selectedKey == null) continue;
          const v = variant.values[selectedKey];
          if (!v) continue;
          if (v.class != null) allClasses.push(v.class);
          if (v.style) assign(allStyle, v.style);
        } else if (variant.shorthand) {
          // shorthand: applies when selectedValue === true
          if (selectedValue === true) {
            const v = variant.shorthand;
            if (v.class != null) allClasses.push(v.class);
            if (v.style) assign(allStyle, v.style);
          }
        }
      }

      // computedVariants
      for (let i = 0; i < computedVariantCount; i++) {
        const variantName = computedVariantNames[i];
        const fn = computedVariantFns[i];
        if (currentVariantKeys && currentVariantKeys.has(variantName)) continue;
        const selectedValue = resolvedVariants[variantName];
        if (selectedValue === undefined) continue;
        const selectedKey = getVariantValueKey(selectedValue);
        if (
          skipStyleVariantValuesIn &&
          selectedKey != null &&
          skipStyleVariantValuesIn[variantName]?.has(selectedKey)
        ) {
          continue;
        }
        const computedResult = fn(selectedValue);
        if (computedResult == null) continue;
        const r = extractClassAndStylePrebuilt(computedResult);
        if (r.class != null) allClasses.push(r.class);
        if (r.style) assign(allStyle, r.style);
      }

      // computed function results
      if (computedClassesArr) {
        for (let i = 0; i < computedClassesArr.length; i++) {
          allClasses.push(computedClassesArr[i]);
        }
      }
      if (computedStyleObj) assign(allStyle, computedStyleObj);

      // props.class / props.className
      if ("class" in props)
        allClasses.push((props as { class: ClassValue }).class);
      if ("className" in props)
        allClasses.push((props as { className: ClassValue }).className);

      // props.style
      const psv = (props as { style?: unknown }).style;
      if (psv != null) {
        // Fast path: if it's an object with no keys, skip
        if (typeof psv === "string") {
          if (psv.length > 0) {
            assign(allStyle, htmlStyleToStyleValue(psv));
          }
        } else if (typeof psv === "object") {
          // Could be HTMLObj or JSX form. Don't allocate when empty.
          let hasAnyKey = false;
          for (const _ in psv) {
            hasAnyKey = true;
            break;
          }
          if (hasAnyKey) {
            assign(allStyle, normalizeStyle(psv));
          }
        }
      }

      return {
        className: cx(...(allClasses as ClsxClassValue[])),
        style: allStyle,
      };
    };

    const getVariants = (variants?: VariantValues<MergedVariants>) => {
      const variantProps = (variants ?? {}) as Record<string, unknown>;
      let resolvedVariants = resolveVariantsHot(variantProps);
      // Run computed function to get variants set via setVariants and
      // setDefaultVariants
      if (computed) {
        const updatedVariants: Record<string, unknown> = {};
        Object.assign(updatedVariants, resolvedVariants);
        const ctx = {
          variants: resolvedVariants as VariantValues<Record<string, unknown>>,
          setVariants: (
            newVariants: VariantValues<Record<string, unknown>>,
          ) => {
            const filtered: Record<string, unknown> = {};
            filterDisabledInto(
              newVariants as Record<string, unknown>,
              filtered,
            );
            Object.assign(updatedVariants, filtered);
          },
          setDefaultVariants: (
            newDefaults: VariantValues<Record<string, unknown>>,
          ) => {
            for (const key in newDefaults) {
              if (!hasOwn.call(newDefaults, key)) continue;
              if (variantProps[key] !== undefined) continue;
              if (disabledVariantKeys.has(key)) continue;
              const value = (newDefaults as Record<string, unknown>)[key];
              const valueKey = getVariantValueKey(value);
              if (
                valueKey != null &&
                disabledVariantValues[key]?.has(valueKey)
              ) {
                continue;
              }
              updatedVariants[key] = value;
            }
          },
          addClass: () => {},
          addStyle: () => {},
        };
        computed(ctx);
        const filteredUpdated: Record<string, unknown> = {};
        filterDisabledInto(updatedVariants, filteredUpdated);
        resolvedVariants = filteredUpdated;
      }
      return resolvedVariants as VariantValues<MergedVariants>;
    };

    // Compute base class (without variants) - includes extended base classes
    const extendedBaseClasses: ClassValue[] = [];
    if (extend) {
      for (const ext of extend) {
        const meta = getComponentMeta(ext);
        extendedBaseClasses.push(meta?.baseClass ?? "");
      }
    }
    const computedBaseClass = cx(
      ...(extendedBaseClasses as ClsxClassValue[]),
      config.class as ClsxClassValue,
    );

    // Shared closures across the default and modal components.
    const classFn = (props: ComponentProps<MergedVariants> = {}) => {
      return computeResult(props).className;
    };
    const meta: ComponentMeta = {
      baseClass: computedBaseClass,
      staticDefaults,
      resolveDefaults: resolveDefaultsFn,
    };

    const initComponent = <C extends ModalComponent<MergedVariants, never>>(
      c: C,
      keys: string[],
      style: C["style"],
    ): C => {
      c.class = classFn;
      c.style = style;
      c.getVariants = getVariants;
      c.keys = keys as never;
      c.variantKeys = variantKeys as never;
      c.propKeys = keys as never;
      setComponentMeta(c, meta);
      return c;
    };

    // Default component
    const defaultComponent = ((props: ComponentProps<MergedVariants> = {}) => {
      const { className, style } = computeResult(props);
      return { class: className, style };
    }) as CVComponent<V, CV, E>;
    initComponent(
      defaultComponent as unknown as ModalComponent<MergedVariants, never>,
      inputPropsKeys,
      ((props: ComponentProps<MergedVariants> = {}) => {
        return computeResult(props).style;
      }) as unknown as ModalComponent<MergedVariants, never>["style"],
    );

    // JSX component
    const jsxComponent = ((props: ComponentProps<MergedVariants> = {}) => {
      const { className, style } = computeResult(props);
      return { className, style: styleValueToJSXStyle(style) };
    }) as ModalComponent<MergedVariants, JSXProps>;
    initComponent(
      jsxComponent as unknown as ModalComponent<MergedVariants, never>,
      ["className", "style", ...variantKeys],
      ((props: ComponentProps<MergedVariants> = {}) => {
        return styleValueToJSXStyle(computeResult(props).style);
      }) as unknown as ModalComponent<MergedVariants, never>["style"],
    );

    // HTML component
    const htmlComponent = ((props: ComponentProps<MergedVariants> = {}) => {
      const { className, style } = computeResult(props);
      return { class: className, style: styleValueToHTMLStyle(style) };
    }) as ModalComponent<MergedVariants, HTMLProps>;
    initComponent(
      htmlComponent as unknown as ModalComponent<MergedVariants, never>,
      ["class", "style", ...variantKeys],
      ((props: ComponentProps<MergedVariants> = {}) => {
        return styleValueToHTMLStyle(computeResult(props).style);
      }) as unknown as ModalComponent<MergedVariants, never>["style"],
    );

    // HTMLObj component
    const htmlObjComponent = ((props: ComponentProps<MergedVariants> = {}) => {
      const { className, style } = computeResult(props);
      return { class: className, style: styleValueToHTMLObjStyle(style) };
    }) as ModalComponent<MergedVariants, HTMLObjProps>;
    initComponent(
      htmlObjComponent as unknown as ModalComponent<MergedVariants, never>,
      ["class", "style", ...variantKeys],
      ((props: ComponentProps<MergedVariants> = {}) => {
        return styleValueToHTMLObjStyle(computeResult(props).style);
      }) as unknown as ModalComponent<MergedVariants, never>["style"],
    );

    defaultComponent.jsx = jsxComponent;
    defaultComponent.html = htmlComponent;
    defaultComponent.htmlObj = htmlObjComponent;

    return defaultComponent;
  };

  return { cv, cx };
}

export const { cv, cx } = create();
