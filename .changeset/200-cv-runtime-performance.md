---
"clava": patch
---

Improved runtime performance of [`cv`](https://clava.style/docs/reference/cv) and [`splitProps`](https://clava.style/docs/reference/split-props)

Variant tables, disabled-variant sets, and extended-component metadata are now pre-built once when [`cv`](https://clava.style/docs/reference/cv) is called, so prop resolution no longer walks `Object.entries` or normalizes styles on each render. [`splitProps`](https://clava.style/docs/reference/split-props) reuses component key arrays directly instead of copying them per call.

Render-path benchmarks improve between roughly 2× and 7×, with no public API or behavior changes.
