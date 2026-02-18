---
"clava": patch
---

Reduced runtime overhead in `cv` hot paths.

This avoids repeated key-array allocations when merging style objects and when propagating override metadata to extended components. Behavior remains the same while reducing per-call work in frequently executed code paths, especially for components with many style merges or multiple `extend` entries.
