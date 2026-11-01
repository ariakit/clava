---
"clava": patch
---

Computed defaults read settled values in extension chains

A computed `defaultVariants` entry that returns `defaultValue` in a base recipe no longer hides the value that an extending [`cv`](https://clava.style/docs/reference/cv) recipe computes for the same variant. Other computed defaults and [`refine`](https://clava.style/docs/reference/refine) callbacks in the chain used to read the base value, so a recipe could settle on output that contradicted its own variants. They now read the value that the chain settles on.

As a result, some chains now reach the re-run limit and log its warning in development. This happens when computed defaults contradict each other, which used to settle without a warning. It also happens when two computed defaults in one recipe change each other's input on every run, as they already did when the base default was static.
