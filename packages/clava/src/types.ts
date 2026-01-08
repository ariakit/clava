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

export interface OnlyVariantsComponent<V> {
  splitProps: (...args: any[]) => any;
  getVariants: GetVariants<V>;
  keys: (keyof V)[];
}

export interface ModalComponent<V, R extends ComponentResult> {
  (props?: ComponentProps<V>): R;
  class: (props?: ComponentProps<V>) => string;
  style: (props?: ComponentProps<V>) => R["style"];
  splitProps: (...args: any[]) => any;
  getVariants: GetVariants<V>;
  keys: (keyof V | keyof R)[];
  onlyVariants: OnlyVariantsComponent<V>;
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

export type AnyComponent = Component<any, any, any, any>;

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
