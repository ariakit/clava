import clsx, { type ClassValue as ClsxClassValue } from "clsx";
import type {
  Access,
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
  staticDefaults: Record<string, unknown>;
  variantAccess: Record<string, AccessEntry>;
  variantValueAccess: Record<string, Record<string, AccessEntry>>;
  resolveDefaults: (
    childDefaults: Record<string, unknown>,
    userProps?: Record<string, unknown>,
  ) => Record<string, unknown>;
}

interface AccessEntry {
  level: Access;
  privateOwner?: unknown;
}

interface AccessState {
  variantAccess: Record<string, AccessEntry>;
  variantValueAccess: Record<string, Record<string, AccessEntry>>;
}

const META_KEY = "__meta";

// Symbol property used to pass skip keys through the props object without
// polluting the actual variant values. This allows the computed function to
// see actual variant values while still skipping styling for overridden keys.
const SKIP_STYLE_KEYS = Symbol("skipStyleKeys");
const SKIP_STYLE_VARIANT_VALUES = Symbol("skipStyleVariantValues");
const INTERNAL_ACCESS_OWNER = Symbol("internalAccessOwner");

// Dynamic property access on function requires cast through unknown
function getComponentMeta(component: AnyComponent): ComponentMeta | undefined {
  return (component as unknown as Record<string, unknown>)[META_KEY] as
    | ComponentMeta
    | undefined;
}

function setComponentMeta(component: AnyComponent, meta: ComponentMeta): void {
  (component as unknown as Record<string, unknown>)[META_KEY] = meta;
}

const ACCESS_LEVEL_ORDER: Record<Access, number> = {
  public: 0,
  protected: 1,
  private: 2,
};

function isAccess(value: unknown): value is Access {
  return value === "public" || value === "protected" || value === "private";
}

function getMoreRestrictiveAccess(current: Access, next: Access): Access {
  return ACCESS_LEVEL_ORDER[current] >= ACCESS_LEVEL_ORDER[next]
    ? current
    : next;
}

function mergeAccessEntry(
  base: AccessEntry | undefined,
  next: AccessEntry,
): AccessEntry {
  if (!base) {
    return next;
  }
  const level = getMoreRestrictiveAccess(base.level, next.level);
  if (level === base.level) {
    return base;
  }
  return next;
}

function mergeAccessMap(
  base: Record<string, AccessEntry>,
  override: Record<string, AccessEntry>,
): Record<string, AccessEntry> {
  const merged: Record<string, AccessEntry> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = mergeAccessEntry(merged[key], value);
  }
  return merged;
}

function mergeAccessValueMap(
  base: Record<string, Record<string, AccessEntry>>,
  override: Record<string, Record<string, AccessEntry>>,
): Record<string, Record<string, AccessEntry>> {
  const merged: Record<string, Record<string, AccessEntry>> = {};

  for (const [variantKey, valueMap] of Object.entries(base)) {
    merged[variantKey] = { ...valueMap };
  }

  for (const [variantKey, valueMap] of Object.entries(override)) {
    if (!merged[variantKey]) {
      merged[variantKey] = {};
    }
    for (const [valueKey, accessEntry] of Object.entries(valueMap)) {
      merged[variantKey][valueKey] = mergeAccessEntry(
        merged[variantKey][valueKey],
        accessEntry,
      );
    }
  }

  return merged;
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
  defaultVariants?: VariantValues<MergeVariants<V, CV, E>, "internal">;
  computed?: Computed<MergeVariants<V, CV, E>>;
}

