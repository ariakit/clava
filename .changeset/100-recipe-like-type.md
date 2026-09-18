---
"clava": minor
---

Structural recipe compatibility

**BREAKING** if you use [`ExtensionOf`](https://clava.style/docs/reference/extension-of). Replace it with [`RecipeLike`](https://clava.style/docs/reference/recipe-like).

Before:

```ts
type DisclosureProps<
  R extends ExtensionOf<typeof disclosure, R> = typeof disclosure,
> = VariantProps<R> & { recipe: R };
```

After:

```ts
type DisclosureProps<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
> = VariantProps<R> & { recipe: R };
```

The new constraint accepts independently defined recipes as well as extensions. Each recipe must supply every base variant with compatible input and output types. Added variants preserve their exact prop and key types. Extra metadata and extension ancestry do not affect compatibility.
