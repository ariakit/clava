import type { CSSProperties, ComponentProps } from "react";
import { expect, expectTypeOf, test } from "vitest";
import { type VariantProps, cv, splitProps } from "./index.ts";
import type { JSXProps } from "./types.ts";

test("splitProps", () => {
  const component = cv({ variants: { size: { sm: "sm", md: "md" } } });

  interface Props
    extends ComponentProps<"div">, VariantProps<typeof component> {}
  const props: Props = { className: "custom", size: "md", id: "my-div" };

  const [variantProps, rest] = splitProps(props, component);
  expectTypeOf(variantProps.style).toEqualTypeOf<CSSProperties | undefined>();
  expectTypeOf(variantProps.className).toEqualTypeOf<string | undefined>();
  expect(variantProps.className).toBe("custom");
  expect(variantProps).toEqual({ size: "md", className: "custom" });
  expect(
    // @ts-expect-error
    rest.className,
  ).toBeUndefined();
  expect(
    // @ts-expect-error
    rest.style,
  ).toBeUndefined();
  expect(rest).toEqual({ id: "my-div" });
});

test("component props", () => {
  const component = cv({
    style: { fontSize: "16px" },
    variants: { size: { sm: "sm", md: "md" } },
  });
  const props = component({ size: "sm", className: "custom" });
  expectTypeOf(props).toEqualTypeOf<JSXProps>();
  expect(props).toEqual({
    className: "sm custom",
    style: { fontSize: "16px" },
  });
});
