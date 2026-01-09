import type { ComponentProps, JSX } from "solid-js";
import { expect, expectTypeOf, test } from "vitest";
import { create, splitProps, type VariantProps } from "./index.ts";
import { type HTMLObjProps } from "./types.ts";

const { cv } = create({ defaultMode: "htmlObj" });

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

test("component props", () => {
  const component = cv({
    style: { fontSize: "16px" },
    variants: { size: { sm: "sm", md: "md" } },
  });
  const props = component({ size: "sm", className: "custom" });
  expectTypeOf(props).toEqualTypeOf<HTMLObjProps>();
  expect(props).toEqual({
    class: "sm custom",
    style: { "font-size": "16px" },
  });
});
