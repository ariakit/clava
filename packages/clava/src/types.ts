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

export interface StyleProps {
  jsx: JSXProps;
  html: HTMLProps;
  htmlObj: HTMLObjProps;
}

export type ComponentResult = JSXProps | HTMLProps | HTMLObjProps;

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

// Check if any source in a tuple is a component (to track if styling is claimed)
type HasComponent<Sources> = Sources extends readonly []
  ? false
  : Sources extends readonly [infer First, ...infer Rest]
    ? IsComponent<First> extends true
      ? true
      : HasComponent<Rest>
    : false;

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
// S2+: Subsequent sources - use SourceResultWithStyling if no prior component, else SourceResultWithoutStyling
type SplitPropsFunctionResult<
  T,
  S1 extends KeySource,
  Sources extends readonly KeySource[],
> = Sources extends readonly []
  ? [SourceResultWithStyling<T, S1>, Omit<T, SourceKeys<S1>>]
  : Sources extends readonly [infer S2 extends KeySource]
    ? [
        SourceResultWithStyling<T, S1>,
        IsComponent<S1> extends true
          ? SourceResultWithoutStyling<T, S2>
          : SourceResultWithStyling<T, S2>,
        Omit<T, SourceKeys<S1> | SourceKeys<S2>>,
      ]
    : Sources extends readonly [
          infer S2 extends KeySource,
          infer S3 extends KeySource,
        ]
      ? [
          SourceResultWithStyling<T, S1>,
          IsComponent<S1> extends true
            ? SourceResultWithoutStyling<T, S2>
            : SourceResultWithStyling<T, S2>,
          HasComponent<[S1, S2]> extends true
            ? SourceResultWithoutStyling<T, S3>
            : SourceResultWithStyling<T, S3>,
          Omit<T, SourceKeys<S1> | SourceKeys<S2> | SourceKeys<S3>>,
        ]
      : Sources extends readonly [
            infer S2 extends KeySource,
            infer S3 extends KeySource,
            infer S4 extends KeySource,
          ]
        ? [
            SourceResultWithStyling<T, S1>,
            IsComponent<S1> extends true
              ? SourceResultWithoutStyling<T, S2>
              : SourceResultWithStyling<T, S2>,
            HasComponent<[S1, S2]> extends true
              ? SourceResultWithoutStyling<T, S3>
              : SourceResultWithStyling<T, S3>,
            HasComponent<[S1, S2, S3]> extends true
              ? SourceResultWithoutStyling<T, S4>
              : SourceResultWithStyling<T, S4>,
            Omit<
              T,
              SourceKeys<S1> | SourceKeys<S2> | SourceKeys<S3> | SourceKeys<S4>
            >,
          ]
        : Sources extends readonly [
              infer S2 extends KeySource,
              infer S3 extends KeySource,
              infer S4 extends KeySource,
              infer S5 extends KeySource,
            ]
          ? [
              SourceResultWithStyling<T, S1>,
              IsComponent<S1> extends true
                ? SourceResultWithoutStyling<T, S2>
                : SourceResultWithStyling<T, S2>,
              HasComponent<[S1, S2]> extends true
                ? SourceResultWithoutStyling<T, S3>
                : SourceResultWithStyling<T, S3>,
              HasComponent<[S1, S2, S3]> extends true
                ? SourceResultWithoutStyling<T, S4>
                : SourceResultWithStyling<T, S4>,
              HasComponent<[S1, S2, S3, S4]> extends true
                ? SourceResultWithoutStyling<T, S5>
                : SourceResultWithStyling<T, S5>,
              Omit<
                T,
                | SourceKeys<S1>
                | SourceKeys<S2>
                | SourceKeys<S3>
                | SourceKeys<S4>
                | SourceKeys<S5>
              >,
            ]
          : Sources extends readonly [
                infer S2 extends KeySource,
                infer S3 extends KeySource,
                infer S4 extends KeySource,
                infer S5 extends KeySource,
                infer S6 extends KeySource,
              ]
            ? [
                SourceResultWithStyling<T, S1>,
                IsComponent<S1> extends true
                  ? SourceResultWithoutStyling<T, S2>
                  : SourceResultWithStyling<T, S2>,
                HasComponent<[S1, S2]> extends true
                  ? SourceResultWithoutStyling<T, S3>
                  : SourceResultWithStyling<T, S3>,
                HasComponent<[S1, S2, S3]> extends true
                  ? SourceResultWithoutStyling<T, S4>
                  : SourceResultWithStyling<T, S4>,
                HasComponent<[S1, S2, S3, S4]> extends true
                  ? SourceResultWithoutStyling<T, S5>
                  : SourceResultWithStyling<T, S5>,
                HasComponent<[S1, S2, S3, S4, S5]> extends true
                  ? SourceResultWithoutStyling<T, S6>
                  : SourceResultWithStyling<T, S6>,
                Omit<
                  T,
                  | SourceKeys<S1>
                  | SourceKeys<S2>
                  | SourceKeys<S3>
                  | SourceKeys<S4>
                  | SourceKeys<S5>
                  | SourceKeys<S6>
                >,
              ]
            : Sources extends readonly [
                  infer S2 extends KeySource,
                  infer S3 extends KeySource,
                  infer S4 extends KeySource,
                  infer S5 extends KeySource,
                  infer S6 extends KeySource,
                  infer S7 extends KeySource,
                ]
              ? [
                  SourceResultWithStyling<T, S1>,
                  IsComponent<S1> extends true
                    ? SourceResultWithoutStyling<T, S2>
                    : SourceResultWithStyling<T, S2>,
                  HasComponent<[S1, S2]> extends true
                    ? SourceResultWithoutStyling<T, S3>
                    : SourceResultWithStyling<T, S3>,
                  HasComponent<[S1, S2, S3]> extends true
                    ? SourceResultWithoutStyling<T, S4>
                    : SourceResultWithStyling<T, S4>,
                  HasComponent<[S1, S2, S3, S4]> extends true
                    ? SourceResultWithoutStyling<T, S5>
                    : SourceResultWithStyling<T, S5>,
                  HasComponent<[S1, S2, S3, S4, S5]> extends true
                    ? SourceResultWithoutStyling<T, S6>
                    : SourceResultWithStyling<T, S6>,
                  HasComponent<[S1, S2, S3, S4, S5, S6]> extends true
                    ? SourceResultWithoutStyling<T, S7>
                    : SourceResultWithStyling<T, S7>,
                  Omit<
                    T,
                    | SourceKeys<S1>
                    | SourceKeys<S2>
                    | SourceKeys<S3>
                    | SourceKeys<S4>
                    | SourceKeys<S5>
                    | SourceKeys<S6>
                    | SourceKeys<S7>
                  >,
                ]
              : Sources extends readonly [
                    infer S2 extends KeySource,
                    infer S3 extends KeySource,
                    infer S4 extends KeySource,
                    infer S5 extends KeySource,
                    infer S6 extends KeySource,
                    infer S7 extends KeySource,
                    infer S8 extends KeySource,
                  ]
                ? [
                    SourceResultWithStyling<T, S1>,
                    IsComponent<S1> extends true
                      ? SourceResultWithoutStyling<T, S2>
                      : SourceResultWithStyling<T, S2>,
                    HasComponent<[S1, S2]> extends true
                      ? SourceResultWithoutStyling<T, S3>
                      : SourceResultWithStyling<T, S3>,
                    HasComponent<[S1, S2, S3]> extends true
                      ? SourceResultWithoutStyling<T, S4>
                      : SourceResultWithStyling<T, S4>,
                    HasComponent<[S1, S2, S3, S4]> extends true
                      ? SourceResultWithoutStyling<T, S5>
                      : SourceResultWithStyling<T, S5>,
                    HasComponent<[S1, S2, S3, S4, S5]> extends true
                      ? SourceResultWithoutStyling<T, S6>
                      : SourceResultWithStyling<T, S6>,
                    HasComponent<[S1, S2, S3, S4, S5, S6]> extends true
                      ? SourceResultWithoutStyling<T, S7>
                      : SourceResultWithStyling<T, S7>,
                    HasComponent<[S1, S2, S3, S4, S5, S6, S7]> extends true
                      ? SourceResultWithoutStyling<T, S8>
                      : SourceResultWithStyling<T, S8>,
                    Omit<
                      T,
                      | SourceKeys<S1>
                      | SourceKeys<S2>
                      | SourceKeys<S3>
                      | SourceKeys<S4>
                      | SourceKeys<S5>
                      | SourceKeys<S6>
                      | SourceKeys<S7>
                      | SourceKeys<S8>
                    >,
                  ]
                : unknown[];

