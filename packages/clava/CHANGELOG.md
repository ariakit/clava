# clava

## 0.7.1

### Union recipes accept only shared variants

[`VariantPropsWithRecipe`](https://clava.style/docs/reference/variant-props-with-recipe) now rejects a variant that only some members of a recipe union define. Before, a component could receive `recipe` as a union and a variant that the selected member does not define. That member then ignored the variant at runtime, and `splitProps` forwarded it to the element.

If you pass a union-typed recipe together with a variant that only some members define, narrow the recipe first so the variant belongs to a member that defines it:

```tsx
// Error: `disclosure` does not define `$placement`.
<Disclosure recipe={isNav ? navDisclosure : disclosure} $placement="top" />;

// Narrow the recipe before passing the variant.
const element = isNav ? (
  <Disclosure recipe={navDisclosure} $placement="top" />
) : (
  <Disclosure recipe={disclosure} />
);
```

## 0.7.0

### Renamed Clava components to recipes

**BREAKING** if you import the [`CVComponent`](https://clava.style/docs/reference/cv) type. Replace it with [`Recipe`](https://clava.style/docs/reference/cv). The type parameters and generated class and style props stay the same.

Before:

```ts
import type { CVComponent } from "clava";

type Button = CVComponent<{ size: { sm: string; lg: string } }>;
```

After:

```ts
import type { Recipe } from "clava";

type Button = Recipe<{ size: { sm: string; lg: string } }>;
```

Use [`cv()`](https://clava.style/docs/reference/cv) to create a recipe. Documentation and development warnings now use the recipe name.

### Structural recipe compatibility

The new [`RecipeLike`](https://clava.style/docs/reference/recipe-like) type lets a generic component accept structurally compatible recipes. Each recipe must supply every base variant with compatible input and output types. Added variants preserve their exact prop and key types.

```ts
import { type RecipeLike, type VariantPropsWithRecipe, cv } from "clava";

const disclosure = cv({ variants: { $open: "open" } });

type DisclosureProps<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
> = VariantPropsWithRecipe<typeof disclosure, R>;
```

Recipes can be defined independently or through extension. Extra metadata and extension ancestry do not affect compatibility.

### Variant props with a configurable recipe prop

Use [`VariantPropsWithRecipe`](https://clava.style/docs/reference/variant-props-with-recipe) to combine a recipe's variant props with a recipe prop. The prop is optional when the selected recipe type is assignable to the base type and required when it adds variants. The third type argument selects the prop name and defaults to `"recipe"`.

```ts
type DisclosureProps<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
> = VariantPropsWithRecipe<typeof disclosure, R>;

type StyledDisclosureProps<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
> = VariantPropsWithRecipe<typeof disclosure, R, "styles">;
```

Pass the selected recipe at runtime to apply its classes and styles. Choosing its type alone does not provide the recipe to the component.

## 0.6.4

- Fixed shared components in [`cv`](https://clava.style/docs/reference/cv) extension chains to apply only at their first occurrence, preventing repeated base classes and variant output when several components extend the same base.

## 0.6.3

### Improved runtime performance of the `refine` chain

Per-render benchmarks improve roughly 15% to 20% for a component that extends nothing and whose [`refine`](https://clava.style/docs/reference/refine) callback does not change variants. A component that does more work per render gains a smaller share of that improvement. The minified bundle is 2.2% smaller. There are no public API or behavior changes.

Resolving a component whose chain contains [`refine`](https://clava.style/docs/reference/refine) or a computed `defaultVariants` entry allocated the bookkeeping for a variant change on every call, even when no callback changed one. Each piece of that bookkeeping is now created only when something reads it: the record of assigned variants when a callback assigns one, and the copy of your props when a computed default reads them.

### Improved runtime performance of re-running the `refine` chain

Per-render benchmarks improve roughly 15% to 20% for a component whose [`refine`](https://clava.style/docs/reference/refine) callback or computed `defaultVariants` entry changes a variant, and the [`getVariants()`](https://clava.style/docs/reference/getVariants) benchmark for such a component is roughly twice as fast, measured on the unbundled `dist` under Node. The minified bundle is 0.3% smaller. There are no public API changes and no change to supported behavior.

When a callback changes a variant, Clava re-runs the chain until the variants stop changing, and each extra pass cost far more than the work it repeated. Two things caused that. A development-only check read `process.env.NODE_ENV` on every pass that changed a variant, which in Node is an environment lookup rather than a property load. Separately, the record tracking a callback's assignments was seeded with a full copy of the resolved variants. The check now runs only as a chain approaches its iteration limit, and the record holds only the keys that changed.

A bundler that replaces `process.env.NODE_ENV` already removes that check from both versions, so a bundled application gains only from the record change, which applies where a [`refine`](https://clava.style/docs/reference/refine) callback calls `setVariants`.

### Ignored inherited property values in variants, props, and configuration

[`cv`](https://clava.style/docs/reference/cv) and [`create`](https://clava.style/docs/reference/create) no longer take a class, a style, a variant value, or a configuration setting from a key inherited from `Object.prototype`.

A variant named after an `Object.prototype` member, such as `constructor` or `toString`, now resolves like any other variant.

## 0.6.2

- Fixed `TS2590` and `TS2345` type errors when a framework style value, such as React's `CSSProperties` or Solid's `JSX.CSSProperties`, is passed to a [`cv`](https://clava.style/docs/reference/cv) component.

## 0.6.1

- Reduced the production bundle size and improved tree-shaking for standalone imports.
- Fixed [`getVariants`](https://clava.style/docs/reference/getVariants) to ignore input keys that are not declared variants.
- Limited the published package to runtime builds, source-condition files, and package documentation.
- Fixed Microsoft-prefixed CSS properties to round-trip between camelCase and hyphenated style formats.
- Fixed [`cv`](https://clava.style/docs/reference/cv) to preserve inherited variant types when extending `.jsx`, `.html`, or `.htmlObj` mode components.
- Fixed deep component extension chains to preserve stable refinement output without exhausting the convergence limit.
- Fixed [`splitProps`](https://clava.style/docs/reference/split-props) to ignore inherited property values.
- Fixed numeric style normalization to preserve unitless CSS and custom property values.

## 0.6.0

### Computed default variant parameters

**BREAKING** if you're using computed `defaultVariants` functions in [`cv`](https://clava.style/docs/reference/cv).

Computed `defaultVariants` functions now receive `defaultValue` and `variants` as separate parameters instead of a context object.

Before:

```ts
const button = cv({
  variants: {
    size: { sm: "sm", lg: "lg" },
    intent: { neutral: "neutral", brand: "brand" },
  },
  defaultVariants: {
    intent: ({ defaultValue, variants }) =>
      variants.size === "lg" ? "neutral" : defaultValue,
  },
});
```

After:

```ts
const button = cv({
  variants: {
    size: { sm: "sm", lg: "lg" },
    intent: { neutral: "neutral", brand: "brand" },
  },
  defaultVariants: {
    intent: (defaultValue, variants) =>
      variants.size === "lg" ? "neutral" : defaultValue,
  },
});
```

### Other updates

- Documented Clava's public TypeScript helper declarations with inline examples.

## 0.5.0

### Computed default variants

**BREAKING** if you're using `setDefaultVariants` in [`cv`](https://clava.style/docs/reference/cv) `refine` callbacks.

The `setDefaultVariants` function has been removed from `refine`. Define dependent defaults directly in `defaultVariants` by passing a function for the variant key. The function receives the current `defaultValue` for that key and the resolved `variants` snapshot.

Computed default variants run before `refine`, so `refine` callbacks now read computed default values during their first pass. If a variant value itself is a function, return that function from a computed default variant instead of passing it directly as a static default.

Before:

```ts
const button = cv({
  variants: {
    size: { sm: "sm", lg: "lg" },
    intent: { neutral: "neutral", brand: "brand" },
  },
  refine({ variants, setDefaultVariants }) {
    if (variants.size === "lg") {
      setDefaultVariants({ intent: "neutral" });
    }
  },
});
```

After:

```ts
const button = cv({
  variants: {
    size: { sm: "sm", lg: "lg" },
    intent: { neutral: "neutral", brand: "brand" },
  },
  defaultVariants: {
    intent: ({ defaultValue, variants }) =>
      variants.size === "lg" ? "neutral" : defaultValue,
  },
});
```

## 0.4.2

- Improved [`refine`](https://clava.style/docs/reference/refine) iteration warnings to show the latest changing variant values with a shorter component creation stack.
- Fixed [`setDefaultVariants`](https://clava.style/docs/reference/refine#setdefaultvariants) calls with stable values to avoid extra [`refine`](https://clava.style/docs/reference/refine) passes.

## 0.4.1

### Improved refine iteration warning with debugging context

When the [`refine`](https://clava.style/docs/reference/refine) iteration cap is hit, the development warning now lists the variant keys that did not stabilize and includes the stack trace of the [`cv`](https://clava.style/docs/reference/cv) call that defined the component. This makes it easier to find the offending component without searching through the codebase.

```txt
Clava: Maximum refine iterations exceeded. This can happen when a refine callback calls setVariants or setDefaultVariants, but one of the variants changes on every run.
Variant(s) that did not stabilize: size.
Component created at:
    at toolbarButton (src/components/toolbar.ts:42:18)
    ...
```

The frame is captured at component creation but formatted lazily, so component creation stays cheap unless the warning actually fires, and the capture is skipped entirely for components that cannot enter the refine loop. The whole warning is wrapped in a `process.env.NODE_ENV !== "production"` guard, so bundlers that inline that constant strip the warning machinery from production builds.

### Other updates

- Removed refine warning-only code from production bundles when bundlers statically replace `process.env.NODE_ENV`.

## 0.4.0

### Removed `computedVariants` in favor of function values in `variants`

**BREAKING** if you're using the `computedVariants` config option.

Define a function directly inside [`variants`](https://clava.style/docs/reference/cv#variants) — it now acts as a function variant. The function's parameter type defines the prop type and replaces any inherited variant for the same key.

Before:

```ts
const grid = cv({
  variants: {
    color: { red: "text-red", blue: "text-blue" },
  },
  computedVariants: {
    columns: (value: number) => `grid-cols-${value}`,
  },
});
```

After:

```ts
const grid = cv({
  variants: {
    color: { red: "text-red", blue: "text-blue" },
    columns: (value: number) => `grid-cols-${value}`,
  },
});
```

### Renamed `computed` to `refine`

**BREAKING** if you use the `computed` config field on [`cv`](https://clava.style/docs/reference/cv).

The `computed` field previously collided with `computedVariants`, even though the two have very different semantics: `computedVariants` is a map of pure per-variant transformer functions, while `computed` is a single imperative callback that can mutate variants, set defaults, and emit class/style output across re-runs until variants stabilize. The new name `refine` describes that iterative refinement and removes the collision.

Rename the `computed` field to `refine`. The callback signature and context (`variants`, `setVariants`, `setDefaultVariants`, `addClass`, `addStyle`) are unchanged.

Before:

```ts
const button = cv({
  variants: { size: { sm: "sm", lg: "lg" } },
  computed({ variants, addClass }) {
    if (variants.size === "lg") {
      addClass("is-large");
    }
  },
});
```

After:

```ts
const button = cv({
  variants: { size: { sm: "sm", lg: "lg" } },
  refine({ variants, addClass }) {
    if (variants.size === "lg") {
      addClass("is-large");
    }
  },
});
```

## 0.3.0

### Removed `keys`

**BREAKING** if you're reading `keys` from [`cv`](https://clava.style/docs/reference/cv) components.

Use `propKeys` instead. `propKeys` is now the only API for style props plus variant props and has accurate HTML and HTML object types for libraries such as Solid's `splitProps`.

Before:

```ts
button.keys;
```

After:

```ts
button.propKeys;
```

### Re-run `cv` computed callbacks when they change variants

This makes later reads in the same component chain, including [`getVariants()`](https://clava.style/docs/reference/getVariants) and extended components, use the latest values. Re-runs are capped at 50 iterations, after which Clava stops and logs a development warning.

## 0.2.4

- Fixed [`cv`](https://clava.style/docs/reference/cv) variant props inferred from array class values to use boolean shorthand props.

## 0.2.3

### Improved runtime performance of `extend` chains and `getVariants` in `cv`

Extending components no longer round-trips through the public component (`clsx` join → regex split to recover variant classes) — extends now contribute classes and styles directly via an internal compute path, avoiding intermediate string parsing and array allocations on every render.

Per-render benchmarks improve roughly 2.5× for extended components and 2.7× for `getVariants`, with no public API changes.

### Fixed `computed`'s `ctx.variants` leaking foreign variant keys when extended

When the same `cv` was used as an `extend` by a parent component that defined additional variant keys, the `computed` callback's `ctx.variants` could include those parent-only keys. It is now filtered to the component's own `variantKeys`, matching the public `VariantValues<V>` contract — both during render and during the `setDefaultVariants` pass that backs `getVariants`.

### Fixed non-idempotent `transformClass` compounding across `extend` chains

A non-idempotent `transformClass` (e.g. one that prefixes every class word) was applied multiple times to base classes contributed by extended components — once per level in the extend chain. It now runs exactly once per render, so prefixing transforms no longer compound across `extend`. The fix also covers cross-factory extends: when a component from one `create()` factory is extended by a component from another, the extend's transform applies to its own contribution before the parent's transform runs on the joined string.

## 0.2.2

- Improved runtime prop resolution, style normalization, and [`splitProps`](https://clava.style/docs/reference/split-props) performance.

## 0.2.1

### Improved runtime performance of `cv` and `splitProps`

Variant tables, disabled-variant sets, and extended-component metadata are now pre-built once when [`cv`](https://clava.style/docs/reference/cv) is called, so prop resolution no longer walks `Object.entries` and variant-related styles are pre-normalized at creation time instead of on each render. [`splitProps`](https://clava.style/docs/reference/split-props) reuses component key arrays directly instead of copying them per call.

Per-render benchmarks improve roughly 2× to 7×, with no public API or behavior changes; component-creation cost is unchanged.

## 0.2.0

### Minor Changes

- 2d99317: Removed the `defaultMode` option from `create()` and changed the default callable Clava component result to return normalized `{ class, style }` props.

  Calling a component directly now always returns Clava's definition-compatible shape, with camelCase style keys. Use `.jsx`, `.html`, or `.htmlObj` when a framework- or renderer-specific prop shape is needed.

  Before:

  ```ts
  const { cv } = create({ defaultMode: "htmlObj" });
  const button = cv({ style: { fontSize: "16px" } });

  button();
  // { class: "", style: { "font-size": "16px" } }
  ```

  After:

  ```ts
  const { cv } = create();
  const button = cv({ style: { fontSize: "16px" } });

  button();
  // { class: "", style: { fontSize: "16px" } }

  button.htmlObj();
  // { class: "", style: { "font-size": "16px" } }
  ```

## 0.1.19

### Patch Changes

- b349c39: Fixed TypeScript Go to Definition and Rename Symbol for variant props on Clava components.

  The exported component prop types now preserve the original variant property symbols while still reading their allowed values from the fully merged variant definitions. This keeps editor navigation pointing back to the local `variants` object without regressing inherited variant merging or `null`-based disabling.

## 0.1.18

### Patch Changes

- f1aefb1: Preserved `clsx` and `csstype` as external imports in the published Clava build instead of bundling them into `dist`.

## 0.1.17

### Patch Changes

- c2f1fa9: Added support for disabling inherited variants and variant values with `null`.

  ```ts
  const base = cv({
    variants: { size: { sm: "sm", lg: "lg" } },
    defaultVariants: { size: "sm" },
  });

  const button = cv({
    extend: [base],
    variants: { size: { sm: null } },
  });

  button({ size: "lg" }); // ✅
  button({ size: "sm" }); // ❌ TypeScript error
  ```

  Disabled variants and values are excluded from `defaultVariants`, resolved variant props, and applied classes/styles.

- a8cc18c: Added `Variant<T, K>` utility type for cross-component variant key constraints.
- 4e54d51: Required an explicit `style` key for object-based variant/computed outputs.
- 7e32a54: Reduced runtime overhead in `cv` hot paths.

  This avoids repeated key-array allocations when merging style objects and when propagating override metadata to extended components. Behavior remains the same while reducing per-call work in frequently executed code paths, especially for components with many style merges or multiple `extend` entries.

## 0.1.16

### Patch Changes

- 6c7704c: The `component.getVariants(props)` method now returns variants set by the `computed` function.

## 0.1.15

### Patch Changes

- c15884d: Added `addClass` and `addStyle` methods to the `computed` parameters.

## 0.1.14

### Patch Changes

- fee9f84: Fixed `computed` method not receiving default variants set by an intermediate component.

## 0.1.13

### Patch Changes

- 5955334: Fixed `computed` method receiving updated variants when extending multiple levels of components.

## 0.1.12

### Patch Changes

- e4da426: Fixed `computed` method receiving variant values with internal symbol.

## 0.1.11

### Patch Changes

- dfd5a3a: Variants that accept `false` as a value now work when the value is undefined.

## 0.1.10

### Patch Changes

- 28f8155: Fixed default variants passed to `computed` method when extending multiple levels of components.

## 0.1.9

### Patch Changes

- f1654df: Fixed `computed` not receiving default variants from child components.

## 0.1.8

### Patch Changes

- fd89999: Fixed `computed` not receiving component updated props.

## 0.1.7

### Patch Changes

- 9a232c0: Fixed computed default variants not overriding static default variants from child components.

## 0.1.6

### Patch Changes

- b62c04b: To guarantee consistency, `splitProps` does not assign default variants anymore.

## 0.1.5

### Patch Changes

- 6dd40e9: Fixed `undefined` props overriding default variant values.

## 0.1.4

### Patch Changes

- 6d821f2: Updated component props to support `null` as `class`, `className`, and `style` values.

## 0.1.3

### Patch Changes

- 87b7934: Exported internal types to fix TS errors on consumer code.

## 0.1.2

### Patch Changes

- e7a2ebe: Removed `onlyVariants` property in favor of `variantKeys`.

## 0.1.1

### Patch Changes

- c06f0ec: Fixed `context.setDefaultVariants()` not overriding `defaultVariants`.

## 0.1.0

### Minor Changes

- 2c1acd9: Removed `splitProps` property. It's now a separate exported function.

## 0.0.2

### Patch Changes

- 30403a3: Initial implementation.
