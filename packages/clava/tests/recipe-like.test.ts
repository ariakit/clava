import type { ComponentProps } from "react";
import { expectTypeOf, test } from "vitest";
import {
  type RecipeLike,
  type VariantProps,
  type VariantPropsWithRecipe,
  cv,
  splitProps,
} from "../src/index.ts";
import type { HTMLObjProps, HTMLProps, JSXProps } from "../src/types.ts";

const frame = cv({ variants: { $padding: { sm: "p-2", md: "p-4" } } });
const disclosure = cv({
  extend: [frame],
  variants: { $open: "open" },
});
const navDisclosure = cv({
  extend: [disclosure],
  variants: { $placement: { top: "top-0", bottom: "bottom-0" } },
});

type DisclosureProps<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
> = ComponentProps<"div"> & VariantPropsWithRecipe<typeof disclosure, R>;

function Disclosure<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
>(props: DisclosureProps<R>) {
  const { recipe = disclosure, ...rest } = props;
  const [variantProps, elementProps] = splitProps(rest, recipe.propKeys);
  const open: boolean | undefined = props.$open;
  const padding: "sm" | "md" | undefined = props.$padding;
  return { ...elementProps, ...recipe.jsx(variantProps), open, padding };
}

function acceptRecipe<R extends RecipeLike<typeof disclosure, R>>(recipe: R) {
  return recipe;
}

function readKeys<R extends RecipeLike<typeof disclosure, R>>(recipe: R) {
  return {
    variantKeys: recipe.variantKeys,
    propKeys: recipe.propKeys,
    jsxKeys: recipe.jsx.propKeys,
    htmlKeys: recipe.html.propKeys,
    htmlObjKeys: recipe.htmlObj.propKeys,
  };
}

function readVariants<R extends RecipeLike<typeof disclosure, R>>(
  recipe: R,
  props: VariantProps<R>,
) {
  return recipe.variantKeys.map((key) => props[key]);
}

test("accepts the base recipe and extensions with additional variants", () => {
  const sameVariants = cv({ extend: [disclosure], class: "custom" });
  expectTypeOf(acceptRecipe(disclosure)).toEqualTypeOf<typeof disclosure>();
  expectTypeOf(acceptRecipe(sameVariants)).toEqualTypeOf<typeof sameVariants>();
  expectTypeOf(acceptRecipe(navDisclosure)).toEqualTypeOf<
    typeof navDisclosure
  >();

  Disclosure({});
  Disclosure({ $open: true, $padding: "sm" });
  Disclosure({ recipe: navDisclosure, $placement: "top", id: "nav" });
  Disclosure<typeof navDisclosure>({
    recipe: navDisclosure,
    $placement: "bottom",
  });
});

test("accepts independently defined recipes with compatible variants", () => {
  const independent = cv({
    variants: {
      $padding: { sm: "p-1", md: "p-3" },
      $open: "expanded",
      $placement: { top: "top-1", bottom: "bottom-1" },
    },
  });
  expectTypeOf(acceptRecipe(independent)).toEqualTypeOf<typeof independent>();
  Disclosure({ recipe: independent, $placement: "top", $open: true });
  const keys = readKeys(independent);
  expectTypeOf(keys.variantKeys).toEqualTypeOf<
    ("$padding" | "$open" | "$placement")[]
  >();
});

test("accepts indirect and multiple extensions", () => {
  const nested = cv({
    extend: [navDisclosure],
    variants: { $nested: "nested" },
  });
  const textFrame = cv({ variants: { $tone: { red: "red", blue: "blue" } } });
  const multiple = cv({ extend: [textFrame, nested] });
  expectTypeOf(acceptRecipe(multiple)).toEqualTypeOf<typeof multiple>();
  Disclosure({ recipe: multiple, $nested: true, $tone: "red" });
});

