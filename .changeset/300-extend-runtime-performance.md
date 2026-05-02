---
"clava": patch
---

Improved runtime performance of `extend` chains and `getVariants` in `cv`

Extending components no longer round-trips through the public component (`clsx` join → regex split to recover variant classes) — extends now contribute classes and styles directly via an internal compute path, avoiding intermediate string parsing and array allocations on every render.

Per-render benchmarks improve roughly 2.5× for extended components and 2.7× for `getVariants`, with no public API changes.
