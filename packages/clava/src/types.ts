import type * as CSS from "csstype";

/**
 * A class value accepted by Clava. It supports strings, numbers, booleans,
 * nullish values, and nested arrays.
 *
 * @example
 * ```ts
 * import type { ClassValue } from "clava";
 *
 * const className: ClassValue = [
 *   "button",
 *   false && "button-hidden",
 *   ["button-primary"],
 * ];
 * ```
 */
export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | void
  | ClassValue[];

interface CustomProperties {
  [key: `--${string}`]: string | number;
}

export interface JSXCSSProperties
  extends CSS.Properties<string | number>, CustomProperties {}

export interface HTMLCSSProperties
  extends CSS.PropertiesHyphen<string | number>, CustomProperties {}

export type CSSProperties = CSS.Properties;

// Indexed members keep custom properties known to fresh style literals, one
// per input mode. Index-free members keep framework style types assignable:
// an all-indexed union rejects React's `CSSProperties`, surfacing as TS2590.
// https://github.com/ariakit/clava/issues/483#issuecomment-5447514407
export type StyleProperty =
  | JSXCSSProperties
  | HTMLCSSProperties
  | CSS.Properties<string | number>
  | CSS.PropertiesHyphen<string | number>
  | string;

/**
 * The prop object returned by a component's `.jsx()` mode.
 *
 * @example
 * ```ts
 * import { type JSXProps, cv } from "clava";
 *
 * const button = cv({ class: "button" });
 * const props: JSXProps = button.jsx();
 * ```
 */
export interface JSXProps {
  className: string;
  style: JSXCSSProperties;
}

/**
 * The prop object returned by a component's `.html()` mode. The `style` value
 * is serialized as an HTML style string.
 *
 * @example
 * ```ts
 * import { type HTMLProps, cv } from "clava";
 *
 * const button = cv({ style: { color: "red" } });
 * const props: HTMLProps = button.html();
 * ```
 */
export interface HTMLProps {
  class: string;
  style: string;
}

/**
 * The prop object returned by a component's `.htmlObj()` mode. The `style`
 * value uses hyphenated CSS property names.
 *
 * @example
 * ```ts
 * import { type HTMLObjProps, cv } from "clava";
 *
 * const button = cv({ style: { fontSize: "16px" } });
 * const props: HTMLObjProps = button.htmlObj();
 * ```
 */
export interface HTMLObjProps {
  class: string;
  style: HTMLCSSProperties;
}

/**
 * The default prop object returned by a Clava component. It uses `class`
 * rather than `className` and keeps styles as a normalized object.
 *
 * @example
 * ```ts
 * import { type StyleClassProps, cv } from "clava";
 *
 * const button = cv({ class: "button" });
 * const props: StyleClassProps = button();
 * ```
 */
export interface StyleClassProps {
  class: string;
  style: StyleValue;
}

export interface StyleProps {
  jsx: JSXProps;
  html: HTMLProps;
  htmlObj: HTMLObjProps;
}

export type ComponentResult =
  | JSXProps
  | HTMLProps
  | HTMLObjProps
  | StyleClassProps;

type AllComponentResultKeys =
  | keyof JSXProps
  | keyof HTMLProps
  | keyof HTMLObjProps;

type ComponentResultValue<K extends AllComponentResultKeys> = K extends "style"
  ? StyleProperty
  : K extends "className"
    ? string
    : K extends "class"
      ? string
      : never;

export type NullableComponentResult = {
  [K in AllComponentResultKeys]?: ComponentResultValue<K> | null;
};

export type ComponentProps<V = {}> = VariantValues<V> & NullableComponentResult;

export type GetVariants<V> = (variants?: VariantValues<V>) => VariantValues<V>;

type ComponentPropKey<R extends ComponentResult> =
  | keyof R
  | (R extends StyleClassProps ? "className" : never);

// Key source types - what can be passed as additional parameters to splitProps
export type KeySourceArray = readonly string[];
export interface KeySourceComponent {
  propKeys: readonly string[];
  variantKeys: readonly string[];
  getVariants: () => Record<string, unknown>;
}
export type KeySource = KeySourceArray | KeySourceComponent;

// Check if source is a component (has getVariants)
type IsComponent<S> = S extends { getVariants: () => unknown } ? true : false;

// Extract keys from a source (includes class/style for components)
type SourceKeys<S> = S extends readonly (infer K)[]
  ? K
  : S extends { propKeys: readonly (infer K)[] }
    ? K
    : never;