test("accepts recipes with added metadata and their extensions", () => {
  const namedBase = Object.assign(disclosure, { displayName: "Disclosure" });
  const namedChild = Object.assign(navDisclosure, {
    displayName: "NavDisclosure",
  });
  const nested = cv({
    extend: [namedChild],
    variants: { $nested: "nested" },
  });

  expectTypeOf(acceptRecipe(namedBase)).toEqualTypeOf<typeof namedBase>();
  expectTypeOf(acceptRecipe(namedChild)).toEqualTypeOf<typeof namedChild>();
  expectTypeOf(acceptRecipe(nested)).toEqualTypeOf<typeof nested>();
  expectTypeOf(readKeys(namedChild).variantKeys).toEqualTypeOf<
    ("$padding" | "$open" | "$placement")[]
  >();
});

test("ignores metadata on the base and candidate", () => {
  const namedBase = Object.assign(disclosure, {
    displayName: "Disclosure" as const,
  });
  const namedChild = Object.assign(navDisclosure, {
    displayName: "NavDisclosure" as const,
  });
  const renamedBase = Object.assign(disclosure, {
    displayName: "RenamedDisclosure" as const,
  });
  expectTypeOf(disclosure).toExtend<
    RecipeLike<typeof namedBase, typeof disclosure>
  >();
  expectTypeOf(navDisclosure).toExtend<
    RecipeLike<typeof namedBase, typeof navDisclosure>
  >();
  expectTypeOf(namedChild).toExtend<
    RecipeLike<typeof namedBase, typeof namedChild>
  >();
  expectTypeOf(renamedBase).toExtend<
    RecipeLike<typeof namedBase, typeof renamedBase>
  >();

  const nested = cv({
    extend: [navDisclosure],
    variants: { $nested: "nested" },
  });
  expectTypeOf(nested).toExtend<RecipeLike<typeof namedBase, typeof nested>>();

  const unrelated = cv({ variants: { $other: "other" } });
  const partial = cv({ variants: { $open: "open" } });
  const sibling = cv({ extend: [frame], variants: { $disabled: "disabled" } });
  expectTypeOf<
    RecipeLike<typeof namedBase, typeof unrelated>
  >().toEqualTypeOf<never>();
  expectTypeOf<
    RecipeLike<typeof namedBase, typeof partial>
  >().toEqualTypeOf<never>();
  expectTypeOf<
    RecipeLike<typeof namedBase, typeof sibling>
  >().toEqualTypeOf<never>();
  expectTypeOf<
    RecipeLike<typeof namedBase, typeof frame>
  >().toEqualTypeOf<never>();
  expectTypeOf({ ...navDisclosure }).not.toExtend<
    RecipeLike<typeof namedBase, typeof navDisclosure>
  >();
});

test("keeps exact key types through a generic recipe constraint", () => {
  const keys = readKeys(navDisclosure);
  expectTypeOf(keys.variantKeys).toEqualTypeOf<
    ("$padding" | "$open" | "$placement")[]
  >();
  expectTypeOf(keys.propKeys).toEqualTypeOf<
    ("$padding" | "$open" | "$placement" | "class" | "className" | "style")[]
  >();
  expectTypeOf(keys.jsxKeys).toEqualTypeOf<
    ("$padding" | "$open" | "$placement" | "className" | "style")[]
  >();
  expectTypeOf(keys.htmlKeys).toEqualTypeOf<
    ("$padding" | "$open" | "$placement" | "class" | "style")[]
  >();
  expectTypeOf(keys.htmlObjKeys).toEqualTypeOf<typeof keys.htmlKeys>();
  expectTypeOf(navDisclosure.variantKeys).toEqualTypeOf<
    typeof keys.variantKeys
  >();
  expectTypeOf(navDisclosure.propKeys).toEqualTypeOf<typeof keys.propKeys>();
});

test("indexes variant props with their keys without casts", () => {
  const values = readVariants(navDisclosure, { $placement: "top" });
  expectTypeOf(values).toEqualTypeOf<
    (boolean | "sm" | "md" | "top" | "bottom" | undefined)[]
  >();
});

