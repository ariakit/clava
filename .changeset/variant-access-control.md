---
"clava": patch
---

Added access control for variants and variant values with `public`, `protected`,
and `private` levels.

Added support for `access` in variant definitions and style-class variant value
objects.

Enforced access restrictions for external variant props and APIs, while keeping
private/protected variants applied when set internally.

Added tests for protected/private behavior, extending access rules, and invalid
usage.
