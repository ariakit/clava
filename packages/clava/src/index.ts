import clsx, { type ClassValue as ClsxClassValue } from "clsx";
import type {
  AnyComponent,
  CVComponent,
  ClassValue,
  ComponentProps,
  ComponentResult,
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
  runState?: RefineRunState,
  protectedVariants?: Record<string, unknown> | null,
  pendingProtectedVariants?: Record<string, unknown> | null,
  protectedVariantKeys?: Set<string> | null,
) => Record<string, unknown>;

type ResolveRefineFn = (
  resolved: Record<string, unknown>,
  userVariantProps: Record<string, unknown>,
  filterOwnVariants?: boolean,
  runState?: RefineRunState,
  protectedVariants?: Record<string, unknown> | null,
  pendingProtectedVariants?: Record<string, unknown> | null,
  protectedVariantKeys?: Set<string> | null,
) => Record<string, unknown>;

interface RefineRunState {
  remaining: number;
  warned: boolean;
}

// Internal metadata stored on components but hidden from public types.
interface ComponentMeta {
  baseClass: string;
  staticDefaults: Record<string, unknown>;
  // Returns variants set via setDefaultVariants in the refine function chain.
  // null when this component has no resolveDefaults work to do (no `refine`
  // and no extends with work).
  resolveDefaults:
    | ((
        childDefaults: Record<string, unknown>,
        userProps?: Record<string, unknown>,
      ) => Record<string, unknown>)
    | null;
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
}

const META_KEY = "__meta";

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

interface CreationFrame {
  stack?: string;
}

// Captures the call site of the function passed in `skipFn` so refine-limit
// warnings can point developers at the originating `cv()` call. Returns
// `undefined` in production so bundlers that replace `process.env.NODE_ENV` at
// build time can drop the entire warning machinery. The underlying `.stack`
// string is formatted lazily on first access in every major engine (V8,
// SpiderMonkey, JavaScriptCore), so holding the captured frame for the
// lifetime of the component is cheap when no warning fires.
function captureCreationFrame(skipFn: Function): CreationFrame | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  if (typeof Error.captureStackTrace === "function") {
    const holder: CreationFrame = {};
    Error.captureStackTrace(holder, skipFn);
    return holder;
  }
  // Engines without `Error.captureStackTrace` (SpiderMonkey, JavaScriptCore)
  // can't strip internal frames, but their `Error.stack` getter is still
  // lazy, so returning the Error instance defers the format cost. The
  // resulting trace includes 1–2 extra frames at the top from this helper and
  // `cv` itself.
  return new Error();
}

function formatCreationStack(frame: CreationFrame): string | undefined {
  let stack = frame.stack;
  if (!stack) return undefined;
  // V8 prefixes the stack with a leading "Error" / "Error: message" line that
  // isn't meaningful for a captured location — drop it.
  const newlineIdx = stack.indexOf("\n");
  if (newlineIdx > 0) {
    const firstLine = stack.slice(0, newlineIdx);
    if (firstLine === "Error" || firstLine.startsWith("Error:")) {
      stack = stack.slice(newlineIdx + 1);
    }
  }
  return stack;
}

function collectUnstableVariantKeys(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): string[] {
  const keys: string[] = [];
  for (const key in next) {
    if (!Object.hasOwn(next, key)) continue;
    if (!Object.is(prev[key], next[key])) keys.push(key);
  }
  for (const key in prev) {
    if (!Object.hasOwn(prev, key)) continue;
    if (Object.hasOwn(next, key)) continue;
    keys.push(key);
  }
  return keys;
}

