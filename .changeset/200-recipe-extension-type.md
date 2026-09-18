---
"clava": patch
---

Recipe extension constraints

The new [`ExtensionOf`](https://clava.style/docs/reference/extension-of) type lets a generic component accept a base recipe and its compatible extensions. Variant props and key arrays keep their exact types, so component code can use them without casts.

```ts
import { type ExtensionOf, type VariantProps, cv } from "clava";

const disclosure = cv({ variants: { $open: "open" } });

type DisclosureProps<
  R extends ExtensionOf<typeof disclosure, R> = typeof disclosure,
> = VariantProps<R> &
  ([R] extends [typeof disclosure] ? { recipe?: R } : { recipe: R });
```

The check follows full recipes in extension tuples. Mode helpers do not retain their ancestry type. Existing variants must preserve the base recipe's input and output types, and structurally identical recipes cannot be distinguished.
