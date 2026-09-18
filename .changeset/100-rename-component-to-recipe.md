---
"clava": minor
---

Renamed Clava components to recipes

**BREAKING** if you import the [`CVComponent`](https://clava.style/docs/reference/cv) type. Replace it with [`Recipe`](https://clava.style/docs/reference/cv). The type parameters and generated class and style props stay the same.

Before:

```ts
import type { CVComponent } from "clava";

type Button = CVComponent<{ size: { sm: string; lg: string } }>;
```

After:

```ts
import type { Recipe } from "clava";

type Button = Recipe<{ size: { sm: string; lg: string } }>;
```

Use [`cv()`](https://clava.style/docs/reference/cv) to create a recipe. Documentation and development warnings now use the recipe name.