function warnRefineLimit(
  runState: RefineRunState,
  creationFrame: CreationFrame | undefined,
  priorResolved: Record<string, unknown>,
  nextResolved: Record<string, unknown>,
): void {
  if (runState.warned) return;
  runState.warned = true;
  if (process.env.NODE_ENV !== "production") {
    let message =
      "Clava: Maximum refine iterations exceeded. This can happen when a " +
      "refine callback calls setVariants or setDefaultVariants, but one " +
      "of the variants changes on every run.";
    const unstableKeys = collectUnstableVariantKeys(
      priorResolved,
      nextResolved,
    );
    if (unstableKeys.length > 0) {
      message += `\nVariant(s) that did not stabilize: ${unstableKeys.join(", ")}.`;
    }
    if (creationFrame) {
      const creationStack = formatCreationStack(creationFrame);
      if (creationStack) {
        message += `\nComponent created at:\n${creationStack}`;
      }
    }
    console.warn(message);
  }
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
      if (!Object.is(target[key], value)) changed = true;
      target[key] = value;
    }
    return changed;
  }
  for (const key in source) {
    if (!Object.hasOwn(source, key)) continue;
    if (skipKeys.has(key)) continue;
    const value = source[key];
    if (!Object.is(target[key], value)) changed = true;
    target[key] = value;
  }
  return changed;
}

// Dynamic property access on function requires cast through unknown.
function getComponentMeta(component: AnyComponent): ComponentMeta | undefined {
  return (component as unknown as Record<string, unknown>)[META_KEY] as
    | ComponentMeta
    | undefined;
}

function setComponentMeta(component: AnyComponent, meta: ComponentMeta): void {
  (component as unknown as Record<string, unknown>)[META_KEY] = meta;
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
  E extends AnyComponent[] = [],
> {
  extend?: E;
  class?: ClassValue;
  style?: StyleValue;
  variants?: ExtendableVariants<V, E>;
  defaultVariants?: VariantValues<MergeVariants<V, E>>;
  refine?: Refine<MergeVariants<V, E>>;
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
  config: CVConfig<Variants, AnyComponent[]>,
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
      if (!Object.hasOwn(config.variants, key)) continue;
      const variant = (config.variants as Record<string, unknown>)[key];
      if (variant === null) {
        keys.delete(key);
        continue;
      }
      keys.add(key);
    }
  }

  return Array.from(keys);
}

function isVariantDisabled(
  config: CVConfig<Variants, AnyComponent[]>,
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
  config: CVConfig<Variants, AnyComponent[]>,
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
  config: CVConfig<Variants, AnyComponent[]>,
): Set<string> {
  const keys = new Set<string>();
  if (!config.variants) return keys;
  for (const key in config.variants) {
    if (!Object.hasOwn(config.variants, key)) continue;
    if ((config.variants as Record<string, unknown>)[key] === null) {
      keys.add(key);
    }
  }
  return keys;
}

function collectDisabledVariantValues(
  config: CVConfig<Variants, AnyComponent[]>,
): Record<string, Set<string>> {
  const values: Record<string, Set<string>> = {};
  if (!config.variants) return values;
  for (const key in config.variants) {
    if (!Object.hasOwn(config.variants, key)) continue;
    const variant = (config.variants as Record<string, unknown>)[key];
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

  if (!source) return EMPTY_SOURCE;
  if (typeof source !== "object" && typeof source !== "function") {
    return EMPTY_SOURCE;
  }
  const typed = source as Record<string, unknown>;
  if (typeof typed.getVariants !== "function") return EMPTY_SOURCE;
  if (!Array.isArray(typed.propKeys)) return EMPTY_SOURCE;
  if (!Array.isArray(typed.variantKeys)) return EMPTY_SOURCE;

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
  };
}

/**
 * Creates the cv and cx functions.
 */
