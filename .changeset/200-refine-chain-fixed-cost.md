---
"clava": patch
---

Improved runtime performance of the `refine` chain

Per-render benchmarks improve roughly 18% to 19% for components whose [`refine`](https://clava.style/docs/reference/refine) callback does not change variants, and 13% for extended components with function variants. The minified bundle is 2.2% smaller. There are no public API or behavior changes.

Resolving a component whose chain contains [`refine`](https://clava.style/docs/reference/refine) or a computed `defaultVariants` entry allocated the bookkeeping for a variant change on every call, even when no callback changed one. Each piece of that bookkeeping is now created only when something reads it: the record of assigned variants when a callback assigns one, and the copy of your props when a computed default reads them.