export interface ModalComponent<V, R extends ComponentResult> {
  (props?: ComponentProps<V>): R;
  class: (props?: ComponentProps<V>) => string;
  style: (props?: ComponentProps<V>) => R["style"];
  getVariants: GetVariants<V>;
  keys: (keyof V | keyof R)[];
  variantKeys: (keyof V)[];
  propKeys: (keyof V | keyof R)[];
  /** @internal Base class without variants */
  _baseClass: string;
  /**
   * @internal Returns resolved variants after running the computed function.
   * Used by child components to get parent's setDefaultVariants effects.
   */
  _resolveDefaults: (
    propsVariants: Record<string, unknown>,
  ) => Record<string, unknown>;
}

export interface CVComponent<
  V extends Variants = {},
  CV extends ComputedVariants = {},
  E extends AnyComponent[] = [],
  R extends ComponentResult = ComponentResult,
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

export type MergeVariants<V, CV, E extends AnyComponent[]> = NoInfer<CV> &
  Omit<NoInfer<V>, keyof CV> &
  Omit<MergeExtendedVariants<E>, keyof CV> &
  Omit<MergeExtendedComputedVariants<E>, keyof CV>;

type StringToBoolean<T> = T extends "true" | "false" ? boolean : T;

type VariantValue = ClassValue | StyleClassValue;

type ExtractVariantValue<T> = T extends (value: infer V) => any
  ? V
  : T extends ClassValue
    ? boolean
    : T extends Record<infer K, any>
      ? StringToBoolean<K>
      : never;

export type VariantValues<V> = {
  [K in keyof V]?: ExtractVariantValue<V[K]>;
};

export type StyleValue = CSS.Properties & {
  [key: `--${string}`]: string;
};

export type StyleClassValue = StyleValue & { class?: ClassValue };

export interface ComputedContext<V> {
  variants: VariantValues<V>;
  setVariants: (variants: VariantValues<V>) => void;
  setDefaultVariants: (variants: VariantValues<V>) => void;
}

export type Computed<V> = (context: ComputedContext<V>) => VariantValue;

export type ComputedVariant = (value: any) => VariantValue;
export type ComputedVariants = Record<string, ComputedVariant>;
export type Variant = ClassValue | Record<string, VariantValue>;
export type Variants = Record<string, Variant>;

type ExtendedVariants<E extends AnyComponent[]> = MergeExtendedVariants<E> &
  MergeExtendedComputedVariants<E>;

export type ExtendableVariants<
  V extends Variants,
  E extends AnyComponent[],
> = V & {
  [K in keyof ExtendedVariants<E>]?: Partial<ExtendedVariants<E>[K]> | Variant;
};
