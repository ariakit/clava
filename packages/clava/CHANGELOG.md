# clava

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
