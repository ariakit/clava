---
"clava": patch
---

Improved runtime performance of the `refine` chain

Per-render benchmarks improve roughly 15% to 20% for a component that extends nothing and whose [`refine`](https://clava.style/docs/reference/refine) callback does not change variants. A component that does more work per render gains a smaller share of that improvement. The minified bundle is 2.2% smaller. There are no public API or behavior changes.

Resolving a component whose chain contains [`refine`](https://clava.style/docs/reference/refine) or a computed `defaultVariants` entry allocated the bookkeeping for a variant change on every call, even when no callback changed one. Each piece of that bookkeeping is now created only when something reads it: the record of assigned variants when a callback assigns one, and the copy of your props when a computed default reads them.
