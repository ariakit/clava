import type { ComponentProps } from "react";
import { expectTypeOf, test } from "vitest";
import {
  type RecipeLike,
  type VariantProps,
  type VariantPropsWithRecipe,
  cv,
  splitProps,
} from "../src/index.ts";

const disclosure = cv({ variants: { $open: "open" } });
const navigation = cv({
  variants: {
    $open: "expanded",
    $placement: { top: "top-0", bottom: "bottom-0" },
  },
});

type DisclosureProps<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
> = ComponentProps<"div"> & VariantPropsWithRecipe<typeof disclosure, R>;

function Disclosure<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
>(props: DisclosureProps<R>) {
  const { recipe = disclosure, ...rest } = props;
  const [variantProps, elementProps] = splitProps(rest, recipe);
  expectTypeOf(props.$open).toEqualTypeOf<boolean | undefined>();
  return { ...elementProps, ...recipe.jsx(variantProps) };
}

type StyledDisclosureProps<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
> = ComponentProps<"div"> &
  VariantPropsWithRecipe<typeof disclosure, R, "styles">;

function StyledDisclosure<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
>(props: StyledDisclosureProps<R>) {
  const { styles = disclosure, ...rest } = props;
  const [variantProps, elementProps] = splitProps(rest, styles);
  expectTypeOf(props.$open).toEqualTypeOf<boolean | undefined>();
  return { ...elementProps, ...styles.jsx(variantProps) };
}

function chooseRecipe(expanded: boolean) {
  return expanded ? navigation : disclosure;
}

test("defaults to an optional recipe prop for the base type", () => {
  expectTypeOf<
    VariantPropsWithRecipe<typeof disclosure, typeof disclosure>
  >().toEqualTypeOf<
    VariantProps<typeof disclosure> & { recipe?: typeof disclosure }
  >();

  Disclosure({});
  Disclosure({ $open: true, id: "disclosure" });
  Disclosure({ recipe: disclosure, $open: true });

  const restyled = cv({ variants: { $open: "expanded" } });
  Disclosure<typeof restyled>({ $open: true });
  Disclosure({ recipe: restyled, $open: true });
});

test("infers added variant props from the selected recipe", () => {
  Disclosure({ recipe: navigation, $placement: "top", $open: true });
  Disclosure<typeof navigation>({ recipe: navigation, $placement: "bottom" });
  // @ts-expect-error The selected recipe does not define this placement.
  Disclosure({ recipe: navigation, $placement: "left" });
  // @ts-expect-error The base recipe does not define placement.
  Disclosure({ $placement: "top" });
});

test("resolves optional recipes before forwarding them", () => {
  // @ts-expect-error Inference cannot use undefined as a recipe.
  Disclosure({ recipe: undefined });
  // @ts-expect-error The custom prop has the same inference constraint.
  StyledDisclosure({ styles: undefined });

  const Panel = (props: { recipe?: typeof disclosure | undefined }) => {
    // @ts-expect-error An optional recipe can infer undefined into R.
    Disclosure({ recipe: props.recipe });
    // @ts-expect-error Spreading optional props has the same constraint.
    Disclosure({ ...props });
    return Disclosure({ ...props, recipe: props.recipe ?? disclosure });
  };
  const Navigation = (
    props: VariantProps<typeof navigation> & {
      styles?: typeof navigation | undefined;
    },
  ) => {
    // @ts-expect-error An optional styles prop can infer undefined into R.
    StyledDisclosure({ ...props });
    return StyledDisclosure({ ...props, styles: props.styles ?? navigation });
  };

  Panel({});
  Panel({ recipe: disclosure });
  Navigation({ $open: true, $placement: "top" });
  Navigation({ styles: navigation, $placement: "bottom" });
  // @ts-expect-error The wrapper preserves the selected variant values.
  Navigation({ $placement: "left" });
});

test("requires a recipe when the selected type adds variants", () => {
  expectTypeOf<
    VariantPropsWithRecipe<typeof disclosure, typeof navigation>
  >().toEqualTypeOf<
    VariantProps<typeof navigation> & { recipe: typeof navigation }
  >();

  // @ts-expect-error A type argument cannot supply the recipe at runtime.
  Disclosure<typeof navigation>({ $placement: "top" });
  // @ts-expect-error The selected recipe cannot be absent.
  Disclosure<typeof navigation>({ recipe: undefined });
  // @ts-expect-error Specialized props must include their recipe.
  const detached: DisclosureProps<typeof navigation> = { $placement: "top" };
  Disclosure(detached);
});

test("supports a custom recipe prop name", () => {
  expectTypeOf<
    VariantPropsWithRecipe<typeof disclosure, typeof disclosure, "styles">
  >().toEqualTypeOf<
    VariantProps<typeof disclosure> & { styles?: typeof disclosure }
  >();
  expectTypeOf<
    VariantPropsWithRecipe<typeof disclosure, typeof navigation, "styles">
  >().toEqualTypeOf<
    VariantProps<typeof navigation> & { styles: typeof navigation }
  >();

  StyledDisclosure({});
  StyledDisclosure({ $open: true });
  StyledDisclosure({ styles: navigation, $placement: "top", id: "nav" });
  // @ts-expect-error The configured prop is named styles.
  StyledDisclosure({ recipe: navigation });
  // @ts-expect-error The selected recipe does not define this placement.
  StyledDisclosure({ styles: navigation, $placement: "left" });
  // @ts-expect-error The custom prop is required for added variants.
  StyledDisclosure<typeof navigation>({ $placement: "top" });
});

test("supports wrappers that supply the selected recipe", () => {
  type NavigationProps = Omit<
    StyledDisclosureProps<typeof navigation>,
    "styles"
  >;
  const Navigation = (props: NavigationProps) =>
    StyledDisclosure({ ...props, styles: navigation });

  Navigation({ $open: true, $placement: "top", id: "nav" });
  // @ts-expect-error The wrapper preserves the selected variant values.
  Navigation({ $placement: "left" });
});

test("requires a recipe for unions that include added variants", () => {
  const recipe = chooseRecipe(true);
  Disclosure({ recipe });
  StyledDisclosure({ styles: recipe });
  // @ts-expect-error A union containing added variants needs a recipe.
  Disclosure<typeof recipe>({});
  // @ts-expect-error The custom prop is also required for this union.
  StyledDisclosure<typeof recipe>({});
});

test("rejects incompatible recipes with default and custom prop names", () => {
  const incompatible = cv({ variants: { $other: "other" } });
  expectTypeOf<
    VariantPropsWithRecipe<
      typeof disclosure,
      // @ts-expect-error The selected recipe does not supply the open variant.
      typeof incompatible
    >
  >();
  // @ts-expect-error The selected recipe does not supply the open variant.
  Disclosure({ recipe: incompatible });
  // @ts-expect-error The custom prop preserves the compatibility check.
  StyledDisclosure({ styles: incompatible });

  const paddedDisclosure = cv({
    extend: [disclosure],
    variants: { $padding: { sm: "p-2", md: "p-4" } },
  });
  expectTypeOf<
    VariantPropsWithRecipe<
      typeof paddedDisclosure,
      // @ts-expect-error Optional base props do not make missing variants compatible.
      typeof disclosure
    >
  >();
});
