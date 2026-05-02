---
"clava": patch
---

Fixed `computed`'s `ctx.variants` leaking foreign variant keys when extended

When the same `cv` was used as an `extend` by a parent component that defined additional variant keys, the `computed` callback's `ctx.variants` could include those parent-only keys. It is now filtered to the component's own `variantKeys`, matching the public `VariantValues<V>` contract — both during render and during the `setDefaultVariants` pass that backs `getVariants`.
