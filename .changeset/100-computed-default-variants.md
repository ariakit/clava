---
"clava": minor
---

Computed default variants

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
  refine: ({ variants, setDefaultVariants }) => {
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
