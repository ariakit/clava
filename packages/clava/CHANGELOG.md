# clava

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
  computed: ({ variants, addClass }) => {
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
  refine: ({ variants, addClass }) => {
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
