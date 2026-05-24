import {
  REFINE_UNSTABLE_TRACKING_WINDOW,
  type RefineRunState,
  type VariantChange,
  accumulateUnstableVariantChanges,
  captureCreationFrame,
  warnRefineLimit,
} from "./refine-warning.ts";
import type {
  AnyComponent,
  CVComponent,
  ClassValue,
  ComponentProps,
  ComponentResult,
  DefaultVariants,
  ExtendableVariants,
  HTMLObjProps,
  HTMLProps,
  JSXProps,
  MergeVariants,
  ModalComponent,
  Refine,
  SplitPropsFunction,
  StyleClassProps,
  StyleClassValue,
  StyleValue,
  VariantValue,
  VariantValues,
  Variants,
} from "./types.ts";
import {
  htmlObjStyleToStyleValue,
  htmlStyleToStyleValue,
  isHTMLObjStyle,
  joinClass,
  jsxStyleToStyleValue,
  styleValueToHTMLObjStyle,
  styleValueToHTMLStyle,
  styleValueToJSXStyle,
} from "./utils.ts";

// Internal compute path: pushes the variant classes contributed by this
// component (and its extends chain) into `classesOut` and merges any styles
// into `styleOut`. Base class is handled by callers via ComponentMeta.baseClass
// to avoid string-parsing round trips. Both outputs are mutated in place to
// avoid intermediate allocations.
type ComputeFn = (
  resolved: Record<string, unknown>,
  userVariantProps: Record<string, unknown>,
  skipKeys: Set<string> | null,
  skipValues: Record<string, Set<string>> | null,
  classesOut: ClassValue[],
  styleOut: StyleValue,
  runState?: RefineRunState,
  protectedVariants?: Record<string, unknown> | null,
  pendingProtectedVariants?: Record<string, unknown> | null,
  protectedVariantKeys?: Set<string> | null,
  defaultResolved?: Record<string, unknown>,
  renderOnly?: boolean,
) => Record<string, unknown>;

type ResolveRefineFn = (
  resolved: Record<string, unknown>,
  userVariantProps: Record<string, unknown>,
  filterOwnVariants?: boolean,
  runState?: RefineRunState,
  protectedVariants?: Record<string, unknown> | null,
  pendingProtectedVariants?: Record<string, unknown> | null,
  protectedVariantKeys?: Set<string> | null,
  defaultResolved?: Record<string, unknown>,
) => Record<string, unknown>;

type ComputedDefaultVariantFn = (context: {
  defaultValue: unknown;
  variants: Readonly<Record<string, unknown>>;
}) => unknown;

// Internal metadata stored on components but hidden from public types.
interface ComponentMeta {
  baseClass: string;
  staticDefaults: Record<string, unknown>;
  // Returns variant classes + style for this component, used by extending
  // components. Top-level rendering also routes through this.
  compute: ComputeFn;
  resolveRefine: ResolveRefineFn | null;
  // Reference identity is used to detect mixed-factory `extend`. When a
  // component is extended by a parent from a different `create()` call, the
  // parent applies this transform to the extend's contribution before joining,
  // preserving each factory's transform boundary.
  transformClass: (className: string) => string;
  // Variant keys whose effective definition in this component's chain is a
  // function. An extending component that supplies a non-function variant for
  // the same key uses this to tell us to skip that key (matching the
  // type-level "function variant is replaced by anything in the child" rule).
  // Empty when no key in this chain is a function variant.
  functionVariantKeys: Set<string>;
  // Variant keys with computed defaults anywhere in this component's chain.
  // Child components use this to preserve inherited computed defaults through
  // `defaultValue` without preserving their own prior computed result.
  computedDefaultKeys: Set<string>;
}

const META_KEY = "__meta";

interface ComponentWithMeta {
  [META_KEY]?: ComponentMeta;
}

const EMPTY_DEFAULTS: Record<string, unknown> = Object.freeze({}) as Record<
  string,
  unknown
>;

const MAX_REFINE_RUNS = 50;

function areVariantsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  for (const key in a) {
    if (!Object.hasOwn(a, key)) continue;
    if (!Object.is(a[key], b[key])) return false;
  }
  for (const key in b) {
    if (!Object.hasOwn(b, key)) continue;
    if (!Object.hasOwn(a, key)) return false;
  }
  return true;
}

function getExtUserVariantProps(
  userVariantProps: Record<string, unknown>,
  protectedVariants: Record<string, unknown> | null,
  changedVariants: Record<string, unknown> | null,
): Record<string, unknown> {
  const extUserVariantProps: Record<string, unknown> = {};
  Object.assign(extUserVariantProps, userVariantProps);
  if (protectedVariants) {
    Object.assign(extUserVariantProps, protectedVariants);
  }
  if (changedVariants) {
    Object.assign(extUserVariantProps, changedVariants);
  }
  return extUserVariantProps;
}

function mergeVariants(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  skipKeys?: Set<string> | null,
): boolean {
  let changed = false;
  if (!skipKeys || skipKeys.size === 0) {
    for (const key in source) {
      if (!Object.hasOwn(source, key)) continue;
      const value = source[key];
      if (!Object.is(target[key], value)) {
        changed = true;
      }
      target[key] = value;
    }
    return changed;
  }
  for (const key in source) {
    if (!Object.hasOwn(source, key)) continue;
    if (skipKeys.has(key)) continue;
    const value = source[key];
    if (!Object.is(target[key], value)) {
      changed = true;
    }
    target[key] = value;
  }
  return changed;
}

function mergeProtectedIntoBase(
  baseResolved: Record<string, unknown>,
  protectedVariants: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!protectedVariants) {
    return baseResolved;
  }
  let hasProtected = false;
  for (const key in protectedVariants) {
    if (!Object.hasOwn(protectedVariants, key)) continue;
    hasProtected = true;
    break;
  }
  if (!hasProtected) {
    return baseResolved;
  }
  const resolved: Record<string, unknown> = {};
  Object.assign(resolved, baseResolved);
  for (const key in protectedVariants) {
    if (!Object.hasOwn(protectedVariants, key)) continue;
    resolved[key] = protectedVariants[key];
  }
  return resolved;
}

// Components carry internal metadata on a non-public property so user-facing
// component types stay clean.
function getComponentMeta(component: AnyComponent): ComponentMeta | undefined {
  return (component as AnyComponent & ComponentWithMeta)[META_KEY];
}

