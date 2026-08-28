import type { ComponentProps, JSX } from "solid-js";
import { splitProps as splitSolidProps } from "solid-js";
import { expect, expectTypeOf, test } from "vitest";
import { type VariantProps, cv, splitProps } from "../src/index.ts";
import { type HTMLObjProps } from "../src/types.ts";

test("splitProps", () => {
  const component = cv({ variants: { size: { sm: "sm", md: "md" } } });

  interface Props
    extends ComponentProps<"div">, VariantProps<typeof component> {}
  const props: Props = { class: "custom", size: "md", id: "my-div" };

  const [variantProps, rest] = splitProps(props, component);
  expectTypeOf(variantProps.style).toEqualTypeOf<
    string | JSX.CSSProperties | undefined
  >();
  expectTypeOf(variantProps.class).toEqualTypeOf<string | undefined>();
  expect(variantProps.class).toBe("custom");
  expect(variantProps).toEqual({ size: "md", class: "custom" });
  expect(rest).toEqual({ id: "my-div" });
});

test("split props feed back into the component", () => {
  const component = cv({ variants: { size: { sm: "sm", md: "md" } } });

  interface Props
    extends ComponentProps<"div">, VariantProps<typeof component> {}
  const props: Props = { style: { color: "red" }, size: "md" };

  // Solid types `style` as `string | JSX.CSSProperties`, whose `-${string}`
  // index allows `undefined`, so the style input type must keep accepting it.
  // https://github.com/ariakit/clava/issues/483#issuecomment-5447514407
  const [variantProps] = splitProps(props, component);
  expect(component.htmlObj(variantProps)).toEqual({
    class: "md",
    style: { color: "red" },
  });
});

test("component props", () => {
  const component = cv({
    style: { fontSize: "16px" },
    variants: { size: { sm: "sm", md: "md" } },
  }).htmlObj;
  const props = component({ size: "sm", className: "custom" });
  expectTypeOf(props).toEqualTypeOf<HTMLObjProps>();
  expect(props).toEqual({
    class: "sm custom",
    style: { "font-size": "16px" },
  });
});

test("solid splitProps accepts html propKeys", () => {
  const component = cv({ variants: { size: { sm: "sm", md: "md" } } });
  expect(component.html.propKeys).toEqual(["class", "style", "size"]);

  interface Props
    extends ComponentProps<"button">, VariantProps<typeof component> {}
  const props: Props = { class: "custom", size: "md", id: "my-button" };

  const [variantProps, rest] = splitSolidProps(props, component.html.propKeys);
  expect(variantProps).toEqual({ class: "custom", size: "md" });
  expect(rest).toEqual({ id: "my-button" });
});

test("solid splitProps accepts htmlObj propKeys", () => {
  const component = cv({ variants: { size: { sm: "sm", md: "md" } } });
  expect(component.htmlObj.propKeys).toEqual(["class", "style", "size"]);

  interface Props
    extends ComponentProps<"button">, VariantProps<typeof component> {}
  const props: Props = { class: "custom", size: "md", id: "my-button" };

  const [variantProps, rest] = splitSolidProps(
    props,
    component.htmlObj.propKeys,
  );
  expect(variantProps).toEqual({ class: "custom", size: "md" });
  expect(rest).toEqual({ id: "my-button" });
});
