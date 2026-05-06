import type * as CSS from "csstype";

export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | void
  | ClassValue[];

export type JSXCSSProperties = CSS.Properties<string | number>;

export type HTMLCSSProperties = CSS.PropertiesHyphen<string | number>;

export type CSSProperties = CSS.Properties;

export type StyleProperty = JSXCSSProperties | HTMLCSSProperties | string;

export interface JSXProps {
  className: string;
  style: JSXCSSProperties;
}

export interface HTMLProps {
  class: string;
  style: string;
}

export interface HTMLObjProps {
  class: string;
  style: HTMLCSSProperties;
}

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

// Key source types - what can be passed as additional parameters to splitProps
export type KeySourceArray = readonly string[];
export type KeySourceComponent = {
  keys: readonly (string | number | symbol)[];
  variantKeys: readonly (string | number | symbol)[];
  getVariants: () => Record<string, unknown>;
};
export type KeySource = KeySourceArray | KeySourceComponent;

// Check if source is a component (has getVariants)
type IsComponent<S> = S extends { getVariants: () => unknown } ? true : false;

// Extract keys from a source (includes class/style for components)
type SourceKeys<S> = S extends readonly (infer K)[]
  ? K
  : S extends { keys: readonly (infer K)[] }
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
  keys: (keyof V | keyof NullableComponentResult)[];
  variantKeys: (keyof V)[];
  propKeys: (keyof V | keyof NullableComponentResult)[];
}

export interface CVComponent<
  V extends Variants = {},
  CV extends ComputedVariants = {},
  E extends AnyComponent[] = [],
  R extends ComponentResult = StyleClassProps,
> extends ModalComponent<MergeVariants<V, CV, E>, R> {
  jsx: ModalComponent<MergeVariants<V, CV, E>, JSXProps>;
  html: ModalComponent<MergeVariants<V, CV, E>, HTMLProps>;
  htmlObj: ModalComponent<MergeVariants<V, CV, E>, HTMLObjProps>;
}

export type AnyComponent =
  | CVComponent<any, any, any, any>
  | ModalComponent<any, any>;

type MergeExtendedVariants<T> = T extends readonly [infer First, ...infer Rest]
  ? ExtractVariants<First> & MergeExtendedVariants<Rest>
  : {};

type MergeExtendedComputedVariants<T> = T extends readonly [
  infer First,
  ...infer Rest,
]
  ? ExtractComputedVariants<First> & MergeExtendedComputedVariants<Rest>
  : {};

type ExtractVariants<T> =
  T extends CVComponent<infer V, any, infer E, any>
    ? V & MergeExtendedVariants<E>
    : {};

type ExtractComputedVariants<T> =
  T extends CVComponent<any, infer CV, infer E, any>
    ? CV & Omit<MergeExtendedComputedVariants<E>, keyof CV>
    : {};

type MergeVariantDefinition<Child, Parent> =
  Child extends Record<string, any>
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

type MergeExtendedAllVariants<E extends AnyComponent[]> =
  MergeExtendedVariants<E> & MergeExtendedComputedVariants<E>;

type MergeBaseVariants<V, E extends AnyComponent[]> = MergeVariantMaps<
  NoInfer<V>,
  MergeExtendedAllVariants<E>
>;

export type MergeVariants<V, CV, E extends AnyComponent[]> = NoInfer<CV> &
  Omit<MergeBaseVariants<V, E>, keyof CV>;

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
  [K in keyof V]?: ExtractVariantValue<V[K]>;
};

export type StyleValue = CSS.Properties & {
  [key: `--${string}`]: string;
};

export interface StyleClassValue {
  style?: StyleValue;
  class?: ClassValue;
}

export interface ComputedContext<V> {
  variants: VariantValues<V>;
  setVariants: (variants: VariantValues<V>) => void;
  setDefaultVariants: (variants: VariantValues<V>) => void;
  addClass: (className: ClassValue) => void;
  addStyle: (style: StyleValue) => void;
}

export type Computed<V> = (context: ComputedContext<V>) => VariantValue;

export type ComputedVariant = (value: any) => VariantValue;
export type ComputedVariants = Record<string, ComputedVariant>;
export type Variant = ClassValue | Record<string, VariantValue>;
export type Variants = Record<string, Variant>;

type ExtendedVariants<E extends AnyComponent[]> = MergeExtendedVariants<E> &
  MergeExtendedComputedVariants<E>;

type NullablePartial<T> =
  T extends Record<string, any> ? { [K in keyof T]?: T[K] | null } : T | null;

export type ExtendableVariants<
  V extends Variants,
  E extends AnyComponent[],
> = V & {
  [K in keyof ExtendedVariants<E>]?:
    | NullablePartial<ExtendedVariants<E>[K]>
    | Variant;
};
