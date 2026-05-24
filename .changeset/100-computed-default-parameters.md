---
"clava": minor
---

Computed default variant parameters

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