test("preserves mode calls and base variants inside a generic function", () => {
  const useRecipe = <R extends RecipeLike<typeof disclosure, R>>(recipe: R) => {
    expectTypeOf(recipe({ $open: true }).class).toEqualTypeOf<string>();
    expectTypeOf(recipe.class({ $padding: "sm" })).toEqualTypeOf<string>();
    expectTypeOf(recipe.style()).toEqualTypeOf<
      ReturnType<typeof disclosure.style>
    >();
    expectTypeOf(recipe.jsx({ $open: true })).toEqualTypeOf<JSXProps>();
    expectTypeOf(recipe.html({ $open: true })).toEqualTypeOf<HTMLProps>();
    expectTypeOf(recipe.htmlObj({ $open: true })).toEqualTypeOf<HTMLObjProps>();
    expectTypeOf(recipe.getVariants().$open).toEqualTypeOf<
      boolean | undefined
    >();
  };
  useRecipe(navDisclosure);
});

test("supports React wrapper props and rejects unknown variant values", () => {
  type NavDisclosureProps = Omit<
    DisclosureProps<typeof navDisclosure>,
    "recipe"
  >;
  const NavDisclosure = (props: NavDisclosureProps) =>
    Disclosure({ ...props, recipe: navDisclosure });

  NavDisclosure({ $placement: "top", $open: true, id: "nav" });
  // @ts-expect-error The child does not define this placement.
  NavDisclosure({ $placement: "left" });
  // @ts-expect-error The default recipe does not define placement.
  Disclosure({ $placement: "top" });
});

test("requires the recipe when component props select an extension", () => {
  // @ts-expect-error A type argument cannot supply the child recipe at runtime.
  Disclosure<typeof navDisclosure>({ $placement: "top" });
  // @ts-expect-error Specialized props must include their recipe.
  const detached: DisclosureProps<typeof navDisclosure> = { $placement: "top" };
  Disclosure(detached);

  const props: DisclosureProps<typeof navDisclosure> = {
    recipe: navDisclosure,
    $placement: "top",
  };
  Disclosure(props);
  Disclosure({ $open: true });
});

test("requires every base variant regardless of recipe ancestry", () => {
  const unrelated = cv({ variants: { $other: "other" } });
  const partial = cv({ variants: { $open: "open" } });
  const sibling = cv({ extend: [frame], variants: { $disabled: "disabled" } });

  // @ts-expect-error The recipe does not define the base variants.
  acceptRecipe(unrelated);
  // @ts-expect-error The recipe does not define padding.
  acceptRecipe(partial);
  // @ts-expect-error The sibling does not define open.
  acceptRecipe(sibling);
  // @ts-expect-error The ancestor does not define open.
  acceptRecipe(frame);
});

test("rejects changes that break the base variant contract", () => {
  const wider = cv({
    extend: [disclosure],
    variants: { $padding: { lg: "p-8" } },
  });
  const narrower = cv({
    extend: [disclosure],
    variants: { $padding: { md: null } },
  });
  // @ts-expect-error getVariants may return lg, which the base cannot return.
  acceptRecipe(wider);
  // @ts-expect-error The child cannot accept every base variant value.
  acceptRecipe(narrower);

  const differentType = cv({
    variants: {
      $padding: { sm: "p-1", md: "p-3" },
      $open: { open: "expanded", closed: "collapsed" },
    },
  });
  // @ts-expect-error The open variant must accept and return booleans.
  acceptRecipe(differentType);
});

test("accepts structurally identical recipes without per-call identity", () => {
  const identical = cv({
    variants: {
      $padding: { sm: "p-1", md: "p-3" },
      $open: "different-class",
    },
  });
  expectTypeOf(acceptRecipe(identical)).toEqualTypeOf<typeof identical>();
});