// Extract variant keys from a source (only variant keys, no class/style)
type SourceVariantKeys<S> = S extends readonly (infer K)[]
  ? K
  : S extends { variantKeys: readonly (infer K)[] }
    ? K
    : never;

// Extract defaults from a source (components have defaults, arrays don't)
type SourceDefaults<S> = S extends { getVariants: () => infer Defaults }
  ? Defaults
  : {};

// Result type for a source when styling is NOT yet claimed
// - Arrays: use listed keys (no defaults)
// - Components: use full keys including class/style (with defaults)
type SourceResultWithStyling<T, S> = Pick<T, Extract<keyof T, SourceKeys<S>>> &
  Omit<SourceDefaults<S>, keyof T>;

// Result type for a source when styling IS already claimed
// - Arrays: use listed keys (no defaults)
// - Components: use only variant keys (with defaults)
type SourceResultWithoutStyling<T, S> =
  IsComponent<S> extends true
    ? Pick<T, Extract<keyof T, SourceVariantKeys<S>>> &
        Omit<SourceDefaults<S>, keyof T>
    : Pick<T, Extract<keyof T, SourceKeys<S>>>;

// Recursive helper to build the result tuple for sources after S1
// StylingClaimed: whether a component has already claimed styling
// UsedKeys: accumulator for all keys used so far (for the rest object)
type BuildSourceResults<
  T,
  Sources extends readonly KeySource[],
  StylingClaimed extends boolean,
  UsedKeys,
> = Sources extends readonly [
  infer Current extends KeySource,
  ...infer Rest extends readonly KeySource[],
]
  ? [
      StylingClaimed extends true
        ? SourceResultWithoutStyling<T, Current>
        : SourceResultWithStyling<T, Current>,
      ...BuildSourceResults<
        T,
        Rest,
        StylingClaimed extends true ? true : IsComponent<Current>,
        UsedKeys | SourceKeys<Current>
      >,
    ]
  : [Omit<T, UsedKeys & (string | number | symbol)>];

// Standalone splitProps function type - first source is required
export type SplitPropsFunction = <
  T,
  const S1 extends KeySource,
  const Sources extends readonly KeySource[],
>(
  props: T,
  source1: S1,
  ...sources: Sources
) => SplitPropsFunctionResult<T, S1, Sources>;

// Result type for standalone splitProps function
// S1: First source - uses SourceResultWithStyling (either array or first component gets styling)
// Sources: Subsequent sources - use SourceResultWithStyling if no prior component, else SourceResultWithoutStyling
type SplitPropsFunctionResult<
  T,
  S1 extends KeySource,
  Sources extends readonly KeySource[],
> = [
  SourceResultWithStyling<T, S1>,
  ...BuildSourceResults<T, Sources, IsComponent<S1>, SourceKeys<S1>>,
];

export interface ModalComponent<V, R extends ComponentResult> {
  (props?: ComponentProps<V>): R;
  class: (props?: ComponentProps<V>) => string;
  style: (props?: ComponentProps<V>) => R["style"];
  getVariants: GetVariants<V>;
  variantKeys: (keyof V)[];
  propKeys: (keyof V | ComponentPropKey<R>)[];
}

/**
 * A callable Clava component returned by `cv()`. It includes the default
 * output mode plus `.jsx()`, `.html()`, and `.htmlObj()` mode helpers.
 *
 * @example
 * ```ts
 * import { type CVComponent, cv } from "clava";
 *
 * const button: CVComponent<{
 *   size: { sm: string; lg: string };
 * }> = cv({
 *   variants: {
 *     size: { sm: "button-sm", lg: "button-lg" },
 *   },
 * });
 *
 * button.jsx({ size: "lg" });
 * ```
 */
export interface CVComponent<
  V extends Variants = {},
  E extends AnyComponent[] = [],
  R extends ComponentResult = StyleClassProps,
> extends ModalComponent<MergeVariants<V, E>, R> {
  jsx: ModalComponent<MergeVariants<V, E>, JSXProps>;
  html: ModalComponent<MergeVariants<V, E>, HTMLProps>;
  htmlObj: ModalComponent<MergeVariants<V, E>, HTMLObjProps>;
}

export type AnyComponent =
  | CVComponent<any, any, any>
  | ModalComponent<any, any>;

type MergeExtendedVariants<T> = T extends readonly [infer First, ...infer Rest]
  ? ExtractVariants<First> & MergeExtendedVariants<Rest>
  : {};

