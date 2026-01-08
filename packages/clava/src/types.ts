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
  getVariants: () => Record<string, unknown>;
};
export type KeySource = KeySourceArray | KeySourceComponent;

// Extract keys from a source
type SourceKeys<S> = S extends readonly (infer K)[]
  ? K
  : S extends { keys: readonly (infer K)[] }
    ? K
    : never;

// Extract defaults from a source (components have defaults, arrays don't)
type SourceDefaults<S> = S extends { getVariants: () => infer Defaults }
  ? Defaults
  : {};

// Result type for one source - pick keys from T and add defaults
type SourceResult<T, S> = Pick<T, Extract<keyof T, SourceKeys<S>>> &
  Omit<SourceDefaults<S>, keyof T>;

// Self result with defaults
type SelfResult<T, Keys, Defaults> = Pick<T, Extract<keyof T, Keys>> &
  Omit<Defaults, keyof T>;

// All possible keys from ComponentResult (class, className, style)
type ComponentResultKeys =
  | keyof JSXProps
  | keyof HTMLProps
  | keyof HTMLObjProps;

// Build result tuple based on number of sources
type SplitPropsResult<
  T,
  V,
  D,
  Sources extends readonly KeySource[],
> = Sources extends readonly []
  ? [
      SelfResult<T, keyof V | ComponentResultKeys, D>,
      Omit<T, keyof V | ComponentResultKeys>,
    ]
  : Sources extends readonly [infer S1 extends KeySource]
    ? [
        SelfResult<T, keyof V | ComponentResultKeys, D>,
        SourceResult<T, S1>,
        Omit<T, keyof V | ComponentResultKeys | SourceKeys<S1>>,
      ]
    : Sources extends readonly [
          infer S1 extends KeySource,
          infer S2 extends KeySource,
        ]
      ? [
          SelfResult<T, keyof V | ComponentResultKeys, D>,
          SourceResult<T, S1>,
          SourceResult<T, S2>,
          Omit<
            T,
            keyof V | ComponentResultKeys | SourceKeys<S1> | SourceKeys<S2>
          >,
        ]
      : Sources extends readonly [
            infer S1 extends KeySource,
            infer S2 extends KeySource,
            infer S3 extends KeySource,
          ]
        ? [
            SelfResult<T, keyof V | ComponentResultKeys, D>,
            SourceResult<T, S1>,
            SourceResult<T, S2>,
            SourceResult<T, S3>,
            Omit<
              T,
              | keyof V
              | ComponentResultKeys
              | SourceKeys<S1>
              | SourceKeys<S2>
              | SourceKeys<S3>
            >,
          ]
        : Sources extends readonly [
              infer S1 extends KeySource,
              infer S2 extends KeySource,
              infer S3 extends KeySource,
              infer S4 extends KeySource,
            ]
          ? [
              SelfResult<T, keyof V | ComponentResultKeys, D>,
              SourceResult<T, S1>,
              SourceResult<T, S2>,
              SourceResult<T, S3>,
              SourceResult<T, S4>,
              Omit<
                T,
                | keyof V
                | ComponentResultKeys
                | SourceKeys<S1>
                | SourceKeys<S2>
                | SourceKeys<S3>
                | SourceKeys<S4>
              >,
            ]
          : Sources extends readonly [
                infer S1 extends KeySource,
                infer S2 extends KeySource,
                infer S3 extends KeySource,
                infer S4 extends KeySource,
                infer S5 extends KeySource,
              ]
            ? [
                SelfResult<T, keyof V | ComponentResultKeys, D>,
                SourceResult<T, S1>,
                SourceResult<T, S2>,
                SourceResult<T, S3>,
                SourceResult<T, S4>,
                SourceResult<T, S5>,
                Omit<
                  T,
                  | keyof V
                  | ComponentResultKeys
                  | SourceKeys<S1>
                  | SourceKeys<S2>
                  | SourceKeys<S3>
                  | SourceKeys<S4>
                  | SourceKeys<S5>
                >,
              ]
            : Sources extends readonly [
                  infer S1 extends KeySource,
                  infer S2 extends KeySource,
                  infer S3 extends KeySource,
                  infer S4 extends KeySource,
                  infer S5 extends KeySource,
                  infer S6 extends KeySource,
                ]
              ? [
                  SelfResult<T, keyof V | ComponentResultKeys, D>,
                  SourceResult<T, S1>,
                  SourceResult<T, S2>,
                  SourceResult<T, S3>,
                  SourceResult<T, S4>,
                  SourceResult<T, S5>,
                  SourceResult<T, S6>,
                  Omit<
                    T,
                    | keyof V
                    | ComponentResultKeys
                    | SourceKeys<S1>
                    | SourceKeys<S2>
                    | SourceKeys<S3>
                    | SourceKeys<S4>
                    | SourceKeys<S5>
                    | SourceKeys<S6>
                  >,
                ]
              : Sources extends readonly [
                    infer S1 extends KeySource,
                    infer S2 extends KeySource,
                    infer S3 extends KeySource,
                    infer S4 extends KeySource,
                    infer S5 extends KeySource,
                    infer S6 extends KeySource,
                    infer S7 extends KeySource,
                  ]
                ? [
                    SelfResult<T, keyof V | ComponentResultKeys, D>,
                    SourceResult<T, S1>,
                    SourceResult<T, S2>,
                    SourceResult<T, S3>,
                    SourceResult<T, S4>,
                    SourceResult<T, S5>,
                    SourceResult<T, S6>,
                    SourceResult<T, S7>,
                    Omit<
                      T,
                      | keyof V
                      | ComponentResultKeys
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
                      infer S1 extends KeySource,
                      infer S2 extends KeySource,
                      infer S3 extends KeySource,
                      infer S4 extends KeySource,
                      infer S5 extends KeySource,
                      infer S6 extends KeySource,
                      infer S7 extends KeySource,
                      infer S8 extends KeySource,
                    ]
                  ? [
                      SelfResult<T, keyof V | ComponentResultKeys, D>,
                      SourceResult<T, S1>,
                      SourceResult<T, S2>,
                      SourceResult<T, S3>,
                      SourceResult<T, S4>,
                      SourceResult<T, S5>,
                      SourceResult<T, S6>,
                      SourceResult<T, S7>,
                      SourceResult<T, S8>,
                      Omit<
                        T,
                        | keyof V
                        | ComponentResultKeys
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

// SplitProps as a single generic function type
export type SplitProps<V, D, _R extends ComponentResult> = <
  const T extends Record<string, unknown>,
  const Sources extends readonly KeySource[],
>(
  props: T,
  ...sources: Sources
) => SplitPropsResult<T, V, D, Sources>;

// Build result tuple for OnlyVariants based on number of sources
type OnlyVariantsSplitPropsResult<
  T,
  V,
  D,
  Sources extends readonly KeySource[],
> = Sources extends readonly []
  ? [SelfResult<T, keyof V, D>, Omit<T, keyof V>]
  : Sources extends readonly [infer S1 extends KeySource]
    ? [
        SelfResult<T, keyof V, D>,
        SourceResult<T, S1>,
        Omit<T, keyof V | SourceKeys<S1>>,
      ]
    : Sources extends readonly [
          infer S1 extends KeySource,
          infer S2 extends KeySource,
        ]
      ? [
          SelfResult<T, keyof V, D>,
          SourceResult<T, S1>,
          SourceResult<T, S2>,
          Omit<T, keyof V | SourceKeys<S1> | SourceKeys<S2>>,
        ]
      : Sources extends readonly [
            infer S1 extends KeySource,
            infer S2 extends KeySource,
            infer S3 extends KeySource,
          ]
        ? [
            SelfResult<T, keyof V, D>,
            SourceResult<T, S1>,
            SourceResult<T, S2>,
            SourceResult<T, S3>,
            Omit<T, keyof V | SourceKeys<S1> | SourceKeys<S2> | SourceKeys<S3>>,
          ]
        : Sources extends readonly [
              infer S1 extends KeySource,
              infer S2 extends KeySource,
              infer S3 extends KeySource,
              infer S4 extends KeySource,
            ]
          ? [
              SelfResult<T, keyof V, D>,
              SourceResult<T, S1>,
              SourceResult<T, S2>,
              SourceResult<T, S3>,
              SourceResult<T, S4>,
              Omit<
                T,
                | keyof V
                | SourceKeys<S1>
                | SourceKeys<S2>
                | SourceKeys<S3>
                | SourceKeys<S4>
              >,
            ]
          : Sources extends readonly [
                infer S1 extends KeySource,
                infer S2 extends KeySource,
                infer S3 extends KeySource,
                infer S4 extends KeySource,
                infer S5 extends KeySource,
              ]
            ? [
                SelfResult<T, keyof V, D>,
                SourceResult<T, S1>,
                SourceResult<T, S2>,
                SourceResult<T, S3>,
                SourceResult<T, S4>,
                SourceResult<T, S5>,
                Omit<
                  T,
                  | keyof V
                  | SourceKeys<S1>
                  | SourceKeys<S2>
                  | SourceKeys<S3>
                  | SourceKeys<S4>
                  | SourceKeys<S5>
                >,
              ]
            : Sources extends readonly [
                  infer S1 extends KeySource,
                  infer S2 extends KeySource,
                  infer S3 extends KeySource,
                  infer S4 extends KeySource,
                  infer S5 extends KeySource,
                  infer S6 extends KeySource,
                ]
              ? [
                  SelfResult<T, keyof V, D>,
                  SourceResult<T, S1>,
                  SourceResult<T, S2>,
                  SourceResult<T, S3>,
                  SourceResult<T, S4>,
                  SourceResult<T, S5>,
                  SourceResult<T, S6>,
                  Omit<
                    T,
                    | keyof V
                    | SourceKeys<S1>
                    | SourceKeys<S2>
                    | SourceKeys<S3>
                    | SourceKeys<S4>
                    | SourceKeys<S5>
                    | SourceKeys<S6>
                  >,
                ]
              : Sources extends readonly [
                    infer S1 extends KeySource,
                    infer S2 extends KeySource,
                    infer S3 extends KeySource,
                    infer S4 extends KeySource,
                    infer S5 extends KeySource,
                    infer S6 extends KeySource,
                    infer S7 extends KeySource,
                  ]
                ? [
                    SelfResult<T, keyof V, D>,
                    SourceResult<T, S1>,
                    SourceResult<T, S2>,
                    SourceResult<T, S3>,
                    SourceResult<T, S4>,
                    SourceResult<T, S5>,
                    SourceResult<T, S6>,
                    SourceResult<T, S7>,
                    Omit<
                      T,
                      | keyof V
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
                      infer S1 extends KeySource,
                      infer S2 extends KeySource,
                      infer S3 extends KeySource,
                      infer S4 extends KeySource,
                      infer S5 extends KeySource,
                      infer S6 extends KeySource,
                      infer S7 extends KeySource,
                      infer S8 extends KeySource,
                    ]
                  ? [
                      SelfResult<T, keyof V, D>,
                      SourceResult<T, S1>,
                      SourceResult<T, S2>,
                      SourceResult<T, S3>,
                      SourceResult<T, S4>,
                      SourceResult<T, S5>,
                      SourceResult<T, S6>,
                      SourceResult<T, S7>,
                      SourceResult<T, S8>,
                      Omit<
                        T,
                        | keyof V
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

// OnlyVariantsSplitProps as a single generic function type
export type OnlyVariantsSplitProps<V, D> = <
  const T extends Record<string, unknown>,
  const Sources extends readonly KeySource[],
>(
  props: T,
  ...sources: Sources
) => OnlyVariantsSplitPropsResult<T, V, D, Sources>;

export interface OnlyVariantsComponent<V, D> {
  splitProps: OnlyVariantsSplitProps<V, D>;
  getVariants: GetVariants<V>;
  keys: (keyof V)[];
}

export interface ModalComponent<V, D, R extends ComponentResult> {
  (props?: ComponentProps<V>): R;
  class: (props?: ComponentProps<V>) => string;
  style: (props?: ComponentProps<V>) => R["style"];
  splitProps: SplitProps<V, D, R>;
  getVariants: GetVariants<V>;
  keys: (keyof V | keyof R)[];
  onlyVariants: OnlyVariantsComponent<V, D>;
  /** @internal Base class without variants */
  _baseClass: string;
}

export interface Component<
  V extends Variants = {},
  CV extends ComputedVariants = {},
  E extends AnyComponent[] = [],
  R extends ComponentResult = ComponentResult,
  D = VariantValues<MergeVariants<V, CV, E>>,
> extends ModalComponent<MergeVariants<V, CV, E>, D, R> {
  jsx: ModalComponent<MergeVariants<V, CV, E>, D, JSXProps>;
  html: ModalComponent<MergeVariants<V, CV, E>, D, HTMLProps>;
  htmlObj: ModalComponent<MergeVariants<V, CV, E>, D, HTMLObjProps>;
}

export type AnyComponent =
  | Component<any, any, any, any, any>
  | ModalComponent<any, any, any>;

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
