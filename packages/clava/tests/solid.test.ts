import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { expect, expectTypeOf, test } from "vitest";
import { type VariantProps, cv, splitProps } from "../src/index.ts";
import { type HTMLObjProps } from "../src/types.ts";

test("splitProps", () => {
  const recipe = cv({ variants: { size: { sm: "sm", md: "md" } } });

  interface Props extends ComponentProps<"div">, VariantProps<typeof recipe> {}
  const props: Props = { class: "custom", size: "md", id: "my-div" };

  const [variantProps, rest] = splitProps(props, recipe);
  expectTypeOf(variantProps.style).toEqualTypeOf<
    string | JSX.CSSProperties | false | undefined
  >();
  expectTypeOf(variantProps.class).toEqualTypeOf<JSX.ClassValue>();
  expect(variantProps.class).toBe("custom");
  expect(variantProps).toEqual({ size: "md", class: "custom" });
  expect(rest).toEqual({ id: "my-div" });
});

test("split props feed back into the recipe", () => {
  const recipe = cv({ variants: { size: { sm: "sm", md: "md" } } });

  interface Props extends ComponentProps<"div">, VariantProps<typeof recipe> {}
  const props: Props = {
    class: ["custom", { active: true, hidden: false }, false],
    style: { color: "red" },
    size: "md",
  };

  // Solid 2 types `style` as `string | JSX.CSSProperties | false | undefined`
  // (whose `-${string}` index allows `undefined`) and `class` as
  // `JSX.ClassValue`, so recipe props must keep accepting both.
  // https://github.com/ariakit/clava/issues/483#issuecomment-5447514407
  const [variantProps] = splitProps(props, recipe);
  expect(recipe.htmlObj(variantProps)).toEqual({
    class: "md custom active",
    style: { color: "red" },
  });
  expect(recipe.html(variantProps)).toEqual({
    class: "md custom active",
    style: "color: red;",
  });

  const removedStyleProps: Props = { style: false, size: "sm" };
  const [removedVariantProps] = splitProps(removedStyleProps, recipe);
  expect(recipe.htmlObj(removedVariantProps)).toEqual({
    class: "sm",
    style: {},
  });
});

test("recipe props", () => {
  const recipe = cv({
    style: { fontSize: "16px" },
    variants: { size: { sm: "sm", md: "md" } },
  }).htmlObj;
  const props = recipe({ size: "sm", className: "custom" });
  expectTypeOf(props).toEqualTypeOf<HTMLObjProps>();
  expect(props).toEqual({
    class: "sm custom",
    style: { "font-size": "16px" },
  });
});

test("solid omit accepts html propKeys", () => {
  const recipe = cv({ variants: { size: { sm: "sm", md: "md" } } });
  expect(recipe.html.propKeys).toEqual(["class", "style", "size"]);

  interface Props
    extends ComponentProps<"button">, VariantProps<typeof recipe> {}
  const props: Props = { class: "custom", size: "md", id: "my-button" };

  const rest = omit(props, ...recipe.html.propKeys);
  expect(
    // @ts-expect-error omitted props should not have class
    rest.class,
  ).toBeUndefined();
  expect(
    // @ts-expect-error omitted props should not have style
    rest.style,
  ).toBeUndefined();
  expect(
    // @ts-expect-error omitted props should not have size
    rest.size,
  ).toBeUndefined();
  expect(rest).toEqual({ id: "my-button" });
});

test("solid omit accepts htmlObj propKeys", () => {
  const recipe = cv({ variants: { size: { sm: "sm", md: "md" } } });
  expect(recipe.htmlObj.propKeys).toEqual(["class", "style", "size"]);

  interface Props
    extends ComponentProps<"button">, VariantProps<typeof recipe> {}
  const props: Props = { class: "custom", size: "md", id: "my-button" };

  const rest = omit(props, ...recipe.htmlObj.propKeys);
  expect(
    // @ts-expect-error omitted props should not have class
    rest.class,
  ).toBeUndefined();
  expect(
    // @ts-expect-error omitted props should not have style
    rest.style,
  ).toBeUndefined();
  expect(
    // @ts-expect-error omitted props should not have size
    rest.size,
  ).toBeUndefined();
  expect(rest).toEqual({ id: "my-button" });
});
