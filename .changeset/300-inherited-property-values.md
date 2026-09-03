---
"clava": patch
---

Ignored inherited property values in variants, props, and configuration

[`cv`](https://clava.style/docs/reference/cv) and [`create`](https://clava.style/docs/reference/create) no longer take a class, a style, a variant value, or a configuration setting from a key inherited from `Object.prototype`.

A variant named after an `Object.prototype` member, such as `constructor` or `toString`, now resolves like any other variant.
