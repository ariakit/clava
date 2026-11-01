---
"clava": patch
---

Fixed [`getVariants`](https://clava.style/docs/reference/getVariants) returning variants that render doesn't apply when a recipe disables a value and has an extend without callbacks, in a chain with computed defaults or [`refine`](https://clava.style/docs/reference/refine).
