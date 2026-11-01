---
"clava": patch
---

Fixed [`cv`](https://clava.style/docs/reference/cv) dropping a variant or value that a recipe defines again after a recipe it extends disabled it with `null`. The new definition now applies, and [`getVariants`](https://clava.style/docs/reference/getVariants) reports the value.
