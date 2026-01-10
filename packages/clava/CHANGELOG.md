# clava

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