function setComponentMeta(component: AnyComponent, meta: ComponentMeta): void {
  (component as AnyComponent & ComponentWithMeta)[META_KEY] = meta;
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

/**
 * Extracts the variant props inferred for a Clava component. Use it to add a
 * component's variant props to framework component props.
 *
 * @example
 * ```ts
 * import { type VariantProps, cv } from "clava";
 * import type { ComponentProps } from "react";
 *
 * const button = cv({
 *   variants: {
 *     size: { sm: "button-sm", lg: "button-lg" },
 *     disabled: { true: "button-disabled", false: "" },
 *   },
 * });
 *
 * interface ButtonProps
 *   extends ComponentProps<"button">,
 *     VariantProps<typeof button> {}
 *
 * const props: ButtonProps = {
 *   size: "lg",
 *   disabled: true,
 * };
 * ```
 */
export type VariantProps<T extends Pick<AnyComponent, "getVariants">> =
  ReturnType<T["getVariants"]>;

// Variant props expose booleans, but variant object keys are always strings.
type VariantKey<T> = T extends boolean ? "true" | "false" : Extract<T, string>;

/**
 * Constrains a variant map to the same value keys as a variant on another
 * component. Boolean variants are represented with `"true"` and `"false"`
 * object keys.
 *
 * @example
 * ```ts
 * import { type Variant, cv } from "clava";
 *
 * const button = cv({
 *   variants: {
 *     size: { sm: "button-sm", lg: "button-lg" },
 *   },
 * });
 *
 * const icon = cv({
 *   extend: [button],
 *   variants: {
 *     size: {
 *       sm: "icon-sm",
 *       lg: "icon-lg",
 *     } satisfies Variant<typeof button, "size">,
 *   },
 * });
 * ```
 */
export type Variant<
  T extends Pick<AnyComponent, "getVariants">,
  K extends keyof VariantProps<T>,
> = Record<VariantKey<NonNullable<VariantProps<T>[K]>>, VariantValue>;

/**
 * The configuration object accepted by `cv()`. It defines base class/style
 * output, variants, default variants, component extensions, and refinement
 * logic.
 *
 * @example
 * ```ts
 * import { type CVConfig, cv } from "clava";
 *
 * const config: CVConfig<{
 *   tone: { info: string; danger: string };
 * }> = {
 *   variants: {
 *     tone: {
 *       info: "alert-info",
 *       danger: "alert-danger",
 *     },
 *   },
 *   defaultVariants: {
 *     tone: "info",
 *   },
 * };
 *
 * const alert = cv(config);
 * ```
 */
export interface CVConfig<
  V extends Variants = {},
  E extends AnyComponent[] = [],
> {
  extend?: E;
  class?: ClassValue;
  style?: StyleValue;
  variants?: ExtendableVariants<V, E>;
  defaultVariants?: DefaultVariants<MergeVariants<V, E>>;
  refine?: Refine<MergeVariants<V, E>>;
}

interface CreateParams {
  transformClass?: (className: string) => string;
}

interface VariantConfigLike {
  extend?: AnyComponent[];
  variants?: Record<string, unknown>;
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
    if (isHTMLObjStyle(style)) {
      return htmlObjStyleToStyleValue(style as HTMLObjProps["style"]);
    }
    return jsxStyleToStyleValue(style as JSXProps["style"]);
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
function collectVariantKeys(config: VariantConfigLike): string[] {
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
      if (!Object.hasOwn(config.variants, key)) continue;
      const variant = config.variants[key];
      if (variant === null) {
        keys.delete(key);
        continue;
      }
      keys.add(key);
    }
  }

  return Array.from(keys);
}

