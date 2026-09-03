import clsx, { type ClassValue as ClsxClassValue } from "clsx";
import {
  REFINE_UNSTABLE_TRACKING_WINDOW,
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
  KeySourceComponent,
  MergeVariants,
  ModalComponent,
  Refine,
  SplitPropsFunction,
  StyleClassProps,
  StyleClassValue,
  StyleValue,
  VariantValues,
  Variants,
} from "./types.ts";
import {
  getOwn,
  hasOwn,
  htmlObjStyleToStyleValue,
  htmlStyleToStyleValue,
  styleValueToHTMLObjStyle,
  styleValueToHTMLStyle,
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
  classesOut: ClsxClassValue[],
  styleOut: StyleValue,
) => Record<string, unknown>;

type ComputeOnceFn = (
  resolved: Record<string, unknown>,
  userVariantProps: Record<string, unknown>,
  skipKeys: Set<string> | null,
  skipValues: Record<string, Set<string>> | null,
  classesOut: ClsxClassValue[],
  styleOut: StyleValue,
  protection?: RefineProtection | null,
  defaultResolved?: Record<string, unknown>,
  renderOnly?: boolean,
) => Record<string, unknown>;

type ResolveRefineFn = (
  resolved: Record<string, unknown>,
  userVariantProps: Record<string, unknown>,
  filterOwnVariants?: boolean,
) => Record<string, unknown>;

type ResolveRefineOnceFn = (
  resolved: Record<string, unknown>,
  userVariantProps: Record<string, unknown>,
  filterOwnVariants?: boolean,
  protection?: RefineProtection | null,
  defaultResolved?: Record<string, unknown>,
) => Record<string, unknown>;

type ComputedDefaultVariantFn = (
  defaultValue: unknown,
  variants: Readonly<Record<string, unknown>>,
) => unknown;

// Internal metadata stored on components but hidden from public types.
interface ComponentMeta {
  baseClass: string;
  staticDefaults: Record<string, unknown>;
  // Performs a single compute pass for extending components, returning the
  // resolved variants while pushing classes and styles into the output values.
  compute: ComputeOnceFn;
  resolveRefine: ResolveRefineOnceFn | null;
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

const EMPTY_DEFAULTS: Record<string, unknown> = {};

const MAX_REFINE_RUNS = 50;

function areVariantsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  // The first loop proves every own key of `a` is an own key of `b` with the
  // same value, so counting both sides is enough to prove the key sets match.
  // Counting keeps the total number of lookups the same as before the own-key
  // check was added to the first loop.
  let ownKeyDifference = 0;
  for (const key in a) {
    if (!hasOwn(a, key)) continue;
    if (!hasOwn(b, key)) return false;
    if (!Object.is(a[key], b[key])) return false;
    ownKeyDifference++;
  }
  for (const key in b) {
    if (!hasOwn(b, key)) continue;
    ownKeyDifference--;
  }
  return ownKeyDifference === 0;
}

// Variants that a `refine` callback assigned through `setVariants`. Two stages
// read them: computed defaults skip a key that was assigned this way, and
// `mergeProtectedIntoBase` folds them into the base each pass resolves from.
// The record is created on the first `setVariants` call, because most callbacks
// only read variants. The holder is shared so that a callback anywhere in the
// chain can report its assignment back to the resolution that owns the pass.
interface RefineProtection {
  variants: Record<string, unknown> | null;
}

