---
"clava": patch
---

Improved runtime performance of [`cv`](https://clava.style/docs/reference/cv) and [`splitProps`](https://clava.style/docs/reference/split-props)

Variant tables, disabled-variant sets, and extended-component metadata are now pre-built once when [`cv`](https://clava.style/docs/reference/cv) is called, so prop resolution no longer walks `Object.entries` or normalizes styles on each render. [`splitProps`](https://clava.style/docs/reference/split-props) reuses component key arrays directly instead of copying them per call.

Per-render benchmarks improve roughly 2× to 7×, with no public API or behavior changes; component-creation cost is unchanged.
