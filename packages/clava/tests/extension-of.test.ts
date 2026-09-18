import type { ComponentProps } from "react";
import { expectTypeOf, test } from "vitest";
import {
  type ExtensionOf,
  type VariantProps,
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
  R extends ExtensionOf<typeof disclosure, R> = typeof disclosure,
> = ComponentProps<"div"> &
  VariantProps<R> &
  ([R] extends [typeof disclosure] ? { recipe?: R } : { recipe: R });

function Disclosure<
  R extends ExtensionOf<typeof disclosure, R> = typeof disclosure,
>(props: DisclosureProps<R>) {
  const { recipe = disclosure, ...rest } = props;
  const [variantProps, elementProps] = splitProps(rest, recipe.propKeys);
  const open: boolean | undefined = props.$open;
  const padding: "sm" | "md" | undefined = props.$padding;
  return { ...elementProps, ...recipe.jsx(variantProps), open, padding };
}

function acceptRecipe<R extends ExtensionOf<typeof disclosure, R>>(recipe: R) {
  return recipe;
}

function readKeys<R extends ExtensionOf<typeof disclosure, R>>(recipe: R) {
  return {
    variantKeys: recipe.variantKeys,
    propKeys: recipe.propKeys,
    jsxKeys: recipe.jsx.propKeys,
    htmlKeys: recipe.html.propKeys,
    htmlObjKeys: recipe.htmlObj.propKeys,
  };
}

function readVariants<R extends ExtensionOf<typeof disclosure, R>>(
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

test("ignores base metadata added after an extension was created", () => {
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
    ExtensionOf<typeof namedBase, typeof disclosure>
  >();
  expectTypeOf(navDisclosure).toExtend<
    ExtensionOf<typeof namedBase, typeof navDisclosure>
  >();
  expectTypeOf(namedChild).toExtend<
    ExtensionOf<typeof namedBase, typeof namedChild>
  >();
  expectTypeOf(renamedBase).toExtend<
    ExtensionOf<typeof namedBase, typeof renamedBase>
  >();

  const nested = cv({
    extend: [navDisclosure],
    variants: { $nested: "nested" },
  });
  expectTypeOf(nested).toExtend<ExtensionOf<typeof namedBase, typeof nested>>();

  const unrelated = cv({ variants: { $other: "other" } });
  const partial = cv({ variants: { $open: "open" } });
  const sibling = cv({ extend: [frame], variants: { $disabled: "disabled" } });
  expectTypeOf<
    ExtensionOf<typeof namedBase, typeof unrelated>
  >().toEqualTypeOf<never>();
  expectTypeOf<
    ExtensionOf<typeof namedBase, typeof partial>
  >().toEqualTypeOf<never>();
  expectTypeOf<
    ExtensionOf<typeof namedBase, typeof sibling>
  >().toEqualTypeOf<never>();
  expectTypeOf<
    ExtensionOf<typeof namedBase, typeof frame>
  >().toEqualTypeOf<never>();
  expectTypeOf({ ...navDisclosure }).not.toExtend<
    ExtensionOf<typeof namedBase, typeof navDisclosure>
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
  const useRecipe = <R extends ExtensionOf<typeof disclosure, R>>(
    recipe: R,
  ) => {
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

test("rejects unrelated recipes, partial matches, siblings, and ancestors", () => {
  const unrelated = cv({ variants: { $other: "other" } });
  const partial = cv({ variants: { $open: "open" } });
  const sibling = cv({ extend: [frame], variants: { $disabled: "disabled" } });

  // @ts-expect-error The recipe is unrelated to disclosure.
  acceptRecipe(unrelated);
  // @ts-expect-error Sharing a variant does not establish an extension.
  acceptRecipe(partial);
  // @ts-expect-error Sharing an ancestor does not establish an extension.
  acceptRecipe(sibling);
  // @ts-expect-error The base's ancestor does not extend the base.
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
});

test("accepts structurally identical recipes without per-call identity", () => {
  const identical = cv({
    extend: [frame],
    variants: { $open: "different-class" },
  });
  expectTypeOf(acceptRecipe(identical)).toEqualTypeOf<typeof identical>();
});

test("does not make the extending recipe assignable to the base recipe", () => {
  // @ts-expect-error The base's key arrays cannot contain placement.
  const base: typeof disclosure = navDisclosure;
  expectTypeOf(base).toEqualTypeOf<typeof disclosure>();

  const useRecipe = <R extends ExtensionOf<typeof disclosure, R>>(
    recipe: R,
  ) => {
    // @ts-expect-error A generic extension may contain additional keys.
    const base: typeof disclosure = recipe;
    // @ts-expect-error A generic extension's keys may include placement.
    const keys: ("$open" | "$padding")[] = recipe.variantKeys;
    return { base, keys };
  };
  useRecipe(navDisclosure);
});

test("checks ancestry through full recipes rather than mode helpers", () => {
  const throughMode = cv({
    extend: [disclosure.jsx],
    variants: { $placement: { top: "top-0" } },
  });
  // @ts-expect-error A mode helper does not retain its recipe's extend list.
  acceptRecipe(throughMode);
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
    ExtensionOf<typeof empty, typeof extension>
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
  // @ts-expect-error One union member is not an extension of disclosure.
  acceptRecipe(chooseUnrelated(true));
});

test("retains exact keys when a component defaults to its base recipe", () => {
  const getKeys = <
    R extends ExtensionOf<typeof disclosure, R> = typeof disclosure,
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