function getVariantValueKey(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function collectDisabledVariantKeys(config: VariantConfigLike): Set<string> {
  const keys = new Set<string>();
  if (!config.variants) {
    return keys;
  }
  for (const key in config.variants) {
    if (!Object.hasOwn(config.variants, key)) continue;
    if (config.variants[key] === null) {
      keys.add(key);
    }
  }
  return keys;
}

function collectDisabledVariantValues(
  config: VariantConfigLike,
): Record<string, Set<string>> {
  const values: Record<string, Set<string>> = {};
  if (!config.variants) {
    return values;
  }
  for (const key in config.variants) {
    if (!Object.hasOwn(config.variants, key)) continue;
    const variant = config.variants[key];
    if (!isRecordObject(variant)) continue;
    let bucket: Set<string> | undefined;
    for (const variantValue in variant) {
      if (!Object.hasOwn(variant, variantValue)) continue;
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

interface NormalizedSource {
  propKeys: string[];
  variantKeys: string[];
  isComponent: boolean;
}

const EMPTY_SOURCE: NormalizedSource = {
  propKeys: [],
  variantKeys: [],
  isComponent: false,
};

function normalizeKeySource(source: unknown): NormalizedSource {
  if (Array.isArray(source)) {
    return {
      propKeys: source as string[],
      variantKeys: source as string[],
      isComponent: false,
    };
  }

  if (!source) {
    return EMPTY_SOURCE;
  }
  if (typeof source !== "object" && typeof source !== "function") {
    return EMPTY_SOURCE;
  }
  const typed = source as Record<string, unknown>;
  if (typeof typed.getVariants !== "function") {
    return EMPTY_SOURCE;
  }
  if (!Array.isArray(typed.propKeys)) {
    return EMPTY_SOURCE;
  }
  if (!Array.isArray(typed.variantKeys)) {
    return EMPTY_SOURCE;
  }

  return {
    propKeys: typed.propKeys as string[],
    variantKeys: typed.variantKeys as string[],
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
  sources: unknown[],
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
    const source = normalizeKeySource(sources[s]);
    const sourceResult: Record<string, unknown> = {};

    const effectiveKeys =
      source.isComponent && stylingClaimed
        ? source.variantKeys
        : source.propKeys;

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
  return splitPropsImpl(
    normalizedSource1.propKeys,
    normalizedSource1.isComponent,
    props,
    sources,
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
}

function buildPrebuiltVariant(variantDef: unknown): PrebuiltVariant {
  if (!isRecordObject(variantDef)) {
    return {
      values: null,
      shorthand: extractClassAndStylePrebuilt(variantDef),
      disabledValues: null,
    };
  }
  const values: Record<string, PrebuiltValue> = {};
  let disabledValues: Set<string> | null = null;
  for (const key in variantDef) {
    if (!Object.hasOwn(variantDef, key)) continue;
    const value = variantDef[key];
    if (value === null) {
      if (!disabledValues) {
        disabledValues = new Set<string>();
      }
      disabledValues.add(key);
      continue;
    }
    values[key] = extractClassAndStylePrebuilt(value);
  }
  return {
    values,
    shorthand: null,
    disabledValues,
  };
}

/**
 * Creates the cv and cx functions.
 */
export function create({
  transformClass = (className) => className,
}: CreateParams = {}) {
  const cx = (...classes: ClassValue[]) =>
    transformClass(joinClass(...classes));

  const cv = <V extends Variants = {}, const E extends AnyComponent[] = []>(
    config: CVConfig<V, E> = {},
  ): CVComponent<V, E> => {
    type MergedVariants = MergeVariants<V, E>;

    // ----- Pre-computed at creation time -----
    const variantKeys = collectVariantKeys(config);
    const variantKeysLength = variantKeys.length;
    const disabledVariantKeys = collectDisabledVariantKeys(config);
    const disabledVariantValues = collectDisabledVariantValues(config);
    const hasDisabledVariantKeys = disabledVariantKeys.size > 0;
    const disabledVariantValueKeys = Object.keys(disabledVariantValues);
    const hasDisabledVariantValues = disabledVariantValueKeys.length > 0;
    const hasAnyDisabled = hasDisabledVariantKeys || hasDisabledVariantValues;

    const inputPropsKeys = ["class", "className", "style", ...variantKeys];

    const extend = config.extend;
    const hasExtend = !!extend && extend.length > 0;
    const variants = config.variants;
    const refine = config.refine;
    const baseStyle = config.style;
    const hasBaseStyle = !!baseStyle;

    // Split `variants` entries into static entries (object/shorthand) and
    // function-variant entries. Static entries are pre-built into
    // PrebuiltVariant for fast iteration. Function-variant entries override
    // any same-key inherited variant (see `staticExtSkipKeys`).
    const variantEntryNames: string[] = [];
    const variantEntryDefs: PrebuiltVariant[] = [];
    const functionVariantNames: string[] = [];
    const functionVariantFns: Array<(value: unknown) => unknown> = [];
    if (variants) {
      for (const name in variants) {
        if (!Object.hasOwn(variants, name)) continue;
        const variant = (variants as Record<string, unknown>)[name];
        if (variant === null) continue;
        if (typeof variant === "function") {
          functionVariantNames.push(name);
          functionVariantFns.push(variant as (value: unknown) => unknown);
          continue;
        }
        variantEntryNames.push(name);
        variantEntryDefs.push(buildPrebuiltVariant(variant));
      }
    }
    const variantEntryCount = variantEntryNames.length;
    const functionVariantCount = functionVariantNames.length;

    const computedDefaultNames: string[] = [];
    const computedDefaultFns: ComputedDefaultVariantFn[] = [];
    const defaultVariants = config.defaultVariants as
      | Record<string, unknown>
      | undefined;

    // Pre-compute static defaults. Includes:
    // - extended components' static defaults
    // - implicit boolean defaults (variants with a `false` key default to false)
    // - this config's literal defaultVariants (overriding the above)
    //
    // Function entries in defaultVariants are computed defaults. They run in
    // the refine loop so they can react to setVariants updates.
    // Then filtered through disabled-variants.
    const staticDefaults: Record<string, unknown> = {};
    if (extend) {
      for (const ext of extend) {
        const meta = getComponentMeta(ext);
        if (meta) {
          Object.assign(staticDefaults, meta.staticDefaults);
        }
      }
    }
    if (variants) {
      for (const name in variants) {
        if (!Object.hasOwn(variants, name)) continue;
        const variantDef = (variants as Record<string, unknown>)[name];
        if (!isRecordObject(variantDef)) continue;
        if (
          Object.hasOwn(variantDef, "false") &&
          staticDefaults[name] === undefined
        ) {
          staticDefaults[name] = false;
        }
      }
    }
    if (defaultVariants) {
      for (const name in defaultVariants) {
        if (!Object.hasOwn(defaultVariants, name)) continue;
        const value = defaultVariants[name];
        if (typeof value === "function") {
          computedDefaultNames.push(name);
          computedDefaultFns.push(value as ComputedDefaultVariantFn);
          continue;
        }
        if (value === undefined) {
          Reflect.deleteProperty(staticDefaults, name);
          continue;
        }
        staticDefaults[name] = value;
      }
    }
    const computedDefaultCount = computedDefaultNames.length;
    if (hasAnyDisabled) {
      // Filter disabled variants in-place
      for (const key in staticDefaults) {
        if (!Object.hasOwn(staticDefaults, key)) continue;
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
    // `getComponentMeta` per render. Extends from a different `create()`
    // factory (different `transformClass` identity) need their contribution
    // transformed by their own `transformClass` before being joined into our
    // class string — otherwise our outer
    // `transformClass(joinClass(...allClasses))` would be the only transform
    // that runs, and the extend's factory would be silently bypassed for any
    // base coming from `extend: [otherFactoryCv]`.
    const extMetas: ComponentMeta[] = [];
    const extBaseClassesArr: string[] = [];
    const extIsolated: boolean[] = [];
    let hasIsolatedExt = false;
    if (hasExtend) {
      for (const ext of extend) {
        const meta = getComponentMeta(ext);
        if (!meta) continue;
        extMetas.push(meta);
        const isolated = meta.transformClass !== transformClass;
        extIsolated.push(isolated);
        if (isolated) {
          hasIsolatedExt = true;
          // Apply the extend's own transformClass to its base class so it
          // survives our outer transform (which still applies on top, matching
          // the original public-component round-trip behavior).
          extBaseClassesArr.push(meta.transformClass(meta.baseClass));
        } else {
          extBaseClassesArr.push(meta.baseClass);
        }
      }
    }
    const extCount = extMetas.length;

    const inheritedComputedDefaultKeys = new Set<string>();
    for (let i = 0; i < extCount; i++) {
      const keys = extMetas[i].computedDefaultKeys;
      for (const key of keys) {
        inheritedComputedDefaultKeys.add(key);
      }
    }

    // Filter to only extends with computed default or refine work in their
    // chain. Those are the components that can change resolved variants across
    // fixed-point iterations.
    const extMetasWithRefine: ComponentMeta[] = [];
    for (let i = 0; i < extCount; i++) {
      const meta = extMetas[i];
      if (meta.resolveRefine) {
        extMetasWithRefine.push(meta);
      }
    }
    const extMetasWithRefineCount = extMetasWithRefine.length;
    const shouldCollectChangedVariants = extMetasWithRefineCount > 0;

    // Call-site frame captured at the `cv()` call site so refine-limit warnings
    // can point developers at the component definition. Skipped entirely for
    // components that can never enter the refine loop, and stripped in
    // production via the NODE_ENV guard inside `captureCreationFrame`. The
    // frame is captured at creation time but the underlying `.stack` string is
    // formatted lazily on first access, so component creation stays cheap
    // unless the warning actually fires.
    const canTriggerRefineWarning =
      !!refine || computedDefaultCount > 0 || extMetasWithRefineCount > 0;
    const creationFrame = canTriggerRefineWarning
      ? captureCreationFrame(cv)
      : undefined;

    // Function variant keys inherited from extends, filtered through this
    // component's own variants: a static (object/shorthand) variant in this
    // component replaces an inherited function variant for the same key.
    // The closure is exposed on `ComponentMeta` so any further extending
    // component can detect "ancestor's effective variant for K is a function"
    // and skip it when overriding K with a non-function.
    const functionVariantKeys = new Set<string>();
    for (let i = 0; i < extCount; i++) {
      const fnKeys = extMetas[i].functionVariantKeys;
      for (const k of fnKeys) {
        if (disabledVariantKeys.has(k)) continue;
        functionVariantKeys.add(k);
      }
    }
    for (let i = 0; i < functionVariantCount; i++) {
      functionVariantKeys.add(functionVariantNames[i]);
    }
    for (let i = 0; i < variantEntryCount; i++) {
      // A static variant in this component replaces an inherited function
      // variant for the same key; from this component onward, the key is no
      // longer a function variant.
      functionVariantKeys.delete(variantEntryNames[i]);
    }

    const computedDefaultKeys = new Set(inheritedComputedDefaultKeys);
    for (let i = 0; i < computedDefaultCount; i++) {
      computedDefaultKeys.add(computedDefaultNames[i]);
    }

    // Static-variant keys in this component that override an inherited
    // function variant. Type-level merge says child fully replaces, so the
    // ancestor's function must not run with the child's (object-typed) value.
    let staticVariantsOverridingExtFn: string[] | null = null;
    if (variantEntryCount > 0 && extCount > 0) {
      for (let i = 0; i < variantEntryCount; i++) {
        const name = variantEntryNames[i];
        for (let j = 0; j < extCount; j++) {
          if (extMetas[j].functionVariantKeys.has(name)) {
            if (!staticVariantsOverridingExtFn) {
              staticVariantsOverridingExtFn = [];
            }
            staticVariantsOverridingExtFn.push(name);
            break;
          }
        }
      }
    }

    // Pre-compute static skip key/value sets to pass to extends. These never
    // change across calls — when caller passes no skip sets, we reuse the same
    // object and avoid Set allocation.
    let staticExtSkipKeys: Set<string> | null = null;
    if (
      hasDisabledVariantKeys ||
      functionVariantCount > 0 ||
      staticVariantsOverridingExtFn !== null
    ) {
      staticExtSkipKeys = new Set<string>();
      for (const k of disabledVariantKeys) {
        staticExtSkipKeys.add(k);
      }
      for (let i = 0; i < functionVariantCount; i++) {
        staticExtSkipKeys.add(functionVariantNames[i]);
      }
      if (staticVariantsOverridingExtFn) {
        for (const k of staticVariantsOverridingExtFn) {
          staticExtSkipKeys.add(k);
        }
      }
    }
    // Skip values are passed directly to extends. We can reuse the same object
    // when no caller-provided values need merging.
    const staticExtSkipValues: Record<string, Set<string>> | null =
      hasDisabledVariantValues ? disabledVariantValues : null;

    // Branches on `hasAnyDisabled` so the no-disabled path skips the per-key
    // filter checks entirely — most components have no disabled variants and
    // hit only the plain copy.
    function filterDisabledInto(
      input: Record<string, unknown>,
      out: Record<string, unknown>,
    ): void {
      if (!hasAnyDisabled) {
        for (const key in input) {
          if (Object.hasOwn(input, key)) {
            out[key] = input[key];
          }
        }
        return;
      }
      for (const key in input) {
        if (!Object.hasOwn(input, key)) continue;
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

    const isOwnDisabledValue = (key: string, value: unknown): boolean => {
      if (disabledVariantKeys.has(key)) {
        return true;
      }
      if (hasDisabledVariantValues) {
        const valueKey = getVariantValueKey(value);
        if (valueKey != null && disabledVariantValues[key]?.has(valueKey)) {
          return true;
        }
      }
      return false;
    };

    const filterOwnDisabledVariants = (
      input: Record<string, unknown>,
      fallback: Record<string, unknown>,
    ): Record<string, unknown> => {
      if (!hasAnyDisabled) {
        return input;
      }

      let hasOwnDisabledValue = false;
      for (const key in input) {
        if (!Object.hasOwn(input, key)) continue;
        const value = input[key];
        if (isOwnDisabledValue(key, value)) {
          hasOwnDisabledValue = true;
          break;
        }
      }
      if (!hasOwnDisabledValue) {
        return input;
      }

      const filtered: Record<string, unknown> = {};
      for (const key in input) {
        if (!Object.hasOwn(input, key)) continue;
        const value = input[key];
        if (!isOwnDisabledValue(key, value)) {
          filtered[key] = value;
          continue;
        }
        const fallbackValue = fallback[key];
        if (
          fallbackValue !== undefined &&
          !isOwnDisabledValue(key, fallbackValue)
        ) {
          filtered[key] = fallbackValue;
        }
      }

      return filtered;
    };

    // Hot path: resolve variants by merging static defaults + extends'
    // static defaults + user-provided props.
    function resolveVariantsHot(
      propsVariants: Record<string, unknown>,
    ): Record<string, unknown> {
      // Start with static defaults
      const defaults: Record<string, unknown> = {};
      Object.assign(defaults, staticDefaults);

      // Apply propsVariants on top (filter undefined). propsVariants is
      // contractually variant-only here — callers building from a full props
      // object filter to variant keys before calling.
      for (const k in propsVariants) {
        if (!Object.hasOwn(propsVariants, k)) continue;
        const v = propsVariants[k];
        if (v === undefined) continue;
        defaults[k] = v;
      }

      if (!hasAnyDisabled) {
        return defaults;
      }

      // Filter disabled
      const result: Record<string, unknown> = {};
      filterDisabledInto(defaults, result);
      return result;
    }

    const runComputedDefaults = (
      resolved: Record<string, unknown>,
      defaultResolved: Record<string, unknown>,
      userVariantProps: Record<string, unknown>,
      filterOwnVariants: boolean,
      protectedVariantKeys: Set<string> | null | undefined,
    ): {
      workingResolved: Record<string, unknown>;
      changedVariants: Record<string, unknown> | null;
    } => {
      if (computedDefaultCount === 0) {
        return { workingResolved: resolved, changedVariants: null };
      }

      let ownVariants = filterOwnVariants ? null : resolved;
      const getOwnVariants = (): Record<string, unknown> => {
        if (ownVariants) {
          return ownVariants;
        }
        const filteredVariants: Record<string, unknown> = {};
        for (let i = 0; i < variantKeysLength; i++) {
          const key = variantKeys[i];
          if (Object.hasOwn(resolved, key)) {
            filteredVariants[key] = resolved[key];
          }
        }
        ownVariants = filteredVariants;
        return filteredVariants;
      };

      let updatedVariants: Record<string, unknown> | null = null;
      let changedVariants: Record<string, unknown> | null = null;
      const ensureUpdated = (): Record<string, unknown> => {
        if (updatedVariants) {
          return updatedVariants;
        }
        const updated: Record<string, unknown> = {};
        Object.assign(updated, resolved);
        updatedVariants = updated;
        return updated;
      };

      for (let i = 0; i < computedDefaultCount; i++) {
        const key = computedDefaultNames[i];
        if (Object.hasOwn(userVariantProps, key)) {
          if (userVariantProps[key] !== undefined) continue;
        }
        if (protectedVariantKeys?.has(key)) continue;

        const variantSnapshot = getOwnVariants();
        const defaultValue = inheritedComputedDefaultKeys.has(key)
          ? variantSnapshot[key]
          : defaultResolved[key];
        const value = computedDefaultFns[i]({
          defaultValue,
          variants: variantSnapshot,
        });
        if (hasAnyDisabled) {
          if (disabledVariantKeys.has(key)) continue;
          const valueKey = getVariantValueKey(value);
          if (valueKey != null && disabledVariantValues[key]?.has(valueKey)) {
            continue;
          }
        }

        if (value === undefined) {
          if (!Object.hasOwn(variantSnapshot, key)) continue;
          if (shouldCollectChangedVariants) {
            changedVariants ??= {};
            changedVariants[key] = value;
          }
          Reflect.deleteProperty(ensureUpdated(), key);
          continue;
        }
        if (Object.is(variantSnapshot[key], value)) continue;
        if (shouldCollectChangedVariants) {
          changedVariants ??= {};
          changedVariants[key] = value;
        }
        ensureUpdated()[key] = value;
      }

      return {
        workingResolved: updatedVariants ?? resolved,
        changedVariants,
      };
    };

    const runRefineContext = (
      resolved: Record<string, unknown>,
      userVariantProps: Record<string, unknown>,
      filterOwnVariants: boolean,
      collectOutput: boolean,
      applyVariantUpdates: boolean,
      protectedVariants: Record<string, unknown> | null | undefined,
      pendingProtectedVariants: Record<string, unknown> | null | undefined,
      protectedVariantKeys: Set<string> | null | undefined,
    ): {
      workingResolved: Record<string, unknown>;
      changedVariants: Record<string, unknown> | null;
      classes: ClassValue[] | null;
      style: StyleValue | null;
    } => {
      let workingResolved = resolved;
      let cClasses: ClassValue[] | null = null;
      let cStyle: StyleValue | null = null;
      let changedVariants: Record<string, unknown> | null = null;

      if (refine) {
        let ownVariants = resolved;
        if (filterOwnVariants) {
          // When this component is being extended, `resolved` is the parent's
          // workingResolved (a superset of our variant keys). Filter to our own
          // keys for `ctx.variants` so the user's `refine` callback sees the
          // shape declared by `VariantValues<V>` and not foreign parent keys.
          const filteredVariants: Record<string, unknown> = {};
          for (let i = 0; i < variantKeysLength; i++) {
            const k = variantKeys[i];
            if (Object.hasOwn(resolved, k)) {
              filteredVariants[k] = resolved[k];
            }
          }
          ownVariants = filteredVariants;
        }
        // Lazy-init updatedVariants — many refine callbacks only inspect
        // `variants`, so the copy is unnecessary in the common case.
        let updatedVariants: Record<string, unknown> | null = null;
        const localCClasses: ClassValue[] | null = collectOutput ? [] : null;
        let localCStyle: StyleValue | null = null;
        const ensureUpdated = (): Record<string, unknown> => {
          if (updatedVariants) {
            return updatedVariants;
          }
          const u: Record<string, unknown> = {};
          Object.assign(u, ownVariants);
          updatedVariants = u;
          return u;
        };
        const setChangedVariant = (
          key: string,
          value: unknown,
          protect = false,
        ) => {
          if (shouldCollectChangedVariants) {
            if (!changedVariants) {
              changedVariants = {};
            }
            changedVariants[key] = value;
          }
          if (protect && protectedVariants) {
            protectedVariants[key] = value;
            protectedVariantKeys?.add(key);
          }
        };
        const getCurrentVariantValue = (key: string) => {
          return updatedVariants ? updatedVariants[key] : ownVariants[key];
        };
        const ctx = {
          variants: ownVariants as VariantValues<Record<string, unknown>>,
          setVariants: (
            newVariants: VariantValues<Record<string, unknown>>,
          ) => {
            if (!applyVariantUpdates) {
              return;
            }
            if (!hasAnyDisabled) {
              for (const key in newVariants) {
                if (!Object.hasOwn(newVariants, key)) continue;
                const value = (newVariants as Record<string, unknown>)[key];
                setChangedVariant(key, value, true);
                if (Object.is(getCurrentVariantValue(key), value)) continue;
                ensureUpdated()[key] = value;
              }
              return;
            }
            for (const key in newVariants) {
              if (!Object.hasOwn(newVariants, key)) continue;
              if (disabledVariantKeys.has(key)) continue;
              const value = (newVariants as Record<string, unknown>)[key];
              if (hasDisabledVariantValues) {
                const valueKey = getVariantValueKey(value);
                if (
                  valueKey != null &&
                  disabledVariantValues[key]?.has(valueKey)
                ) {
                  continue;
                }
              }
              setChangedVariant(key, value, true);
              if (Object.is(getCurrentVariantValue(key), value)) continue;
              ensureUpdated()[key] = value;
            }
          },
          addClass: (className: ClassValue) => {
            localCClasses?.push(className);
          },
          addStyle: (newStyle: StyleValue) => {
            if (!collectOutput) return;
            if (!localCStyle) {
              localCStyle = {};
            }
            Object.assign(localCStyle, newStyle);
          },
        };
        const result = refine(ctx);
        if (collectOutput && result != null) {
          const r = extractClassAndStylePrebuilt(result);
          if (r.class != null) {
            localCClasses?.push(r.class);
          }
          if (r.style) {
            if (!localCStyle) {
              localCStyle = {};
            }
            Object.assign(localCStyle, r.style);
          }
        }
        cClasses = localCClasses;
        cStyle = localCStyle;
        if (updatedVariants) {
          const nextResolved: Record<string, unknown> = {};
          Object.assign(nextResolved, workingResolved);
          if (hasAnyDisabled) {
            const filteredUpdated: Record<string, unknown> = {};
            filterDisabledInto(updatedVariants, filteredUpdated);
            Object.assign(nextResolved, filteredUpdated);
          } else {
            Object.assign(nextResolved, updatedVariants);
          }
          workingResolved = nextResolved;
        }
      }

      return {
        workingResolved,
        changedVariants,
        classes: cClasses,
        style: cStyle,
      };
    };

    // Core compute path. Called both for top-level rendering (via
    // `computeResult`) and recursively when this component is used as an
    // `extend` target by another component. Pushes variant classes (excluding
    // base class) into `classesOut` and merges styles into `styleOut`.
    const computeOnce: ComputeFn = (
      resolved,
      userVariantProps,
      skipKeys,
      skipValues,
      classesOut,
      styleOut,
      runState,
      protectedVariants,
      pendingProtectedVariants,
      protectedVariantKeys,
      defaultResolved = resolved,
      renderOnly = false,
    ) => {
      let workingResolved = resolved;
      let cClasses: ClassValue[] | null = null;
      let cStyle: StyleValue | null = null;
      let changedVariants: Record<string, unknown> | null = null;

      // Run extends' contributions first (their full classes + styles) so our
      // own base style and variants apply on top, matching the original
      // ext1 → ext2 → … → current ordering.
      if (hasExtend) {
        // Build skip sets to pass to extends. Reuse precomputed values when no
        // caller-provided sets need merging.
        let extSkipKeys: Set<string> | null;
        if (skipKeys === null) {
          extSkipKeys = staticExtSkipKeys;
        } else if (staticExtSkipKeys === null) {
          extSkipKeys = skipKeys;
        } else {
          extSkipKeys = new Set(skipKeys);
          for (const k of staticExtSkipKeys) {
            extSkipKeys.add(k);
          }
        }

        let extSkipVals: Record<string, Set<string>> | null;
        if (skipValues === null) {
          extSkipVals = staticExtSkipValues;
        } else if (staticExtSkipValues === null) {
          extSkipVals = skipValues;
        } else {
          extSkipVals = {};
          for (const k in skipValues) {
            extSkipVals[k] = skipValues[k];
          }
          for (const k in staticExtSkipValues) {
            const existing = extSkipVals[k];
            if (existing) {
              const merged = new Set<string>(existing);
              for (const v of staticExtSkipValues[k]) {
                merged.add(v);
              }
              extSkipVals[k] = merged;
            } else {
              extSkipVals[k] = staticExtSkipValues[k];
            }
          }
        }

        const extUserVariantProps =
          extMetasWithRefineCount > 0
            ? getExtUserVariantProps(
                userVariantProps,
                protectedVariants ?? null,
                changedVariants,
              )
            : userVariantProps;
        for (let i = 0; i < extCount; i++) {
          if (hasIsolatedExt && extIsolated[i]) {
            // Isolated extend (different factory): gather its variant classes
            // into a scratch array, then push the joined string after applying
            // its own transformClass. Our outer transform applies on top.
            const extClasses: ClassValue[] = [];
            workingResolved = extMetas[i].compute(
              workingResolved,
              extUserVariantProps,
              extSkipKeys,
              extSkipVals,
              extClasses,
              styleOut,
              runState,
              protectedVariants,
              pendingProtectedVariants,
              protectedVariantKeys,
              defaultResolved,
              renderOnly,
            );
            if (extClasses.length > 0) {
              const joined = joinClass(extClasses);
              if (joined.length > 0) {
                classesOut.push(extMetas[i].transformClass(joined));
              }
            }
          } else {
            workingResolved = extMetas[i].compute(
              workingResolved,
              extUserVariantProps,
              extSkipKeys,
              extSkipVals,
              classesOut,
              styleOut,
              runState,
              protectedVariants,
              pendingProtectedVariants,
              protectedVariantKeys,
              defaultResolved,
              renderOnly,
            );
          }
          workingResolved = filterOwnDisabledVariants(
            workingResolved,
            defaultResolved,
          );
          // Only sync protected variants when a child refine resolver can
          // observe them. Otherwise extUserVariantProps may alias caller props.
          if (protectedVariants && extMetasWithRefineCount > 0) {
            Object.assign(extUserVariantProps, protectedVariants);
          }
        }
      }

      // Run own computed defaults after extended components so defaults resolve
      // from base to child. They still run before this component's `refine`.
      if (!renderOnly && computedDefaultCount > 0) {
        const computedResult = runComputedDefaults(
          workingResolved,
          defaultResolved,
          userVariantProps,
          true,
          protectedVariantKeys,
        );
        workingResolved = computedResult.workingResolved;
        changedVariants = computedResult.changedVariants;
      }

      // Run own `refine` (if any). May modify resolved variants and emit
      // classes and styles that are applied after this component's variants.
      if (refine) {
        const refineResult = runRefineContext(
          workingResolved,
          userVariantProps,
          true,
          true,
          !renderOnly,
          protectedVariants,
          pendingProtectedVariants,
          protectedVariantKeys,
        );
        workingResolved = refineResult.workingResolved;
        cClasses = refineResult.classes;
        cStyle = refineResult.style;
        if (refineResult.changedVariants) {
          changedVariants ??= {};
          Object.assign(changedVariants, refineResult.changedVariants);
        }
      }

      // Apply own base style (after extends' styles, matching original order).
      if (hasBaseStyle) {
        Object.assign(styleOut, baseStyle);
      }

      // Apply own variants. Skip keys/values come from caller (e.g., parent
      // wants its own function variant to override this variant).
      // `variantEntryNames` already excludes disabled keys (those with `null`
      // value in config) and function variants, so we don't re-check
      // `disabledVariantKeys` here.
      const ownSkipKeys = skipKeys;
      const ownSkipValues = skipValues;
      for (let i = 0; i < variantEntryCount; i++) {
        const variantName = variantEntryNames[i];
        if (ownSkipKeys && ownSkipKeys.has(variantName)) continue;
        const selectedValue = workingResolved[variantName];
        if (selectedValue === undefined) continue;
        const selectedKey = getVariantValueKey(selectedValue);
        const variant = variantEntryDefs[i];
        if (
          variant.disabledValues &&
          selectedKey != null &&
          variant.disabledValues.has(selectedKey)
        ) {
          continue;
        }
        if (
          ownSkipValues &&
          selectedKey != null &&
          ownSkipValues[variantName]?.has(selectedKey)
        ) {
          continue;
        }

        if (variant.values) {
          if (selectedKey == null) continue;
          const v = variant.values[selectedKey];
          if (!v) continue;
          if (v.class != null) {
            classesOut.push(v.class);
          }
          if (v.style) {
            Object.assign(styleOut, v.style);
          }
        } else if (variant.shorthand && selectedValue === true) {
          const v = variant.shorthand;
          if (v.class != null) {
            classesOut.push(v.class);
          }
          if (v.style) {
            Object.assign(styleOut, v.style);
          }
        }
      }

      // Apply function variants — entries in `variants` whose value is a
      // function. They run after static variants and override any same-key
      // inherited variant via `staticExtSkipKeys`.
      for (let i = 0; i < functionVariantCount; i++) {
        const variantName = functionVariantNames[i];
        if (ownSkipKeys && ownSkipKeys.has(variantName)) continue;
        const selectedValue = workingResolved[variantName];
        if (selectedValue === undefined) continue;
        const selectedKey = getVariantValueKey(selectedValue);
        if (
          ownSkipValues &&
          selectedKey != null &&
          ownSkipValues[variantName]?.has(selectedKey)
        ) {
          continue;
        }
        const fn = functionVariantFns[i];
        const computedResult = fn(selectedValue);
        if (computedResult == null) continue;
        const r = extractClassAndStylePrebuilt(computedResult);
        if (r.class != null) {
          classesOut.push(r.class);
        }
        if (r.style) {
          Object.assign(styleOut, r.style);
        }
      }

      // Apply `refine` results — must come after own variants (static and
      // function).
      if (cClasses) {
        for (let i = 0; i < cClasses.length; i++) {
          const className = cClasses[i];
          if (className == null) continue;
          classesOut.push(className);
        }
      }
      if (cStyle) {
        Object.assign(styleOut, cStyle);
      }

      return workingResolved;
    };

    const compute: ComputeFn =
      !refine && computedDefaultCount === 0 && extMetasWithRefineCount === 0
        ? computeOnce
        : (
            resolved,
            userVariantProps,
            skipKeys,
            skipValues,
            classesOut,
            styleOut,
            runState,
            protectedVariants,
            pendingProtectedVariants,
            protectedVariantKeys,
            incomingDefaultResolved = resolved,
            renderOnly = false,
          ) => {
            if (renderOnly) {
              return computeOnce(
                resolved,
                userVariantProps,
                skipKeys,
                skipValues,
                classesOut,
                styleOut,
                runState,
                protectedVariants,
                pendingProtectedVariants,
                protectedVariantKeys,
                incomingDefaultResolved,
                true,
              );
            }
            runState ??= { remaining: MAX_REFINE_RUNS };
            protectedVariants ??= {};
            protectedVariantKeys ??= new Set<string>();
            let workingResolved = resolved;
            // Latest variant changes from non-converging iterations inside the
            // tracking window. Lazy-init keeps convergent loops allocation-free.
            let unstableChanges: Map<string, VariantChange> | null = null;
            let lastClasses: ClassValue[] = [];
            let lastStyle: StyleValue = {};
            let isFirstRun = true;

            while (runState.remaining > 0) {
              runState.remaining -= 1;
              let useDirectOutput = isFirstRun;
              if (useDirectOutput) {
                for (const key in styleOut) {
                  if (Object.hasOwn(styleOut, key)) {
                    useDirectOutput = false;
                    break;
                  }
                }
              }
              const classCount = classesOut.length;
              const nextPendingProtectedVariants: Record<string, unknown> = {};
              const nextClasses: ClassValue[] = useDirectOutput
                ? classesOut
                : [];
              const nextStyle: StyleValue = useDirectOutput ? styleOut : {};
              const defaultResolved = mergeProtectedIntoBase(
                incomingDefaultResolved,
                protectedVariants,
              );
              const nextResolved = computeOnce(
                workingResolved,
                userVariantProps,
                skipKeys,
                skipValues,
                nextClasses,
                nextStyle,
                runState,
                protectedVariants,
                nextPendingProtectedVariants,
                protectedVariantKeys,
                defaultResolved,
              );

              let protectedChanged: boolean;
              if (pendingProtectedVariants) {
                protectedChanged = mergeVariants(
                  pendingProtectedVariants,
                  nextPendingProtectedVariants,
                  protectedVariantKeys,
                );
              } else {
                protectedChanged = mergeVariants(
                  protectedVariants,
                  nextPendingProtectedVariants,
                  protectedVariantKeys,
                );
              }

              if (
                !protectedChanged &&
                (nextResolved === workingResolved ||
                  areVariantsEqual(workingResolved, nextResolved))
              ) {
                if (nextResolved !== workingResolved) {
                  if (useDirectOutput) {
                    classesOut.length = classCount;
                    for (const key in styleOut) {
                      if (Object.hasOwn(styleOut, key)) {
                        Reflect.deleteProperty(styleOut, key);
                      }
                    }
                  }
                  computeOnce(
                    nextResolved,
                    userVariantProps,
                    skipKeys,
                    skipValues,
                    classesOut,
                    styleOut,
                    runState,
                    protectedVariants,
                    null,
                    protectedVariantKeys,
                    defaultResolved,
                    true,
                  );
                } else if (!useDirectOutput) {
                  for (let i = 0; i < nextClasses.length; i++) {
                    classesOut.push(nextClasses[i]);
                  }
                  Object.assign(styleOut, nextStyle);
                }
                return nextResolved;
              }

              if (
                process.env.NODE_ENV !== "production" &&
                runState.remaining < REFINE_UNSTABLE_TRACKING_WINDOW
              ) {
                if (!unstableChanges) {
                  unstableChanges = new Map<string, VariantChange>();
                }
                accumulateUnstableVariantChanges(
                  unstableChanges,
                  workingResolved,
                  nextResolved,
                );
              }

              if (useDirectOutput && runState.remaining === 0) {
                // Keep the direct output from the last allowed run. Rolling
                // back here would drop it before the fallback copy below.
                warnRefineLimit({
                  runState,
                  creationFrame,
                  unstableChanges,
                });
                return nextResolved;
              }

              if (useDirectOutput) {
                classesOut.length = classCount;
                for (const key in styleOut) {
                  if (Object.hasOwn(styleOut, key)) {
                    Reflect.deleteProperty(styleOut, key);
                  }
                }
              } else {
                lastClasses = nextClasses;
                lastStyle = nextStyle;
              }

              workingResolved = nextResolved;
              isFirstRun = false;
            }

            warnRefineLimit({
              runState,
              creationFrame,
              unstableChanges,
            });

            for (let i = 0; i < lastClasses.length; i++) {
              classesOut.push(lastClasses[i]);
            }
            Object.assign(styleOut, lastStyle);
            return workingResolved;
          };

    const resolveRefineOnce: ResolveRefineFn = (
      resolved,
      userVariantProps,
      filterOwnVariants = true,
      runState,
      protectedVariants,
      pendingProtectedVariants,
      protectedVariantKeys,
      defaultResolved = resolved,
    ) => {
      let workingResolved = resolved;
      let changedVariants: Record<string, unknown> | null = null;

      if (extMetasWithRefineCount > 0) {
        const extUserVariantProps = getExtUserVariantProps(
          userVariantProps,
          protectedVariants ?? null,
          changedVariants,
        );
        for (let i = 0; i < extMetasWithRefineCount; i++) {
          const meta = extMetasWithRefine[i];
          const resolveRefine = meta.resolveRefine;
          if (!resolveRefine) continue;
          workingResolved = resolveRefine(
            workingResolved,
            extUserVariantProps,
            true,
            runState,
            protectedVariants,
            pendingProtectedVariants,
            protectedVariantKeys,
            defaultResolved,
          );
          workingResolved = filterOwnDisabledVariants(
            workingResolved,
            defaultResolved,
          );
          if (protectedVariants) {
            Object.assign(extUserVariantProps, protectedVariants);
          }
        }
      }

      if (computedDefaultCount > 0) {
        const computedResult = runComputedDefaults(
          workingResolved,
          defaultResolved,
          userVariantProps,
          filterOwnVariants,
          protectedVariantKeys,
        );
        workingResolved = computedResult.workingResolved;
        changedVariants = computedResult.changedVariants;
      }
      if (refine) {
        const refineResult = runRefineContext(
          workingResolved,
          userVariantProps,
          filterOwnVariants,
          false,
          true,
          protectedVariants,
          pendingProtectedVariants,
          protectedVariantKeys,
        );
        workingResolved = refineResult.workingResolved;
        if (refineResult.changedVariants) {
          changedVariants ??= {};
          Object.assign(changedVariants, refineResult.changedVariants);
        }
      }

      return workingResolved;
    };

    const resolveRefine: ResolveRefineFn | null =
      refine || computedDefaultCount > 0 || extMetasWithRefineCount > 0
        ? (
            resolved,
            userVariantProps,
            filterOwnVariants = true,
            runState,
            protectedVariants,
            pendingProtectedVariants,
            protectedVariantKeys,
            incomingDefaultResolved = resolved,
          ) => {
            runState ??= { remaining: MAX_REFINE_RUNS };
            protectedVariants ??= {};
            protectedVariantKeys ??= new Set<string>();
            let workingResolved = resolved;
            // Latest variant changes from non-converging iterations inside the
            // tracking window. See the compute loop above for the shared
            // rationale.
            let unstableChanges: Map<string, VariantChange> | null = null;
            let reachedLimit = true;

            while (runState.remaining > 0) {
              runState.remaining -= 1;
              const nextPendingProtectedVariants: Record<string, unknown> = {};
              const defaultResolved = mergeProtectedIntoBase(
                incomingDefaultResolved,
                protectedVariants,
              );
              const nextResolved = resolveRefineOnce(
                workingResolved,
                userVariantProps,
                filterOwnVariants,
                runState,
                protectedVariants,
                nextPendingProtectedVariants,
                protectedVariantKeys,
                defaultResolved,
              );
              let protectedChanged: boolean;
              if (pendingProtectedVariants) {
                protectedChanged = mergeVariants(
                  pendingProtectedVariants,
                  nextPendingProtectedVariants,
                  protectedVariantKeys,
                );
              } else {
                protectedChanged = mergeVariants(
                  protectedVariants,
                  nextPendingProtectedVariants,
                  protectedVariantKeys,
                );
              }

              if (
                !protectedChanged &&
                (nextResolved === workingResolved ||
                  areVariantsEqual(workingResolved, nextResolved))
              ) {
                workingResolved = nextResolved;
                reachedLimit = false;
                break;
              }

              if (
                process.env.NODE_ENV !== "production" &&
                runState.remaining < REFINE_UNSTABLE_TRACKING_WINDOW
              ) {
                if (!unstableChanges) {
                  unstableChanges = new Map<string, VariantChange>();
                }
                accumulateUnstableVariantChanges(
                  unstableChanges,
                  workingResolved,
                  nextResolved,
                );
              }
              workingResolved = nextResolved;
            }

            if (reachedLimit) {
              warnRefineLimit({
                runState,
                creationFrame,
                unstableChanges,
              });
            }

            return workingResolved;
          }
        : null;

    // Top-level: resolves variants from user props, calls compute, then
    // assembles className and style with user-provided class/style overrides.
    const computeResult = (
      props: ComponentProps<MergedVariants> = EMPTY_DEFAULTS as ComponentProps<MergedVariants>,
    ): { className: string; style: StyleValue } => {
      const propsRecord = props as Record<string, unknown>;

      let resolved: Record<string, unknown> = {};
      Object.assign(resolved, staticDefaults);

      let userVariantProps: Record<string, unknown>;
      if (refine || computedDefaultCount > 0 || extMetasWithRefineCount > 0) {
        const variantProps: Record<string, unknown> = {};
        for (let i = 0; i < variantKeysLength; i++) {
          const key = variantKeys[i];
          if (Object.hasOwn(propsRecord, key)) {
            variantProps[key] = propsRecord[key];
          }
        }
        for (const k in variantProps) {
          if (!Object.hasOwn(variantProps, k)) continue;
          const v = variantProps[k];
          if (v === undefined) continue;
          resolved[k] = v;
        }
        userVariantProps = variantProps;
      } else {
        // Fast path: walk variantKeys directly against propsRecord. Use
        // Object.hasOwn so a polluted Object.prototype can't introduce variant
        // values the user didn't pass.
        for (let i = 0; i < variantKeysLength; i++) {
          const key = variantKeys[i];
          if (!Object.hasOwn(propsRecord, key)) continue;
          const v = propsRecord[key];
          if (v === undefined) continue;
          resolved[key] = v;
        }
        userVariantProps = propsRecord;
      }

      if (hasAnyDisabled) {
        const filtered: Record<string, unknown> = {};
        filterDisabledInto(resolved, filtered);
        resolved = filtered;
      }

      // Build allClasses directly. computedBaseClass already has all extend
      // bases joined with config.class — `compute` only adds variant classes
      // on top.
      const allClasses: ClassValue[] = [computedBaseClass];
      const style: StyleValue = {};
      compute(resolved, userVariantProps, null, null, allClasses, style);

      // Apply user-provided class / className.
      if ("class" in propsRecord) {
        allClasses.push(propsRecord.class as ClassValue);
      }
      if ("className" in propsRecord) {
        allClasses.push(propsRecord.className as ClassValue);
      }

      // Apply user-provided style.
      const psv = propsRecord.style;
      if (psv != null) {
        if (typeof psv === "string") {
          if (psv.length > 0) {
            Object.assign(style, htmlStyleToStyleValue(psv));
          }
        } else if (typeof psv === "object") {
          // Don't allocate when empty.
          let hasAnyKey = false;
          for (const _ in psv) {
            hasAnyKey = true;
            break;
          }
          if (hasAnyKey) {
            Object.assign(style, normalizeStyle(psv));
          }
        }
      }

      return {
        className: transformClass(joinClass(allClasses)),
        style,
      };
    };

    const getVariants = (variants?: VariantValues<MergedVariants>) => {
      const variantProps = variants ?? EMPTY_DEFAULTS;
      let resolvedVariants = resolveVariantsHot(variantProps);
      if (resolveRefine) {
        resolvedVariants = resolveRefine(resolvedVariants, variantProps, false);
      }
      return resolvedVariants as VariantValues<MergedVariants>;
    };

    // Compute base class (without variants) — includes extended base classes.
    // Plain class join (no `transformClass`): `meta.baseClass` flows back into
    // parent extends as class input and then through the single
    // `transformClass(joinClass(...allClasses))` at render time, so applying
    // it here would compound (double for own-render, triple+ for extend
    // chains) and misbehave for non-idempotent transforms.
    const computedBaseClass = hasExtend
      ? joinClass(...extBaseClassesArr, config.class)
      : joinClass(config.class);

    // Shared closures across the default and modal components.
    const classFn = (props: ComponentProps<MergedVariants> = {}) => {
      return computeResult(props).className;
    };
    const meta: ComponentMeta = {
      baseClass: computedBaseClass,
      staticDefaults,
      compute,
      resolveRefine,
      transformClass,
      functionVariantKeys,
      computedDefaultKeys,
    };

    const initComponent = <
      R extends ComponentResult,
      T extends ModalComponent<MergedVariants, R>,
    >(
      c: T,
      propKeys: string[],
      style: T["style"],
    ): T => {
      c.class = classFn;
      c.style = style;
      c.getVariants = getVariants;
      c.variantKeys = variantKeys;
      c.propKeys = propKeys;
      setComponentMeta(c, meta);
      return c;
    };

    // Default component
    const defaultComponent = ((props: ComponentProps<MergedVariants> = {}) => {
      const { className, style } = computeResult(props);
      return { class: className, style };
    }) as CVComponent<V, E>;
    initComponent(defaultComponent, inputPropsKeys, (props = {}) => {
      return computeResult(props).style;
    });

    // JSX component
    const jsxComponent = ((props: ComponentProps<MergedVariants> = {}) => {
      const { className, style } = computeResult(props);
      return { className, style: styleValueToJSXStyle(style) };
    }) as ModalComponent<MergedVariants, JSXProps>;
    initComponent(
      jsxComponent,
      ["className", "style", ...variantKeys],
      (props = {}) => styleValueToJSXStyle(computeResult(props).style),
    );

    // HTML component
    const htmlComponent = ((props: ComponentProps<MergedVariants> = {}) => {
      const { className, style } = computeResult(props);
      return { class: className, style: styleValueToHTMLStyle(style) };
    }) as ModalComponent<MergedVariants, HTMLProps>;
    initComponent(
      htmlComponent,
      ["class", "style", ...variantKeys],
      (props = {}) => styleValueToHTMLStyle(computeResult(props).style),
    );

    // HTMLObj component
    const htmlObjComponent = ((props: ComponentProps<MergedVariants> = {}) => {
      const { className, style } = computeResult(props);
      return { class: className, style: styleValueToHTMLObjStyle(style) };
    }) as ModalComponent<MergedVariants, HTMLObjProps>;
    initComponent(
      htmlObjComponent,
      ["class", "style", ...variantKeys],
      (props = {}) => styleValueToHTMLObjStyle(computeResult(props).style),
    );

    defaultComponent.jsx = jsxComponent;
    defaultComponent.html = htmlComponent;
    defaultComponent.htmlObj = htmlObjComponent;

    return defaultComponent;
  };

  return { cv, cx };
}

export const { cv, cx } = create();
