---
"clava": patch
---

Fixed a type error when calling [`cv`](https://clava.style/docs/reference/cv) inline inside `extend`, such as `cv({ extend: [cv({ variants })] })`.
