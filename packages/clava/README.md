# Clava

Type-safe class and style variants for framework components. Clava turns variant props into class/style prop objects, works with any class naming system, and keeps the generated API easy for TypeScript and editors to understand.

Clava is an ESM package. Import from the package root:

```ts
import { cv, cx, create, splitProps } from "clava";
import type { Variant, VariantProps } from "clava";
```

## Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [Output Modes](#output-modes)
- [Classes And Styles](#classes-and-styles)
- [Variants](#variants)
- [Function Variants](#function-variants)
- [Extending Recipes](#extending-recipes)
- [Refine](#refine)
- [Splitting Props](#splitting-props)
- [React](#react)
- [Solid](#solid)
- [`create()` And `cx()`](#create-and-cx)
- [Type Helpers](#type-helpers)
- [Comparison](#comparison)
- [API Summary](#api-summary)

## Install

```sh
pnpm add clava
```

```sh
npm install clava
```

```sh
yarn add clava
```

## Quick Start

Use `cv()` to create a callable style recipe. The default callable recipe returns normalized `{ class, style }` props.

```ts
import { cv } from "clava";

const button = cv({
  class: "button",
  style: { borderRadius: "6px" },
  variants: {
    size: {
      sm: "button-sm",
      lg: { class: "button-lg", style: { fontSize: "16px" } },
    },
    intent: {
      primary: "button-primary",
      danger: "button-danger",
    },
    disabled: {
      true: "button-disabled",
      false: "",
    },
    fluid: "button-fluid",
  },
  defaultVariants: {
    size: "sm",
    intent: "primary",
  },
});

button({ size: "lg", disabled: true, fluid: true, className: "mt-2" });
// {
//   class: "button button-lg button-primary button-disabled button-fluid mt-2",
//   style: { borderRadius: "6px", fontSize: "16px" },
// }
```

Variant prop types are inferred from the `variants`, `defaultVariants`, and `extend` configuration. Invalid variant keys and values are TypeScript errors and are ignored at runtime.

Input props may use `class` or `className` in any output mode. Both are appended to the generated class string.

## Output Modes

Every Clava recipe has four output modes:

```ts
const label = cv({
  class: "label",
  style: { fontSize: "14px", "--accent": "red" },
});

label();
// { class: "label", style: { fontSize: "14px", "--accent": "red" } }

label.jsx();
// { className: "label", style: { fontSize: "14px", "--accent": "red" } }

label.html();
// { class: "label", style: "font-size: 14px; --accent: red;" }

label.htmlObj();
// { class: "label", style: { "font-size": "14px", "--accent": "red" } }
```

Use the default callable recipe when you want Clava's own normalized shape. Use `.jsx()` for React-style `className` props, `.html()` when you need an HTML style string, and `.htmlObj()` when you need hyphenated CSS property names.

Each mode also exposes helpers:

```ts
button.class({ size: "lg" });
// "button button-lg button-primary"

button.style({ size: "lg" });
// { borderRadius: "6px", fontSize: "16px" }

button.getVariants({ size: "lg" });
// { disabled: false, size: "lg", intent: "primary" }

button.propKeys;
// ["class", "className", "style", "size", "intent", "disabled", "fluid"]

button.variantKeys;
// ["size", "intent", "disabled", "fluid"]
```

`propKeys` includes style props plus variant props for that mode. `variantKeys` includes only variant props.

## Classes And Styles

`class` values are passed through `clsx`, so strings, arrays, nested arrays, and falsy values work the same way they do in `clsx`.

```ts
const box = cv({
  class: ["box", ["rounded", false && "hidden"]],
});

box().class;
// "box rounded"
```

Config styles use camelCase CSS property names. CSS custom properties accept string or number values.

```ts
const card = cv({
  style: {
    paddingBlock: "8px",
    "--card-accent": "oklch(62% 0.2 250)",
    "--card-scale": 1.05,
  },
});
```

Style results from `variants` and `refine` must use an explicit `{ style }` wrapper. A raw object like `{ backgroundColor: "red" }` is not a style result by itself.

```ts
const chip = cv({
  variants: {
    tone: {
      info: {
        class: "chip-info",
        style: { color: "blue" },
      },
    },
  },
});
```

User `style` props can be JSX-style objects, HTML style strings, or hyphenated style objects. User styles are merged last, so they override generated style keys.

```ts
chip({
  tone: "info",
  style: "color: navy; margin-top: 4px;",
});
// { class: "chip-info", style: { color: "navy", marginTop: "4px" } }
```

## Variants

Object variants infer prop values from their keys. String keys named `"true"` and `"false"` become boolean props.

```ts
const badge = cv({
  variants: {
    tone: {
      neutral: "badge-neutral",
      success: "badge-success",
    },
    selected: {
      true: "badge-selected",
      false: "badge-unselected",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

badge({ tone: "success", selected: true }).class;
// "badge-success badge-selected"
```

A variant with a `"false"` branch implicitly defaults to `false` when no default is set. Passing `undefined` does not override a default variant.

```ts
badge().class;
// "badge-neutral badge-unselected"

badge({ tone: undefined }).class;
// "badge-neutral badge-unselected"
```

String and array shorthand variants are boolean variants that emit only when the prop is `true`.

```ts
const item = cv({
  variants: {
    active: "item-active",
    interactive: ["item-interactive", "focus-visible:ring"],
  },
});

item({ active: true, interactive: true }).class;
// "item-active item-interactive focus-visible:ring"
```

Variant values can be class values, arrays, `{ class, style }` objects, or [functions](#function-variants). Use `null` in an extending recipe to disable inherited variants or inherited variant values.

## Function Variants

Add a function as a variant value when the prop should generate class/style output dynamically. The function's parameter type defines the prop type. Method syntax works well for multi-line callbacks; compact one-line callbacks can stay as arrow-function property values.

When function variants emit Tailwind utilities, keep utility names static so Tailwind can detect them at build time. Pass dynamic CSS values through variables instead of building utilities like `` `grid-cols-${value}` ``.

```ts
const grid = cv({
  class: "grid",
  variants: {
    columns(value: number) {
      return {
        class: "grid-cols-(--grid-columns)",
        style: { "--grid-columns": `repeat(${value}, minmax(0, 1fr))` },
      };
    },
    color(value: string | null) {
      if (!value) return "text-current";
      return {
        class: "text-(--text-color)",
        style: { "--text-color": value },
      };
    },
  },
});

grid({ columns: 3, color: null });
// {
//   class: "grid grid-cols-(--grid-columns) text-current",
//   style: { "--grid-columns": "repeat(3, minmax(0, 1fr))" },
// }
```

Function variants can return any class value, `{ class, style }`, a default Clava recipe result, `null`, or `undefined`. A function variant with the same key as an extended variant replaces that inherited variant's prop type and output.

## Extending Recipes

Use `extend` to compose existing Clava recipes. Extended base classes are ordered before the child class, and extended variant output is applied before child variant output.

If a recipe appears through several `extend` paths, Clava applies it only at its first occurrence. Its classes, styles, defaults, and refinement participate through that path. For example, if `left` and `right` both extend `base`, `cv({ extend: [left, right] })` applies `base`, then `left`, then `right`. The recipe's JSX and HTML helpers share the same identity. Separate recipes can still emit identical classes.

Recipes created by older Clava versions retain their existing internal extension behavior. Shared ancestors inside those recipes can still repeat.

```ts
const baseButton = cv({
  class: "button",
  variants: {
    size: {
      sm: "button-sm",
      lg: "button-lg",
    },
    intent: {
      neutral: "button-neutral",
      brand: "button-brand",
    },
  },
  defaultVariants: {
    size: "sm",
    intent: "neutral",
  },
});

const iconButton = cv({
  extend: [baseButton],
  class: "icon-button",
  variants: {
    size: {
      sm: "icon-button-sm",
    },
    intent: {
      brand: null,
    },
  },
  defaultVariants: {
    size: "lg",
  },
});

iconButton({ size: "sm" }).class;
// "button icon-button button-sm button-neutral icon-button-sm"

iconButton({ intent: "brand" });
// TypeScript error: "brand" was disabled by the child recipe.
```

Set an inherited variant to `null` to remove it entirely:

```ts
const plainButton = cv({
  extend: [baseButton],
  variants: {
    intent: null,
  },
});
```

You can extend any recipe mode, including `baseButton.jsx`, `baseButton.html`, and `baseButton.htmlObj`.

### Constraining Recipe Props

Use `RecipeLike<Base, R>` to accept recipes that supply every base variant with compatible input and output types. A recipe can be defined independently, extend another recipe, or compose mode helpers. The constraint keeps the base variants readable inside a generic component and preserves the selected recipe's variant props, `variantKeys`, and `propKeys`, including the mode-specific key lists.

```tsx
import type { ComponentProps } from "react";
import {
  type RecipeLike,
  type VariantPropsWithRecipe,
  cv,
  splitProps,
} from "clava";

const disclosure = cv({ variants: { $open: "open" } });

type DisclosureProps<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
> = ComponentProps<"div"> & VariantPropsWithRecipe<typeof disclosure, R>;

function Disclosure<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
>(props: DisclosureProps<R>) {
  const { recipe = disclosure, ...rest } = props;
  const [variantProps, elementProps] = splitProps(rest, recipe);
  return <div {...elementProps} {...recipe.jsx(variantProps)} />;
}

const navDisclosure = cv({
  variants: {
    $open: "nav-open",
    $placement: { top: "top-0", bottom: "bottom-0" },
  },
});

<Disclosure recipe={navDisclosure} $placement="top" />;

type NavDisclosureProps = Omit<DisclosureProps<typeof navDisclosure>, "recipe">;
```

`VariantPropsWithRecipe` combines variant props with a `recipe` prop. The prop is optional when the selected type is assignable to the base type. Selecting a type that adds variants requires its recipe, so those variants can be processed at runtime. A wrapper can omit this prop from its public props if it supplies the selected recipe itself.

You can omit the optional prop. When `R` is inferred, passing `undefined` or forwarding an optional recipe can infer `undefined` as part of `R` and fail the recipe constraint. Resolve the optional value before forwarding it:

```tsx
function Panel({ recipe, ...props }: DisclosureProps) {
  return <Disclosure {...props} recipe={recipe ?? disclosure} />;
}
```

If a wrapper exposes added variants, use a fallback recipe that defines those variants.

The third type argument changes the prop name and defaults to `"recipe"`:

```ts
type StyledDisclosureProps<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
> = ComponentProps<"div"> &
  VariantPropsWithRecipe<typeof disclosure, R, "styles">;
```

The component must read `props.styles` when it uses this type. A type argument does not provide a runtime recipe. To apply different classes or styles, pass the desired recipe even if its variant types match the base. Recipe values are checked by structural assignability, so these helpers do not enforce recipe identity.

Inside generic code, the key arrays stay tied to `R`. You can read `recipe.variantKeys` and `recipe.propKeys` and use variant keys to index `VariantProps<R>` without a cast. The arrays remain properties, and a recipe with added variants is still not assignable to the base recipe's exact key-array type.

Existing variants must remain compatible with the base's inputs and resolved values. Adding a new value to an existing variant, disabling a base value, or changing its value type can fail this constraint. These recipes can still be created with `cv`; they cannot be passed where the base variant contract is required.

Compatibility depends on the recipe's shape, not its `extend` list or extra metadata. Each member of a recipe union must supply every base variant. Both the base and selected recipe must be full recipes with `jsx`, `html`, and `htmlObj` helpers, even when the component calls only one mode. A mode helper such as `disclosure.jsx` is rejected, but a recipe that extends a mode helper is accepted.

## Refine

Use computed `defaultVariants` for dependent defaults. A function entry receives the current default value for that key as the first parameter and the resolved variants snapshot as the second parameter, then returns the next default value.

Use `refine` for final variant overrides and class/style adjustments. It receives the resolved variant values for the recipe and can return class/style output.

```ts
const toolbarButton = cv({
  extend: [baseButton],
  variants: {
    pressed: {
      true: "toolbar-button-pressed",
      false: "",
    },
    loading: "toolbar-button-loading",
  },
  defaultVariants: {
    intent: (defaultValue, variants) =>
      variants.size === "lg" ? "neutral" : defaultValue,
  },
  refine({ variants, setVariants, addClass, addStyle }) {
    if (variants.loading) {
      setVariants({ pressed: false });
    }

    if (variants.pressed && variants.intent === "brand") {
      addClass("toolbar-button-brand-pressed");
      addStyle({ transform: "translateY(1px)" });
    }

    return variants.loading ? "is-loading" : null;
  },
});
```

Computed `defaultVariants` do not override a prop the user explicitly passed unless that prop value is `undefined`. Return `defaultValue` to preserve the inherited or static default value. Return `undefined` to clear the default value. If a variant's value is a function, return that function from a computed default:

```ts
const transform = (value: string) => value.toUpperCase();

const input = cv({
  variants: {
    transform: (fn: (value: string) => string) => fn("example"),
  },
  defaultVariants: {
    transform: () => transform,
  },
});
```

`setVariants()` overrides explicit props. `addClass()` and `addStyle()` append output without changing resolved variant values. `getVariants()` includes values changed by computed `defaultVariants` and `setVariants()`.

When a computed default or `refine` callback changes variants, Clava re-runs the refine chain so later reads see the latest values. Re-runs are capped at 50 iterations, after which Clava stops and logs a warning in development.

## Splitting Props

Use `splitProps()` to separate variant/style props from DOM or framework props without manually maintaining prop-name lists.

```tsx
import type { ComponentProps } from "react";
import { type VariantProps, cv, splitProps } from "clava";

const button = cv({
  class: "button",
  variants: {
    size: {
      sm: "button-sm",
      lg: "button-lg",
    },
  },
});

interface ButtonProps
  extends ComponentProps<"button">, VariantProps<typeof button> {}

function Button(props: ButtonProps) {
  const [variantProps, buttonProps] = splitProps(props, button);
  return <button {...buttonProps} {...button.jsx(variantProps)} />;
}
```

The first recipe source claims variant props plus the styling props exposed by that recipe's `propKeys`. The base recipe claims `class`, `className`, and `style`; mode-specific recipes claim their own styling props. Later recipe sources receive only their variant props. Array sources receive exactly the listed keys and do not claim styling props.

```ts
const [buttonProps, fieldProps, rest] = splitProps(props, button, field);
// buttonProps: button variants + class/style props
// fieldProps: field variants only
// rest: props not claimed by either recipe

const [dataProps, variantProps, otherProps] = splitProps(
  props,
  ["id", "data-testid"],
  button,
);
// dataProps: id and data-testid
// variantProps: button variants + class/style props
// otherProps: remaining props
```

`splitProps()` only moves props that are actually present in the input object. It does not inject `defaultVariants`; call `recipe.getVariants()` when you need resolved variant values.

## React

Use `.jsx` for React components because it returns `className` and a camelCase style object.

```tsx
import type { ComponentProps } from "react";
import { type VariantProps, cv, splitProps } from "clava";

const button = cv({
  class: "button",
  style: { fontSize: "16px" },
  variants: {
    size: {
      sm: "button-sm",
      md: "button-md",
    },
  },
});

interface ButtonProps
  extends ComponentProps<"button">, VariantProps<typeof button> {}

function Button(props: ButtonProps) {
  const [variantProps, buttonProps] = splitProps(props, button);
  return <button {...buttonProps} {...button.jsx(variantProps)} />;
}
```

## Solid

Use `.htmlObj` for Solid components when you want `class` and hyphenated style object output.

```tsx
import type { ComponentProps } from "solid-js";
import { type VariantProps, cv, splitProps } from "clava";

const button = cv({
  class: "button",
  style: { fontSize: "16px" },
  variants: {
    size: {
      sm: "button-sm",
      md: "button-md",
    },
  },
});

interface ButtonProps
  extends ComponentProps<"button">, VariantProps<typeof button> {}

function Button(props: ButtonProps) {
  const [variantProps, buttonProps] = splitProps(props, button);
  return <button {...buttonProps} {...button.htmlObj(variantProps)} />;
}
```

## `create()` And `cx()`

The package-level `cv` and `cx` behave like the helpers returned by `create()` with no class transform. Use `create({ transformClass })` when every generated class string should pass through a transform, such as a prefixer or CSS-module lookup.

```ts
import { create } from "clava";

const { cv, cx } = create({
  transformClass: (className) => {
    return className
      .split(" ")
      .filter(Boolean)
      .map((name) => `tw-${name}`)
      .join(" ");
  },
});

cx("px-2", ["font-bold", false && "hidden"]);
// "tw-px-2 tw-font-bold"

const title = cv({ class: "text-lg font-semibold" });
title().class;
// "tw-text-lg tw-font-semibold"
```

When a recipe created by one factory extends a recipe created by another factory, the extended recipe's transform is preserved for its own classes and the parent transform still runs on the final joined string.

## Type Helpers

Use `RecipeLike<typeof recipe, R>` to constrain a generic component's recipe prop to a structurally compatible recipe. Use `VariantPropsWithRecipe<typeof recipe, R>` to combine the selected recipe's variant props with its `recipe` prop, or pass a third type argument for a custom prop name. See [Constraining Recipe Props](#constraining-recipe-props).

Use `VariantProps<typeof recipe>` to add a Clava recipe's variant props to framework component props.

```ts
import type { ComponentProps } from "react";
import type { VariantProps } from "clava";

interface ButtonProps
  extends ComponentProps<"button">, VariantProps<typeof button> {}
```

Use `Variant<typeof recipe, "key">` to constrain a new variant map to the same values as another recipe's variant.

```ts
import { type Variant, cv } from "clava";

const button = cv({
  variants: {
    size: {
      sm: "button-sm",
      lg: "button-lg",
    },
  },
});

const icon = cv({
  extend: [button],
  variants: {
    size: {
      sm: "icon-sm",
      lg: "icon-lg",
    } satisfies Variant<typeof button, "size">,
  },
});
```

Use `Recipe` when you need an explicit type for a recipe:

```ts
import { type Recipe, cv } from "clava";

const button: Recipe<{ size: { sm: string; lg: string } }> = cv({
  variants: { size: { sm: "button-sm", lg: "button-lg" } },
});
```

The package also exports `ClassValue`, `StyleValue`, `StyleClassProps`, `StyleClassValue`, `JSXProps`, `HTMLProps`, `HTMLObjProps`, and `CVConfig`.

## Comparison

This table compares Clava with the packages used by the repository's alternative benchmark: `class-variance-authority@0.7.1`, `cva@1.0.0-beta.8`, `tailwind-variants/lite@3.3.1`, and `tailwind-variants@3.3.1`.

| Feature                                              | Clava          | CVA v0             | CVA v1 beta        | TV Lite            | TV                 |
| ---------------------------------------------------- | -------------- | ------------------ | ------------------ | ------------------ | ------------------ |
| Typed variants and default variants                  | Yes            | Yes                | Yes                | Yes                | Yes                |
| Boolean shorthand variants                           | Yes            | No                 | No                 | No                 | No                 |
| Recipe extension or composition                      | `extend`       | No helper          | `compose()`        | `extend`           | `extend`           |
| Cross-variant conditions                             | `refine()`     | `compoundVariants` | `compoundVariants` | `compoundVariants` | `compoundVariants` |
| Function variant values                              | Yes            | No                 | No                 | No                 | No                 |
| Computed default variants                            | Yes            | No                 | No                 | No                 | No                 |
| Class and style prop output                          | Yes            | Classes only       | Classes only       | Classes only       | Classes only       |
| JSX, HTML string, and hyphenated-object output modes | Yes            | No                 | No                 | No                 | No                 |
| Built-in prop splitting for framework props          | `splitProps()` | No                 | No                 | No                 | No                 |
| Dedicated slots API                                  | No             | No                 | No                 | Yes                | Yes                |
| Built-in Tailwind conflict merging                   | No             | No                 | No                 | No                 | Yes                |

Clava has no built-in Tailwind conflict merging. [`create({ transformClass })`](#create-and-cx) routes every generated class string through a merger such as `tailwind-merge` when you need one.

The `pnpm perf-alternatives` benchmark resolves a composed Tailwind-style button with inherited variants and defaults. It runs in two groups so each group compares equivalent work, since cross-variant conditions cost every library something different. On Node v24.18.0, Vitest reported these results, where higher ops/sec is better.

The first group composes three layers with no cross-variant conditions. `class-variance-authority` has no compose helper, so its build merges the three layers into a single config.

| Package                          |   Ops/sec | Relative to Clava |
| -------------------------------- | --------: | ----------------: |
| `clava@0.6.2`                    | 2,384,411 |             1.00x |
| `class-variance-authority@0.7.1` | 1,872,892 |      1.27x slower |
| `tailwind-variants@3.3.1`        | 1,312,965 |      1.82x slower |
| `tailwind-variants/lite@3.3.1`   | 1,308,798 |      1.82x slower |
| `cva@1.0.0-beta.8`               |   408,730 |      5.83x slower |

The second group adds the same cross-variant conditions at the interaction and product layers. Clava expresses them with `refine`, and every other library with `compoundVariants`.

| Package                          |   Ops/sec | Relative to Clava |
| -------------------------------- | --------: | ----------------: |
| `clava@0.6.2`                    | 1,335,204 |             1.00x |
| `tailwind-variants/lite@3.3.1`   |   568,960 |      2.35x slower |
| `tailwind-variants@3.3.1`        |   563,659 |      2.37x slower |
| `class-variance-authority@0.7.1` |   500,557 |      2.67x slower |
| `cva@1.0.0-beta.8`               |   313,641 |      4.26x slower |

Dividing one table by the other shows what each library charges for cross-variant conditions. `cva` charges the least at 1.30x, Clava sits at 1.79x, both `tailwind-variants` entry points are near 2.31x, and `class-variance-authority` charges the most at 3.74x. The exact ratios move by several percent between runs, so read the ordering rather than the digits, and reach for the group that matches your recipes rather than reading either table as the whole picture.

Benchmark results vary by runtime and hardware, so treat them as a reproducible snapshot of this repository's composed-variant case rather than a universal ranking. Rows within a few percent of each other sit inside run-to-run noise, so their relative order is not meaningful. That covers the two `tailwind-variants` entry points, which land within a few percent in both groups and swap order between runs.

Both groups resolve one fixed prop set on every iteration, so every package with an internal cache serves repeated calls from cache after warmup. Both `tailwind-variants` entry points cache the resolved result by variant props. Clava, `cva`, and `class-variance-authority` have no such cache, so those rows recompute on every iteration.

## API Summary

`cv(config?)` creates a typed Clava recipe. Supported config keys are `extend`, `class`, `style`, `variants`, `defaultVariants`, and `refine`.

`recipe(props?)` returns `{ class, style }` with normalized camelCase style keys.

`recipe.jsx(props?)` returns `{ className, style }`.

`recipe.html(props?)` returns `{ class, style }`, where `style` is a CSS string.

`recipe.htmlObj(props?)` returns `{ class, style }`, where `style` is a hyphenated CSS property object.

`recipe.class(props?)` returns only the resolved class string.

`recipe.style(props?)` returns only the resolved style value for that recipe mode.

`recipe.getVariants(props?)` returns resolved variant values after static defaults, inherited defaults, computed defaults, and `refine` updates.

`recipe.propKeys` lists style props plus variant props for that recipe mode.

`recipe.variantKeys` lists only variant prop keys.

`RecipeLike<Base, R>` constrains `R` to a structurally compatible recipe while preserving variant props and key arrays in generic components. See [Constraining Recipe Props](#constraining-recipe-props).

`VariantPropsWithRecipe<Base, R, Name = "recipe">` combines the selected recipe's variant props with a recipe prop. The prop is optional when `R` is assignable to `Base` and required otherwise. `Name` selects the prop name.

`splitProps(props, source1, ...sources)` returns one object per source plus a final rest object.

`cx(...classes)` joins class values with `clsx` and applies the factory's `transformClass`.

`create(options?)` returns isolated `{ cv, cx }` helpers. The only option is `transformClass?: (className: string) => string`.
