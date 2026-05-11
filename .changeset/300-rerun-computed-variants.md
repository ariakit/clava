---
"clava": patch
---

Re-run `cv` computed callbacks when they change variants

This makes later reads in the same component chain, including [`getVariants()`](https://clava.style/docs/reference/getVariants) and extended components, use the latest values. Re-runs are capped at 50 iterations, after which Clava stops and logs a development warning.
