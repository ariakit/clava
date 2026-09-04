---
"clava": patch
---

Improved runtime performance of re-running the `refine` chain

Per-render benchmarks improve about 15% to 17% for a component whose [`refine`](https://clava.style/docs/reference/refine) callback or computed `defaultVariants` entry changes a variant, and the [`getVariants()`](https://clava.style/docs/reference/getVariants) benchmark for such a component improves about 93%, measured on the unbundled `dist` under Node. The minified bundle is 0.3% smaller. There are no public API changes and no change to supported behavior.

When a callback changes a variant, Clava re-runs the chain until the variants stop changing, and each extra pass cost far more than the work it repeated. Two things caused that. A development-only check read `process.env.NODE_ENV` on every pass that changed a variant, which in Node is an environment lookup rather than a property load. Separately, the record tracking a callback's assignments was seeded with a full copy of the resolved variants. The check now runs only as a chain approaches its iteration limit, and the record holds only the keys that changed.

A bundler that replaces `process.env.NODE_ENV` already removes that check from both versions, so a bundled application gains only from the record change, which applies where a [`refine`](https://clava.style/docs/reference/refine) callback calls `setVariants`.
