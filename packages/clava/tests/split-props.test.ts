import { describe, expect, expectTypeOf, test } from "vitest";
import { cv, splitProps } from "../src/index.ts";
import {
  CONFIGS,
  type HTMLProperties,
  createCVFromConfig,
  getClassPropertyName,
  getConfigDescription,
  getConfigMode,
  getModeComponent,
} from "./_utils.ts";

for (const config of Object.values(CONFIGS)) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);

  describe(getConfigDescription(config), () => {
    test("splitProps separates variant props", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> = {
        id: "test",
        size: "lg",
        style: { color: "red" },
        [classNameProp]: "extra",
      };
      const [variantProps, otherProps] = splitProps(props, component);
      expectTypeOf(variantProps).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(variantProps).toEqual({
        size: "lg",
        style: { color: "red" },
        [classNameProp]: "extra",
      });
      expect(otherProps).toEqual({ id: "test" });
    });

    test("variantKeys splitProps", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> = {
        size: "lg",
        id: "test",
        style: "color: red;",
        [classNameProp]: "extra",
      };
      const [variantProps, otherProps] = splitProps(
        props,
        component.variantKeys,
      );
      expectTypeOf(variantProps).branded.toEqualTypeOf<{
        size?: "sm" | "lg";
      }>();
      expectTypeOf(otherProps).toEqualTypeOf<
        Pick<typeof props, "id" | "style" | "class" | "className">
      >();
      expect(variantProps).toEqual({ size: "lg" });
      expect(otherProps).toEqual({
        id: "test",
        style: "color: red;",
        [classNameProp]: "extra",
      });
    });

    test("splitProps does not include defaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" }, color: { red: "red" } },
          defaultVariants: { size: "sm", color: "red" },
        }),
      );
      const props: HTMLProperties<typeof component> = {
        id: "test",
        size: "lg",
      };
      const [variantProps, otherProps] = splitProps(props, component);
      expectTypeOf(variantProps).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "color" | "style" | "class" | "className">
      >();
      expect(variantProps).toEqual({
        size: "lg",
      });
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with key array as second parameter", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> & { disabled?: boolean } = {
        id: "test",
        size: "lg",
        style: { color: "red" },
        [classNameProp]: "extra",
        disabled: true,
      };
      const [variantProps, extraProps, otherProps] = splitProps(
        props,
        component,
        ["disabled"],
      );
      expectTypeOf(variantProps).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      expect(variantProps).toEqual({
        size: "lg",
        style: { color: "red" },
        [classNameProp]: "extra",
      });
      expectTypeOf(extraProps).branded.toEqualTypeOf<{ disabled?: boolean }>();
      expect(extraProps).toEqual({ disabled: true });
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with another component as parameter", () => {
      const component1 = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const component2 = getModeComponent(
        mode,
        cv({
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { color: "red" },
        }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> = {
        id: "test",
        size: "lg",
        color: "blue",
        [classNameProp]: "extra",
      };
      const [comp1Props, comp2Props, otherProps] = splitProps(
        props,
        component1,
        component2,
      );
      expectTypeOf(comp1Props).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      // First component gets class/style props
      expect(comp1Props).toEqual({
        size: "lg",
        [classNameProp]: "extra",
      });
      // Second component only gets variant props (no class/style)
      expectTypeOf(comp2Props).branded.toEqualTypeOf<
        Pick<typeof props, "color">
      >();
      expect(comp2Props).toEqual({
        color: "blue",
      });
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with component parameter does not include component defaults", () => {
      const component1 = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const component2 = getModeComponent(
        mode,
        cv({
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { color: "red" },
        }),
      );
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> = {
        id: "test",
        size: "lg",
      };
      const [comp1Props, comp2Props, otherProps] = splitProps(
        props,
        component1,
        component2,
      );
      // First component gets variant props
      expect(comp1Props).toEqual({ size: "lg" });
      // Second component gets empty object (no defaults applied)
      expect(comp2Props).toEqual({});
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps second component excludes class and style", () => {
      const component1 = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const component2 = getModeComponent(
        mode,
        cv({ variants: { color: { red: "red", blue: "blue" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> = {
        id: "test",
        size: "lg",
        color: "blue",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      };
      const [comp1Props, comp2Props, otherProps] = splitProps(
        props,
        component1,
        component2,
      );
      expectTypeOf(comp1Props).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      // First component gets class/style
      expect(comp1Props).toEqual({
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      });
      // Second component only gets variant props
      expectTypeOf(comp2Props).branded.toEqualTypeOf<{
        color?: "red" | "blue";
      }>();
      expect(comp2Props).toEqual({ color: "blue" });
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with multiple parameters", () => {
      const component1 = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const component2 = getModeComponent(
        mode,
        cv({ variants: { color: { red: "red", blue: "blue" } } }),
      );
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> & { disabled?: boolean } = {
        id: "test",
        size: "lg",
        color: "blue",
        disabled: true,
      };
      const [comp1Props, extraProps, comp2Props, otherProps] = splitProps(
        props,
        component1,
        ["disabled"],
        component2,
      );
      expectTypeOf(comp1Props).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      expectTypeOf(extraProps).branded.toEqualTypeOf<{ disabled?: boolean }>();
      expectTypeOf(comp2Props).branded.toEqualTypeOf<{
        color?: "red" | "blue";
      }>();
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(comp1Props).toEqual({ size: "lg" });
      expect(extraProps).toEqual({ disabled: true });
      expect(comp2Props).toEqual({ color: "blue" });
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with shared keys between components", () => {
      const component1 = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const component2 = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> = {
        id: "test",
        size: "lg",
      };
      const [comp1Props, comp2Props, otherProps] = splitProps(
        props,
        component1,
        component2,
      );
      expectTypeOf(comp1Props).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      // First component gets class/style + size
      expect(comp1Props).toEqual({ size: "lg" });
      // Second component only gets variant props (size appears in both)
      expectTypeOf(comp2Props).branded.toEqualTypeOf<{
        size?: "sm" | "lg";
      }>();
      expect(comp2Props).toEqual({ size: "lg" });
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with defaultVariants from multiple components does not include defaults", () => {
      const component1 = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const component2 = getModeComponent(
        mode,
        cv({
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { color: "red" },
        }),
      );
      const [comp1Props, comp2Props, otherProps] = splitProps(
        { id: "test" },
        component1,
        component2,
      );
      // Neither gets defaults - only props that are actually in the input
      expectTypeOf(comp1Props).branded.toEqualTypeOf<{ size?: "sm" | "lg" }>();
      expect(comp1Props).toEqual({});
      expectTypeOf(comp2Props).branded.toEqualTypeOf<{
        color?: "red" | "blue";
      }>();
      expect(comp2Props).toEqual({});
      expectTypeOf(otherProps).toEqualTypeOf<{ id: string }>();
      expect(otherProps).toEqual({ id: "test" });
    });

    test("variantKeys splitProps does not include defaultVariants", () => {
      const component = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" }, color: { red: "red" } },
          defaultVariants: { size: "sm", color: "red" },
        }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> = {
        id: "test",
        size: "lg",
        [classNameProp]: "extra",
      };
      const [variantProps, otherProps] = splitProps(
        props,
        component.variantKeys,
      );
      // variantKeys is just an array, so no defaults are applied
      expect(variantProps).toEqual({
        size: "lg",
      });
      // color is in variantKeys but not in props, so it's not in either result
      expect(otherProps).toEqual({ id: "test", [classNameProp]: "extra" });
    });

    test("variantKeys splitProps with key array", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> & { disabled?: boolean } = {
        id: "test",
        size: "lg",
        [classNameProp]: "extra",
        disabled: true,
      };
      const [variantProps, extraProps, otherProps] = splitProps(
        props,
        component.variantKeys,
        ["disabled"],
      );
      expectTypeOf(variantProps).branded.toEqualTypeOf<{
        size?: "sm" | "lg";
      }>();
      expect(variantProps).toEqual({ size: "lg" });
      expectTypeOf(extraProps).branded.toEqualTypeOf<{ disabled?: boolean }>();
      expect(extraProps).toEqual({ disabled: true });
      expectTypeOf(otherProps).toEqualTypeOf<
        Pick<typeof props, "id" | "class" | "className" | "style">
      >();
      expect(otherProps).toEqual({ id: "test", [classNameProp]: "extra" });
    });

    test("variantKeys splitProps with component", () => {
      const component1 = getModeComponent(
        mode,
        cv({
          variants: { size: { sm: "sm", lg: "lg" } },
          defaultVariants: { size: "sm" },
        }),
      );
      const component2 = getModeComponent(
        mode,
        cv({
          variants: { color: { red: "red", blue: "blue" } },
          defaultVariants: { color: "red" },
        }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> = {
        id: "test",
        size: "lg",
        color: "blue",
        [classNameProp]: "extra",
      };
      const [comp1Props, comp2Props, otherProps] = splitProps(
        props,
        component1.variantKeys,
        component2.variantKeys,
      );
      expectTypeOf(comp1Props).branded.toEqualTypeOf<{ size?: "sm" | "lg" }>();
      expect(comp1Props).toEqual({ size: "lg" });
      expectTypeOf(comp2Props).branded.toEqualTypeOf<{
        color?: "red" | "blue";
      }>();
      expect(comp2Props).toEqual({ color: "blue" });
      expectTypeOf(otherProps).toEqualTypeOf<
        Pick<typeof props, "id" | "class" | "className" | "style">
      >();
      expect(otherProps).toEqual({ id: "test", [classNameProp]: "extra" });
    });

    test("splitProps with array containing class before component", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> = {
        id: "test",
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      };
      // Array gets class, component still gets class/style (arrays don't claim styling)
      const [arrayProps, compProps, otherProps] = splitProps(
        props,
        [classNameProp],
        component,
      );
      expectTypeOf(arrayProps).branded.toEqualTypeOf<
        Pick<typeof props, "class" | "className">
      >();
      expect(arrayProps).toEqual({ [classNameProp]: "extra" });
      // Component still gets class/style since arrays don't claim them
      expectTypeOf(compProps).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      expect(compProps).toEqual({
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      });
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with array containing class and style before component", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> = {
        id: "test",
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      };
      // Array gets class and style, component still gets class/style (arrays don't claim styling)
      const [arrayProps, compProps, otherProps] = splitProps(
        props,
        [classNameProp, "style"],
        component,
      );
      expectTypeOf(arrayProps).branded.toEqualTypeOf<
        Pick<typeof props, "class" | "className" | "style">
      >();
      expect(arrayProps).toEqual({
        [classNameProp]: "extra",
        style: { backgroundColor: "yellow" },
      });
      // Component still gets class/style since arrays don't claim them
      expectTypeOf(compProps).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      expect(compProps).toEqual({
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      });
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps with array after component", () => {
      const component = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component> = {
        id: "test",
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      };
      // Component gets class/style first, array also gets them
      const [compProps, arrayProps, otherProps] = splitProps(props, component, [
        classNameProp,
        "style",
      ]);
      expectTypeOf(compProps).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      expect(compProps).toEqual({
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      });
      expectTypeOf(arrayProps).branded.toEqualTypeOf<
        Pick<typeof props, "class" | "className" | "style">
      >();
      expect(arrayProps).toEqual({
        [classNameProp]: "extra",
        style: { backgroundColor: "yellow" },
      });
      expectTypeOf(otherProps).toEqualTypeOf<{ id?: string }>();
      expect(otherProps).toEqual({ id: "test" });
    });

    test("splitProps array before multiple components", () => {
      const component1 = getModeComponent(
        mode,
        cv({ variants: { size: { sm: "sm", lg: "lg" } } }),
      );
      const component2 = getModeComponent(
        mode,
        cv({ variants: { color: { red: "red", blue: "blue" } } }),
      );
      const classNameProp = getClassPropertyName(config);
      const props: HTMLProperties<typeof component1> &
        HTMLProperties<typeof component2> & { disabled?: boolean } = {
        id: "test",
        size: "lg",
        color: "blue",
        disabled: true,
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      };
      // Array doesn't claim styling, so first component (comp1) gets styling
      const [disabledProps, comp1Props, comp2Props, otherProps] = splitProps(
        props,
        ["disabled"],
        component1,
        component2,
      );
      expectTypeOf(disabledProps).branded.toEqualTypeOf<{
        disabled?: boolean;
      }>();
      expect(disabledProps).toEqual({ disabled: true });
      expectTypeOf(comp1Props).branded.toEqualTypeOf<
        Pick<typeof props, "size" | "style" | "class" | "className">
      >();
      // First component gets class/style
      expect(comp1Props).toEqual({
        size: "lg",
        style: { backgroundColor: "yellow" },
        [classNameProp]: "extra",
      });
      // Second component only gets variant props
      expectTypeOf(comp2Props).branded.toEqualTypeOf<
        Pick<typeof props, "color">
      >();
      expect(comp2Props).toEqual({ color: "blue" });
      expect(otherProps).toEqual({ id: "test" });
    });
  });
}

