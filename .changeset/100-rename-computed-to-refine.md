---
"clava": minor
---

Renamed `computed` to `refine`

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