function mergeProtectedIntoBase(
  baseResolved: Record<string, unknown>,
  protection: RefineProtection | null,
): Record<string, unknown> {
  const protectedVariants = protection?.variants;
  if (!protectedVariants) return baseResolved;
  return Object.assign({}, baseResolved, protectedVariants);
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
> = Record<
  VariantKey<NonNullable<VariantProps<T>[K]>>,
  ClassValue | StyleClassValue
>;

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

function identityClass(className: string) {
  return className;
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
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
    return htmlObjStyleToStyleValue(style);
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

function extractClassAndStylePrebuilt(value: unknown): PrebuiltValue {
  if (!isRecordObject(value)) {
    return { class: value as ClassValue, style: null };
  }
  // A value that owns neither key contributes nothing, and a value that owns
  // one of them must not pick up the other from a polluted `Object.prototype`.
  // Checked inline rather than through `getOwn`: this runs for every variant
  // value at creation time, where the call is worth about 3% of `cv()`.
  const styleClassValue = value as StyleClassValue;
  const classValue = hasOwn(value, "class") ? styleClassValue.class : undefined;
  const styleValue = hasOwn(value, "style") ? styleClassValue.style : undefined;
  if (classValue === undefined && styleValue === undefined) {
    return { class: null, style: null };
  }
  const style = normalizeStyle(styleValue);
  return {
    class: classValue ?? null,
    style: Object.keys(style).length > 0 ? style : null,
  };
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

const EMPTY_KEYS: readonly string[] = [];

function isComponentKeySource(source: unknown): source is KeySourceComponent {
  if (!source) return false;
  if (typeof source !== "object" && typeof source !== "function") {
    return false;
  }
  const typed = source as Record<string, unknown>;
  if (typeof typed.getVariants !== "function") return false;
  if (!Array.isArray(typed.propKeys)) return false;
  return Array.isArray(typed.variantKeys);
}

/**
 * Splits props into multiple groups based on key sources. Only the first
 * component claims styling props (class/className/style). Subsequent components
 * only receive variant props. Arrays always receive their listed keys but don't
 * claim styling props.
 */
function splitPropsImpl(
  selfKeys: readonly string[],
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
    if (key !== undefined && hasOwn(props, key)) {
      selfResult[key] = props[key];
    }
  }
  results.push(selfResult);

  // Track effective key arrays for the rest computation — for typical inputs
  // a linear scan beats building a Set up-front.
  const effectiveKeyArrays: Array<readonly string[]> = [selfKeys];

  for (let s = 0; s < sourcesLength; s++) {
    const source = sources[s];
    const sourceResult: Record<string, unknown> = {};
    let sourceIsComponent = false;
    let effectiveKeys: readonly string[];
    if (Array.isArray(source)) {
      effectiveKeys = source;
    } else if (isComponentKeySource(source)) {
      sourceIsComponent = true;
      effectiveKeys = stylingClaimed ? source.variantKeys : source.propKeys;
    } else {
      effectiveKeys = EMPTY_KEYS;
    }

    const effectiveKeysLength = effectiveKeys.length;
    for (let i = 0; i < effectiveKeysLength; i++) {
      const key = effectiveKeys[i];
      if (key !== undefined && hasOwn(props, key)) {
        sourceResult[key] = props[key];
      }
    }
    results.push(sourceResult);
    effectiveKeyArrays.push(effectiveKeys);

    if (sourceIsComponent && !stylingClaimed) {
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
  if (Array.isArray(source1)) {
    return splitPropsImpl(source1, false, props, sources);
  }
  if (isComponentKeySource(source1)) {
    return splitPropsImpl(source1.propKeys, true, props, sources);
  }
  return splitPropsImpl(EMPTY_KEYS, false, props, sources);
}) as SplitPropsFunction;

/**
 * A pre-built variant. Maps variant value keys (or the literal "true"/"false"
 * strings for boolean variants) to PrebuiltValue. Includes a "shorthand"
 * fallback when the variant is a single class value (treated as `{ true: ... }`).
 */
interface PrebuiltVariant {
  // For object variants: map of value -> prebuilt class/style. A Map keeps the
  // lookup keyed by the caller's variant value out of reach of a polluted
  // `Object.prototype`.
  values: Map<string, PrebuiltValue> | null;
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
  const values = new Map<string, PrebuiltValue>();
  let disabledValues: Set<string> | null = null;
  for (const key in variantDef) {
    if (!hasOwn(variantDef, key)) continue;
    const value = variantDef[key];
    if (value === null) {
      if (!disabledValues) {
        disabledValues = new Set<string>();
      }
      disabledValues.add(key);
      continue;
    }
    values.set(key, extractClassAndStylePrebuilt(value));
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
export function create(params: CreateParams = {}) {
  // Destructuring would read an inherited `transformClass`, which a polluted
  // `Object.prototype` could use to rewrite every class string this factory
  // produces, including those of the package-level `cv`.
  const transformClass = getOwn(params, "transformClass") ?? identityClass;

  const cx = (...classes: ClsxClassValue[]) => transformClass(clsx(classes));

  const cv = <V extends Variants = {}, const E extends AnyComponent[] = []>(
    config: CVConfig<V, E> = {},
  ): CVComponent<V, E> => {
    type MergedVariants = MergeVariants<V, E>;

    // ----- Pre-computed at creation time -----
    // Every setting is optional, so each one is read only when the caller owns
    // the key. A plain read would let a polluted `Object.prototype` supply a
    // class, a style, or a refine callback to every component.
    const extend = getOwn(config, "extend");
    const hasExtend = !!extend && extend.length > 0;
    const variants = getOwn(config, "variants");
    const refine = getOwn(config, "refine");
    const baseStyle = getOwn(config, "style");
    const hasBaseStyle = !!baseStyle;
    const baseClass = getOwn(config, "class");

    const variantKeySet = new Set<string>();
    const staticDefaults: Record<string, unknown> = {};

    // Pre-build extended component info, so the render path doesn't need to
    // read component metadata. Extends from a different `create()`
    // factory (different `transformClass` identity) need their contribution
    // transformed by their own `transformClass` before being joined into our
    // class string.
    const extMetas: ComponentMeta[] = [];
    const extBaseClassesArr: string[] = [];
    const extIsolated: boolean[] = [];
    let hasIsolatedExt = false;
    if (hasExtend) {
      for (const ext of extend) {
        const extKeys = ext.variantKeys as readonly string[];
        for (let i = 0; i < extKeys.length; i++) {
          const key = extKeys[i];
          if (key === undefined) continue;
          variantKeySet.add(key);
        }

        const meta = (ext as AnyComponent & ComponentWithMeta)[META_KEY];
        if (!meta) continue;
        extMetas.push(meta);
        Object.assign(staticDefaults, meta.staticDefaults);

        const isolated = meta.transformClass !== transformClass;
        extIsolated.push(isolated);
        if (isolated) {
          hasIsolatedExt = true;
          extBaseClassesArr.push(meta.transformClass(meta.baseClass));
        } else {
          extBaseClassesArr.push(meta.baseClass);
        }
      }
    }
    const extCount = extMetas.length;

    // Build all own variant metadata in one pass. Disabled value sets are
    // shared with their prebuilt variants instead of scanning and allocating
    // them twice.
    const disabledVariantKeys = new Set<string>();
    let disabledValuesBuilder: Record<string, Set<string>> | null = null;
    const variantEntryNames: string[] = [];
    const variantEntryDefs: PrebuiltVariant[] = [];
    const functionVariantNames: string[] = [];
    const functionVariantFns: Array<(value: unknown) => unknown> = [];
    if (variants) {
      for (const name in variants) {
        if (!hasOwn(variants, name)) continue;
        const variant = (variants as Record<string, unknown>)[name];
        if (variant === null) {
          variantKeySet.delete(name);
          disabledVariantKeys.add(name);
          continue;
        }
        variantKeySet.add(name);
        if (typeof variant === "function") {
          functionVariantNames.push(name);
          functionVariantFns.push(variant as (value: unknown) => unknown);
          continue;
        }
        const prebuiltVariant = buildPrebuiltVariant(variant);
        variantEntryNames.push(name);
        variantEntryDefs.push(prebuiltVariant);
        if (prebuiltVariant.disabledValues) {
          disabledValuesBuilder ??= {};
          disabledValuesBuilder[name] = prebuiltVariant.disabledValues;
        }
        if (
          prebuiltVariant.values?.has("false") &&
          !hasOwn(staticDefaults, name)
        ) {
          staticDefaults[name] = false;
        }
      }
    }
    const variantKeys = Array.from(variantKeySet);
    const variantKeysLength = variantKeys.length;
    const variantEntryCount = variantEntryNames.length;
    const functionVariantCount = functionVariantNames.length;
    const hasDisabledVariantKeys = disabledVariantKeys.size > 0;
    // The table is allocated only when a variant declares a disabled value,
    // so its presence is the flag. Capturing it in a `const` lets the closures
    // below narrow it instead of repeating an optional chain.
    const disabledVariantValues = disabledValuesBuilder;
    const hasAnyDisabled =
      hasDisabledVariantKeys || disabledVariantValues !== null;

    const inputPropsKeys = ["class", "className", "style", ...variantKeys];

    const computedDefaultNames: string[] = [];
    const computedDefaultFns: ComputedDefaultVariantFn[] = [];
    const defaultVariants = getOwn(config, "defaultVariants") as
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
    if (defaultVariants) {
      for (const name in defaultVariants) {
        if (!hasOwn(defaultVariants, name)) continue;
        const value = defaultVariants[name];
        if (typeof value === "function") {
          computedDefaultNames.push(name);
          computedDefaultFns.push(value as ComputedDefaultVariantFn);
          continue;
        }
        if (value === undefined) {
          delete staticDefaults[name];
          continue;
        }
        staticDefaults[name] = value;
      }
    }
    const computedDefaultCount = computedDefaultNames.length;
    if (hasAnyDisabled) {
      // Filter disabled variants in-place
      for (const key in staticDefaults) {
        if (!hasOwn(staticDefaults, key)) continue;
        if (disabledVariantKeys.has(key)) {
          delete staticDefaults[key];
          continue;
        }
        if (disabledVariantValues) {
          const value = staticDefaults[key];
          const valueKey = getVariantValueKey(value);
          if (
            valueKey != null &&
            getOwn(disabledVariantValues, key)?.has(valueKey)
          ) {
            delete staticDefaults[key];
          }
        }
      }
    }

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

    // Only a `refine` callback protects variants, through `setVariants`. This
    // over-approximates: `extMetasWithRefineCount` also counts extends that
    // only have computed defaults. Tightening it would mean tracking `refine`
    // separately in `ComponentMeta` to save one allocation. The record inside
    // the holder is created only when a callback assigns something.
    const canProtectVariants = !!refine || extMetasWithRefineCount > 0;

    // `userVariantProps` tells computed defaults which variants the user set
    // explicitly, and `runComputedDefaults` is its only reader anywhere in the
    // chain: a `refine` callback never receives it. `computedDefaultKeys` is
    // transitive, so an empty inherited set proves no extend runs computed
    // defaults either, and nothing reads the record. The record is then the
    // caller's own props object, which no stage may write to.
    const needsUserVariantProps =
      computedDefaultCount > 0 || inheritedComputedDefaultKeys.size > 0;

    // Call-site frame captured at the `cv()` call site so refine-limit warnings
    // can point developers at the component definition. Skipped entirely for
    // components that can never enter the refine loop, and stripped in
    // production via the NODE_ENV guard inside `captureCreationFrame`. The
    // frame is captured at creation time but the underlying `.stack` string is
    // formatted lazily on first access, so component creation stays cheap
    // unless the warning actually fires.
    const canTriggerRefineWarning =
      !!refine || computedDefaultCount > 0 || extMetasWithRefineCount > 0;
    const creationFrame =
      canTriggerRefineWarning && process.env.NODE_ENV !== "production"
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

    // Pre-compute static skip key/value sets to pass to extends. These never
    // change across calls — when caller passes no skip sets, we reuse the same
    // object and avoid Set allocation.
    let staticExtSkipKeys: Set<string> | null = null;
    if (hasDisabledVariantKeys || functionVariantCount > 0) {
      staticExtSkipKeys = new Set<string>();
      for (const k of disabledVariantKeys) {
        staticExtSkipKeys.add(k);
      }
      for (let i = 0; i < functionVariantCount; i++) {
        staticExtSkipKeys.add(functionVariantNames[i]);
      }
    }

    // A static variant in this component replaces an inherited function
    // variant, so the ancestor must skip that key.
    if (variantEntryCount > 0 && extCount > 0) {
      for (let i = 0; i < variantEntryCount; i++) {
        const name = variantEntryNames[i];
        for (let j = 0; j < extCount; j++) {
          if (extMetas[j].functionVariantKeys.has(name)) {
            staticExtSkipKeys ??= new Set<string>();
            staticExtSkipKeys.add(name);
            break;
          }
        }
      }
    }
    // Skip values are passed directly to extends. We can reuse the same object
    // when no caller-provided values need merging.
    const staticExtSkipValues = disabledVariantValues;

    // Callers use this only when disabled keys or values exist.
    function filterDisabledInto(
      input: Record<string, unknown>,
      out: Record<string, unknown>,
    ): void {
      for (const key in input) {
        if (!hasOwn(input, key)) continue;
        if (disabledVariantKeys.has(key)) continue;
        const value = input[key];
        if (disabledVariantValues) {
          const valueKey = getVariantValueKey(value);
          if (
            valueKey != null &&
            getOwn(disabledVariantValues, key)?.has(valueKey)
          ) {
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
      if (disabledVariantValues) {
        const valueKey = getVariantValueKey(value);
        if (
          valueKey != null &&
          getOwn(disabledVariantValues, key)?.has(valueKey)
        ) {
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
        if (!hasOwn(input, key)) continue;
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
        if (!hasOwn(input, key)) continue;
        const value = input[key];
        if (!isOwnDisabledValue(key, value)) {
          filtered[key] = value;
          continue;
        }
        const fallbackValue = getOwn(fallback, key);
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
      const defaults = Object.assign({}, staticDefaults);

      // Apply propsVariants on top (filter undefined).
      for (let i = 0; i < variantKeysLength; i++) {
        const k = variantKeys[i];
        if (!hasOwn(propsVariants, k)) continue;
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
      protection: RefineProtection | null | undefined,
    ): Record<string, unknown> => {
      const protectedVariants = protection?.variants;
      let ownVariants = filterOwnVariants ? null : resolved;
      const getOwnVariants = (): Record<string, unknown> => {
        if (ownVariants) {
          return ownVariants;
        }
        const filteredVariants: Record<string, unknown> = {};
        for (let i = 0; i < variantKeysLength; i++) {
          const key = variantKeys[i];
          if (hasOwn(resolved, key)) {
            filteredVariants[key] = resolved[key];
          }
        }
        ownVariants = filteredVariants;
        return filteredVariants;
      };

      let updatedVariants: Record<string, unknown> | null = null;
      const ensureUpdated = (): Record<string, unknown> => {
        if (updatedVariants) {
          return updatedVariants;
        }
        const updated = Object.assign({}, resolved);
        updatedVariants = updated;
        return updated;
      };

      for (let i = 0; i < computedDefaultCount; i++) {
        const key = computedDefaultNames[i];
        if (hasOwn(userVariantProps, key)) {
          if (userVariantProps[key] !== undefined) continue;
        }
        if (protectedVariants && hasOwn(protectedVariants, key)) continue;

        const variantSnapshot = getOwnVariants();
        const defaultValue = inheritedComputedDefaultKeys.has(key)
          ? getOwn(variantSnapshot, key)
          : getOwn(defaultResolved, key);
        const value = computedDefaultFns[i](defaultValue, variantSnapshot);
        if (hasAnyDisabled) {
          if (disabledVariantKeys.has(key)) continue;
          if (disabledVariantValues) {
            const valueKey = getVariantValueKey(value);
            if (
              valueKey != null &&
              getOwn(disabledVariantValues, key)?.has(valueKey)
            ) {
              continue;
            }
          }
        }

        if (value === undefined) {
          if (!hasOwn(variantSnapshot, key)) continue;
          delete ensureUpdated()[key];
          continue;
        }
        if (Object.is(getOwn(variantSnapshot, key), value)) continue;
        ensureUpdated()[key] = value;
      }

      return updatedVariants ?? resolved;
    };

    const runRefineContext = (
      resolved: Record<string, unknown>,
      filterOwnVariants: boolean,
      collectOutput: boolean,
      applyVariantUpdates: boolean,
      protection: RefineProtection | null | undefined,
    ): {
      workingResolved: Record<string, unknown>;
      classes: ClassValue[] | null;
      style: StyleValue | null;
    } => {
      let workingResolved = resolved;
      let cClasses: ClassValue[] | null = null;
      let cStyle: StyleValue | null = null;

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
            if (hasOwn(resolved, k)) {
              filteredVariants[k] = resolved[k];
            }
          }
          ownVariants = filteredVariants;
        }
        // `updatedVariants`, `localCClasses` and `localCStyle` are created on
        // first use, so a callback that only inspects `variants` allocates
        // none of them. The `setVariants` bookkeeping is inlined for the same
        // reason: helper closures would be allocated on every call, including
        // the calls that never assign anything.
        let updatedVariants: Record<string, unknown> | null = null;
        let localCClasses: ClassValue[] | null = null;
        let localCStyle: StyleValue | null = null;
        const ctx = {
          variants: ownVariants as VariantValues<Record<string, unknown>>,
          setVariants: (
            newVariants: VariantValues<Record<string, unknown>>,
          ) => {
            if (!applyVariantUpdates) {
              return;
            }
            for (const key in newVariants) {
              if (!hasOwn(newVariants, key)) continue;
              // `disabledVariantKeys` is empty unless this component disables a
              // variant, so the lookup replaces a `hasAnyDisabled` branch. The
              // key is checked before the value is read, because reading it can
              // run a caller-defined accessor.
              if (disabledVariantKeys.has(key)) continue;
              const value = (newVariants as Record<string, unknown>)[key];
              if (disabledVariantValues) {
                const valueKey = getVariantValueKey(value);
                if (
                  valueKey != null &&
                  getOwn(disabledVariantValues, key)?.has(valueKey)
                ) {
                  continue;
                }
              }
              if (protection) {
                const protectedVariants = (protection.variants ??= {});
                protectedVariants[key] = value;
              }
              if (
                Object.is(getOwn(updatedVariants ?? ownVariants, key), value)
              ) {
                continue;
              }
              updatedVariants ??= Object.assign({}, ownVariants);
              updatedVariants[key] = value;
            }
          },
          addClass: (className: ClassValue) => {
            if (!collectOutput) return;
            localCClasses ??= [];
            localCClasses.push(className);
          },
          addStyle: (newStyle: StyleValue) => {
            if (!collectOutput) return;
            localCStyle ??= {};
            Object.assign(localCStyle, newStyle);
          },
        };
        const result = refine(ctx);
        if (collectOutput && result != null) {
          const r = extractClassAndStylePrebuilt(result);
          if (r.class != null) {
            localCClasses ??= [];
            localCClasses.push(r.class);
          }
          if (r.style) {
            localCStyle ??= {};
            Object.assign(localCStyle, r.style);
          }
        }
        cClasses = localCClasses;
        cStyle = localCStyle;
        if (updatedVariants) {
          const nextResolved = Object.assign({}, workingResolved);
          if (hasAnyDisabled) {
            filterDisabledInto(updatedVariants, nextResolved);
          } else {
            Object.assign(nextResolved, updatedVariants);
          }
          workingResolved = nextResolved;
        }
      }

      return {
        workingResolved,
        classes: cClasses,
        style: cStyle,
      };
    };

    // Core compute path. Called both for top-level rendering (via
    // `computeResult`) and recursively when this component is used as an
    // `extend` target by another component. Pushes variant classes (excluding
    // base class) into `classesOut` and merges styles into `styleOut`.
    const computeOnce: ComputeOnceFn = (
      resolved,
      userVariantProps,
      skipKeys,
      skipValues,
      classesOut,
      styleOut,
      protection,
      defaultResolved = resolved,
      renderOnly = false,
    ) => {
      let workingResolved = resolved;
      let cClasses: ClassValue[] | null = null;
      let cStyle: StyleValue | null = null;

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
            if (!hasOwn(skipValues, k)) continue;
            extSkipVals[k] = skipValues[k];
          }
          for (const k in staticExtSkipValues) {
            if (!hasOwn(staticExtSkipValues, k)) continue;
            const values = staticExtSkipValues[k];
            const existing = getOwn(extSkipVals, k);
            if (existing) {
              const merged = new Set<string>(existing);
              for (const v of values) {
                merged.add(v);
              }
              extSkipVals[k] = merged;
            } else {
              extSkipVals[k] = values;
            }
          }
        }

        for (let i = 0; i < extCount; i++) {
          if (hasIsolatedExt && extIsolated[i]) {
            // Isolated extend (different factory): gather its variant classes
            // into a scratch array, then push the joined string after applying
            // its own transformClass. Our outer transform applies on top.
            const extClasses: ClsxClassValue[] = [];
            workingResolved = extMetas[i].compute(
              workingResolved,
              userVariantProps,
              extSkipKeys,
              extSkipVals,
              extClasses,
              styleOut,
              protection,
              defaultResolved,
              renderOnly,
            );
            if (extClasses.length > 0) {
              const joined = clsx(extClasses);
              if (joined.length > 0) {
                classesOut.push(extMetas[i].transformClass(joined));
              }
            }
          } else {
            workingResolved = extMetas[i].compute(
              workingResolved,
              userVariantProps,
              extSkipKeys,
              extSkipVals,
              classesOut,
              styleOut,
              protection,
              defaultResolved,
              renderOnly,
            );
          }
          workingResolved = filterOwnDisabledVariants(
            workingResolved,
            defaultResolved,
          );
        }
      }

      // Run own computed defaults after extended components so defaults resolve
      // from base to child. They still run before this component's `refine`.
      if (!renderOnly && computedDefaultCount > 0) {
        workingResolved = runComputedDefaults(
          workingResolved,
          defaultResolved,
          userVariantProps,
          true,
          protection,
        );
      }

      // Run own `refine` (if any). May modify resolved variants and emit
      // classes and styles that are applied after this component's variants.
      if (refine) {
        const refineResult = runRefineContext(
          workingResolved,
          true,
          true,
          !renderOnly,
          protection,
        );
        workingResolved = refineResult.workingResolved;
        cClasses = refineResult.classes;
        cStyle = refineResult.style;
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
        // Read first: an inherited value that could change the output is
        // never `undefined`, so the own-property check only runs for the
        // variants that carry a value.
        const selectedValue = workingResolved[variantName];
        if (selectedValue === undefined) continue;
        if (!hasOwn(workingResolved, variantName)) continue;
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
          getOwn(ownSkipValues, variantName)?.has(selectedKey)
        ) {
          continue;
        }

        let value: PrebuiltValue | null | undefined;
        if (variant.values) {
          if (selectedKey == null) continue;
          value = variant.values.get(selectedKey);
        } else if (selectedValue === true) {
          value = variant.shorthand;
        }
        if (!value) continue;
        if (value.class != null) {
          classesOut.push(value.class);
        }
        if (value.style) {
          Object.assign(styleOut, value.style);
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
        if (!hasOwn(workingResolved, variantName)) continue;
        const selectedKey = getVariantValueKey(selectedValue);
        if (
          ownSkipValues &&
          selectedKey != null &&
          getOwn(ownSkipValues, variantName)?.has(selectedKey)
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
          classesOut.push(cClasses[i] as ClsxClassValue);
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
          ) => {
            let remaining = MAX_REFINE_RUNS;
            const protection: RefineProtection | null = canProtectVariants
              ? { variants: null }
              : null;
            const incomingDefaultResolved = resolved;
            let workingResolved = resolved;
            // Latest variant changes from non-converging iterations inside the
            // tracking window. Lazy-init keeps convergent loops allocation-free.
            let unstableChanges: Map<string, VariantChange> | null = null;
            let lastClasses: ClsxClassValue[] = [];
            let lastStyle: StyleValue = {};
            let isFirstRun = true;

            while (remaining > 0) {
              remaining -= 1;
              const useDirectOutput = isFirstRun;
              const classCount = classesOut.length;
              const nextClasses: ClsxClassValue[] = useDirectOutput
                ? classesOut
                : [];
              const nextStyle: StyleValue = useDirectOutput ? styleOut : {};
              const defaultResolved = mergeProtectedIntoBase(
                incomingDefaultResolved,
                protection,
              );
              const nextResolved = computeOnce(
                workingResolved,
                userVariantProps,
                skipKeys,
                skipValues,
                nextClasses,
                nextStyle,
                protection,
                defaultResolved,
              );

              if (
                nextResolved === workingResolved ||
                areVariantsEqual(workingResolved, nextResolved)
              ) {
                if (nextResolved !== workingResolved) {
                  if (useDirectOutput) {
                    classesOut.length = classCount;
                    for (const key in styleOut) {
                      if (hasOwn(styleOut, key)) {
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
                    protection,
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
                remaining < REFINE_UNSTABLE_TRACKING_WINDOW
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

              if (useDirectOutput) {
                classesOut.length = classCount;
                for (const key in styleOut) {
                  if (hasOwn(styleOut, key)) {
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

            if (process.env.NODE_ENV !== "production") {
              warnRefineLimit({
                creationFrame,
                unstableChanges,
              });
            }

            for (let i = 0; i < lastClasses.length; i++) {
              classesOut.push(lastClasses[i]);
            }
            Object.assign(styleOut, lastStyle);
            return workingResolved;
          };

    const resolveRefineOnce: ResolveRefineOnceFn = (
      resolved,
      userVariantProps,
      filterOwnVariants = true,
      protection,
      defaultResolved = resolved,
    ) => {
      let workingResolved = resolved;

      for (let i = 0; i < extMetasWithRefineCount; i++) {
        const meta = extMetasWithRefine[i];
        const resolveRefine = meta.resolveRefine;
        if (!resolveRefine) continue;
        workingResolved = resolveRefine(
          workingResolved,
          userVariantProps,
          true,
          protection,
          defaultResolved,
        );
        workingResolved = filterOwnDisabledVariants(
          workingResolved,
          defaultResolved,
        );
      }

      if (computedDefaultCount > 0) {
        workingResolved = runComputedDefaults(
          workingResolved,
          defaultResolved,
          userVariantProps,
          filterOwnVariants,
          protection,
        );
      }
      if (refine) {
        const refineResult = runRefineContext(
          workingResolved,
          filterOwnVariants,
          false,
          true,
          protection,
        );
        workingResolved = refineResult.workingResolved;
      }

      return workingResolved;
    };

    const resolveRefine: ResolveRefineFn | null =
      refine || computedDefaultCount > 0 || extMetasWithRefineCount > 0
        ? (resolved, userVariantProps, filterOwnVariants = true) => {
            let remaining = MAX_REFINE_RUNS;
            const protection: RefineProtection | null = canProtectVariants
              ? { variants: null }
              : null;
            const incomingDefaultResolved = resolved;
            let workingResolved = resolved;
            // Latest variant changes from non-converging iterations inside the
            // tracking window. See the compute loop above for the shared
            // rationale.
            let unstableChanges: Map<string, VariantChange> | null = null;

            while (remaining > 0) {
              remaining -= 1;
              const defaultResolved = mergeProtectedIntoBase(
                incomingDefaultResolved,
                protection,
              );
              const nextResolved = resolveRefineOnce(
                workingResolved,
                userVariantProps,
                filterOwnVariants,
                protection,
                defaultResolved,
              );

              if (
                nextResolved === workingResolved ||
                areVariantsEqual(workingResolved, nextResolved)
              ) {
                return nextResolved;
              }

              if (
                process.env.NODE_ENV !== "production" &&
                remaining < REFINE_UNSTABLE_TRACKING_WINDOW
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

            if (process.env.NODE_ENV !== "production") {
              warnRefineLimit({
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
      if (needsUserVariantProps) {
        const variantProps: Record<string, unknown> = {};
        for (let i = 0; i < variantKeysLength; i++) {
          const key = variantKeys[i];
          if (!hasOwn(propsRecord, key)) continue;
          const value = propsRecord[key];
          variantProps[key] = value;
          if (value === undefined) continue;
          resolved[key] = value;
        }
        userVariantProps = variantProps;
      } else {
        // Fast path: walk variantKeys directly against propsRecord.
        // Own-property checks ensure a polluted Object.prototype can't add
        // values the user didn't pass.
        for (let i = 0; i < variantKeysLength; i++) {
          const key = variantKeys[i];
          if (!hasOwn(propsRecord, key)) continue;
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
      const allClasses: ClsxClassValue[] = [computedBaseClass];
      const style: StyleValue = {};
      compute(resolved, userVariantProps, null, null, allClasses, style);

      // Apply user-provided class / className. Own-property checks keep these
      // consistent with the variant props read above: only what the caller
      // passed is applied, never a key inherited from Object.prototype.
      if (hasOwn(propsRecord, "class")) {
        allClasses.push(propsRecord.class as ClsxClassValue);
      }
      if (hasOwn(propsRecord, "className")) {
        allClasses.push(propsRecord.className as ClsxClassValue);
      }

      // Apply user-provided style, read before the own-property check for the
      // same reason as the variant loops above.
      const psv = propsRecord.style;
      if (psv != null && hasOwn(propsRecord, "style")) {
        if (typeof psv === "string") {
          if (psv.length > 0) {
            htmlStyleToStyleValue(psv, style);
          }
        } else if (typeof psv === "object") {
          htmlObjStyleToStyleValue(psv, style);
        }
      }

      return {
        className: transformClass(clsx(allClasses)),
        style,
      };
    };

    const getVariants = (variants?: VariantValues<MergedVariants>) => {
      const variantsRecord = variants ?? EMPTY_DEFAULTS;
      let variantProps = variantsRecord;
      // Copy to the declared variant keys, so the computed defaults that read
      // this record cannot see an undeclared key as an explicitly passed
      // variant, and cannot re-run a caller accessor once per refine pass. The
      // gate is narrower than that purpose: it misses a chain whose only
      // computed default is this component's own.
      // See https://github.com/ariakit/clava/issues/494
      if (variants && extMetasWithRefineCount > 0) {
        variantProps = {};
        for (let i = 0; i < variantKeysLength; i++) {
          const key = variantKeys[i];
          if (hasOwn(variantsRecord, key)) {
            variantProps[key] = variantsRecord[key];
          }
        }
      }
      let resolvedVariants = resolveVariantsHot(variantProps);
      if (resolveRefine) {
        resolvedVariants = resolveRefine(resolvedVariants, variantProps, false);
      }
      return resolvedVariants as VariantValues<MergedVariants>;
    };

    // Compute base class (without variants) — includes extended base classes.
    // Plain `clsx` (no `transformClass`): `meta.baseClass` flows back into
    // parent extends as `clsx` input and then through the single
    // `transformClass(clsx(allClasses))` at render time, so applying it here
    // would compound (double for own-render, triple+ for extend chains) and
    // misbehave for non-idempotent transforms.
    const computedBaseClass = hasExtend
      ? clsx(extBaseClassesArr, baseClass as ClsxClassValue)
      : clsx(baseClass as ClsxClassValue);

    // Shared closures across the default and modal components.
    const classFn = (props: ComponentProps<MergedVariants> = {}) => {
      return computeResult(props).className;
    };
    const meta: ComponentMeta = {
      baseClass: computedBaseClass,
      staticDefaults,
      compute: computeOnce,
      resolveRefine: resolveRefine ? resolveRefineOnce : null,
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
      (c as AnyComponent & ComponentWithMeta)[META_KEY] = meta;
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
      return { className, style };
    }) as ModalComponent<MergedVariants, JSXProps>;
    initComponent(
      jsxComponent,
      ["className", "style", ...variantKeys],
      (props = {}) => computeResult(props).style,
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

export const cv = /* @__PURE__ */ (() => create().cv)();

/**
 * Joins class values without applying a class transform.
 *
 * This behaves like the `cx` function returned by `create()` with no options.
 */
export function cx(...classes: ClsxClassValue[]) {
  return clsx(classes);
}
