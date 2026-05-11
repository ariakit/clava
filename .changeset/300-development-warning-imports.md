---
"clava": patch
---

Strip computed-warning code from production bundles.

Moved development-only warning dispatch behind a conditional package import so
production bundles can omit the computed warning code.