interface CreateParams<M extends Mode> {
  defaultMode?: M;
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
 * Extracts class and style from a style-class value object.
 */
function extractStyleClass(value: StyleClassValue): {
  class: ClassValue;
  style: StyleValue;
} {
  return { class: value.class, style: normalizeStyle(value.style) };
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
  if (isRecordObject(value)) {
    return { class: null, style: {} };
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
    for (const [key, variant] of Object.entries(config.variants)) {
      if (variant === null) {
        keys.delete(key);
        continue;
      }
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

function canSetVariant(
  accessState: AccessState,
  key: string,
  owner: unknown,
  external: boolean,
): boolean {
  const accessEntry = accessState.variantAccess[key];
  if (!accessEntry) return true;
  if (accessEntry.level === "public") return true;
  if (external) return false;
  if (accessEntry.level === "protected") return true;
  return accessEntry.privateOwner === owner;
}

function canSetVariantValue(
  accessState: AccessState,
  key: string,
  value: unknown,
  owner: unknown,
  external: boolean,
): boolean {
  const valueKey = getVariantValueKey(value);
  if (!valueKey) return true;
  const accessEntry = accessState.variantValueAccess[key]?.[valueKey];
  if (!accessEntry) return true;
  if (accessEntry.level === "public") return true;
  if (external) return false;
  if (accessEntry.level === "protected") return true;
  return accessEntry.privateOwner === owner;
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

function filterDisabledVariants(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  variants: Record<string, unknown>,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(variants)) {
    if (isVariantDisabled(config, key)) continue;
    if (isVariantValueDisabled(config, key, value)) continue;
    filtered[key] = value;
  }
  return filtered;
}

function filterRestrictedVariants(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  accessState: AccessState,
  variants: Record<string, unknown>,
  owner: unknown,
  external: boolean,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(variants)) {
    if (isVariantDisabled(config, key)) continue;
    if (isVariantValueDisabled(config, key, value)) continue;
    if (!canSetVariant(accessState, key, owner, external)) continue;
    if (!canSetVariantValue(accessState, key, value, owner, external)) continue;
    filtered[key] = value;
  }
  return filtered;
}

function collectAccessState(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  owner: unknown,
): AccessState {
  let variantAccess: Record<string, AccessEntry> = {};
  let variantValueAccess: Record<string, Record<string, AccessEntry>> = {};

  if (config.extend) {
    for (const ext of config.extend) {
      const meta = getComponentMeta(ext);
      if (!meta) continue;
      variantAccess = mergeAccessMap(variantAccess, meta.variantAccess);
      variantValueAccess = mergeAccessValueMap(
        variantValueAccess,
        meta.variantValueAccess,
      );
    }
  }

  if (!config.variants) {
    return { variantAccess, variantValueAccess };
  }

  for (const [variantName, variantDef] of Object.entries(config.variants)) {
    if (!isRecordObject(variantDef)) continue;

    const variantAccessValue = variantDef.access;
    if (isAccess(variantAccessValue)) {
      const previousAccess = variantAccess[variantName];
      const previousLevel = previousAccess?.level ?? "public";
      const level = getMoreRestrictiveAccess(previousLevel, variantAccessValue);
      if (level === "private" && previousLevel !== "private") {
        variantAccess[variantName] = { level, privateOwner: owner };
      } else {
        variantAccess[variantName] = {
          level,
          privateOwner: previousAccess?.privateOwner,
        };
      }
    }

    for (const [valueKey, variantValue] of Object.entries(variantDef)) {
      if (valueKey === "access") continue;
      if (!isRecordObject(variantValue)) continue;
      if (!isAccess(variantValue.access)) continue;

      if (!variantValueAccess[variantName]) {
        variantValueAccess[variantName] = {};
      }

      const previousAccess = variantValueAccess[variantName][valueKey];
      const previousLevel = previousAccess?.level ?? "public";
      const level = getMoreRestrictiveAccess(
        previousLevel,
        variantValue.access,
      );
      if (level === "private" && previousLevel !== "private") {
        variantValueAccess[variantName][valueKey] = {
          level,
          privateOwner: owner,
        };
      } else {
        variantValueAccess[variantName][valueKey] = {
          level,
          privateOwner: previousAccess?.privateOwner,
        };
      }
    }
  }

  return { variantAccess, variantValueAccess };
}

function collectDisabledVariantKeys(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
): Set<string> {
  const keys = new Set<string>();
  if (!config.variants) return keys;
  for (const [key, value] of Object.entries(config.variants)) {
    if (value === null) {
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
  for (const [key, variant] of Object.entries(config.variants)) {
    if (!isRecordObject(variant)) continue;
    for (const [variantValue, variantEntry] of Object.entries(variant)) {
      if (variantValue === "access") continue;
      if (variantEntry !== null) continue;
      if (!values[key]) {
        values[key] = new Set<string>();
      }
      values[key].add(variantValue);
    }
  }
  return values;
}

function mergeDisabledVariantValues(
  base: Record<string, Set<string>>,
  override: Record<string, Set<string>>,
): Record<string, Set<string>> {
  const merged: Record<string, Set<string>> = {};
  for (const [key, values] of Object.entries(base)) {
    merged[key] = new Set(values);
  }
  for (const [key, values] of Object.entries(override)) {
    if (!merged[key]) {
      merged[key] = new Set<string>();
    }
    for (const value of values) {
      merged[key].add(value);
    }
  }
  return merged;
}

/**
 * Collects static default variants from extended components and the current
 * config. Also handles implicit boolean defaults (when only `false` key
 * exists). This does NOT trigger computed functions - use collectDefaultVariants
 * for that.
 */
function collectStaticDefaults(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  accessState: AccessState,
  owner: unknown,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  // Collect static defaults from extended components (via metadata to avoid
  // triggering computed functions)
  if (config.extend) {
    for (const ext of config.extend) {
      const meta = getComponentMeta(ext);
      if (meta) {
        Object.assign(defaults, meta.staticDefaults);
      }
    }
  }

  // Handle implicit boolean defaults from variants
  // If a variant has a `false` key, default to false when no value is provided
  if (config.variants) {
    for (const [variantName, variantDef] of Object.entries(config.variants)) {
      if (!isRecordObject(variantDef)) continue;
      const keys = Object.keys(variantDef);
      const hasFalse = keys.includes("false");
      if (hasFalse && !defaults[variantName]) {
        defaults[variantName] = false;
      }
    }
  }

  // Override with current config's static defaults
  if (config.defaultVariants) {
    Object.assign(
      defaults,
      filterRestrictedVariants(
        config,
        accessState,
        config.defaultVariants as Record<string, unknown>,
        owner,
        false,
      ),
    );
  }

  return filterDisabledVariants(config, defaults);
}

/**
 * Collects default variants from extended components and the current config.
 * This includes both static defaults and computed defaults (from
 * setDefaultVariants in extended components' computed functions). Priority:
 * parent static < child static < parent computed < child computed.
 */
function collectDefaultVariants(
  config: CVConfig<Variants, ComputedVariants, AnyComponent[]>,
  accessState: AccessState,
  owner: unknown,
  propsVariants: Record<string, unknown> = {},
): Record<string, unknown> {
  // Start with static defaults (parent static < child static)
  const defaults = collectStaticDefaults(config, accessState, owner);

  // Apply computed defaults from extended components
  // Parent's setDefaultVariants should override child's static defaults
  if (!config.extend) return defaults;

  // Pass full static defaults (not just this config's defaultVariants)
  // so that intermediate components' defaults are visible to ancestors
  for (const ext of config.extend) {
    const meta = getComponentMeta(ext);
    if (!meta) continue;
    Object.assign(defaults, meta.resolveDefaults(defaults, propsVariants));
  }

  return filterDisabledVariants(config, defaults);
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
  accessState: AccessState,
  selfOwner: unknown,
  propsOwner: unknown,
  external: boolean,
  props: Record<string, unknown> = {},
): Record<string, unknown> {
  const defaults = collectDefaultVariants(
    config,
    accessState,
    selfOwner,
    props,
  );
  return {
    ...defaults,
    ...filterRestrictedVariants(
      config,
      accessState,
      filterUndefined(props),
      propsOwner,
      external,
    ),
  };
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
  if (!isRecordObject(variantDef)) {
    if (selectedValue === true) {
      return extractClassAndStyle(variantDef);
    }
    return { class: null, style: {} };
  }

  // Object variant: { sm: "...", lg: "..." }
  const key = String(selectedValue);
  const value = variantDef[key];
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
  owner: unknown,
  overrideVariantKeys: Set<string> = new Set(),
  overrideVariantValues: Record<string, Set<string>> = {},
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
    // Pass actual variant values but mark which keys should skip styling.
    // Using a Symbol property keeps variant values clean for computed functions
    // while still allowing us to skip styling for overridden keys.
    const propsForExt: Record<string | symbol, unknown> = {
      ...resolvedVariants,
    };
    if (overrideVariantKeys.size > 0) {
      propsForExt[SKIP_STYLE_KEYS] = overrideVariantKeys;
    }
    if (Object.keys(overrideVariantValues).length > 0) {
      propsForExt[SKIP_STYLE_VARIANT_VALUES] = overrideVariantValues;
    }
    propsForExt[INTERNAL_ACCESS_OWNER] = owner;

    const extResult = ext(
      propsForExt as ComponentProps<Record<string, unknown>>,
    );
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
  resolvedVariants: Record<string | symbol, unknown>,
  skipStyleKeys: Set<string> = new Set(),
  skipVariantValues: Record<string, Set<string>> = {},
): { classes: ClassValue[]; style: StyleValue } {
  const classes: ClassValue[] = [];
  const style: StyleValue = {};

  // Process current component's variants
  if (config.variants) {
    for (const [variantName, variantDef] of Object.entries(config.variants)) {
      // Skip styling for variants that are overridden by child's computedVariants
      if (skipStyleKeys.has(variantName)) continue;

      const selectedValue = resolvedVariants[variantName];
      if (selectedValue === undefined) continue;
      const selectedKey = getVariantValueKey(selectedValue);
      if (selectedKey && skipVariantValues[variantName]?.has(selectedKey)) {
        continue;
      }

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
      // Skip styling for variants that are overridden by child's computedVariants
      if (skipStyleKeys.has(variantName)) continue;

      const selectedValue = resolvedVariants[variantName];
      if (selectedValue === undefined) continue;
      const selectedKey = getVariantValueKey(selectedValue);
      if (selectedKey && skipVariantValues[variantName]?.has(selectedKey)) {
        continue;
      }

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
  accessState: AccessState,
  owner: unknown,
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
    setVariants: (
      newVariants: VariantValues<Record<string, unknown>, "internal">,
    ) => {
      Object.assign(
        updatedVariants,
        filterRestrictedVariants(
          config,
          accessState,
          newVariants as Record<string, unknown>,
          owner,
          false,
        ),
      );
    },
    setDefaultVariants: (
      newDefaults: VariantValues<Record<string, unknown>, "internal">,
    ) => {
      // Only apply defaults for variants not explicitly set in props
      for (const [key, value] of Object.entries(newDefaults)) {
        if (propsVariants[key] === undefined) {
          if (!canSetVariant(accessState, key, owner, false)) continue;
          if (!canSetVariantValue(accessState, key, value, owner, false)) {
            continue;
          }
          if (isVariantDisabled(config, key)) continue;
          if (isVariantValueDisabled(config, key, value)) continue;
          updatedVariants[key] = value;
        }
      }
    },
    addClass: (className: ClassValue) => {
      classes.push(className);
    },
    addStyle: (newStyle: StyleValue) => {
      assign(style, newStyle);
    },
  };

  const computedResult = config.computed(context);
  if (computedResult != null) {
    const result = extractClassAndStyle(computedResult);
    classes.push(result.class);
    assign(style, result.style);
  }

  return {
    classes,
    style,
    updatedVariants: filterDisabledVariants(config, updatedVariants),
  };
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
  accessState: AccessState,
  owner: unknown,
): ComponentMeta["resolveDefaults"] {
  return (childDefaults, userProps = {}) => {
    // Get static defaults (including from extended components)
    const staticDefaults = collectStaticDefaults(config, accessState, owner);

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
        variants: resolvedVariants as VariantValues<
          Record<string, unknown>,
          "internal"
        >,
        setVariants: () => {
          // Not relevant for collecting defaults
        },
        setDefaultVariants: (newDefaults) => {
          // Only apply defaults for variants not explicitly set by user
          // (child's static defaults should not block setDefaultVariants)
          for (const [key, value] of Object.entries(newDefaults)) {
            if (userProps[key] !== undefined) continue;
            if (!canSetVariant(accessState, key, owner, false)) continue;
            if (!canSetVariantValue(accessState, key, value, owner, false)) {
              continue;
            }
            if (isVariantDisabled(config, key)) continue;
            if (isVariantValueDisabled(config, key, value)) continue;
            computedDefaults[key] = value;
          }
        },
        addClass: () => {
          // Not relevant for collecting defaults
        },
        addStyle: () => {
          // Not relevant for collecting defaults
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
    const accessOwner = {};
    const accessState = collectAccessState(
      config as CVConfig<Variants, ComputedVariants, AnyComponent[]>,
      accessOwner,
    );

    const variantKeys = collectVariantKeys(config);
    const disabledVariantKeys = collectDisabledVariantKeys(config);
    const disabledVariantValues = collectDisabledVariantValues(config);

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

      // Extract skip style keys from props (set by child's computedVariants)
      const skipStyleKeys =
        ((props as Record<symbol, unknown>)[SKIP_STYLE_KEYS] as
          | Set<string>
          | undefined) ?? new Set<string>();
      const skipStyleVariantValues =
        ((props as Record<symbol, unknown>)[SKIP_STYLE_VARIANT_VALUES] as
          | Record<string, Set<string>>
          | undefined) ?? {};
      const internalAccessOwner = (props as Record<symbol, unknown>)[
        INTERNAL_ACCESS_OWNER
      ];
      const isExternalAccess = internalAccessOwner === undefined;
      const variantAccessOwner = isExternalAccess
        ? accessOwner
        : internalAccessOwner;

      // Extract variant props from input
      const variantProps: Record<string, unknown> = {};
      for (const key of variantKeys) {
        if (key in props) {
          variantProps[key] = props[key];
        }
      }
      // Resolve variants with defaults
      let resolvedVariants = resolveVariants(
        config,
        accessState,
        accessOwner,
        variantAccessOwner,
        isExternalAccess,
        variantProps,
      );
      // Process computed first to potentially update variants
      const computedResult = runComputedFunction(
        config,
        accessState,
        accessOwner,
        resolvedVariants,
        variantProps,
      );
      resolvedVariants = computedResult.updatedVariants;

      // Collect computedVariants keys that will override extended variants.
      // Combine with incoming skip keys to propagate through the extend chain.
      const currentVariantKeys = new Set<string>(skipStyleKeys);
      for (const key of disabledVariantKeys) {
        currentVariantKeys.add(key);
      }
      const computedVariantKeys = new Set<string>(currentVariantKeys);
      if (config.computedVariants) {
        for (const key of Object.keys(config.computedVariants)) {
          computedVariantKeys.add(key);
        }
      }
      const computedVariantValues = mergeDisabledVariantValues(
        skipStyleVariantValues,
        disabledVariantValues,
      );

      // Process extended components (separates base and variant classes)
      const extendedResult = computeExtendedStyles(
        config,
        resolvedVariants,
        accessOwner,
        computedVariantKeys,
        computedVariantValues,
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

      // 5. Current component's variants (skip keys that are overridden)
      const variantsResult = computeVariantStyles(
        config,
        resolvedVariants,
        currentVariantKeys,
        computedVariantValues,
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
          return { className, style: styleValueToJSXStyle(style) };
        }
        if (mode === "html") {
          return { class: className, style: styleValueToHTMLStyle(style) };
        }
        // htmlObj
        return { class: className, style: styleValueToHTMLObjStyle(style) };
      }) as ModalComponent<MergedVariants, R>;

      component.class = (props: ComponentProps<MergedVariants> = {}) => {
        return computeResult(props).className;
      };

      component.style = (props: ComponentProps<MergedVariants> = {}) => {
        const { style } = computeResult(props);
        if (mode === "jsx") return styleValueToJSXStyle(style);
        if (mode === "html") return styleValueToHTMLStyle(style);
        return styleValueToHTMLObjStyle(style);
      };

      component.getVariants = (variants?: VariantValues<MergedVariants>) => {
        const variantProps = variants ?? {};
        const resolvedVariants = resolveVariants(
          config,
          accessState,
          accessOwner,
          accessOwner,
          true,
          variantProps as Record<string, unknown>,
        );
        // Run computed function to get variants set via setVariants and
        // setDefaultVariants
        const { updatedVariants } = runComputedFunction(
          config,
          accessState,
          accessOwner,
          resolvedVariants,
          variantProps as Record<string, unknown>,
        );
        return updatedVariants as VariantValues<MergedVariants>;
      };

      component.keys = propsKeys;
      component.variantKeys = variantKeys;
      component.propKeys = propsKeys;

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

      // Compute static defaults once at creation time (without triggering
      // computed functions)
      const staticDefaults = collectStaticDefaults(
        config,
        accessState,
        accessOwner,
      );

      // Store internal metadata hidden from public types
      setComponentMeta(component, {
        baseClass,
        staticDefaults,
        variantAccess: accessState.variantAccess,
        variantValueAccess: accessState.variantValueAccess,
        resolveDefaults: createResolveDefaults(
          config,
          accessState,
          accessOwner,
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
