import type { CSSProperties, ComponentProps } from "react";
import { expect, expectTypeOf, test } from "vitest";
import { type VariantProps, cv, splitProps } from "../src/index.ts";
import type { JSXProps } from "../src/types.ts";

test("splitProps", () => {
  const recipe = cv({ variants: { size: { sm: "sm", md: "md" } } });

  interface Props extends ComponentProps<"div">, VariantProps<typeof recipe> {}
  const props: Props = { className: "custom", size: "md", id: "my-div" };

  const [variantProps, rest] = splitProps(props, recipe);
  expectTypeOf(variantProps.style).toEqualTypeOf<CSSProperties | undefined>();
  expectTypeOf(variantProps.className).toEqualTypeOf<string | undefined>();
  expect(variantProps.className).toBe("custom");
  expect(variantProps).toEqual({ size: "md", className: "custom" });
  expect(
    // @ts-expect-error rest props should not have className
    rest.className,
  ).toBeUndefined();
  expect(
    // @ts-expect-error rest props should not have style
    rest.style,
  ).toBeUndefined();
  expect(rest).toEqual({ id: "my-div" });
});

test("split props feed back into the recipe", () => {
  const recipe = cv({ variants: { size: { sm: "sm", md: "md" } } });

  interface Props extends ComponentProps<"div">, VariantProps<typeof recipe> {}
  const props: Props = { style: { color: "red" }, size: "md" };

  // React types `style` as `CSSProperties`, which declares no custom-property
  // index signature, so the style input type must keep accepting it.
  // https://github.com/ariakit/clava/issues/483#issuecomment-5447514407
  const [variantProps] = splitProps(props, recipe);
  expect(recipe.jsx(variantProps)).toEqual({
    className: "md",
    style: { color: "red" },
  });
});

test("recipe props", () => {
  const recipe = cv({
    style: { fontSize: "16px" },
    variants: { size: { sm: "sm", md: "md" } },
  }).jsx;
  const props = recipe({ size: "sm", className: "custom" });
  expectTypeOf(props).toEqualTypeOf<JSXProps>();
  expect(props).toEqual({
    className: "sm custom",
    style: { fontSize: "16px" },
  });
});
