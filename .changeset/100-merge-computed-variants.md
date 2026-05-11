---
"clava": minor
---

Removed `computedVariants` in favor of function values in `variants`

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
