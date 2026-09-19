---
"clava": patch
---

Structural recipe compatibility

The new [`RecipeLike`](https://clava.style/docs/reference/recipe-like) type lets a generic component accept structurally compatible recipes. Each recipe must supply every base variant with compatible input and output types. Added variants preserve their exact prop and key types.

```ts
import { type RecipeLike, type VariantPropsWithRecipe, cv } from "clava";

const disclosure = cv({ variants: { $open: "open" } });

type DisclosureProps<
  R extends RecipeLike<typeof disclosure, R> = typeof disclosure,
> = VariantPropsWithRecipe<typeof disclosure, R>;
```

Recipes can be defined independently or through extension. Extra metadata and extension ancestry do not affect compatibility.
