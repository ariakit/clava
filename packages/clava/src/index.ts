import clsx, { type ClassValue as ClsxClassValue } from "clsx";

import type {
  Variants,
  ComputedVariants,
  AnyComponent,
  Component,
  StyleProps,
  ClassValue,
  StyleValue,
  StyleClassValue,
  VariantValues,
  Computed,
  ExtendableVariants,
  MergeVariants,
} from "./types.ts";

const MODES = ["jsx", "html", "htmlObj"] as const;
type Mode = (typeof MODES)[number];

export type { ClassValue, StyleValue, StyleClassValue };

export type VariantProps<T extends Pick<AnyComponent, "getVariants">> =
  ReturnType<T["getVariants"]>;

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
  defaultVariants?: VariantValues<MergeVariants<V, CV, E>>;
  computed?: Computed<MergeVariants<V, CV, E>>;
}

interface CreateParams<M extends Mode> {
  defaultMode?: M;
  transformClass?: (className: string) => string;
}

export function create<M extends Mode>({
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
  ): Component<V, CV, E, StyleProps[M]> => ({}) as any;

  return { cv, cx };
}

export const { cv, cx } = create();
