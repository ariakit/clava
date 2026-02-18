---
"clava": patch
---

Reduced runtime overhead in `cv` hot paths by avoiding repeated key-array allocations when merging style objects and when propagating override metadata to extended components. This keeps behavior the same while reducing per-call work in frequently executed code paths, especially for components with many style merges or multiple `extend` entries.