// Returns a component's effective variants so an intermediate component's
// static variant hides a grandparent's function variant from descendants.
// CVComponent and its mode helpers instantiate ModalComponent with the already
// merged MergeVariants<V, E>, so inferring V yields that effective chain.
type ExtractVariants<T> = T extends ModalComponent<infer V, any> ? V : {};

// A function value in `variants` (a function variant) replaces any inherited
// variant for the same key. An object value merges value-by-value with an
// inherited object, but replaces an inherited function.
type MergeVariantDefinition<Child, Parent> = Child extends (
  ...args: any[]
) => any
  ? Child
  : Parent extends (...args: any[]) => any
    ? Child
    : Child extends Record<string, any>
      ? Parent extends Record<string, any>
        ? Omit<Parent, keyof Child> & Child
        : Child
      : Child;

type MergeVariantMaps<Child, Parent> = Omit<Parent, keyof Child> &
  Child & {
    [K in keyof Child & keyof Parent]: MergeVariantDefinition<
      Child[K],
      Parent[K]
    >;
  };

export type MergeVariants<V, E extends AnyComponent[]> = MergeVariantMaps<
  NoInfer<V>,
  MergeExtendedVariants<E>
>;

type StringToBoolean<T> = T extends "true" | "false" ? boolean : T;

type VariantValue = ClassValue | StyleClassValue;

type NonNullKeys<T> = {
  [K in keyof T]: T[K] extends null ? never : K;
}[keyof T];

type ExtractVariantValue<T> = T extends null
  ? never
  : T extends (value: infer V) => any
    ? V
    : T extends readonly unknown[]
      ? boolean
      : T extends Record<string, any>
        ? StringToBoolean<NonNullKeys<T>>
        : T extends ClassValue
          ? boolean
          : never;

export type VariantValues<V> = {
  [K in keyof V]?: ExtractVariantValue<V[K]> | undefined;
};

type ComputedDefaultVariant<V, K extends keyof V> = (
  defaultValue: ExtractVariantValue<V[K]> | undefined,
  variants: Readonly<VariantValues<V>>,
) => ExtractVariantValue<V[K]> | undefined;

type NonFunctionVariantValue<T> = Exclude<T, (...args: any[]) => any>;

type DefaultVariantValue<V, K extends keyof V> = [
  NonFunctionVariantValue<ExtractVariantValue<V[K]>>,
] extends [never]
  ? ComputedDefaultVariant<V, K>
  :
      | NonFunctionVariantValue<ExtractVariantValue<V[K]>>
      | ComputedDefaultVariant<V, K>;

export type DefaultVariants<V> = {
  [K in keyof V]?: DefaultVariantValue<V, K> | undefined;
};

/**
 * A normalized style object accepted by Clava config, variant, and refine
 * style entries. CSS custom properties are supported with string and number
 * values.
 *
 * @example
 * ```ts
 * import type { StyleValue } from "clava";
 *
 * const style: StyleValue = {
 *   color: "red",
 *   "--button-accent": "oklch(62% 0.2 250)",
 *   "--button-scale": 1.1,
 * };
 * ```
 */
export interface StyleValue extends CSS.Properties, CustomProperties {}

/**
 * A value that contributes both class and style output from a base config,
 * variant value, function variant, or refine callback.
 *
 * @example
 * ```ts
 * import type { StyleClassValue } from "clava";
 *
 * const tone: StyleClassValue = {
 *   class: "button-primary",
 *   style: { color: "white" },
 * };
 * ```
 */
export interface StyleClassValue {
  style?: StyleValue;
  class?: ClassValue;
}

export interface RefineContext<V> {
  variants: VariantValues<V>;
  setVariants: (variants: VariantValues<V>) => void;
  addClass: (className: ClassValue) => void;
  addStyle: (style: StyleValue) => void;
}

export type Refine<V> = (context: RefineContext<V>) => VariantValue;

export type Variant =
  | ClassValue
  | Record<string, VariantValue>
  | ((value: any) => VariantValue);
export type Variants = Record<string, Variant>;

type NullablePartial<T> =
  T extends Record<string, any> ? { [K in keyof T]?: T[K] | null } : T | null;

export type ExtendableVariants<
  V extends Variants,
  E extends AnyComponent[],
> = V & {
  [K in keyof MergeExtendedVariants<E>]?:
    | NullablePartial<MergeExtendedVariants<E>[K]>
    | Variant;
};