export function create({
  transformClass = (className) => className,
}: CreateParams = {}) {
  const cx = (...classes: ClsxClassValue[]) => transformClass(clsx(...classes));

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
    if (config.defaultVariants) {
      Object.assign(staticDefaults, config.defaultVariants);
    }
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
    // class string — otherwise our outer `transformClass(clsx(allClasses))`
    // would be the only transform that runs, and the extend's factory would
    // be silently bypassed for any base coming from `extend: [otherFactoryCv]`.
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

    // Filter to only extends with refine work in their chain. `resolveDefaults`
    // and `resolveRefine` are populated from the same transitive condition,
    // so one bucket is enough for both resolver paths.
    const extMetasWithRefine: ComponentMeta[] = [];
    for (let i = 0; i < extCount; i++) {
      const meta = extMetas[i];
      if (meta.resolveDefaults) {
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
    const canTriggerRefineWarning = !!refine || extMetasWithRefineCount > 0;
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
      for (const k of disabledVariantKeys) staticExtSkipKeys.add(k);
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
          if (Object.hasOwn(input, key)) out[key] = input[key];
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

    // Pre-create resolveDefaults function — used by parents during their
    // `resolveVariantsHot`. Returns the variants set via setDefaultVariants in
    // the refine function chain.
    //
    // When this component has no `refine` and no `extend` with work, the
    // function is null — callers can skip iterating it entirely.
    const resolveDefaultsFn: ComponentMeta["resolveDefaults"] =
      refine || extMetasWithRefineCount > 0
        ? (
            childDefaults: Record<string, unknown>,
            userProps: Record<string, unknown> = EMPTY_DEFAULTS,
          ) => {
            // userProps is contractually variant-only (callers pre-filter
            // when starting from a full props object).
            const resolvedVariants: Record<string, unknown> = {};
            Object.assign(resolvedVariants, staticDefaults);
            for (const key in childDefaults) {
              if (!Object.hasOwn(childDefaults, key)) continue;
              const v = childDefaults[key];
              if (v === undefined) continue;
              resolvedVariants[key] = v;
            }
            for (const key in userProps) {
              if (!Object.hasOwn(userProps, key)) continue;
              const v = userProps[key];
              if (v === undefined) continue;
              resolvedVariants[key] = v;
            }

            const refineDefaults: Record<string, unknown> = {};

            for (let i = 0; i < extMetasWithRefineCount; i++) {
              const extDefaults = extMetasWithRefine[i].resolveDefaults!(
                childDefaults,
                userProps,
              );
              for (const k in extDefaults) {
                if (!Object.hasOwn(extDefaults, k)) continue;
                refineDefaults[k] = extDefaults[k];
              }
            }

            if (refine) {
              // Filter to own variant keys so `ctx.variants` matches
              // `VariantValues<V>` when this component is used as an extend by
              // a parent that adds extra variant keys (those keys would
              // otherwise leak through `userProps`).
              const ownVariants: Record<string, unknown> = {};
              for (let i = 0; i < variantKeysLength; i++) {
                const k = variantKeys[i];
                if (Object.hasOwn(resolvedVariants, k)) {
                  ownVariants[k] = resolvedVariants[k];
                }
              }
              refine({
                variants: ownVariants as VariantValues<Record<string, unknown>>,
                setVariants: noop,
                setDefaultVariants: (newDefaults) => {
                  for (const key in newDefaults) {
                    if (!Object.hasOwn(newDefaults, key)) continue;
                    const value = (newDefaults as Record<string, unknown>)[key];
                    if (userProps[key] !== undefined) continue;
                    if (isVariantDisabled(config, key)) continue;
                    if (isVariantValueDisabled(config, key, value)) continue;
                    refineDefaults[key] = value;
                  }
                },
                addClass: noop,
                addStyle: noop,
              });
            }

            return refineDefaults;
          }
        : null;

    // Hot path: resolve variants by merging static defaults + extends'
    // refine defaults + user-provided props.
    function resolveVariantsHot(
      propsVariants: Record<string, unknown>,
    ): Record<string, unknown> {
      // Start with static defaults
      const defaults: Record<string, unknown> = {};
      Object.assign(defaults, staticDefaults);

      // Apply refine defaults from extended components (only those that have
      // actual work to do).
      for (let i = 0; i < extMetasWithRefineCount; i++) {
        const meta = extMetasWithRefine[i];
        const extDefaults = meta.resolveDefaults!(defaults, propsVariants);
        for (const k in extDefaults) {
          if (!Object.hasOwn(extDefaults, k)) continue;
          defaults[k] = extDefaults[k];
        }
      }

      // Apply propsVariants on top (filter undefined). propsVariants is
      // contractually variant-only here — callers building from a full props
      // object filter to variant keys before calling.
      for (const k in propsVariants) {
        if (!Object.hasOwn(propsVariants, k)) continue;
        const v = propsVariants[k];
        if (v === undefined) continue;
        defaults[k] = v;
      }

      if (!hasAnyDisabled) return defaults;

      // Filter disabled
      const result: Record<string, unknown> = {};
      filterDisabledInto(defaults, result);
      return result;
    }

    const runRefineContext = (
      resolved: Record<string, unknown>,
      userVariantProps: Record<string, unknown>,
      filterOwnVariants: boolean,
      collectOutput: boolean,
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
            if (Object.hasOwn(resolved, k)) filteredVariants[k] = resolved[k];
          }
          ownVariants = filteredVariants;
        }
        // Lazy-init updatedVariants — many refine callbacks only inspect
        // `variants` or call setDefaultVariants for keys the user already set,
        // so the copy is unnecessary in the common case.
        let updatedVariants: Record<string, unknown> | null = null;
        const localCClasses: ClassValue[] | null = collectOutput ? [] : null;
        let localCStyle: StyleValue | null = null;
        const ensureUpdated = (): Record<string, unknown> => {
          if (updatedVariants) return updatedVariants;
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
            if (!changedVariants) changedVariants = {};
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
            if (!hasAnyDisabled) {
              for (const key in newVariants) {
                if (!Object.hasOwn(newVariants, key)) continue;
                const value = (newVariants as Record<string, unknown>)[key];
                setChangedVariant(key, value, true);
                if (getCurrentVariantValue(key) === value) continue;
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
              if (getCurrentVariantValue(key) === value) continue;
              ensureUpdated()[key] = value;
            }
          },
          setDefaultVariants: (
            newDefaults: VariantValues<Record<string, unknown>>,
          ) => {
            for (const key in newDefaults) {
              if (!Object.hasOwn(newDefaults, key)) continue;
              if (userVariantProps[key] !== undefined) continue;
              if (protectedVariantKeys?.has(key)) continue;
              const value = (newDefaults as Record<string, unknown>)[key];
              if (hasAnyDisabled) {
                if (disabledVariantKeys.has(key)) continue;
                const valueKey = getVariantValueKey(value);
                if (
                  valueKey != null &&
                  disabledVariantValues[key]?.has(valueKey)
                ) {
                  continue;
                }
              }
              setChangedVariant(key, value);
              if (pendingProtectedVariants) {
                pendingProtectedVariants[key] = value;
              }
              if (getCurrentVariantValue(key) === value) continue;
              ensureUpdated()[key] = value;
            }
          },
          addClass: (className: ClassValue) => {
            localCClasses?.push(className);
          },
          addStyle: (newStyle: StyleValue) => {
            if (!collectOutput) return;
            if (!localCStyle) localCStyle = {};
            Object.assign(localCStyle, newStyle);
          },
        };
        const result = refine(ctx);
        if (collectOutput && result != null) {
          const r = extractClassAndStylePrebuilt(result);
          if (r.class != null) localCClasses?.push(r.class);
          if (r.style) {
            if (!localCStyle) localCStyle = {};
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
    ) => {
      // Run `refine` (if any). May modify resolved variants and emit classes
      // and styles.
      let workingResolved = resolved;
      let cClasses: ClassValue[] | null = null;
      let cStyle: StyleValue | null = null;
      let changedVariants: Record<string, unknown> | null = null;
      if (refine) {
        const refineResult = runRefineContext(
          resolved,
          userVariantProps,
          true,
          true,
          protectedVariants,
          pendingProtectedVariants,
          protectedVariantKeys,
        );
        workingResolved = refineResult.workingResolved;
        cClasses = refineResult.classes;
        cStyle = refineResult.style;
        changedVariants = refineResult.changedVariants;
      }

      // Run extends' contributions first (their full classes + styles) so our
      // own base style and variants apply on top, matching the original
      // ext1 → ext2 → … → current ordering.
      //
      // Pass explicit user values plus refine changes as the extends'
      // `userVariantProps`. This lets more-specific refine decisions stick
      // across re-runs while inherited static defaults can still be refined by
      // the extended component's own refine chain.
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
          for (const k of staticExtSkipKeys) extSkipKeys.add(k);
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
              for (const v of staticExtSkipValues[k]) merged.add(v);
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
            const extClasses: ClsxClassValue[] = [];
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
            );
            if (extClasses.length > 0) {
              const joined = clsx(extClasses);
              if (joined.length > 0) {
                classesOut.push(
                  extMetas[i].transformClass(joined) as ClsxClassValue,
                );
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
            );
          }
          // Only sync protected variants when a child refine resolver can
          // observe them. Otherwise extUserVariantProps may alias caller props.
          if (protectedVariants && extMetasWithRefineCount > 0) {
            Object.assign(extUserVariantProps, protectedVariants);
          }
        }
      }

      // Apply own base style (after extends' styles, matching original order).
      if (hasBaseStyle) Object.assign(styleOut, baseStyle);

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
          if (v.class != null) classesOut.push(v.class as ClsxClassValue);
          if (v.style) Object.assign(styleOut, v.style);
        } else if (variant.shorthand && selectedValue === true) {
          const v = variant.shorthand;
          if (v.class != null) classesOut.push(v.class as ClsxClassValue);
          if (v.style) Object.assign(styleOut, v.style);
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
        if (r.class != null) classesOut.push(r.class as ClsxClassValue);
        if (r.style) Object.assign(styleOut, r.style);
      }

      // Apply `refine` results — must come after own variants (static and
      // function).
      if (cClasses) {
        for (let i = 0; i < cClasses.length; i++) {
          classesOut.push(cClasses[i] as ClsxClassValue);
        }
      }
      if (cStyle) Object.assign(styleOut, cStyle);

      return workingResolved;
    };

    const compute: ComputeFn =
      !refine && extMetasWithRefineCount === 0
        ? (
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
          ) => {
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
            );
          }
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
          ) => {
            runState ??= { remaining: MAX_REFINE_RUNS, warned: false };
            protectedVariants ??= {};
            protectedVariantKeys ??= new Set<string>();
            let workingResolved = resolved;
            // Snapshot of `workingResolved` before each non-converging iteration
            // so the refine-limit warning can diff against the final value and
            // report which variant keys are still changing.
            let priorResolved: Record<string, unknown> = resolved;
            let lastClasses: ClsxClassValue[] = [];
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
              const nextClasses: ClsxClassValue[] = useDirectOutput
                ? classesOut
                : [];
              const nextStyle: StyleValue = useDirectOutput ? styleOut : {};
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
                if (!useDirectOutput) {
                  for (let i = 0; i < nextClasses.length; i++) {
                    classesOut.push(nextClasses[i]);
                  }
                  Object.assign(styleOut, nextStyle);
                }
                return nextResolved;
              }

              if (useDirectOutput && runState.remaining === 0) {
                // Keep the direct output from the last allowed run. Rolling
                // back here would drop it before the fallback copy below.
                warnRefineLimit(
                  runState,
                  creationFrame,
                  workingResolved,
                  nextResolved,
                );
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

              priorResolved = workingResolved;
              workingResolved = nextResolved;
              isFirstRun = false;
            }

            warnRefineLimit(
              runState,
              creationFrame,
              priorResolved,
              workingResolved,
            );

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
    ) => {
      let workingResolved = resolved;
      let changedVariants: Record<string, unknown> | null = null;
      if (refine) {
        const refineResult = runRefineContext(
          resolved,
          userVariantProps,
          filterOwnVariants,
          false,
          protectedVariants,
          pendingProtectedVariants,
          protectedVariantKeys,
        );
        workingResolved = refineResult.workingResolved;
        changedVariants = refineResult.changedVariants;
      }

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
          );
          if (protectedVariants) {
            Object.assign(extUserVariantProps, protectedVariants);
          }
        }
      }

      return workingResolved;
    };

    const resolveRefine: ResolveRefineFn | null =
      refine || extMetasWithRefineCount > 0
        ? (
            resolved,
            userVariantProps,
            filterOwnVariants = true,
            runState,
            protectedVariants,
            pendingProtectedVariants,
            protectedVariantKeys,
          ) => {
            runState ??= { remaining: MAX_REFINE_RUNS, warned: false };
            protectedVariants ??= {};
            protectedVariantKeys ??= new Set<string>();
            let workingResolved = resolved;
            // Snapshot of `workingResolved` before each non-converging iteration
            // so the refine-limit warning can diff against the final value and
            // report which variant keys are still changing.
            let priorResolved: Record<string, unknown> = resolved;
            let reachedLimit = true;

            while (runState.remaining > 0) {
              runState.remaining -= 1;
              const nextPendingProtectedVariants: Record<string, unknown> = {};
              const nextResolved = resolveRefineOnce(
                workingResolved,
                userVariantProps,
                filterOwnVariants,
                runState,
                protectedVariants,
                nextPendingProtectedVariants,
                protectedVariantKeys,
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

              priorResolved = workingResolved;
              workingResolved = nextResolved;
            }

            if (reachedLimit) {
              warnRefineLimit(
                runState,
                creationFrame,
                priorResolved,
                workingResolved,
              );
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

      // Inline resolve: avoids allocating a separate variantProps object for
      // the common case where no extends need a resolveDefaults pass.
      // resolveVariantsHot would also work here but assumes its input is
      // variant-only (it uses for-in for speed).
      let resolved: Record<string, unknown> = {};
      Object.assign(resolved, staticDefaults);

      let userVariantProps: Record<string, unknown>;
      if (extMetasWithRefineCount > 0) {
        // Some extends need a resolveDefaults pass. They expect a variant-only
        // object as `userProps`, so we extract one.
        const variantProps: Record<string, unknown> = {};
        for (let i = 0; i < variantKeysLength; i++) {
          const key = variantKeys[i];
          if (Object.hasOwn(propsRecord, key)) {
            variantProps[key] = propsRecord[key];
          }
        }
        for (let i = 0; i < extMetasWithRefineCount; i++) {
          const meta = extMetasWithRefine[i];
          const extDefaults = meta.resolveDefaults!(resolved, variantProps);
          for (const k in extDefaults) {
            if (!Object.hasOwn(extDefaults, k)) continue;
            resolved[k] = extDefaults[k];
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
      const allClasses: ClsxClassValue[] = [computedBaseClass];
      const style: StyleValue = {};
      compute(resolved, userVariantProps, null, null, allClasses, style);

      // Apply user-provided class / className.
      if ("class" in propsRecord) {
        allClasses.push(propsRecord.class as ClsxClassValue);
      }
      if ("className" in propsRecord) {
        allClasses.push(propsRecord.className as ClsxClassValue);
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
        className: transformClass(clsx(allClasses)),
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
    // Plain `clsx` (no `transformClass`): `meta.baseClass` flows back into
    // parent extends as `clsx` input and then through the single
    // `transformClass(clsx(allClasses))` at render time, so applying it here
    // would compound (double for own-render, triple+ for extend chains) and
    // misbehave for non-idempotent transforms.
    const computedBaseClass = hasExtend
      ? clsx(
          ...(extBaseClassesArr as ClsxClassValue[]),
          config.class as ClsxClassValue,
        )
      : clsx(config.class as ClsxClassValue);

    // Shared closures across the default and modal components.
    const classFn = (props: ComponentProps<MergedVariants> = {}) => {
      return computeResult(props).className;
    };
    const meta: ComponentMeta = {
      baseClass: computedBaseClass,
      staticDefaults,
      resolveDefaults: resolveDefaultsFn,
      compute,
      resolveRefine,
      transformClass,
      functionVariantKeys,
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

function noop() {}

export const { cv, cx } = create();
