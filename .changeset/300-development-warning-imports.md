---
"clava": patch
---

Strip computed-warning code from production bundles.

Moved computed warning dispatch behind a conditional package import. Default
resolution uses a no-op so production bundles can omit the warning code, while
source and development conditions keep the warning available. The warning
helper also dedupes by active `console.warn` function and message text, so
repeated misbehaving renders log once.
