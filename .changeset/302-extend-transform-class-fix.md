---
"clava": patch
---

Fixed non-idempotent `transformClass` compounding across `extend` chains

A non-idempotent `transformClass` (e.g. one that prefixes every class word) was applied multiple times to base classes contributed by extended components — once per level in the extend chain. It now runs exactly once per render, so prefixing transforms no longer compound across `extend`. The fix also covers cross-factory extends: when a component from one `create()` factory is extended by a component from another, the extend's transform applies to its own contribution before the parent's transform runs on the joined string.
