---
"clava": patch
---

Fixed two long-standing bugs around `extend` chains in `cv`

A non-idempotent `transformClass` (e.g. one that prefixes every class word) was applied multiple times to base classes contributed by extended components — once per level in the extend chain. It now runs exactly once per render, so prefixing transforms no longer compound across `extend`.

Separately, the `computed` callback's `ctx.variants` could include foreign variant keys when the same `cv` was used as an `extend` by a parent component that defined additional variant keys. It is now filtered to the component's own `variantKeys`, matching the public `VariantValues<V>` contract — both during render and during the `setDefaultVariants` pass that backs `getVariants`.