test.each([
  [
    "missing getVariants",
    {
      propKeys: ["size"],
      variantKeys: ["size"],
    },
  ],
  [
    "non-callable getVariants",
    {
      getVariants: true,
      propKeys: ["size"],
      variantKeys: ["size"],
    },
  ],
  [
    "non-array propKeys",
    {
      getVariants: () => ({}),
      propKeys: null,
      variantKeys: ["size"],
    },
  ],
] as const)(
  "splitProps ignores malformed component-like sources: %s",
  (_, malformedSource) => {
    const props = { id: "test", size: "lg" };

    const [sourceProps, otherProps] = splitProps(
      props,
      // @ts-expect-error malformed source
      malformedSource,
    );
    expect(sourceProps).toEqual({});
    expect(otherProps).toEqual(props);
  },
);

test("splitProps ignores sources with malformed variantKeys", () => {
  const component = cv({ variants: { size: { sm: "sm", lg: "lg" } } });
  const props = { id: "test", size: "lg", color: "red" };
  const malformedSource = {
    getVariants: () => ({}),
    propKeys: ["color"],
    variantKeys: null,
  };

  const result = splitProps(
    props,
    component,
    // @ts-expect-error malformed source
    malformedSource,
  ) as unknown[];
  expect(result).toEqual([{ size: "lg" }, {}, { id: "test", color: "red" }]);
});

test("splitProps type rejects non-string component source keys", () => {
  const props = { size: "lg" };
  const symbolKey = Symbol("size");

  const [sourceProps, otherProps] = splitProps(props, {
    getVariants: () => ({}),
    // @ts-expect-error component source keys must be strings
    propKeys: [symbolKey],
    // @ts-expect-error component source keys must be strings
    variantKeys: [1],
  });
  expect(sourceProps).toEqual({});
  expect(otherProps).toEqual(props);
});
