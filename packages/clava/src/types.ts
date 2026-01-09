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

export type ComponentProps<V = {}> = VariantValues<V> &
  Partial<ComponentResult>;

export type GetVariants<V> = (variants?: VariantValues<V>) => VariantValues<V>;

// Key source types - what can be passed as additional parameters to splitProps
export type KeySourceArray = readonly string[];
export type KeySourceComponent = {
  keys: readonly (string | number | symbol)[];
  variantKeys: readonly (string | number | symbol)[];
  getVariants: () => Record<string, unknown>;
};
export type KeySource = KeySourceArray | KeySourceComponent;

// Extract keys from a source (for first source - includes class/style)
type SourceKeys<S> = S extends readonly (infer K)[]
  ? K
  : S extends { keys: readonly (infer K)[] }
    ? K
    : never;

// Extract variant keys from a source (for non-first sources - only variant keys, no class/style)
type SourceVariantKeys<S> = S extends readonly (infer K)[]
  ? K
  : S extends { variantKeys: readonly (infer K)[] }
    ? K
    : S extends { keys: readonly (infer K)[] }
      ? K
      : never;

// Extract defaults from a source (components have defaults, arrays don't)
type SourceDefaults<S> = S extends { getVariants: () => infer Defaults }
  ? Defaults
  : {};

// Result type for first source - pick keys from T and add defaults
type SourceResult<T, S> = Pick<T, Extract<keyof T, SourceKeys<S>>> &
  Omit<SourceDefaults<S>, keyof T>;

// Result type for non-first source - pick only variant keys from T (no class/style)
type SourceVariantResult<T, S> = Pick<
  T,
  Extract<keyof T, SourceVariantKeys<S>>
> &
  Omit<SourceDefaults<S>, keyof T>;

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
// First source uses SourceResult (full keys including class/style for components)
// Subsequent sources use SourceVariantResult (only variant keys for components)
type SplitPropsFunctionResult<
  T,
  S1 extends KeySource,
  Sources extends readonly KeySource[],
> = Sources extends readonly []
  ? [SourceResult<T, S1>, Omit<T, SourceKeys<S1>>]
  : Sources extends readonly [infer S2 extends KeySource]
    ? [
        SourceResult<T, S1>,
        SourceVariantResult<T, S2>,
        Omit<T, SourceKeys<S1> | SourceVariantKeys<S2>>,
      ]
    : Sources extends readonly [
          infer S2 extends KeySource,
          infer S3 extends KeySource,
        ]
      ? [
          SourceResult<T, S1>,
          SourceVariantResult<T, S2>,
          SourceVariantResult<T, S3>,
          Omit<
            T,
            SourceKeys<S1> | SourceVariantKeys<S2> | SourceVariantKeys<S3>
          >,
        ]
      : Sources extends readonly [
            infer S2 extends KeySource,
            infer S3 extends KeySource,
            infer S4 extends KeySource,
          ]
        ? [
            SourceResult<T, S1>,
            SourceVariantResult<T, S2>,
            SourceVariantResult<T, S3>,
            SourceVariantResult<T, S4>,
            Omit<
              T,
              | SourceKeys<S1>
              | SourceVariantKeys<S2>
              | SourceVariantKeys<S3>
              | SourceVariantKeys<S4>
            >,
          ]
        : Sources extends readonly [
              infer S2 extends KeySource,
              infer S3 extends KeySource,
              infer S4 extends KeySource,
              infer S5 extends KeySource,
            ]
          ? [
              SourceResult<T, S1>,
              SourceVariantResult<T, S2>,
              SourceVariantResult<T, S3>,
              SourceVariantResult<T, S4>,
              SourceVariantResult<T, S5>,
              Omit<
                T,
                | SourceKeys<S1>
                | SourceVariantKeys<S2>
                | SourceVariantKeys<S3>
                | SourceVariantKeys<S4>
                | SourceVariantKeys<S5>
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
                SourceResult<T, S1>,
                SourceVariantResult<T, S2>,
                SourceVariantResult<T, S3>,
                SourceVariantResult<T, S4>,
                SourceVariantResult<T, S5>,
                SourceVariantResult<T, S6>,
                Omit<
                  T,
                  | SourceKeys<S1>
                  | SourceVariantKeys<S2>
                  | SourceVariantKeys<S3>
                  | SourceVariantKeys<S4>
                  | SourceVariantKeys<S5>
                  | SourceVariantKeys<S6>
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
                  SourceResult<T, S1>,
                  SourceVariantResult<T, S2>,
                  SourceVariantResult<T, S3>,
                  SourceVariantResult<T, S4>,
                  SourceVariantResult<T, S5>,
                  SourceVariantResult<T, S6>,
                  SourceVariantResult<T, S7>,
                  Omit<
                    T,
                    | SourceKeys<S1>
                    | SourceVariantKeys<S2>
                    | SourceVariantKeys<S3>
                    | SourceVariantKeys<S4>
                    | SourceVariantKeys<S5>
                    | SourceVariantKeys<S6>
                    | SourceVariantKeys<S7>
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
                    SourceResult<T, S1>,
                    SourceVariantResult<T, S2>,
                    SourceVariantResult<T, S3>,
                    SourceVariantResult<T, S4>,
                    SourceVariantResult<T, S5>,
                    SourceVariantResult<T, S6>,
                    SourceVariantResult<T, S7>,
                    SourceVariantResult<T, S8>,
                    Omit<
                      T,
                      | SourceKeys<S1>
                      | SourceVariantKeys<S2>
                      | SourceVariantKeys<S3>
                      | SourceVariantKeys<S4>
                      | SourceVariantKeys<S5>
                      | SourceVariantKeys<S6>
                      | SourceVariantKeys<S7>
                      | SourceVariantKeys<S8>
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
}

export interface Component<
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
  | Component<any, any, any, any>
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
  T extends Component<infer V, any, infer E, any>
    ? V & MergeExtendedVariants<E>
    : {};

type ExtractComputedVariants<T> =
  T extends Component<any, infer CV, infer E, any>
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
