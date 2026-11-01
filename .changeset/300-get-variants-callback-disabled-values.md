---
"clava": patch
---

Fixed [`getVariants`](https://clava.style/docs/reference/getVariants) returning a value that an extended recipe disables with `null` when a computed default or [`refine`](https://clava.style/docs/reference/refine) callback sets that value after the extended recipe runs. Render already removes this value, even when a later recipe declares it again.