test("does not make the extending recipe assignable to the base recipe", () => {
  // @ts-expect-error The base's key arrays cannot contain placement.
  const base: typeof disclosure = navDisclosure;
  expectTypeOf(base).toEqualTypeOf<typeof disclosure>();

  const useRecipe = <R extends RecipeLike<typeof disclosure, R>>(recipe: R) => {
    // @ts-expect-error A generic extension may contain additional keys.
    const base: typeof disclosure = recipe;
    // @ts-expect-error A generic extension's keys may include placement.
    const keys: ("$open" | "$padding")[] = recipe.variantKeys;
    return { base, keys };
  };
  useRecipe(navDisclosure);
});

test("accepts recipes composed from mode helpers", () => {
  const throughMode = cv({
    extend: [disclosure.jsx],
    variants: { $placement: { top: "top-0" } },
  });
  expectTypeOf(acceptRecipe(throughMode)).toEqualTypeOf<typeof throughMode>();
  Disclosure({ recipe: throughMode, $placement: "top" });
  // @ts-expect-error The component requires a full recipe with all modes.
  acceptRecipe(disclosure.jsx);
});

test("handles nested extension trees and empty bases", () => {
  const one = cv({ extend: [navDisclosure], variants: { $one: "one" } });
  const two = cv({ extend: [one], variants: { $two: "two" } });
  const three = cv({ extend: [two], variants: { $three: "three" } });
  const four = cv({ extend: [three], variants: { $four: "four" } });
  const five = cv({ extend: [four], variants: { $five: "five" } });
  const diamond = cv({ extend: [four, five] });
  expectTypeOf(acceptRecipe(diamond)).toEqualTypeOf<typeof diamond>();

  const empty = cv();
  const extension = cv({ extend: [empty], variants: { $open: "open" } });
  expectTypeOf(extension).toExtend<
    RecipeLike<typeof empty, typeof extension>
  >();
  expectTypeOf(disclosure).toExtend<
    RecipeLike<typeof empty, typeof disclosure>
  >();
});

test("accepts a union only when all its members satisfy the constraint", () => {
  const chooseRecipe = (child: boolean) => (child ? navDisclosure : disclosure);
  const recipe = chooseRecipe(true);
  acceptRecipe(recipe);
  expectTypeOf(readKeys(recipe).variantKeys).toEqualTypeOf<
    ("$open" | "$padding" | "$placement")[]
  >();

  const chooseUnrelated = (child: boolean) => (child ? navDisclosure : frame);
  // @ts-expect-error One union member does not define open.
  acceptRecipe(chooseUnrelated(true));

  const partial = cv({ variants: { $open: "expanded" } });
  const choosePartial = (complete: boolean) =>
    complete ? navDisclosure : partial;
  // @ts-expect-error A shared optional variant cannot hide missing padding.
  acceptRecipe(choosePartial(true));

  const independent = cv({
    variants: {
      $padding: { sm: "p-1", md: "p-3" },
      $open: "expanded",
      $side: { left: "left-0", right: "right-0" },
    },
  });
  const chooseCompatible = (navigation: boolean) =>
    navigation ? navDisclosure : independent;
  const compatible = chooseCompatible(true);
  expectTypeOf(acceptRecipe(compatible)).toEqualTypeOf<typeof compatible>();
  expectTypeOf(readKeys(compatible).variantKeys).toEqualTypeOf<
    ("$padding" | "$open" | "$placement" | "$side")[]
  >();
});

test("retains exact keys when a component defaults to its base recipe", () => {
  const getKeys = <
    R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
  >(
    props: DisclosureProps<R>,
  ) => {
    const { recipe = disclosure } = props;
    return { variantKeys: recipe.variantKeys, propKeys: recipe.propKeys };
  };
  const keys = getKeys({ recipe: navDisclosure });
  expectTypeOf<(typeof keys.variantKeys)[number]>().toEqualTypeOf<
    "$padding" | "$open" | "$placement"
  >();
  expectTypeOf<(typeof keys.propKeys)[number]>().toEqualTypeOf<
    "$padding" | "$open" | "$placement" | "class" | "className" | "style"
  >();
});
