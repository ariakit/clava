# clava

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
